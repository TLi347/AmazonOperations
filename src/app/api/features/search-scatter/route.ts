/**
 * GET /api/features/search-scatter
 *
 * Returns search term efficiency data for scatter plot.
 * Reads ContextFile where fileType = "search_terms", parses parsedRows,
 * returns terms with clicks >= 5.
 */

import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const file = await db.contextFile.findUnique({
      where: { fileType: "search_terms" },
    })
    if (!file) {
      return NextResponse.json(
        { error: "搜索词重构报表未上传" },
        { status: 404 }
      )
    }

    const rows = JSON.parse(file.parsedRows) as Array<Record<string, unknown>>

    const data = rows
      .filter((r) => {
        const clicks = (r.clicks as number) ?? 0
        return clicks >= 5
      })
      .map((r) => {
        const clicks = (r.clicks as number) ?? 0
        const spend = (r.spend as number) ?? 0
        const orders = (r.orders as number) ?? 0
        const acos = (r.acos as number) ?? null
        // cvr from parser is already percentage (orders/clicks * 100)
        const cvrRaw = (r.cvr as number) ?? 0

        return {
          term: (r.searchTerm as string) ?? (r.search_term as string) ?? "",
          clicks,
          cvr: +(cvrRaw).toFixed(2),
          acos: acos != null ? +acos.toFixed(2) : null,
          spend: +spend.toFixed(2),
          orders,
        }
      })

    return NextResponse.json({ data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
