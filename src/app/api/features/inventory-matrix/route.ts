/**
 * GET /api/features/inventory-matrix?categoryKey=mattress
 *
 * Returns inventory health matrix data: each ASIN with dailyAvg, daysOfSupply,
 * sellableQty, and quadrant classification.
 *
 * Data sources:
 *   - ContextFile (fileType="inventory") -> sellable qty per ASIN
 *   - ProductMetricDay (last 7 days) -> daily average orders per ASIN
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

interface InventoryRow {
  asin: string
  sku: string
  availableQty: number
  [key: string]: unknown
}

type MetricsRaw = {
  orders: number
  [key: string]: unknown
}

function subtractDays(dateStr: string, n: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

type Quadrant = "critical" | "warning" | "healthy" | "stale" | "observe"

function classifyQuadrant(
  daysOfSupply: number,
  dailyAvg: number,
  medianDailyAvg: number
): Quadrant {
  const highVelocity = dailyAvg >= medianDailyAvg

  if (daysOfSupply > 90 && !highVelocity) return "stale"
  if (daysOfSupply > 45) return "healthy"
  if (daysOfSupply > 30) return "warning"
  if (daysOfSupply <= 30 && highVelocity) return "critical"
  return "observe"
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
    }

    // --- 1. Get inventory data from ContextFile ---
    const file = await db.contextFile.findUnique({
      where: { fileType: "inventory" },
    })
    if (!file) {
      return NextResponse.json(
        { error: "inventory report not uploaded" },
        { status: 404 }
      )
    }

    const inventoryRows = JSON.parse(file.parsedRows) as InventoryRow[]

    // Build a map: asin -> sellableQty
    const inventoryMap = new Map<string, { sellableQty: number; label: string }>()
    for (const row of inventoryRows) {
      const asin = (row.asin ?? row.fnsku ?? "") as string
      if (!asin) continue
      if (targetAsins && !targetAsins.some((a) => asin.includes(a))) continue

      const sellableQty =
        (row.availableQty as number) ??
        (row.available_qty as number) ??
        (row.sellableQty as number) ??
        (row.sellable_qty as number) ??
        0
      const sku = (row.sku ?? "") as string

      // Accumulate if multiple SKUs per ASIN
      const existing = inventoryMap.get(asin)
      if (existing) {
        existing.sellableQty += sellableQty
      } else {
        inventoryMap.set(asin, { sellableQty, label: sku })
      }
    }

    // --- 2. Get sales data from ProductMetricDay (last 7 days) ---
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

    // Aggregate orders per ASIN
    const salesMap = new Map<string, { totalOrders: number; dayCount: number }>()
    const asinDates = new Map<string, Set<string>>()
    for (const row of rows) {
      const m = JSON.parse(row.metrics) as MetricsRaw
      const orders = m.orders ?? 0
      const existing = salesMap.get(row.asin)
      if (existing) {
        existing.totalOrders += orders
      } else {
        salesMap.set(row.asin, { totalOrders: orders, dayCount: 0 })
      }
      // Track unique dates per ASIN
      if (!asinDates.has(row.asin)) asinDates.set(row.asin, new Set())
      asinDates.get(row.asin)!.add(row.date)
    }
    // Set day counts
    for (const [asin, dates] of asinDates.entries()) {
      const entry = salesMap.get(asin)
      if (entry) entry.dayCount = dates.size
    }

    // Get displayName from AsinConfig
    const asinConfigs = await db.asinConfig.findMany()
    const configMap = new Map(asinConfigs.map((c) => [c.asin, c]))

    // --- 3. Build matrix data ---
    // Collect all ASINs from both inventory and sales
    const allAsins = new Set([...inventoryMap.keys(), ...salesMap.keys()])
    if (targetAsins) {
      for (const a of targetAsins) allAsins.add(a)
    }

    const items: Array<{
      asin: string
      label: string
      dailyAvg: number
      daysOfSupply: number
      sellableQty: number
      quadrant: Quadrant
    }> = []

    for (const asin of allAsins) {
      const inv = inventoryMap.get(asin)
      const sales = salesMap.get(asin)
      const config = configMap.get(asin)

      const sellableQty = inv?.sellableQty ?? 0
      const totalOrders = sales?.totalOrders ?? 0
      const dayCount = sales?.dayCount ?? 7
      const dailyAvg = dayCount > 0 ? totalOrders / dayCount : 0
      const daysOfSupply =
        dailyAvg > 0 ? Math.round(sellableQty / dailyAvg) : sellableQty > 0 ? 999 : 0
      const label = config?.displayName ?? inv?.label ?? asin.slice(-6)

      items.push({
        asin,
        label,
        dailyAvg: +dailyAvg.toFixed(1),
        daysOfSupply,
        sellableQty,
        quadrant: "healthy", // placeholder, classified below
      })
    }

    // Compute median daily avg for quadrant classification
    const dailyAvgs = items.map((i) => i.dailyAvg).sort((a, b) => a - b)
    const medianDailyAvg =
      dailyAvgs.length > 0
        ? dailyAvgs[Math.floor(dailyAvgs.length / 2)]
        : 0

    // Classify quadrants
    for (const item of items) {
      item.quadrant = classifyQuadrant(
        item.daysOfSupply,
        item.dailyAvg,
        medianDailyAvg
      )
    }

    return NextResponse.json({ data: items })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
