import React from 'react'
import type { ProductContext, HealthScore } from '../types/signals'

const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string; goal: string; note: string }> = {
  new:    { label: '新品期', color: '#1D6FA4', bg: '#E8F4FC', goal: '以曝光量和初单为核心目标', note: '高ACOS（100-300%）属正常，不触发警告' },
  early:  { label: '前期',   color: '#6B3FA0', bg: '#F0EAF8', goal: '获取 Review，建立关键词排名', note: '可接受ACOS超过盈亏平衡' },
  growth: { label: '成长期', color: '#3B6D11', bg: '#EAF3DE', goal: 'ACOS 优化与规模扩张', note: '超盈亏平衡ACOS为P0信号' },
  mature: { label: '成熟期', color: '#7A5800', bg: '#FDF6E3', goal: '利润最大化，市场份额防守', note: 'BSR连降为P0信号' },
}

interface ContextStripProps {
  context: ProductContext
  health: HealthScore
  onHealthClick: () => void
}

interface SubDimension {
  label: string
  value: number
}

function getScoreColor(val: number): string {
  if (val >= 70) return '#639922'
  if (val >= 50) return '#EF9F27'
  return '#E24B4A'
}

function getInvBarColor(days: number): string {
  if (days >= 45) return '#639922'
  if (days >= 20) return '#EF9F27'
  return '#E24B4A'
}

function getInvTextColor(status: ProductContext['inventory_status']): string {
  if (status === 'safe') return '#3B6D11'
  if (status === 'warning') return '#854F0B'
  return '#A32D2D'
}

