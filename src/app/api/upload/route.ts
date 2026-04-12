/**
 * POST /api/upload
 * multipart/form-data: { file: File, fileType?: string }
 *
 * 流程：
 *   1. 读取文件，推断 fileType（或使用前端传入的 fileType）
 *   2. 调用对应 parser → { rows, snapshotDate }
 *   3. 写入数据库
 *      - product → ProductMetricDay（upsert by asin × date）
 *      - others  → ContextFile（upsert by fileType）
 *   4. 保存原始文件到 context/ 目录
 *   5. 触发告警引擎（仅当 fileType 是告警依赖文件时）
 *   6. 返回 { fileType, snapshotDate, rowCount }
 */

import { NextRequest, NextResponse } from "next/server"
import path from "path"
import fs from "fs/promises"
import { identifyFileType, isParseableType } from "@/lib/parsers/identifier"
import type { FileType } from "@/lib/parsers/identifier"
import { parseProduct, contextParsers } from "@/lib/parsers/index"
import { db } from "@/lib/db"
import { runAndPersistAlerts } from "@/lib/rules/alerts/index"

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const fileTypeOverride = formData.get("fileType") as string | null

    if (!file) {
      return NextResponse.json({ error: "缺少 file 字段" }, { status: 400 })
    }

    // 1. 推断 fileType
    const fileType: FileType = (fileTypeOverride as FileType) ?? identifyFileType(file.name)

    if (fileType === "unknown") {
      return NextResponse.json(
        { error: "无法识别文件类型，请在上传时手动指定 fileType" },
        { status: 400 }
      )
    }

    if (!isParseableType(fileType)) {
      return NextResponse.json(
        { error: `fileType "${fileType}" 暂无 parser` },
        { status: 400 }
      )
    }

    if (fileType === "keyword_monitor") {
      return NextResponse.json(
        { error: "关键词监控报表 parser 尚未实现，敬请期待" },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    // 2. 解析
    let snapshotDate: string
    let rowCount: number

    if (fileType === "product") {
      // 产品报表 → ProductMetricDay（时序累积）
      const { rows, snapshotDate: sd } = parseProduct(buffer)
      snapshotDate = sd
      rowCount = rows.length

      await Promise.all(
        rows.map(row =>
          db.productMetricDay.upsert({
            where:  { asin_date: { asin: row.asin, date: snapshotDate } },
            update: { metrics: JSON.stringify(row.metrics) },
            create: { asin: row.asin, date: snapshotDate, metrics: JSON.stringify(row.metrics) },
          })
        )
      )
    } else {
      // 其他报表 → ContextFile（快照覆盖）
      const parser = contextParsers[fileType]
      if (!parser) {
        return NextResponse.json(
          { error: `fileType "${fileType}" 没有对应 parser` },
          { status: 400 }
        )
      }

      const { rows, snapshotDate: sd } = parser(buffer, file.name)
      snapshotDate = sd
      rowCount = rows.length

      await db.contextFile.upsert({
        where:  { fileType },
        update: { fileName: file.name, snapshotDate, parsedRows: JSON.stringify(rows) },
        create: { fileType, fileName: file.name, snapshotDate, parsedRows: JSON.stringify(rows) },
      })
    }

    // 3. 保存原始文件到 context/ 目录
    const contextDir = path.join(process.cwd(), "context")
    await fs.mkdir(contextDir, { recursive: true })
    await fs.writeFile(path.join(contextDir, file.name), buffer)

    // 4. 触发告警引擎（product / keyword_monitor / inventory / us_campaign_30d 依赖文件）
    await runAndPersistAlerts(fileType)

    return NextResponse.json({ fileType, snapshotDate, rowCount })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[upload] error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
