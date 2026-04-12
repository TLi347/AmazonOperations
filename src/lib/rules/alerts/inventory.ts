/**
 * lib/rules/alerts/inventory.ts
 *
 * 库存可售天数告警
 *
 * 可售天数 = 可售库存量 ÷ (SUM(近7天订单) ÷ 7)
 * 若 ProductMetricDay 不足7天，用已有天数的均值。
 */

import type { AlertCandidate, DayMetrics } from "./types"
import { getParam } from "@/lib/config"

export function checkInventoryDays(
  days: DayMetrics[],         // 近7天（或已有天数），按日期升序
  availableQty: number,       // 来自 ContextFile[inventory]
  asin: string,
  categoryKey: string,
  stage: string,
  snapshotDate: string
): AlertCandidate | null {
  if (days.length === 0 || availableQty <= 0) return null

  const totalOrders = days.reduce((s, d) => s + d.orders, 0)
  const dailyAvg    = totalOrders / days.length

  if (dailyAvg === 0) return null  // 无销售，无法计算

  const daysOfSupply = availableQty / dailyAvg
  const redThreshold    = getParam("inventory_days_red")    // 30
  const yellowThreshold = getParam("inventory_days_yellow") // 45

  if (daysOfSupply < redThreshold) {
    const reorderQty = Math.round(
      dailyAvg * (
        getParam("inventory_sea_shipping_days") +
        getParam("inventory_safety_stock_days")
      )
    )
    return {
      asin, categoryKey, metric: "inventory_days", level: "red",
      currentValue: daysOfSupply, threshold: redThreshold,
      stage, snapshotDate,
      suggestion: `可售天数仅剩 ${daysOfSupply.toFixed(0)} 天（日均销量约 ${dailyAvg.toFixed(1)} 件）。建议立即补货 ${reorderQty} 件（海运在途${getParam("inventory_sea_shipping_days")}天 + 安全库存${getParam("inventory_safety_stock_days")}天）`,
    }
  }

  if (daysOfSupply < yellowThreshold) {
    return {
      asin, categoryKey, metric: "inventory_days", level: "yellow",
      currentValue: daysOfSupply, threshold: yellowThreshold,
      stage, snapshotDate,
      suggestion: `可售天数 ${daysOfSupply.toFixed(0)} 天，需提前安排补货。目前日均销量约 ${dailyAvg.toFixed(1)} 件`,
    }
  }

  return null
}
