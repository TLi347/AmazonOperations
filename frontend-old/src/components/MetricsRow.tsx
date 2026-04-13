import React from 'react'
import type { ProductMetrics } from '../types/signals'

interface MetricsRowProps {
  metrics: ProductMetrics
}

function formatCurrency(val: number): string {
  return '$' + val.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function formatPercent(val: number): string {
  return val.toFixed(1) + '%'
}

function DeltaBadge({
  value,
  suffix = '',
  invertColor = false,
}: {
  value: number
  suffix?: string
  invertColor?: boolean
}) {
  if (value === 0) {
    return <span className="mc-delta nt">— 持平</span>
  }
  const isPositive = value > 0
  // For spend and ACOS, up is bad; for sales, up is good
  const isGood = invertColor ? !isPositive : isPositive
  const cls = `mc-delta ${isGood ? 'up' : 'dn'}`
  const arrow = isPositive ? '▲' : '▼'
  const sign = isPositive ? '+' : ''
  return (
    <span className={cls}>
      {arrow} {sign}{value.toFixed(1)}{suffix} 较上周
    </span>
  )
}

export default function MetricsRow({ metrics }: MetricsRowProps) {
  const {
    weekly_spend,
    weekly_sales,
    acos,
    organic_ratio,
    ad_ratio,
    potential_weekly_savings,
    spend_wow_change,
    sales_wow_change,
    acos_wow_change,
  } = metrics

  const acosColor = acos > 55 ? '#A32D2D' : acos > 45 ? '#854F0B' : '#3B6D11'

  return (
    <div className="mrow">
      {/* 广告花费 */}
      <div className="mc">
        <div className="mc-label">广告花费</div>
        <div className="mc-val">{formatCurrency(weekly_spend)}</div>
        <DeltaBadge value={spend_wow_change} suffix="%" invertColor={true} />
      </div>

      {/* 广告销售额 */}
      <div className="mc">
        <div className="mc-label">广告销售额</div>
        <div className="mc-val">{formatCurrency(weekly_sales)}</div>
        <DeltaBadge value={sales_wow_change} suffix="%" />
      </div>

      {/* 整体 ACOS */}
      <div className="mc">
        <div className="mc-label">整体 ACOS</div>
        <div className="mc-val" style={{ color: acosColor }}>
          {formatPercent(acos)}
        </div>
        <DeltaBadge value={acos_wow_change} suffix="pt" invertColor={true} />
      </div>

      {/* 自然/广告订单比 */}
      <div className="mc">
        <div className="mc-label">自然 / 广告订单比</div>
        <div className="mc-val">
          {Math.round(organic_ratio)}%{' '}
          <span style={{ fontSize: 14, color: 'var(--color-text-tertiary)' }}>
            / {Math.round(ad_ratio)}%
          </span>
        </div>
        <span className="mc-delta nt">
          自然 {Math.round(organic_ratio)}% · 广告 {Math.round(ad_ratio)}%
        </span>
      </div>

      {/* 止损后可回收毛利 */}
      <div className="mc-conclusion">
        <div className="mc-conclusion-label">止损后可回收毛利</div>
        <div className="mc-conclusion-val">
          +{formatCurrency(potential_weekly_savings)} / 周
        </div>
        <div className="mc-conclusion-sub">
          来源：暂停无效词 + 消除内部竞价（估算）
        </div>
      </div>
    </div>
  )
}
