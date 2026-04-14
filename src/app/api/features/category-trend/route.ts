/**
 * GET /api/features/category-trend
 *
 * Returns daily GMV per category for last 7 days (stacked area chart).
 * Groups ProductMetricDay rows by date x category using CategoryMap.asins.
 */

import { NextResponse } from "next/server"
import { db } from "@/lib/db"

type MetricsRaw = {
  gmv: number
  orders: number
  units: number
  ad_spend: number
  ad_sales: number
  ad_orders: number
  impressions: number
  clicks: number
  sessions: number
}

function subtractDays(dateStr: string, n: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export async function GET() {
  try {
    // 1. Fetch all CategoryMap entries
    const categories = await db.categoryMap.findMany()
    if (categories.length === 0) {
      return NextResponse.json({ error: "品类数据未初始化" }, { status: 500 })
    }

    // 2. Get latest date, compute fromDate = latest - 6
    const latest = await db.productMetricDay.findFirst({
      orderBy: { date: "desc" },
      select: { date: true },
    })
    if (!latest) {
      return NextResponse.json({ error: "暂无产品数据" }, { status: 404 })
    }
    const fromDate = subtractDays(latest.date, 6)

    // 3. Query all rows in range
    const rows = await db.productMetricDay.findMany({
      where: { date: { gte: fromDate } },
    })

    // 4. Build ASIN -> categoryKey lookup
    const asinToCategory = new Map<string, string>()
    for (const cat of categories) {
      const asins = JSON.parse(cat.asins) as string[]
      for (const asin of asins) {
        asinToCategory.set(asin, cat.categoryKey)
      }
    }

    // 5. Group by date x category, sum GMV
    const dateMap = new Map<string, Record<string, number>>()
    for (const row of rows) {
      const m = JSON.parse(row.metrics) as MetricsRaw
      const catKey = asinToCategory.get(row.asin) ?? "other"
      const entry = dateMap.get(row.date) ?? {}
      entry[catKey] = (entry[catKey] ?? 0) + (m.gmv ?? 0)
      dateMap.set(row.date, entry)
    }

    // Sort by date and format
    const categoryKeys = categories.map((c) => c.categoryKey)
    const data = Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => {
        const point: Record<string, string | number> = {
          date: date.slice(5), // "04-06" format
        }
        for (const key of categoryKeys) {
          point[key] = Math.round(vals[key] ?? 0)
        }
        return point
      })

    const categoriesMeta = categories.map((c) => ({
      key: c.categoryKey,
      label: c.displayName,
    }))

    return NextResponse.json({ data, categories: categoriesMeta })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
