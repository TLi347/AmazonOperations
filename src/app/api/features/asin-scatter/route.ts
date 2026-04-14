/**
 * GET /api/features/asin-scatter?categoryKey=mattress
 *
 * Returns per-ASIN efficiency scatter data (last 7 days aggregate):
 *   gmv, acos (ratio), adSpend
 *
 * Data source: ProductMetricDay (last 7 days)
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

type MetricsRaw = {
  gmv: number
  ad_spend: number
  ad_sales: number
  [key: string]: unknown
}

function subtractDays(dateStr: string, n: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const categoryKey = searchParams.get("categoryKey") ?? null

    // Resolve ASIN filter
    let targetAsins: string[] | null = null
    if (categoryKey) {
      const cat = await db.categoryMap.findUnique({ where: { categoryKey } })
      if (!cat)
        return NextResponse.json(
          { error: `category "${categoryKey}" not found` },
          { status: 404 }
        )
      targetAsins = JSON.parse(cat.asins) as string[]
      if (targetAsins.length === 0) {
        return NextResponse.json({ data: [] })
      }
    }

    // Latest date in DB
    const latest = await db.productMetricDay.findFirst({
      orderBy: { date: "desc" },
      select: { date: true },
    })
    if (!latest) {
      return NextResponse.json(
        { error: "no product metrics data" },
        { status: 404 }
      )
    }

    const fromDate = subtractDays(latest.date, 6)
    const asinFilter = targetAsins ? { in: targetAsins } : undefined
    const rows = await db.productMetricDay.findMany({
      where: {
        date: { gte: fromDate },
        ...(asinFilter ? { asin: asinFilter } : {}),
      },
      orderBy: { date: "asc" },
    })

    // Aggregate per ASIN
    const asinMap = new Map<
      string,
      { gmv: number; adSpend: number; adSales: number }
    >()
    for (const row of rows) {
      const m = JSON.parse(row.metrics) as MetricsRaw
      const existing = asinMap.get(row.asin)
      if (existing) {
        existing.gmv += m.gmv ?? 0
        existing.adSpend += m.ad_spend ?? 0
        existing.adSales += m.ad_sales ?? 0
      } else {
        asinMap.set(row.asin, {
          gmv: m.gmv ?? 0,
          adSpend: m.ad_spend ?? 0,
          adSales: m.ad_sales ?? 0,
        })
      }
    }

    const data = Array.from(asinMap.entries())
      .map(([asin, t]) => ({
        asin,
        gmv: Math.round(t.gmv),
        acos: t.adSales > 0 ? +(t.adSpend / t.adSales).toFixed(3) : 0,
        adSpend: Math.round(t.adSpend),
      }))
      .sort((a, b) => b.gmv - a.gmv)

    return NextResponse.json({ data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
