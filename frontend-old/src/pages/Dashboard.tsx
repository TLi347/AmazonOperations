import React, { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import MetricsRow from '../components/MetricsRow'
import ContextStrip from '../components/ContextStrip'
import DecisionSignal from '../components/DecisionSignal'
import AcosTrendChart from '../components/AcosTrendChart'
import CompetitorChart from '../components/CompetitorChart'
import AnalysisDrawer from '../components/AnalysisDrawer'
import LoadingState from '../components/LoadingState'
import { fetchSignals, fetchBrandShare, confirmDecision } from '../api/client'
import type { BrandShareItem, ChatContext } from '../api/client'
import { useAnalysis } from '../hooks/useAnalysis'
import type { AnalysisResult } from '../types/signals'
import {
  MOCK_ANALYSIS,
  MOCK_ACOS_TREND,
} from '../api/mockData'

const DEFAULT_ASIN = 'B0GD7BF2TZ'

export default function Dashboard() {
  const { asin: paramAsin } = useParams<{ asin: string }>()
  const asin = paramAsin ?? DEFAULT_ASIN

  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [isFetching, setIsFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [brandShare, setBrandShare] = useState<BrandShareItem[]>([])

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerPrompt, setDrawerPrompt] = useState<string | undefined>(undefined)
  const [decidedSignals, setDecidedSignals] = useState<Set<string>>(new Set())

  const { isAnalyzing, progress, result: wsResult, startAnalysis } = useAnalysis()

  // Load data on mount or ASIN change
  useEffect(() => {
    let cancelled = false
    setIsFetching(true)
    setFetchError(null)

    fetchSignals(asin)
      .then((data) => {
        if (!cancelled) {
          setAnalysisResult(data)
          setIsFetching(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          // 无分析缓存，显示空状态，提示用户触发分析
          setAnalysisResult(null)
          setIsFetching(false)
        }
      })

    fetchBrandShare(asin)
      .then((data) => { if (!cancelled) setBrandShare(data) })
      .catch(() => { if (!cancelled) setBrandShare([]) })

    return () => {
      cancelled = true
    }
  }, [asin])

  // 分析完成后重新从接口取已映射好字段的数据，而不是直接用 WebSocket 原始 payload
  useEffect(() => {
    if (wsResult) {
      fetchSignals(asin)
        .then(setAnalysisResult)
        .catch(() => setAnalysisResult(wsResult))
      // 新分析完成时清空本地决策状态
      setDecidedSignals(new Set())
    }
  }, [wsResult, asin])

  const handleDecision = useCallback(
    async (signalId: string, dec: 'confirm' | 'reject') => {
      setDecidedSignals((prev) => new Set([...prev, signalId]))
      try {
        await confirmDecision(asin, signalId, dec)
      } catch {
        // 记录失败静默处理，本地状态已更新
      }
    },
    [asin]
  )

  const handleActionClick = useCallback(
    (prompt: string, _context?: ChatContext) => {
      setDrawerPrompt(prompt)
      setDrawerOpen(true)
      // Prevent stale prompt from re-firing — reset after a tick
      setTimeout(() => setDrawerPrompt(undefined), 100)
    },
    []
  )

  const handleHealthClick = useCallback(() => {
    const h = analysisResult?.health
    const prompt = h
      ? `当前广告健康度评分：总分 ${h.overall}/100（转化能力 ${h.conversion}，预算效率 ${h.budget_efficiency}，流量质量 ${h.traffic_quality}，词组结构 ${h.keyword_structure}，广告效率 ${h.ad_efficiency}）。请结合本产品的实际广告数据，解释各维度低分的具体原因，并给出优先级排序的提升步骤。`
      : '解释广告健康度各维度的计算方法，以及提升当前分数到70分以上的优先步骤'
    setDrawerPrompt(prompt)
    setDrawerOpen(true)
    setTimeout(() => setDrawerPrompt(undefined), 100)
  }, [analysisResult])

  const handleGenerateChecklist = useCallback(() => {
    setDrawerPrompt(
      `为${asin}生成本周完整运营执行清单，包含所有P0和P1操作步骤`
    )
    setDrawerOpen(true)
    setTimeout(() => setDrawerPrompt(undefined), 100)
  }, [asin])

  const drawerContext: ChatContext = analysisResult
    ? {
        asin: analysisResult.asin,
        stage: analysisResult.context.stage,
        current_acos: analysisResult.metrics.acos,
        inventory_days: analysisResult.context.inventory_days,
        latest_p0_count: analysisResult.signals.filter(s => s.priority === 'P0').length,
        latest_p1_count: analysisResult.signals.filter(s => s.priority === 'P1').length,
      }
    : { asin }

  const data = analysisResult

  // Count undecided P0/P1 signals (decided ones sink to the bottom)
  const p0Count = data?.signals.filter((s) => s.priority === 'P0' && !decidedSignals.has(s.signal_id)).length ?? 0
  const p1Count = data?.signals.filter((s) => s.priority === 'P1' && !decidedSignals.has(s.signal_id)).length ?? 0

  const isLoading = isFetching || isAnalyzing

  return (
    <div className="d">
      {/* TopBar */}
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 2,
              }}
            >
              <span className="product-name">
                {data?.product_name ?? asin}
              </span>
              {data && (
                <span className="badge">{data.context.bsr_main_category.split('›')[0].trim()}</span>
              )}
              {data && (() => {
                const stageMap: Record<string, { label: string; color: string; border: string; bg: string }> = {
                  new:    { label: '新品期', color: '#1D6FA4', border: '#9DCFED', bg: '#E8F4FC' },
                  early:  { label: '前期',   color: '#6B3FA0', border: '#C3A8E5', bg: '#F0EAF8' },
                  growth: { label: '成长期', color: '#3B6D11', border: '#C0DD97', bg: '#EAF3DE' },
                  mature: { label: '成熟期', color: '#7A5800', border: '#FAC775', bg: '#FDF6E3' },
                }
                const s = stageMap[data.context.stage] ?? stageMap['new']
                return (
                  <span className="badge" style={{ color: s.color, borderColor: s.border, background: s.bg }}>
                    {s.label}
                  </span>
                )
              })()}
              {p0Count > 0 && (
                <span
                  className="badge"
                  style={{
                    color: '#A32D2D',
                    borderColor: '#F7C1C1',
                    background: '#FCEBEB',
                  }}
                >
                  {p0Count} 项 P0
                </span>
              )}
              {p1Count > 0 && (
                <span
                  className="badge"
                  style={{
                    color: '#633806',
                    borderColor: '#FAC775',
                    background: '#FAEEDA',
                  }}
                >
                  {p1Count} 项 P1
                </span>
              )}
            </div>
            <span className="asin-tag">
              {asin} &nbsp;·&nbsp; Roadvo US
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {data && (
            <span className="date-tag">{data.date_range}</span>
          )}
          <button
            className="abtn"
            onClick={() => startAnalysis(asin)}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? '分析中…' : '重新分析'}
          </button>
          <button
            className="abtn pri"
            onClick={handleGenerateChecklist}
          >
            生成执行清单 ↗
          </button>
        </div>
      </div>

      {/* 全屏加载（首次分析，无缓存数据） */}
      {isAnalyzing && !data && (
        <LoadingState events={progress} />
      )}

      {/* 重新分析进度条（已有数据时显示顶部横幅） */}
      {isAnalyzing && data && (
        <div
          style={{
            margin: '0 0 12px',
            padding: '10px 14px',
            background: 'var(--color-background-secondary)',
            borderRadius: 'var(--border-radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 12,
            color: 'var(--color-text-secondary)',
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              border: '2px solid var(--color-background-primary)',
              borderTopColor: 'var(--color-text-primary)',
              animation: 'spin 0.8s linear infinite',
              flexShrink: 0,
            }}
          />
          <span>{progress[progress.length - 1]?.message ?? '正在启动分析…'}</span>
        </div>
      )}

      {/* 无分析数据引导 */}
      {!isLoading && !data && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 24px',
            gap: 16,
            color: 'var(--color-text-tertiary)',
          }}
        >
          <div style={{ fontSize: 40 }}>📊</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-secondary)' }}>
            该产品尚未分析
          </div>
          <div style={{ fontSize: 13 }}>点击右上角「重新分析」，AI 将读取所有数据并生成决策信号</div>
          <button
            className="abtn pri"
            style={{ marginTop: 8 }}
            onClick={() => startAnalysis(asin)}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? '分析中…' : '立即分析'}
          </button>
        </div>
      )}

      {/* Main content */}
      {data && (
        <>
          {/* Metrics */}
          <div className="sec-label">本周经营概览</div>
          <MetricsRow metrics={data.metrics} />

          {/* Context */}
          <div className="sec-label" style={{ marginBottom: 10 }}>
            产品运营背景
          </div>
          <ContextStrip
            context={data.context}
            health={data.health}
            onHealthClick={handleHealthClick}
          />

          {/* Signals */}
          <div
            className="sec-label"
            style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}
          >
            <span>
              决策信号
              {data.signals.length > 0 && (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 11,
                    fontWeight: 400,
                    color: 'var(--color-text-tertiary)',
                    textTransform: 'none',
                    letterSpacing: 0,
                  }}
                >
                  {data.signals.length} 条
                </span>
              )}
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 400,
                color: 'var(--color-text-tertiary)',
                textTransform: 'none',
                letterSpacing: 0,
              }}
            >
              — 点击展开数据依据与推理过程
            </span>
          </div>

          <div className="signals">
            {data.signals.map((signal) => (
              <DecisionSignal
                key={signal.signal_id}
                signal={signal}
                onActionClick={handleActionClick}
                onDecision={handleDecision}
              />
            ))}
            {data.signals.length === 0 && (
              <div
                style={{
                  padding: '24px',
                  textAlign: 'center',
                  color: 'var(--color-text-tertiary)',
                  fontSize: 13,
                  background: 'var(--color-background-secondary)',
                  borderRadius: 'var(--border-radius-lg)',
                }}
              >
                暂无决策信号，产品状态良好
              </div>
            )}
          </div>

          {/* Bottom charts */}
          <div className="two-col">
            <div className="card">
              <div className="card-title">
                整体 ACOS 趋势
                <span className="card-sub">8 周 · 含决策节点标注</span>
              </div>
              <div className="chart-wrap" style={{ height: 200 }}>
                <AcosTrendChart
                  data={MOCK_ACOS_TREND}
                  targetAcos={45}
                />
              </div>
            </div>

            <div className="card">
              <div className="card-title">
                市场点击份额
                <span className="card-sub">
                  {data.context.bsr_main_category.split('›')[0].trim()} 类目 · 本周
                </span>
              </div>
              {brandShare.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 12 }}>
                  暂无 ABA 市场数据，上传品牌分析报告后可见
                </div>
              ) : (
              <CompetitorChart
                data={brandShare}
                onAnalyzeClick={(brand) => {
                  const category = data.context.bsr_main_category.split('›')[0].trim()
                  handleActionClick(
                    `${brand}在${category}类目点击份额持续上升，结合我们产品${data.product_name}的当前数据，分析它的竞争策略对我们的具体威胁程度和应对建议`,
                    drawerContext
                  )
                }}
              />
              )}
            </div>
          </div>
        </>
      )}

      {/* Error state */}
      {fetchError && !data && (
        <div
          style={{
            padding: 24,
            textAlign: 'center',
            color: '#A32D2D',
            fontSize: 13,
          }}
        >
          {fetchError}
          <button
            className="abtn"
            style={{ marginLeft: 12 }}
            onClick={() => startAnalysis(asin)}
          >
            重试
          </button>
        </div>
      )}

      {/* AI Drawer */}
      <AnalysisDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        initialPrompt={drawerPrompt}
        context={drawerContext}
      />
    </div>
  )
}
