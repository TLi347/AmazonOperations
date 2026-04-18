/** SOP 行动候选项（写入 SopAction 表前的内存结构） */
export interface SopCandidate {
  asin:         string
  categoryKey:  string
  priority:     "P0" | "P1" | "P2" | "P3"
  rule:         string   // "P0-A" | "P0-B" | "P0-C" | "P1-A" | "P1-B" | "P1-C" | "P2-A" | "P2-B" | "P2-C" | "P2-D" | "P2-E" | "P3-A" | "P3-B" | "zombie" | "cross_asin"
  searchTerm?:  string
  matchType?:   string
  campaignName?: string
  suggestion:   string
  detail:       Record<string, unknown>
  snapshotDate: string
}

/** SearchTermRow 从 ContextFile.parsedRows 反序列化后的结构 */
export interface SearchTermRow {
  asin:        string
  searchTerm:  string
  matchType:   string
  campaignName: string
  adType:      string
  impressions: number
  clicks:      number
  spend:       number
  orders:      number
  acos:        number   // 百分比，如 82.4 表示 82.4%
  ctr:         number   // 百分比，如 0.25 表示 0.25%
  cpc:         number
  cvr:         number   // 百分比，如 4.2 表示 4.2%
}

/** AdRestructureRow 从 ContextFile.parsedRows 反序列化后的结构 */
export interface AdRestructureRow {
  asin:         string
  campaignName: string
  adGroupName:  string
  adType:       string
  impressions:  number
  clicks:       number
  spend:        number
  sales:        number
  orders:       number
  acos:         number   // 百分比
  cvr:          number   // 百分比
}

/** AdCampaignRow 从 ContextFile.parsedRows 反序列化后的结构（us_campaign_30d） */
export interface AdCampaignRow {
  campaignName: string
  budget:       number   // 每日预算
  startDate:    string | null  // ISO 字符串（JSON 序列化后 Date → string）
  spend:        number
  orders:       number
  acos:         number   // 百分比
}
