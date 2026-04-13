export interface DecisionSignal {
  signal_id: string
  priority: 'P0' | 'P1' | 'P2' | 'P3' | 'good'
  title: string
  description: string
  timeline: TimelineItem[]
  evidence_table: Record<string, string>[]
  evidence_headers: string[]
  reasoning: string
  financial_impact: FinancialImpact
  actions: SignalAction[]
  related_ad_groups: string[]
  // 由后端 /signals 端点注入的历史决策统计
  decision_count?: number
  last_decision?: string
  last_boss_note?: string
}

export interface TimelineItem {
  week: string
  label: string
  value: string
  note?: string
}

export interface FinancialImpact {
  weekly_loss_usd: number
  weekly_gain_usd: number
  description: string
}

export interface SignalAction {
  title: string
  prompt: string
  style: 'primary' | 'default'
}

export interface ProductMetrics {
  weekly_spend: number
  weekly_sales: number
  acos: number
  organic_ratio: number
  ad_ratio: number
  potential_weekly_savings: number
  spend_wow_change: number
  sales_wow_change: number
  acos_wow_change: number
}

export interface HealthScore {
  overall: number
  conversion: number
  budget_efficiency: number
  traffic_quality: number
  keyword_structure: number
  ad_efficiency: number
  wow_change: number
}

export interface ProductContext {
  stage: 'new' | 'early' | 'growth' | 'mature'
  bsr_main: number
  bsr_main_category: string
  bsr_sub?: number
  bsr_sub_category?: string
  bsr_trend: string
  inventory_days: number
  inventory_status: 'safe' | 'warning' | 'critical'
  inbound_qty: number
  inbound_eta: string
  daily_velocity: number
}

export interface AnalysisResult {
  asin: string
  product_name: string
  signals: DecisionSignal[]
  metrics: ProductMetrics
  health: HealthScore
  context: ProductContext
  date_range: string
  generated_at: string
}

export interface Product {
  asin: string
  name: string
  category: string
  marketplace: string
  status: string
  stage?: 'new' | 'early' | 'growth' | 'mature' | 'declining'
  signal_count_p0?: number
  signal_count_p1?: number
  health_score?: number
  break_even_acos?: number
  acos_vs_bep?: number
  inventory_days?: number
  potential_weekly_savings?: number
  weekly_profit?: number | null
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AnalysisStreamEvent {
  stage: string
  message: string
  payload?: AnalysisResult
}