export default function ContextStrip({
  context,
  health,
  onHealthClick,
}: ContextStripProps) {
  const {
    stage,
    bsr_main,
    bsr_main_category,
    bsr_sub,
    bsr_sub_category,
    bsr_trend,
    inventory_days,
    inventory_status,
    inbound_qty,
    inbound_eta,
    daily_velocity,
  } = context

  const stageConf = STAGE_CONFIG[stage] ?? STAGE_CONFIG['new']

  const invBarPct = Math.min((inventory_days / 90) * 100, 100)
  const invBarColor = getInvBarColor(inventory_days)
  const invTextColor = getInvTextColor(inventory_status)

  const bsrIsUp = bsr_trend === 'up'
  const trendLabel = bsrIsUp ? '▲' : '▼'
  const trendClass = bsrIsUp ? 'up' : 'dn'

  const subDimensions: SubDimension[] = [
    { label: '转化能力', value: health.conversion },
    { label: '预算利用', value: health.budget_efficiency },
    { label: '流量质量', value: health.traffic_quality },
    { label: '词组结构', value: health.keyword_structure },
    { label: '广告效率', value: health.ad_efficiency },
  ]

  const overallColor = getScoreColor(health.overall)
  const wowIsDown = health.wow_change < 0

  return (
    <div className="ctx-strip">
      {/* BSR Card */}
      <div className="ctx-card">
        <div className="ctx-title">BSR 排名</div>
        <div style={{ display: 'flex', gap: 16 }}>
          <div>
            <div className="bsr-num">
              #{bsr_main.toLocaleString()}{' '}
              <span className={`trend-inline ${trendClass}`}>
                {trendLabel}
              </span>
            </div>
            <div className="bsr-cat">{bsr_main_category}</div>
          </div>
          {bsr_sub != null && bsr_sub_category && (
            <div>
              <div className="bsr-num">
                #{bsr_sub.toLocaleString()}{' '}
                <span className={`trend-inline ${trendClass}`}>
                  {trendLabel}
                </span>
              </div>
              <div className="bsr-cat">{bsr_sub_category}</div>
            </div>
          )}
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: 11,
            color: 'var(--color-text-secondary)',
            lineHeight: 1.5,
          }}
        >
          排名趋势{bsrIsUp ? '上升' : '下降'}，广告驱动为主。自然份额变化需持续关注。
        </div>
      </div>

      {/* Inventory Card */}
      <div className="ctx-card">
        <div className="ctx-title">库存状态</div>
        <div className="ctx-row">
          <span className="ctx-key">可售天数</span>
          <span className="ctx-val" style={{ color: invTextColor }}>
            {inventory_days} 天
          </span>
        </div>
        <div className="ctx-row">
          <span className="ctx-key">在途库存</span>
          <span className="ctx-val">
            {inbound_qty} 件 · 预计 {inbound_eta} 到仓
          </span>
        </div>
        <div className="ctx-row">
          <span className="ctx-key">当前日均销量</span>
          <span className="ctx-val">{daily_velocity} 件/天</span>
        </div>
        <div className="inv-bar-wrap">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 10,
              color: 'var(--color-text-tertiary)',
              marginTop: 8,
              marginBottom: 2,
            }}
          >
            <span>0</span>
            <span>安全 (45d)</span>
            <span>90d</span>
          </div>
          <div className="inv-bar-track">
            <div
              className="inv-bar-fill"
              style={{ width: `${invBarPct}%`, background: invBarColor }}
            />
          </div>
        </div>
        {inventory_status !== 'safe' && (
          <div style={{ marginTop: 6, fontSize: 11, color: invTextColor }}>
            {inventory_status === 'warning'
              ? `在途到仓前还有约 ${Math.max(0, inventory_days - 7)} 天缓冲，广告预算不宜大幅加码。`
              : '库存紧张，建议降低广告预算或暂停部分关键词。'}
          </div>
        )}
      </div>

      {/* Stage Card */}
      <div className="ctx-card">
        <div className="ctx-title">运营阶段</div>
        <div
          style={{
            display: 'inline-block',
            fontSize: 20,
            fontWeight: 600,
            color: stageConf.color,
            background: stageConf.bg,
            borderRadius: 6,
            padding: '2px 10px',
            marginBottom: 10,
          }}
        >
          {stageConf.label}
        </div>
        <div className="ctx-row">
          <span className="ctx-key">核心目标</span>
          <span className="ctx-val" style={{ color: stageConf.color }}>{stageConf.goal}</span>
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: 11,
            color: 'var(--color-text-secondary)',
            lineHeight: 1.5,
          }}
        >
          {stageConf.note}
        </div>
      </div>

      {/* Health Score Card */}
      <div className="ctx-card">
        <div className="ctx-title">广告健康度</div>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 8,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              fontSize: 32,
              fontWeight: 500,
              color: 'var(--color-text-primary)',
              lineHeight: 1,
            }}
          >
            {health.overall}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--color-text-tertiary)',
              marginBottom: 4,
            }}
          >
            / 100{' '}
            <span style={{ color: wowIsDown ? '#A32D2D' : '#3B6D11' }}>
              {wowIsDown ? '▼' : '▲'} {Math.abs(health.wow_change)} 较上周
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {subDimensions.map((dim) => (
            <div
              key={dim.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
              }}
            >
              <div
                style={{
                  width: 60,
                  color: 'var(--color-text-tertiary)',
                  flexShrink: 0,
                }}
              >
                {dim.label}
              </div>
              <div
                style={{
                  flex: 1,
                  height: 4,
                  background: 'var(--color-background-secondary)',
                  borderRadius: 99,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${dim.value}%`,
                    height: '100%',
                    background: getScoreColor(dim.value),
                    borderRadius: 99,
                  }}
                />
              </div>
              <div
                style={{
                  width: 24,
                  textAlign: 'right',
                  color: 'var(--color-text-tertiary)',
                  flexShrink: 0,
                }}
              >
                {dim.value}
              </div>
            </div>
          ))}
        </div>
        <button
          className="sm-btn"
          style={{ marginTop: 8, width: '100%', fontSize: 11 }}
          onClick={onHealthClick}
        >
          查看评分依据 ↗
        </button>
      </div>
    </div>
  )
}
