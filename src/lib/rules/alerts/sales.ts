/**
 * lib/rules/alerts/sales.ts
 *
 * 销售指标告警：GMV / 订单量 / Sessions 环比（D-1 vs D-2）
 * 需要至少 2 天数据才触发黄色，3 天才能升级红色。
 */

import type { AlertCandidate, DayMetrics } from "./types"
import { getParam } from "@/lib/config"

/** 对单个指标执行 D-1 vs D-2 环比检测 */
function checkDrop(
  metricKey: keyof DayMetrics,
  metricName: string,
  days: DayMetrics[],   // 按日期升序，最后一条 = D-1（最新）
  asin: string,
  categoryKey: string,
  stage: string,
  snapshotDate: string,
  suggestion: string
): AlertCandidate | null {
  if (days.length < 2) return null  // 数据不足

  const threshold = getParam("alert_drop_threshold")           // 0.20
  const d1 = days[days.length - 1][metricKey] as number       // 最新（昨日）
  const d2 = days[days.length - 2][metricKey] as number       // 前日
  const d3 = days.length >= 3 ? days[days.length - 3][metricKey] as number : null

  if (d2 === 0) return null  // 避免除零

  const drop1 = (d1 - d2) / d2   // 负数 = 下跌
  if (drop1 > -threshold) return null  // 未超阈值，正常

  // 判断连续2日（需 D-3）
  const consecutive = d3 !== null && d3 > 0 && (d2 - d3) / d3 < -threshold

  return {
    asin,
    categoryKey,
    metric: `${metricKey}_drop`,
    level:        consecutive ? "red" : "yellow",
    currentValue: drop1,          // 如 -0.28 = 下跌28%
    threshold:    -threshold,
    stage,
    suggestion,
    snapshotDate,
  }
}

export function checkSalesDrop(
  days: DayMetrics[],
  asin: string,
  categoryKey: string,
  stage: string,
  snapshotDate: string
): AlertCandidate[] {
  const alerts: AlertCandidate[] = []

  const gmvAlert = checkDrop(
    "gmv", "GMV", days, asin, categoryKey, stage, snapshotDate,
    "检查 Buy Box 状态（OCR 是否同步下降）；检查关键词自然排名；确认 Listing 页面状态正常"
  )
  if (gmvAlert) alerts.push(gmvAlert)

  const ordersAlert = checkDrop(
    "orders", "订单量", days, asin, categoryKey, stage, snapshotDate,
    "检查广告活动状态；确认 Listing 页面可购买；查看同期竞品价格变化"
  )
  if (ordersAlert) alerts.push(ordersAlert)

  const sessionsAlert = checkDrop(
    "sessions", "Sessions", days, asin, categoryKey, stage, snapshotDate,
    "检查关键词自然排名是否下滑；检查广告预算是否耗尽；确认 Listing 搜索可见性"
  )
  if (sessionsAlert) alerts.push(sessionsAlert)

  return alerts
}
