/**
 * GET /api/features/kpi?window=w7&categoryKey=mattress
 *
 * 返回指定品类、指定时间窗口的 KPI 聚合数据。
 * 包含品类汇总 + 各 ASIN 明细。
 *
 * Query params:
 *   window      — today | yesterday | w7 | w14 | d30  (default: w7)
 *   categoryKey — 品类 key（不传则返回全品类）
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { subtractDays } from "@/lib/date-utils"

type MetricsRaw = {
  gmv: number; orders: number; units: number
  ad_spend: number; ad_sales: number; ad_orders: number
  impressions: number; clicks: number; sessions: number
  ocr: number; refund_rate: number
}

type Totals = {
  gmv: number; orders: number; units: number
  ad_spend: number; ad_sales: number; ad_orders: number
  impressions: number; clicks: number; sessions: number
}

function emptyTotals(): Totals {
  return { gmv: 0, orders: 0, units: 0, ad_spend: 0, ad_sales: 0, ad_orders: 0, impressions: 0, clicks: 0, sessions: 0 }
}

function addMetrics(acc: Totals, m: MetricsRaw): Totals {
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
}

function derived(t: Totals) {
  return {
    acos:  t.ad_sales   > 0 ? +(t.ad_spend   / t.ad_sales).toFixed(4)   : null,
    tacos: t.gmv        > 0 ? +(t.ad_spend   / t.gmv).toFixed(4)        : null,
    ctr:   t.impressions > 0 ? +(t.clicks     / t.impressions).toFixed(5) : null,
    cvr:   t.clicks     > 0 ? +(t.ad_orders  / t.clicks).toFixed(4)     : null,
    cpc:   t.clicks     > 0 ? +(t.ad_spend   / t.clicks).toFixed(2)     : null,
    roas:  t.ad_spend   > 0 ? +(t.ad_sales   / t.ad_spend).toFixed(2)   : null,
  }
}


export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const window      = searchParams.get("window") ?? "w7"
    const categoryKey = searchParams.get("categoryKey") ?? null

    // Resolve ASIN filter
    let targetAsins: string[] | null = null
    if (categoryKey) {
      const cat = await db.categoryMap.findUnique({ where: { categoryKey } })
      if (!cat) return NextResponse.json({ error: `品类 "${categoryKey}" 不存在` }, { status: 404 })
      targetAsins = JSON.parse(cat.asins) as string[]
      if (targetAsins.length === 0) {
        return NextResponse.json({ total: emptyTotals(), derived: {}, byAsin: [], period: null })
      }
    }

    // Latest date in DB
    const latest = await db.productMetricDay.findFirst({
      orderBy: { date: "desc" },
      select:  { date: true },
    })
    if (!latest) {
      return NextResponse.json({ error: "暂无产品数据，请先上传产品报表" }, { status: 404 })
    }

    // Build date filter
    let dateFilter: { date: string } | { date: { gte: string } }
    let periodLabel: string

    if (window === "today" || window === "yesterday") {
      const distinctDates = await db.productMetricDay.findMany({
        distinct: ["date"],
        orderBy:  { date: "desc" },
        select:   { date: true },
        take:     2,
      })
      const offset = window === "yesterday" ? 1 : 0
      const targetDate = distinctDates[offset]?.date
      if (!targetDate) return NextResponse.json({ error: `无${window === "today" ? "今日" : "昨日"}数据` }, { status: 404 })
      dateFilter  = { date: targetDate }
      periodLabel = targetDate
    } else {
      const daysMap: Record<string, number> = { w7: 7, w14: 14, d30: 30 }
      const numDays = daysMap[window] ?? 7
      const fromDate = subtractDays(latest.date, numDays - 1)
      dateFilter  = { date: { gte: fromDate } }
      periodLabel = `${fromDate} ~ ${latest.date}`
    }

    // Fetch rows
    const where = targetAsins
      ? { ...dateFilter, asin: { in: targetAsins } }
      : dateFilter
    const rows = await db.productMetricDay.findMany({ where, orderBy: { date: "asc" } })

    // Aggregate per ASIN then total
    const asinMap = new Map<string, Totals>()
    for (const row of rows) {
      const m = JSON.parse(row.metrics) as MetricsRaw
      asinMap.set(row.asin, addMetrics(asinMap.get(row.asin) ?? emptyTotals(), m))
    }

    const byAsin = Array.from(asinMap.entries()).map(([asin, t]) => {
      // Get stage and config for this ASIN
      return { asin, ...t, ...derived(t) }
    })

    const totalTotals = byAsin.reduce<Totals>((acc, r) => ({
      gmv:         acc.gmv         + r.gmv,
      orders:      acc.orders      + r.orders,
      units:       acc.units       + r.units,
      ad_spend:    acc.ad_spend    + r.ad_spend,
      ad_sales:    acc.ad_sales    + r.ad_sales,
      ad_orders:   acc.ad_orders   + r.ad_orders,
      impressions: acc.impressions + r.impressions,
      clicks:      acc.clicks      + r.clicks,
      sessions:    acc.sessions    + r.sessions,
    }), emptyTotals())

    return NextResponse.json({
      period:  periodLabel,
      window,
      categoryKey: categoryKey ?? "all",
      total:  { ...totalTotals, ...derived(totalTotals) },
      byAsin,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
