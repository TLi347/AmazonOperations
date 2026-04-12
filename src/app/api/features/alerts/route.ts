/**
 * GET /api/features/alerts?level=all&categoryKey=mattress
 *
 * 返回最新快照日期的告警列表。
 *
 * Query params:
 *   level       — all | red | yellow  (default: all)
 *   categoryKey — 品类 key（不传则全品类）
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const level       = searchParams.get("level") ?? "all"
    const categoryKey = searchParams.get("categoryKey") ?? null

    // Most recent snapshot
    const latest = await db.alert.findFirst({
      orderBy: { snapshotDate: "desc" },
      select:  { snapshotDate: true },
    })
    if (!latest) {
      return NextResponse.json({ alerts: [], snapshotDate: null })
    }

    const alerts = await db.alert.findMany({
      where: {
        snapshotDate: latest.snapshotDate,
        ...(level !== "all"  ? { level }         : {}),
        ...(categoryKey      ? { categoryKey }    : {}),
      },
      orderBy: [{ level: "asc" }, { metric: "asc" }],
    })

    return NextResponse.json({ alerts, snapshotDate: latest.snapshotDate })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
