/**
 * scripts/seed-reports.ts
 *
 * 将 ../../报表/ 目录中的 MVP xlsx 文件批量导入到 SQLite 数据库。
 * 等价于逐个通过 /api/upload 上传，但直接在 Node 层执行，无需启动服务。
 *
 * 运行方法：
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-reports.ts
 *
 * 或通过 npm script：
 *   npm run seed:reports
 */

import path from "path"
import fs   from "fs/promises"
import { PrismaClient } from "@prisma/client"
import { identifyFileType } from "../src/lib/parsers/identifier"
import { parseProduct, contextParsers } from "../src/lib/parsers/index"
import { runAndPersistAlerts } from "../src/lib/rules/alerts/index"

const db = new PrismaClient()

// 报表目录（相对于 yz-ops-ai/）
const REPORTS_DIR = path.resolve(__dirname, "../../报表")
// context/ 目录（复制原始文件，与 /api/upload 一致）
const CONTEXT_DIR = path.resolve(__dirname, "../context")

async function main() {
  console.log(`📂 扫描报表目录：${REPORTS_DIR}`)

  let files: string[]
  try {
    files = await fs.readdir(REPORTS_DIR)
  } catch {
    console.error(`❌ 无法读取目录：${REPORTS_DIR}`)
    process.exit(1)
  }

  const xlsxFiles = files.filter(f => f.endsWith(".xlsx"))
  console.log(`📋 找到 ${xlsxFiles.length} 个 xlsx 文件\n`)

  // 创建 context/ 目录
  await fs.mkdir(CONTEXT_DIR, { recursive: true })

  let ok = 0
  let skipped = 0
  let failed  = 0

  for (const fileName of xlsxFiles) {
    const filePath = path.join(REPORTS_DIR, fileName)
    const fileType = identifyFileType(fileName)

    if (fileType === "unknown") {
      console.log(`⏭  跳过（未知类型）：${fileName}`)
      skipped++
      continue
    }

    if (fileType === "keyword_monitor") {
      console.log(`⏭  跳过（parser 未实现）：${fileName}`)
      skipped++
      continue
    }

    try {
      const buffer = await fs.readFile(filePath)

      if (fileType === "product") {
        const { rows, snapshotDate } = parseProduct(buffer)

        // 只要每条 upsert 有一条成功就算成功
        let upserted = 0
        for (const row of rows) {
          try {
            await db.productMetricDay.upsert({
              where:  { asin_date: { asin: row.asin, date: snapshotDate } },
              update: { metrics: JSON.stringify(row.metrics) },
              create: { asin: row.asin, date: snapshotDate, metrics: JSON.stringify(row.metrics) },
            })
            upserted++
          } catch {
            // 部分行失败不中断
          }
        }
        console.log(`✅ product  | ${snapshotDate} | ${upserted}/${rows.length} ASINs | ${fileName}`)
      } else {
        const parser = contextParsers[fileType]
        if (!parser) {
          console.log(`⏭  跳过（无 parser）：${fileType} — ${fileName}`)
          skipped++
          continue
        }

        const { rows, snapshotDate } = parser(buffer, fileName)

        await db.contextFile.upsert({
          where:  { fileType },
          update: { fileName, snapshotDate, parsedRows: JSON.stringify(rows) },
          create: { fileType, fileName, snapshotDate, parsedRows: JSON.stringify(rows) },
        })
        console.log(`✅ ${fileType.padEnd(18)} | ${snapshotDate} | ${rows.length} 行 | ${fileName}`)
      }

      // 复制原始文件到 context/
      await fs.copyFile(filePath, path.join(CONTEXT_DIR, fileName))

      ok++
    } catch (err) {
      console.error(`❌ 导入失败：${fileName}`)
      console.error(`   ${err instanceof Error ? err.message : String(err)}`)
      failed++
    }
  }

  console.log(`\n📊 导入结果：成功 ${ok}，跳过 ${skipped}，失败 ${failed}`)

  // 触发告警引擎（product 是主依赖）
  if (ok > 0) {
    console.log("\n🔔 触发告警引擎…")
    try {
      await runAndPersistAlerts("product")
      console.log("✅ 告警计算完成")
    } catch (err) {
      console.error("⚠️  告警引擎出错：", err instanceof Error ? err.message : String(err))
    }
  }

  await db.$disconnect()
  console.log("\n✨ 完成")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
