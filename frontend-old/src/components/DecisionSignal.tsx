import React, { useState } from 'react'
import type { DecisionSignal as DecisionSignalType } from '../types/signals'
import type { ChatContext } from '../api/client'

interface DecisionSignalProps {
  signal: DecisionSignalType
  onActionClick: (prompt: string, context?: ChatContext) => void
  onDecision?: (signalId: string, decision: 'confirm' | 'reject') => void
}

type Priority = 'P0' | 'P1' | 'P2' | 'P3' | 'good'

function getPriorityClass(priority: Priority): string {
  switch (priority) {
    case 'P0': return 'p0'
    case 'P1': return 'p1'
    case 'P2': return 'p2'
    case 'P3': return 'p2'
    case 'good': return 'pg'
  }
}

function getPriorityIcon(priority: Priority): string {
  switch (priority) {
    case 'P0': return '🔴'
    case 'P1': return '🟡'
    case 'P2': return '⚪'
    case 'P3': return '⚪'
    case 'good': return '🟢'
  }
}

function getPriorityLabel(priority: Priority): string {
  switch (priority) {
    case 'P0': return 'P0 · 立即处理'
    case 'P1': return 'P1 · 本周执行'
    case 'P2': return 'P2 · 两周内'
    case 'P3': return 'P3 · 优化'
    case 'good': return '积极 · 继续保持'
  }
}

function getCellClass(value: string): string {
  const lower = value.toLowerCase()
  if (
    lower.includes('bad') ||
    lower.includes('0') ||
    lower.includes('高') ||
    lower.includes('亏')
  ) {
    return ''
  }
  return ''
}

// Simple heuristic: if a cell value looks like a loss/bad metric, color it
function inferCellStyle(header: string, value: string): React.CSSProperties {
  const lv = String(value ?? '').toLowerCase()
  const lh = String(header ?? '').toLowerCase()

  if (lv === '0' && (lh.includes('成交') || lh.includes('转化'))) {
    return { color: '#A32D2D', fontWeight: 500 }
  }
  if (lh === '建议' && (lv.includes('暂停') || lv.includes('降'))) {
    return { color: '#A32D2D' }
  }
  if (lh === '建议' && (lv.includes('保留') || lv.includes('加'))) {
    return { color: '#3B6D11', fontWeight: 500 }
  }
  return {}
}

