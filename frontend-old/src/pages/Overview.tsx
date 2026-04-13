import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchProducts } from '../api/client'
import type { Product } from '../types/signals'
import { MOCK_PRODUCTS } from '../api/mockData'

function HealthBar({ score }: { score: number }) {
  const color = score >= 70 ? '#639922' : score >= 50 ? '#EF9F27' : '#E24B4A'
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginTop: 6,
      }}
    >
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
            width: `${score}%`,
            height: '100%',
            background: color,
            borderRadius: 99,
          }}
        />
      </div>
      <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', width: 28 }}>
        {score}
      </span>
    </div>
  )
}

const STAGE_BADGE: Record<string, { label: string; color: string; border: string; bg: string }> = {
  new:      { label: '新品期',   color: '#1D6FA4', border: '#9DCFED', bg: '#E8F4FC' },
  early:    { label: '前期',     color: '#6B3FA0', border: '#C3A8E5', bg: '#F0EAF8' },
  growth:   { label: '成长期',   color: '#3B6D11', border: '#C0DD97', bg: '#EAF3DE' },
  mature:   { label: '成熟期',   color: '#7A5800', border: '#FAC775', bg: '#FDF6E3' },
  declining:{ label: '战略收缩', color: '#5C5C5C', border: '#C8C8C8', bg: '#F5F5F5' },
}

function ProductCard({ product, onNavigate }: { product: Product; onNavigate: () => void }) {
  const p0 = product.signal_count_p0 ?? 0
  const p1 = product.signal_count_p1 ?? 0
  const health = product.health_score ?? 0
  const stageBadge = product.stage ? (STAGE_BADGE[product.stage] ?? STAGE_BADGE['new']) : null

  return (
    <div
      style={{
        background: 'var(--color-background-primary)',
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: 'var(--border-radius-lg)',
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.boxShadow =
          '0 0 0 1.5px rgba(0,0,0,.1)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
      }}
      onClick={onNavigate}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--color-text-primary)',
              marginBottom: 3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {product.name}
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--color-text-tertiary)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {product.asin} · {product.marketplace}
          </div>
        </div>
      </div>

      {/* Signal badges */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <span className="badge" style={{ fontSize: 11 }}>
          {product.category}
        </span>
        {stageBadge && (
          <span
            className="badge"
            style={{ fontSize: 11, color: stageBadge.color, borderColor: stageBadge.border, background: stageBadge.bg }}
          >
            {stageBadge.label}
          </span>
        )}
        {p0 > 0 && (
          <span
            className="badge"
            style={{
              color: '#A32D2D',
              borderColor: '#F7C1C1',
              background: '#FCEBEB',
              fontSize: 11,
            }}
          >
            {p0} 项 P0
          </span>
        )}
        {p1 > 0 && (
          <span
            className="badge"
            style={{
              color: '#633806',
              borderColor: '#FAC775',
              background: '#FAEEDA',
              fontSize: 11,
            }}
          >
            {p1} 项 P1
          </span>
        )}
        {p0 === 0 && p1 === 0 && (
          <span
            className="badge"
            style={{
              color: '#27500A',
              borderColor: '#C0DD97',
              background: '#EAF3DE',
              fontSize: 11,
            }}
          >
            状态良好
          </span>
        )}
      </div>

      {/* Health score */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span
            style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}
          >
            广告健康度
          </span>
        </div>
        <HealthBar score={health} />
      </div>

      {/* Action */}
      <button
        className="abtn"
        style={{ marginTop: 12, width: '100%', fontSize: 11 }}
        onClick={(e) => {
          e.stopPropagation()
          onNavigate()
        }}
      >
        查看分析 →
      </button>
    </div>
  )
}

