/**
 * GET /api/categories
 *
 * 返回所有品类及其 ASIN 列表，附带各品类最新告警计数。
 * 供 Sidebar 品类导航使用。
 */

import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const categories = await db.categoryMap.findMany({ orderBy: { categoryKey: "asc" } })

    const latestAlert = await db.alert.findFirst({
      orderBy: { snapshotDate: "desc" },
      select:  { snapshotDate: true },
    })

    const result = await Promise.all(categories.map(async (cat) => {
      let alertCount = 0
      if (latestAlert) {
        alertCount = await db.alert.count({
          where: { snapshotDate: latestAlert.snapshotDate, categoryKey: cat.categoryKey, level: "red" },
        })
      }
      return {
        categoryKey:  cat.categoryKey,
        displayName:  cat.displayName,
        asins:        JSON.parse(cat.asins) as string[],
        redAlerts:    alertCount,
      }
    }))

    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