export default function DecisionSignal({ signal, onActionClick, onDecision }: DecisionSignalProps) {
  const [expanded, setExpanded] = useState(false)
  const [decision, setDecision] = useState<'confirm' | 'reject' | null>(null)

  const priorityClass = getPriorityClass(signal.priority)
  const icon = getPriorityIcon(signal.priority)
  const label = getPriorityLabel(signal.priority)

  const context = {
    trigger_signal_id: signal.signal_id,
    trigger_signal_title: signal.title,
    trigger_signal_priority: signal.priority,
    related_ad_groups: signal.related_ad_groups,
    evidence_summary: signal.evidence_table.slice(0, 5)
      .map(row => Object.entries(row).map(([k, v]) => `${k}:${v}`).join(', '))
      .join(' | '),
    reasoning: signal.reasoning.replace(/<[^>]+>/g, ''),
  }

  return (
    <div
      className={`sig ${priorityClass}${expanded ? ' expanded' : ''}`}
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="sig-head">
        <div className="sig-icon">{icon}</div>
        <div className="sig-content">
          <div className="sig-title">{signal.title}</div>
          <div className="sig-desc">{signal.description}</div>
        </div>
        <div className="sig-right">
          {(signal.decision_count ?? 0) > 0 && (
            <span style={{
              fontSize: 10,
              padding: '2px 6px',
              borderRadius: 99,
              background: (signal.decision_count ?? 0) >= 3 ? '#FCEBEB' : 'var(--color-background-secondary)',
              color: (signal.decision_count ?? 0) >= 3 ? '#A32D2D' : 'var(--color-text-tertiary)',
              border: `0.5px solid ${(signal.decision_count ?? 0) >= 3 ? '#F7C1C1' : 'var(--color-border-tertiary)'}`,
              whiteSpace: 'nowrap',
            }}>
              {(signal.decision_count ?? 0) >= 3
                ? `⚠ 已确认 ${signal.decision_count} 次`
                : `已确认 ${signal.decision_count} 次`
              }
            </span>
          )}
          <span className="pri-tag">{label}</span>
          <span className="chevron">▼</span>
        </div>
      </div>

      <div className="sig-expand">
        <div className="sig-expand-inner">
          {/* Timeline */}
          {signal.timeline.length > 0 && (
            <div className="expand-section">
              <div className="expand-title">为什么是"现在"—— 时间线</div>
              <div className="delta-context">
                {signal.timeline.map((item, i) => (
                  <div className="dc-item" key={i}>
                    <div className="dc-label">{item.label}</div>
                    <div className="dc-val">{item.value}</div>
                    <div className="dc-week">{item.note || item.week}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Financial impact */}
          {(signal.financial_impact.weekly_loss_usd > 0 || signal.financial_impact.weekly_gain_usd > 0) && (
            <div className="expand-section">
              <div className="expand-title">财务影响</div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {signal.financial_impact.weekly_loss_usd > 0 && (
                  <div style={{ fontSize: 13 }}>
                    <span style={{ color: 'var(--color-text-tertiary)' }}>每周损失 </span>
                    <span style={{ color: '#A32D2D', fontWeight: 600 }}>
                      ${signal.financial_impact.weekly_loss_usd.toFixed(0)}
                    </span>
                  </div>
                )}
                {signal.financial_impact.weekly_gain_usd > 0 && (
                  <div style={{ fontSize: 13 }}>
                    <span style={{ color: 'var(--color-text-tertiary)' }}>潜在收益 </span>
                    <span style={{ color: '#3B6D11', fontWeight: 600 }}>
                      +${signal.financial_impact.weekly_gain_usd.toFixed(0)}
                    </span>
                  </div>
                )}
                {signal.financial_impact.description && (
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', width: '100%' }}>
                    {signal.financial_impact.description}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Evidence table — headers 缺失时用第一行的 key 作为表头 */}
          {signal.evidence_table.length > 0 && (() => {
            const headers = signal.evidence_headers.length > 0
              ? signal.evidence_headers
              : Object.keys(signal.evidence_table[0])
            return (
              <div className="expand-section">
                <div className="expand-title">数据明细</div>
                <table className="etable">
                  <thead>
                    <tr>
                      {headers.map((h) => <th key={h}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {signal.evidence_table.map((row, ri) => (
                      <tr key={ri}>
                        {headers.map((h) => (
                          <td key={h} style={inferCellStyle(h, row[h] ?? '')}>
                            {row[h] ?? '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })()}

          {/* Reasoning */}
          {signal.reasoning && (
            <div className="expand-section">
              <div className="expand-title">推理过程</div>
              <div
                className="reasoning"
                dangerouslySetInnerHTML={{ __html: signal.reasoning }}
              />
            </div>
          )}

          {/* Actions */}
          <div
            className="action-row"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 决策按钮：仅 P0/P1 显示，且只在未决策时显示 */}
            {(signal.priority === 'P0' || signal.priority === 'P1') && (
              decision ? (
                <span style={{
                  fontSize: 12,
                  padding: '4px 10px',
                  borderRadius: 99,
                  background: decision === 'confirm' ? '#EAF3DE' : 'var(--color-background-secondary)',
                  color: decision === 'confirm' ? '#3B6D11' : 'var(--color-text-tertiary)',
                  border: `0.5px solid ${decision === 'confirm' ? '#C0DD97' : 'var(--color-border-tertiary)'}`,
                  flexShrink: 0,
                }}>
                  {decision === 'confirm' ? '✓ 已批准执行' : '— 已跳过'}
                </span>
              ) : (
                <>
                  <button
                    className="sm-btn pri"
                    style={{ background: '#EAF3DE', color: '#27500A', borderColor: '#C0DD97' }}
                    onClick={() => {
                      setDecision('confirm')
                      onDecision?.(signal.signal_id, 'confirm')
                    }}
                  >
                    ✓ 批准执行
                  </button>
                  <button
                    className="sm-btn"
                    onClick={() => {
                      setDecision('reject')
                      onDecision?.(signal.signal_id, 'reject')
                    }}
                  >
                    ✗ 暂不处理
                  </button>
                </>
              )
            )}
            {signal.actions.map((action, i) => (
              <button
                key={i}
                className={`sm-btn${action.style === 'primary' ? ' pri' : ''}`}
                onClick={() => onActionClick(action.prompt, context)}
              >
                {action.title} ↗
              </button>
            ))}
            <button
              className="sm-btn"
              onClick={() =>
                onActionClick(
                  `关于决策信号「${signal.title}」（${signal.priority} 优先级）：${signal.description}\n\n推理依据：${signal.reasoning.replace(/<[^>]+>/g, '')}\n\n请帮我分析：这个问题还有哪些其他处理方案？不同选择分别会带来什么结果和风险？`,
                  context
                )
              }
            >
              其他 ↗
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
