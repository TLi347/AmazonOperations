/**
 * GET /api/features/overview
 *
 * 全局总览：每个品类的近7天 KPI 汇总 + 告警计数。
 * 供 OverviewPanel 使用。
 */

import { NextResponse } from "next/server"
import { db } from "@/lib/db"

type Totals = {
  gmv: number; orders: number; units: number
  ad_spend: number; ad_sales: number; ad_orders: number
  impressions: number; clicks: number; sessions: number
}

type MetricsRaw = Totals & { ocr: number; refund_rate: number }

function emptyTotals(): Totals {
  return { gmv: 0, orders: 0, units: 0, ad_spend: 0, ad_sales: 0, ad_orders: 0, impressions: 0, clicks: 0, sessions: 0 }
}

function derived(t: Totals) {
  return {
    acos:  t.ad_sales   > 0 ? +(t.ad_spend / t.ad_sales).toFixed(4)   : null,
    tacos: t.gmv        > 0 ? +(t.ad_spend / t.gmv).toFixed(4)        : null,
    ctr:   t.impressions > 0 ? +(t.clicks   / t.impressions).toFixed(5) : null,
    roas:  t.ad_spend   > 0 ? +(t.ad_sales / t.ad_spend).toFixed(2)   : null,
  }
}

function subtractDays(dateStr: string, n: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export async function GET() {
  try {
    const categories = await db.categoryMap.findMany()
    if (categories.length === 0) {
      return NextResponse.json({ error: "品类数据未初始化，请运行 prisma db seed" }, { status: 500 })
    }

    // Latest date in ProductMetricDay
    const latestRow = await db.productMetricDay.findFirst({
      orderBy: { date: "desc" },
      select:  { date: true },
    })

    // Latest alert snapshot
    const latestAlert = await db.alert.findFirst({
      orderBy: { snapshotDate: "desc" },
      select:  { snapshotDate: true },
    })

    // Per-category summary
    const summary = await Promise.all(categories.map(async (cat) => {
      const catAsins = JSON.parse(cat.asins) as string[]

      // W7 KPIs
      let kpi: Totals & ReturnType<typeof derived> & { dayCount: number } = {
        ...emptyTotals(), ...derived(emptyTotals()), dayCount: 0
      }

      if (latestRow && catAsins.length > 0) {
        const fromDate = subtractDays(latestRow.date, 6)
        const rows = await db.productMetricDay.findMany({
          where: { asin: { in: catAsins }, date: { gte: fromDate } },
        })
        if (rows.length > 0) {
          const totals = rows.reduce<Totals>((acc, row) => {
            const m = JSON.parse(row.metrics) as MetricsRaw
            return {
              gmv:         acc.gmv         + (m.gmv         ?? 0),
              orders:      acc.orders      + (m.orders      ?? 0),
              units:       acc.units       + (m.units       ?? 0),
              ad_spend:    acc.ad_spend    + (m.ad_spend    ?? 0),
              ad_sales:    acc.ad_sales    + (m.ad_sales    ?? 0),
              ad_orders:   acc.ad_orders   + (m.ad_orders   ?? 0),
              impressions: acc.impressions + (m.impressions ?? 0),
              clicks:      acc.clicks      + (m.clicks      ?? 0),
              sessions:    acc.sessions    + (m.sessions    ?? 0),
            }
          }, emptyTotals())
          kpi = { ...totals, ...derived(totals), dayCount: rows.length }
        }
      }

      // Alert counts
      let alertRed = 0
      let alertYellow = 0
      if (latestAlert) {
        const [red, yellow] = await Promise.all([
          db.alert.count({ where: { snapshotDate: latestAlert.snapshotDate, categoryKey: cat.categoryKey, level: "red" } }),
          db.alert.count({ where: { snapshotDate: latestAlert.snapshotDate, categoryKey: cat.categoryKey, level: "yellow" } }),
        ])
        alertRed    = red
        alertYellow = yellow
      }

      return {
        categoryKey:  cat.categoryKey,
        displayName:  cat.displayName,
        asins:        catAsins,
        kpi,
        alerts: { red: alertRed, yellow: alertYellow },
        snapshotDate: latestAlert?.snapshotDate ?? null,
      }
    }))

    // Grand total
    const grandTotals = summary.reduce<Totals>((acc, cat) => ({
      gmv:         acc.gmv         + cat.kpi.gmv,
      orders:      acc.orders      + cat.kpi.orders,
      units:       acc.units       + cat.kpi.units,
      ad_spend:    acc.ad_spend    + cat.kpi.ad_spend,
      ad_sales:    acc.ad_sales    + cat.kpi.ad_sales,
      ad_orders:   acc.ad_orders   + cat.kpi.ad_orders,
      impressions: acc.impressions + cat.kpi.impressions,
      clicks:      acc.clicks      + cat.kpi.clicks,
      sessions:    acc.sessions    + cat.kpi.sessions,
    }), emptyTotals())

    return NextResponse.json({
      period:      latestRow ? `近7天 (截至 ${latestRow.date})` : "暂无数据",
      categories:  summary,
      grandTotal:  { ...grandTotals, ...derived(grandTotals) },
      alertsTotal: {
        red:    summary.reduce((s, c) => s + c.alerts.red, 0),
        yellow: summary.reduce((s, c) => s + c.alerts.yellow, 0),
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
