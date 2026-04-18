/**
 * GET /api/features/sop?categoryKey=mattress
 *
 * 返回最新快照的 SOP 行动清单，按 priority 排序（P0 → P1 → P2 → P3）。
 * categoryKey 可选，不传则返回全账号所有 ASIN 的行动清单。
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

const PRIORITY_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 }

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const categoryKey = searchParams.get("categoryKey") ?? undefined

    // 取最新快照日期
    const latest = await db.sopAction.findFirst({
      orderBy: { snapshotDate: "desc" },
      select:  { snapshotDate: true },
    })

    if (!latest) {
      return NextResponse.json({ snapshotDate: null, total: 0, actions: [] })
    }

    const { snapshotDate } = latest

    const rawActions = await db.sopAction.findMany({
      where: {
        snapshotDate,
        ...(categoryKey ? { categoryKey } : {}),
      },
      orderBy: [{ priority: "asc" }, { rule: "asc" }, { asin: "asc" }],
    })

    // 反序列化 detail JSON
    const actions = rawActions
      .map(a => ({
        ...a,
        detail: JSON.parse(a.detail) as Record<string, unknown>,
      }))
      // 二次排序：P0 < P1 < P2 < P3
      .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9))

    return NextResponse.json({ snapshotDate, total: actions.length, actions })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[sop] error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
