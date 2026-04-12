/**
 * lib/rules/alerts/ads.ts
 *
 * 广告指标告警：ACOS / CTR / OCR / 退货率 / 广告花费利用率
 */

import type { AlertCandidate, DayMetrics, CampaignBudget } from "./types"
import { getParam } from "@/lib/config"

/** ACOS 告警（按产品阶段取阈值） */
export function checkAcos(
  today: DayMetrics,
  asin: string,
  categoryKey: string,
  stage: string,
  snapshotDate: string
): AlertCandidate | null {
  if (today.ad_sales === 0) return null  // 无销售，ACOS 无意义

  const acos = today.ad_spend / today.ad_sales
  const yellowThreshold = getParam("acos_yellow", categoryKey, stage)
  const redThreshold    = getParam("acos_red",    categoryKey, stage)

  if (acos > redThreshold) {
    return {
      asin, categoryKey, metric: "acos", level: "red",
      currentValue: acos, threshold: redThreshold,
      stage, snapshotDate,
      suggestion: `ACoS ${(acos * 100).toFixed(1)}% 超红线。拉搜索词报表，否定点击≥15且0成交的词；暂停最高花费广泛组；降低主词出价10–15%`,
    }
  }

  if (acos > yellowThreshold) {
    return {
      asin, categoryKey, metric: "acos", level: "yellow",
      currentValue: acos, threshold: yellowThreshold,
      stage, snapshotDate,
      suggestion: `ACoS ${(acos * 100).toFixed(1)}% 进入警戒区。检查低效词组，优化出价；重点关注高花费低转化词`,
    }
  }

  return null
}

/** 广告 CTR 告警（点击量 / 曝光量） */
export function checkCtr(
  today: DayMetrics,
  asin: string,
  categoryKey: string,
  stage: string,
  snapshotDate: string
): AlertCandidate | null {
  if (today.impressions < 100) return null  // 曝光太少，无统计意义

  const ctr = today.clicks / today.impressions
  const redThreshold    = 0.002   // < 0.2%
  const yellowThreshold = 0.003   // < 0.3%

  if (ctr < redThreshold) {
    return {
      asin, categoryKey, metric: "ctr", level: "red",
      currentValue: ctr, threshold: redThreshold,
      stage, snapshotDate,
      suggestion: "广告CTR低于0.2%。检查主图是否有竞争力；确认价格是否高于竞品>15%；考虑测试新主图",
    }
  }

  if (ctr < yellowThreshold) {
    return {
      asin, categoryKey, metric: "ctr", level: "yellow",
      currentValue: ctr, threshold: yellowThreshold,
      stage, snapshotDate,
      suggestion: "广告CTR偏低（0.2–0.3%）。建议优化主图和标题；检查价格竞争力",
    }
  }

  return null
}

/** OCR（页面转化率）告警 = orders / sessions */
export function checkOcr(
  today: DayMetrics,
  asin: string,
  categoryKey: string,
  stage: string,
  snapshotDate: string
): AlertCandidate | null {
  if (today.sessions < 50) return null  // 流量太少，无统计意义

  const ocr = today.ocr  // 已在 parseProduct 中计算并存储
  const redThreshold    = 0.08   // < 8%
  const yellowThreshold = 0.10   // < 10%

  if (ocr < redThreshold) {
    return {
      asin, categoryKey, metric: "ocr", level: "red",
      currentValue: ocr, threshold: redThreshold,
      stage, snapshotDate,
      suggestion: "页面转化率(OCR)低于8%，可能存在Buy Box丢失。检查Listing质量、价格及Buy Box状态；确认无负面评价暴增",
    }
  }

  if (ocr < yellowThreshold) {
    return {
      asin, categoryKey, metric: "ocr", level: "yellow",
      currentValue: ocr, threshold: yellowThreshold,
      stage, snapshotDate,
      suggestion: "页面转化率偏低（8–10%）。检查Listing五点描述和图片是否需要优化；确认价格竞争力",
    }
  }

  return null
}

/** 退货率告警（来自报表原始退款率字段） */
export function checkReturnRate(
  today: DayMetrics,
  asin: string,
  categoryKey: string,
  stage: string,
  snapshotDate: string
): AlertCandidate | null {
  const rate = today.refund_rate
  if (rate === 0) return null  // 无退货

  const redThreshold    = getParam("alert_return_rate_red")    // 0.08
  const yellowThreshold = getParam("alert_return_rate_yellow") // 0.05

  if (rate > redThreshold) {
    return {
      asin, categoryKey, metric: "return_rate", level: "red",
      currentValue: rate, threshold: redThreshold,
      stage, snapshotDate,
      suggestion: `退货率${(rate * 100).toFixed(1)}%超红线(8%)。查看退款原因标签，集中处理质量/描述不符类退货；考虑优化Listing描述`,
    }
  }

  if (rate > yellowThreshold) {
    return {
      asin, categoryKey, metric: "return_rate", level: "yellow",
      currentValue: rate, threshold: yellowThreshold,
      stage, snapshotDate,
      suggestion: `退货率${(rate * 100).toFixed(1)}%偏高(5–8%)。分析退款原因；检查产品描述与实物是否一致`,
    }
  }

  return null
}

/** 广告花费利用率告警（需要广告活动每日预算数据） */
export function checkBudgetUtilization(
  today: DayMetrics,
  campaigns: CampaignBudget[],  // 该 ASIN 关联的广告活动预算
  asin: string,
  categoryKey: string,
  stage: string,
  snapshotDate: string
): AlertCandidate | null {
  if (campaigns.length === 0 || today.ad_spend === 0) return null

  const totalBudget = campaigns.reduce((s, c) => s + c.daily_budget, 0)
  if (totalBudget === 0) return null

  const utilization = today.ad_spend / totalBudget
  const lowThreshold  = getParam("alert_budget_utilization_low")   // 0.70
  const highThreshold = getParam("alert_budget_utilization_high")  // 1.00

  if (utilization > highThreshold) {
    return {
      asin, categoryKey, metric: "budget_utilization", level: "red",
      currentValue: utilization, threshold: highThreshold,
      stage, snapshotDate,
      suggestion: `广告花费超预算（利用率${(utilization * 100).toFixed(0)}%）。暂停最高花费广泛组；降低主词出价10–15%；适当提升预算`,
    }
  }

  if (utilization < lowThreshold) {
    return {
      asin, categoryKey, metric: "budget_utilization", level: "yellow",
      currentValue: utilization, threshold: lowThreshold,
      stage, snapshotDate,
      suggestion: `广告预算利用率不足（${(utilization * 100).toFixed(0)}%），流量未充分利用。检查关键词出价是否过低；确认广告活动状态为启用`,
    }
  }

  return null
}
