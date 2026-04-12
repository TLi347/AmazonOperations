/** 系统内所有报表的 fileType 枚举 */
export type FileType =
  | "product"           // 产品报表-子ASIN视图（时序累积 → ProductMetricDay）
  | "search_terms"      // 搜索词重构（US，30天）
  | "campaign_3m"       // 广告活动重构（ALL，3月）
  | "us_campaign_30d"   // US广告活动（活动视图，30天）
  | "placement_us_30d"  // 广告位报表（US，30天）
  | "inventory"         // 库存报表
  | "keyword_monitor"   // 关键词监控
  | "cost_mgmt"         // 成本管理
  | "aba_search"        // ABA搜索词对比
  | "unknown"

/**
 * 根据文件名推断 fileType（顺序敏感，越具体的规则越靠前）
 *
 * 匹配优先级：
 * 1. campaign_3m（需同时含"广告活动重构"和"ALL"）优先于 us_campaign_30d（仅含"广告活动"）
 * 2. product 需同时含"产品报表"和"ASIN"（排除 SKU 视图）
 * 返回 "unknown" 时，调用方应展示弹窗让用户手动确认
 */
export function identifyFileType(filename: string): FileType {
  const f = filename.toLowerCase()

  // 产品报表 ASIN 视图（排除 SKU 视图）
  if (f.includes("产品报表") && f.includes("asin")) return "product"

  // 广告活动重构（需同时含"重构"和"ALL"，否则误判为普通广告活动）
  if (f.includes("广告活动") && f.includes("重构") && f.includes("all")) return "campaign_3m"

  // 搜索词重构
  if (f.includes("搜索词重构") || f.includes("搜索词") && f.includes("重构")) return "search_terms"

  // 广告位报表（需在"广告活动"之前匹配，避免误判）
  if (f.includes("广告位")) return "placement_us_30d"

  // US 广告活动（活动视图，排除含"重构"的情况）
  if (f.includes("广告活动") && !f.includes("重构")) return "us_campaign_30d"

  // 库存报表
  if (f.includes("库存报表") || f.includes("库存")) return "inventory"

  // 关键词监控
  if (f.includes("关键词监控") || f.includes("关键词")) return "keyword_monitor"

  // 成本管理
  if (f.includes("成本管理") || f.includes("成本")) return "cost_mgmt"

  // ABA 搜索词对比
  if (f.includes("aba")) return "aba_search"

  return "unknown"
}

/** 判断该 fileType 是否有对应 parser（unknown 无法解析）*/
export function isParseableType(type: FileType): boolean {
  return type !== "unknown"
}
