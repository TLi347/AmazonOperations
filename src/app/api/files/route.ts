/**
 * GET /api/files
 *
 * 返回所有已上传文件的元信息（含 freshness，不含 parsedRows 原始数据）。
 * 供 ContextPanel 文件列表和前端展示使用。
 */

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getFreshness } from "@/lib/agentTools"

export async function GET() {
  try {
    const files = await db.contextFile.findMany({
      select: {
        id:           true,
        fileType:     true,
        fileName:     true,
        uploadDate:   true,
        snapshotDate: true,
      },
      orderBy: { uploadDate: "desc" },
    })

    return NextResponse.json(files.map(f => ({
      ...f,
      freshness: getFreshness(f.fileType, f.uploadDate),
    })))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
