/** 告警候选项（写入 Alert 表前的内存结构） */
export interface AlertCandidate {
  asin:         string
  categoryKey:  string
  metric:       string    // "acos" | "ctr" | "ocr" | "return_rate" | "gmv_drop" | "orders_drop" | "sessions_drop" | "inventory_days" | "budget_utilization"
  level:        "red" | "yellow"
  currentValue: number
  threshold:    number
  stage:        string
  suggestion:   string
  snapshotDate: string
}

/** ProductMetricDay.metrics 反序列化后的结构 */
export interface DayMetrics {
  gmv:          number
  orders:       number
  units:        number
  ad_spend:     number
  ad_sales:     number
  ad_orders:    number
  impressions:  number
  clicks:       number
  sessions:     number
  ocr:          number
  refund_rate:  number
}

/** us_campaign_30d 中的广告活动预算（按 ASIN + 活动名 JOIN） */
export interface CampaignBudget {
  campaign_name: string
  daily_budget:  number
}
