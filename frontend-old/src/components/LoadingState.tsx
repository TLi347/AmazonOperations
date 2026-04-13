import React from 'react'
import type { AnalysisStreamEvent } from '../types/signals'

interface LoadingStateProps {
  events: AnalysisStreamEvent[]
}

const STAGE_ORDER = ['data_fetch', 'analysis', 'signal_p0', 'complete']
const STAGE_LABELS: Record<string, string> = {
  data_fetch: '获取广告数据',
  analysis: 'AI 分析中',
  signal_p0: '生成决策信号',
  complete: '分析完成',
}
const STAGE_ICONS: Record<string, string> = {
  data_fetch: '📊',
  analysis: '🤖',
  signal_p0: '⚡',
  complete: '✅',
}

export default function LoadingState({ events }: LoadingStateProps) {
  const activeStages = new Set(events.map((e) => e.stage))
  const lastEvent = events[events.length - 1]

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 320,
        gap: 32,
      }}
    >
      {/* Spinner */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          border: '3px solid var(--color-background-secondary)',
          borderTopColor: 'var(--color-text-primary)',
          animation: 'spin 0.8s linear infinite',
        }}
      />

      {/* Stage list */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          width: 280,
        }}
      >
        {STAGE_ORDER.map((stage, i) => {
          const isDone = activeStages.has(stage)
          const isActive =
            lastEvent?.stage === stage ||
            (!isDone && i === STAGE_ORDER.findIndex((s) => !activeStages.has(s)))

          return (
            <div
              key={stage}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                borderRadius: 'var(--border-radius-md)',
                background: isActive
                  ? 'var(--color-background-secondary)'
                  : 'transparent',
                opacity: isDone || isActive ? 1 : 0.35,
                transition: 'all 0.3s',
              }}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>
                {isDone && stage !== lastEvent?.stage
                  ? '✅'
                  : STAGE_ICONS[stage] ?? '⏳'}
              </span>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: isActive ? 500 : 400,
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {STAGE_LABELS[stage] ?? stage}
                </div>
                {isActive && lastEvent && (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--color-text-tertiary)',
                      marginTop: 1,
                    }}
                  >
                    {lastEvent.message}
                  </div>
                )}
              </div>
              {isActive && (
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--color-text-primary)',
                    animation: 'pulse 1s ease-in-out infinite',
                    flexShrink: 0,
                  }}
                />
              )}
            </div>
          )
        })}
      </div>

      <div
        style={{
          fontSize: 11,
          color: 'var(--color-text-tertiary)',
          textAlign: 'center',
          maxWidth: 280,
          lineHeight: 1.6,
        }}
      >
        正在对接亚马逊广告数据并进行 AI 分析，通常需要 15–30 秒
      </div>
    </div>
  )
}
