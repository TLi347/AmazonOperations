/**
 * GET /api/features/funnel?categoryKey=mattress&window=w7
 *
 * Returns funnel data: impressions -> clicks -> ad_orders -> orders
 * Also returns per-ASIN breakdown for comparison.
 *
 * Query params:
 *   window      -- today | yesterday | w7 | w14 | d30  (default: w7)
 *   categoryKey -- category key (omit for all categories)
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { subtractDays } from "@/lib/date-utils"

type MetricsRaw = {
  gmv: number; orders: number; units: number
  ad_spend: number; ad_sales: number; ad_orders: number
  impressions: number; clicks: number; sessions: number
}

type FunnelTotals = {
  impressions: number
  clicks: number
  ad_orders: number
  orders: number
}

function emptyFunnelTotals(): FunnelTotals {
  return { impressions: 0, clicks: 0, ad_orders: 0, orders: 0 }
}

function addFunnelMetrics(acc: FunnelTotals, m: MetricsRaw): FunnelTotals {
  return {
    impressions: acc.impressions + (m.impressions ?? 0),
    clicks:      acc.clicks      + (m.clicks      ?? 0),
    ad_orders:   acc.ad_orders   + (m.ad_orders   ?? 0),
    orders:      acc.orders      + (m.orders      ?? 0),
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
      if (!cat) return NextResponse.json({ error: `category "${categoryKey}" not found` }, { status: 404 })
      targetAsins = JSON.parse(cat.asins) as string[]
      if (targetAsins.length === 0) {
        return NextResponse.json({ funnel: [], byAsin: [], period: null })
      }
    }

    // Latest date in DB
    const latest = await db.productMetricDay.findFirst({
      orderBy: { date: "desc" },
      select:  { date: true },
    })
    if (!latest) {
      return NextResponse.json({ error: "no data" }, { status: 404 })
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
      if (!targetDate) return NextResponse.json({ error: "no data for window" }, { status: 404 })
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

    // Aggregate per ASIN
    const asinMap = new Map<string, FunnelTotals>()
    for (const row of rows) {
      const m = JSON.parse(row.metrics) as MetricsRaw
      asinMap.set(row.asin, addFunnelMetrics(asinMap.get(row.asin) ?? emptyFunnelTotals(), m))
    }

    // Grand totals
    const total = emptyFunnelTotals()
    for (const t of asinMap.values()) {
      total.impressions += t.impressions
      total.clicks      += t.clicks
      total.ad_orders   += t.ad_orders
      total.orders      += t.orders
    }

    // Build funnel stages
    const funnel = [
      { stage: "曝光", value: total.impressions, rate: null },
      {
        stage: "点击",
        value: total.clicks,
        rate: total.impressions > 0 ? +(total.clicks / total.impressions).toFixed(5) : null,
      },
      {
        stage: "广告订单",
        value: total.ad_orders,
        rate: total.clicks > 0 ? +(total.ad_orders / total.clicks).toFixed(4) : null,
      },
      {
        stage: "总订单",
        value: total.orders,
        rate: total.ad_orders > 0 ? +(total.orders / total.ad_orders).toFixed(4) : null,
      },
    ]

    // Per-ASIN breakdown sorted by impressions descending
    const byAsin = Array.from(asinMap.entries())
      .map(([asin, t]) => ({
        asin,
        impressions: t.impressions,
        clicks:      t.clicks,
        ad_orders:   t.ad_orders,
        orders:      t.orders,
      }))
      .sort((a, b) => b.impressions - a.impressions)

    return NextResponse.json({ period: periodLabel, funnel, byAsin })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
