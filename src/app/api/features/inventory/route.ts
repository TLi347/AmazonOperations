/**
 * GET /api/features/inventory?categoryKey=mattress
 *
 * 返回库存快照数据，按品类 ASIN 过滤。
 *
 * Query params:
 *   categoryKey — 品类 key（不传则全部）
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const categoryKey = searchParams.get("categoryKey") ?? null

    // Resolve ASIN filter
    let targetAsins: string[] | null = null
    if (categoryKey) {
      const cat = await db.categoryMap.findUnique({ where: { categoryKey } })
      if (!cat) return NextResponse.json({ error: `品类 "${categoryKey}" 不存在` }, { status: 404 })
      targetAsins = JSON.parse(cat.asins) as string[]
    }

    const file = await db.contextFile.findUnique({ where: { fileType: "inventory" } })
    if (!file) {
      return NextResponse.json({ error: "库存报表未上传，请上传「库存报表」文件" }, { status: 404 })
    }

    let rows = JSON.parse(file.parsedRows) as Array<Record<string, unknown>>

    // Filter by ASIN if category specified
    if (targetAsins) {
      rows = rows.filter(r => {
        const rowAsin = (r.asin ?? r.fnsku ?? "") as string
        return targetAsins!.some(a => rowAsin.includes(a))
      })
    }

    return NextResponse.json({
      snapshotDate: file.snapshotDate,
      total: rows.length,
      rows,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
