/**
 * lib/rules/alerts/index.ts
 *
 * 每日告警引擎入口。
 *
 * runAndPersistAlerts(fileType):
 *   - 仅当 fileType 是告警依赖文件之一时触发
 *   - 读取所有 AsinConfig → 对每个 ASIN 运行规则 → 写入 Alert 表
 *
 * 依赖文件：product / keyword_monitor / inventory / us_campaign_30d
 * （任一依赖文件上传时重新计算，保证 Chat 的 get_alerts() 始终有最新数据）
 */

import { db } from "@/lib/db"
import type { FileType } from "@/lib/parsers/identifier"
import type { AlertCandidate, DayMetrics, CampaignBudget } from "./types"
import { checkSalesDrop }        from "./sales"
import { checkAcos, checkCtr, checkOcr, checkReturnRate, checkBudgetUtilization } from "./ads"
import { checkInventoryDays }    from "./inventory"

// 触发告警引擎的文件类型
const ALERT_DEPS: FileType[] = ["product", "keyword_monitor", "inventory", "us_campaign_30d"]

/** POST /api/upload 末尾调用此函数 */
export async function runAndPersistAlerts(fileType: FileType): Promise<void> {
  if (!ALERT_DEPS.includes(fileType)) return

  // 取最新 snapshotDate（从 ProductMetricDay 中找最大日期）
  const latest = await db.productMetricDay.findFirst({
    orderBy: { date: "desc" },
    select:  { date: true },
  })
  if (!latest) return  // 还没有产品报表数据，跳过

  const snapshotDate = latest.date

  // 获取所有 ASIN 配置
  const asinConfigs = await db.asinConfig.findMany()
  if (asinConfigs.length === 0) return

  const asins = asinConfigs.map(c => c.asin)

  // 并行拉取所需数据
  const [metricsRows, inventoryFile, campaignFile] = await Promise.all([
    // 近 7 天 ProductMetricDay（全量，按 asin 分组在内存中处理）
    db.productMetricDay.findMany({
      where: {
        asin: { in: asins },
        date: { gte: subtractDays(snapshotDate, 6) },  // 近7天
      },
      orderBy: { date: "asc" },
    }),
    // 库存快照
    db.contextFile.findUnique({ where: { fileType: "inventory" } }),
    // US 广告活动（用于预算利用率）
    db.contextFile.findUnique({ where: { fileType: "us_campaign_30d" } }),
  ])

  // 按 ASIN 分组 metrics
  const metricsByAsin = new Map<string, DayMetrics[]>()
  for (const row of metricsRows) {
    const parsed = JSON.parse(row.metrics) as DayMetrics
    const list = metricsByAsin.get(row.asin) ?? []
    list.push(parsed)
    metricsByAsin.set(row.asin, list)
  }

  // 解析库存快照
  const inventoryMap = new Map<string, number>()  // asin → available_qty
  if (inventoryFile) {
    const invRows = JSON.parse(inventoryFile.parsedRows) as Array<{
      asin: string
      availableQty?: number
      available_qty?: number
    }>
    for (const r of invRows) {
      if (!r.asin) continue
      const qty = r.availableQty ?? r.available_qty ?? 0
      // 同一 ASIN 可能有多个 SKU，合计
      inventoryMap.set(r.asin, (inventoryMap.get(r.asin) ?? 0) + qty)
    }
  }

  // 解析广告活动预算：按 ASIN 分组（通过 campaign name 包含 ASIN 前缀匹配）
  const campaignsByAsin = new Map<string, CampaignBudget[]>()
  if (campaignFile) {
    const campRows = JSON.parse(campaignFile.parsedRows) as Array<{
      campaignName?: string
      campaign_name?: string
      budget?: number
      daily_budget?: number
      asin?: string
    }>
    for (const r of campRows) {
      const campaignName = r.campaignName ?? r.campaign_name ?? ""
      const dailyBudget  = r.budget ?? r.daily_budget ?? 0

      // 若 row 有 asin 字段，直接用；否则从活动名称中提取 B0... 前缀
      let rowAsin = r.asin ?? ""
      if (!rowAsin) {
        const m = campaignName.match(/B0[A-Z0-9]{8}/i)
        rowAsin = m ? m[0].toUpperCase() : ""
      }

      if (!rowAsin || dailyBudget === 0) continue
      const list = campaignsByAsin.get(rowAsin) ?? []
      list.push({ campaign_name: campaignName, daily_budget: dailyBudget })
      campaignsByAsin.set(rowAsin, list)
    }
  }

  // 对每个 ASIN 运行规则
  const allAlerts: AlertCandidate[] = []
  for (const config of asinConfigs) {
    const { asin, categoryKey, stage } = config
    const days = metricsByAsin.get(asin) ?? []
    if (days.length === 0) continue  // 无历史数据

    const today = days[days.length - 1]  // 最新一天

    // 销售环比
    allAlerts.push(...checkSalesDrop(days, asin, categoryKey, stage, snapshotDate))

    // ACOS
    const acosAlert = checkAcos(today, asin, categoryKey, stage, snapshotDate)
    if (acosAlert) allAlerts.push(acosAlert)

    // CTR
    const ctrAlert = checkCtr(today, asin, categoryKey, stage, snapshotDate)
    if (ctrAlert) allAlerts.push(ctrAlert)

    // OCR
    const ocrAlert = checkOcr(today, asin, categoryKey, stage, snapshotDate)
    if (ocrAlert) allAlerts.push(ocrAlert)

    // 退货率
    const returnAlert = checkReturnRate(today, asin, categoryKey, stage, snapshotDate)
    if (returnAlert) allAlerts.push(returnAlert)

    // 广告花费利用率
    const campaigns = campaignsByAsin.get(asin) ?? []
    const budgetAlert = checkBudgetUtilization(today, campaigns, asin, categoryKey, stage, snapshotDate)
    if (budgetAlert) allAlerts.push(budgetAlert)

    // 库存可售天数（需要7天时序 + 库存快照）
    const availableQty = inventoryMap.get(asin)
    if (availableQty !== undefined) {
      const invAlert = checkInventoryDays(days, availableQty, asin, categoryKey, stage, snapshotDate)
      if (invAlert) allAlerts.push(invAlert)
    }
  }

  // 写入 Alert 表（先删当日旧记录，再批量插入）
  await db.alert.deleteMany({ where: { snapshotDate } })

  if (allAlerts.length > 0) {
    await db.alert.createMany({
      data: allAlerts.map(a => ({
        asin:         a.asin,
        categoryKey:  a.categoryKey,
        metric:       a.metric,
        level:        a.level,
        currentValue: a.currentValue,
        threshold:    a.threshold,
        stage:        a.stage,
        suggestion:   a.suggestion,
        snapshotDate: a.snapshotDate,
      })),
    })
  }
}

/** YYYY-MM-DD 日期减 N 天 */
function subtractDays(dateStr: string, n: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}
