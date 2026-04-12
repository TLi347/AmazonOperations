/**
 * lib/config.ts
 *
 * 三层参数配置：global → category → stage（优先级从低到高）
 * 使用方：规则引擎（sop/alerts）、API 路由（kpi/inventory）
 */

type ConfigValue = number | string | boolean

interface ConfigStore {
  global:   Record<string, ConfigValue>
  category: Record<string, Record<string, ConfigValue>>
  stage:    Record<string, Record<string, ConfigValue>>
}

const CONFIG: ConfigStore = {
  // ── 全局默认值 ─────────────────────────────────────────────────────────
  global: {
    // P0 — 立即止血
    P0_A_clicks_threshold:    15,
    P0_B_spend_threshold:     20,
    P0_C_acos_threshold:      0.80,
    P0_C_budget_overage_ratio: 1.0,
    P0_C_bid_reduction_min:   0.10,
    P0_C_bid_reduction_max:   0.15,

    // P1 — 今日内优化
    P1_A_acos_min:            0.80,
    P1_A_acos_max:            1.14,
    P1_A_clicks_threshold:    30,
    P1_A_bid_reduction_min:   0.30,
    P1_A_bid_reduction_max:   0.40,
    P1_B_impressions_threshold: 500,
    P1_B_ctr_threshold:       0.002,
    P1_C_impressions_threshold: 500,
    P1_C_running_days_threshold: 7,
    P1_C_bid_increase_min:    0.20,
    P1_C_bid_increase_max:    0.30,

    // P2 — 本周内优化
    P2_A_acos_threshold:      0.35,
    P2_A_cvr_threshold:       0.04,
    P2_A_clicks_threshold:    30,
    P2_A_bid_increase_min:    0.15,
    P2_A_bid_increase_max:    0.20,
    P2_B_bid_premium_min:     0.05,
    P2_B_bid_premium_max:     0.10,
    P2_C_acos_threshold:      0.70,
    P2_C_running_days_threshold: 14,
    P2_C_zero_conv_clicks:    10,
    P2_C_bid_reduction:       0.15,
    P2_D_impressions_total:   3000,
    P2_D_bid_increase_min:    0.25,
    P2_D_bid_increase_max:    0.35,
    P2_E_acos_threshold:      0.70,
    P2_E_running_days_threshold: 14,
    P2_E_bid_reduction:       0.15,

    // P3 — 本月内优化
    P3_A_clicks_threshold:    20,
    P3_A_cvr_threshold:       0.03,
    P3_A_bid_multiplier:      1.2,
    P3_B_keywords_per_group_max: 50,
    P3_C_seasonal_growth_threshold: 0.20,
    P3_C_bid_increase_min:    0.15,
    P3_C_bid_increase_max:    0.20,
    P3_C_budget_increase_min: 0.30,
    P3_C_budget_increase_max: 0.50,
    P3_D_competitor_click_share: 0.05,
    P3_D_brand_bid_min:       0.50,
    P3_D_brand_bid_max:       1.00,

    // 每日告警阈值
    alert_drop_threshold:            0.20,
    alert_drop_consecutive_days:     2,
    alert_return_rate_yellow:        0.05,
    alert_return_rate_red:           0.08,
    alert_budget_utilization_low:    0.70,
    alert_budget_utilization_high:   1.00,

    // ACoS 告警（无阶段时用 growth 值作为兜底）
    acos_yellow: 0.45,
    acos_red:    0.65,

    // 库存健康阈值
    inventory_days_red:             30,
    inventory_days_yellow:          45,
    inventory_sea_shipping_days:    21,
    inventory_safety_stock_days:    30,
    inventory_slow_moving_days:     90,
    inventory_slow_moving_min_orders: 5,

    // 数据时间窗口
    window_search_terms_days:             30,
    window_campaign_months:               3,
    window_kpi_default_days:              7,
    window_seasonal_comparison_months:    13,
  },

  // ── 品类覆盖 ────────────────────────────────────────────────────────────
  category: {
    mattress: {
      ctr_exact_good: 0.010,
      acos_target:    0.40,
      acos_red:       0.60,
      cvr_good:       0.06,
      cpc_good:       1.50,
    },
    scooter: {
      ctr_exact_good: 0.008,
      acos_target:    0.30,
      acos_red:       0.70,
      cvr_good:       0.15,
      cpc_good:       1.00,
    },
    pump: {
      ctr_exact_good: 0.008,
      cpc_good:       2.50,
    },
  },

  // ── 阶段覆盖 ────────────────────────────────────────────────────────────
  stage: {
    launch: {
      acos_yellow: 0.50,
      acos_red:    0.70,
    },
    growth: {
      acos_yellow: 0.45,
      acos_red:    0.65,
    },
    mature: {
      acos_yellow: 0.35,
      acos_red:    0.55,
    },
  },
}

/**
 * 三层参数查找：stage > category > global
 *
 * @example
 * getParam("acos_red", "mattress", "mature")
 * // stage.mature 无 acos_red → category.mattress.acos_red = 0.60
 */
export function getParam(
  key:       string,
  category?: string,
  stage?:    string
): number {
  if (stage && CONFIG.stage[stage]?.[key] !== undefined) {
    return CONFIG.stage[stage][key] as number
  }
  if (category && CONFIG.category[category]?.[key] !== undefined) {
    return CONFIG.category[category][key] as number
  }
  const global = CONFIG.global[key]
  if (global === undefined) {
    throw new Error(`Config key not found: "${key}"`)
  }
  return global as number
}