export default function Overview() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchProducts()
      .then((data) => {
        setProducts(data)
        setIsLoading(false)
      })
      .catch(() => {
        setProducts(MOCK_PRODUCTS)
        setIsLoading(false)
      })
  }, [])

  return (
    <div style={{ padding: '1.5rem 0' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
          paddingBottom: '1rem',
          borderBottom: '0.5px solid var(--color-border-tertiary)',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 500,
              color: 'var(--color-text-primary)',
              marginBottom: 3,
            }}
          >
            产品概览
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
            {products.length} 个在售产品 · Roadvo US
          </div>
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--color-text-tertiary)',
            background: 'var(--color-background-secondary)',
            border: '0.5px solid var(--color-border-tertiary)',
            borderRadius: 'var(--border-radius-md)',
            padding: '5px 10px',
          }}
        >
          上次更新：{new Date().toLocaleDateString('zh-CN')}
        </div>
      </div>

      {isLoading ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: 200,
            color: 'var(--color-text-tertiary)',
            fontSize: 13,
          }}
        >
          加载中…
        </div>
      ) : (
        <>
          {/* Business summary cards */}
          {products.length > 0 && (() => {
            const totalRevenue = products.reduce((s, p) => s + (p.weekly_sales ?? 0), 0)
            const totalSpend = products.reduce((s, p) => s + (p.weekly_spend ?? 0), 0)
            const totalWaste = products.reduce((s, p) => s + (p.potential_weekly_savings ?? 0), 0)
            const totalPending = products.reduce((s, p) => s + (p.signal_count_p0 ?? 0) + (p.signal_count_p1 ?? 0), 0)
            // 利润：只对有数据的产品求和
            const profitProducts = products.filter(p => p.weekly_profit != null)
            const totalProfit = profitProducts.reduce((s, p) => s + (p.weekly_profit ?? 0), 0)
            const hasProfit = profitProducts.length > 0

            const cards: { label: string; value: string; sub?: string; valueColor?: string; bg?: string; border?: string }[] = [
              {
                label: '本周总营收',
                value: totalRevenue > 0 ? `$${totalRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—',
                valueColor: 'var(--color-text-primary)',
              },
              {
                label: '本周广告花费',
                value: totalSpend > 0 ? `$${totalSpend.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—',
                valueColor: 'var(--color-text-primary)',
              },
              {
                label: '本周预估利润',
                value: hasProfit ? `$${totalProfit.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—',
                sub: hasProfit ? (totalProfit >= 0 ? '广告后净利' : '当前亏损') : '需配置成本',
                valueColor: !hasProfit ? 'var(--color-text-tertiary)' : totalProfit >= 0 ? '#3B6D11' : '#A32D2D',
                bg: !hasProfit ? undefined : totalProfit >= 0 ? '#EAF3DE' : '#FCEBEB',
                border: !hasProfit ? undefined : totalProfit >= 0 ? '#C0DD97' : '#F7C1C1',
              },
              {
                label: '无效广告浪费',
                value: totalWaste > 0 ? `$${totalWaste.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—',
                sub: totalWaste > 0 ? '可立即节省' : undefined,
                valueColor: totalWaste > 0 ? '#A32D2D' : 'var(--color-text-tertiary)',
                bg: totalWaste > 0 ? '#FCEBEB' : undefined,
                border: totalWaste > 0 ? '#F7C1C1' : undefined,
              },
              {
                label: '待决策信号',
                value: String(totalPending),
                sub: totalPending > 0 ? `P0+P1` : '暂无紧急信号',
                valueColor: totalPending > 0 ? '#A32D2D' : '#3B6D11',
                bg: totalPending > 0 ? '#FCEBEB' : '#EAF3DE',
                border: totalPending > 0 ? '#F7C1C1' : '#C0DD97',
              },
            ]

            return (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: 10,
                  marginBottom: '1.5rem',
                }}
              >
                {cards.map((c) => (
                  <div
                    key={c.label}
                    style={{
                      background: c.bg ?? 'var(--color-background-primary)',
                      border: `0.5px solid ${c.border ?? 'var(--color-border-tertiary)'}`,
                      borderRadius: 'var(--border-radius-lg)',
                      padding: '12px 14px',
                    }}
                  >
                    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 6 }}>
                      {c.label}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 600, color: c.valueColor, lineHeight: 1.2 }}>
                      {c.value}
                    </div>
                    {c.sub && (
                      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 3 }}>
                        {c.sub}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          })()}

          {/* 跨产品盈亏对比横条 */}
          {products.length > 1 && products.some(p => p.acos_vs_bep !== undefined) && (
            <div style={{
              background: 'var(--color-background-primary)',
              border: '0.5px solid var(--color-border-tertiary)',
              borderRadius: 'var(--border-radius-lg)',
              padding: '12px 16px',
              marginBottom: '1.5rem',
            }}>
              <div style={{
                fontSize: 11, fontWeight: 500, color: 'var(--color-text-tertiary)',
                textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
              }}>
                盈亏对比 — 当前 ACOS vs 盈亏平衡线
              </div>
              {products.map(p => {
                const vs = p.acos_vs_bep
                const isProfit = vs !== undefined && vs < 0
                const isLoss = vs !== undefined && vs > 0
                const stageBadge = p.stage ? (STAGE_BADGE[p.stage] ?? null) : null
                return (
                  <div
                    key={p.asin}
                    onClick={() => {}}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '7px 0',
                      borderBottom: '0.5px solid var(--color-border-tertiary)',
                      cursor: 'default',
                    }}
                  >
                    <div style={{ width: 130, fontSize: 12, color: 'var(--color-text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name}
                    </div>
                    <div style={{ width: 60 }}>
                      {stageBadge && (
                        <span className="badge" style={{ fontSize: 10,
                          color: stageBadge.color, borderColor: stageBadge.border, background: stageBadge.bg }}>
                          {stageBadge.label}
                        </span>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      {vs !== undefined ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 5, background: 'var(--color-background-secondary)',
                            borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{
                              width: `${Math.min(100, Math.abs(vs) / 20 * 100)}%`,
                              height: '100%',
                              background: isProfit ? '#639922' : isLoss ? '#E24B4A' : '#EF9F27',
                              borderRadius: 99,
                            }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 500, width: 88, flexShrink: 0,
                            color: isProfit ? '#3B6D11' : isLoss ? '#A32D2D' : 'var(--color-text-tertiary)' }}>
                            {isProfit
                              ? `✓ 盈利 ${Math.abs(vs).toFixed(1)}pt`
                              : isLoss
                              ? `亏损 ${vs.toFixed(1)}pt`
                              : '接近平衡'}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>暂无数据</span>
                      )}
                    </div>
                    <div style={{ width: 72, fontSize: 11, textAlign: 'right', flexShrink: 0,
                      color: (p.inventory_days ?? 99) < 30 ? '#854F0B' : 'var(--color-text-tertiary)' }}>
                      库存 {p.inventory_days ?? '—'} 天
                    </div>
                    <div style={{ width: 44, flexShrink: 0 }}>
                      {(p.signal_count_p0 ?? 0) > 0 && (
                        <span className="badge" style={{ fontSize: 10,
                          color: '#A32D2D', borderColor: '#F7C1C1', background: '#FCEBEB' }}>
                          {p.signal_count_p0} P0
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Product grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 12,
            }}
          >
            {products.map((product) => (
              <ProductCard
                key={product.asin}
                product={product}
                onNavigate={() => navigate(`/product/${product.asin}`)}
              />
            ))}
          </div>

          {products.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                color: 'var(--color-text-tertiary)',
                fontSize: 13,
                padding: 48,
                background: 'var(--color-background-secondary)',
                borderRadius: 'var(--border-radius-lg)',
              }}
            >
              暂无产品数据
            </div>
          )}
        </>
      )}
    </div>
  )
}
