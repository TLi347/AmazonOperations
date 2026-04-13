import React from 'react'

interface CompetitorDataPoint {
  brand: string
  click_share: number
  delta?: number
  is_self?: boolean
}

interface CompetitorChartProps {
  data: CompetitorDataPoint[]
  onAnalyzeClick?: (brand: string) => void
}

function getBrandBarColor(is_self: boolean, index: number): string {
  if (is_self) return '#378ADD'
  const colors = ['#E24B4A', '#EF9F27', '#888780', '#888780', '#B4B2A9', '#B4B2A9']
  return colors[index] ?? '#B4B2A9'
}

function getBrandTrackColor(is_self: boolean): string {
  return is_self ? '#C5DCF2' : 'var(--color-background-secondary)'
}

export default function CompetitorChart({ data, onAnalyzeClick }: CompetitorChartProps) {
  const maxShare = Math.max(...data.map((d) => d.click_share))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
      {data.map((item, index) => {
        const barWidth = (item.click_share / maxShare) * 100
        const barColor = getBrandBarColor(item.is_self ?? false, index)
        const trackColor = getBrandTrackColor(item.is_self ?? false)
        const deltaVal = item.delta ?? 0
        const deltaClass =
          deltaVal > 0 ? 'up' : deltaVal < 0 ? 'dn' : 'nt'
        const deltaStr =
          deltaVal === 0
            ? '0.0'
            : (deltaVal > 0 ? '+' : '') + deltaVal.toFixed(1)

        return (
          <div
            key={item.brand}
            className={`comp-row${item.is_self ? ' comp-self' : ''}`}
          >
            <div className="comp-label">{item.brand}</div>
            <div className="comp-bar-wrap">
              <div
                className="comp-bar-track"
                style={{ background: trackColor }}
              >
                <div
                  className="comp-bar-fill"
                  style={{ width: `${barWidth}%`, background: barColor }}
                >
                  <span
                    className="comp-bar-val"
                    style={{
                      color: '#fff',
                      fontSize: 10,
                    }}
                  >
                    {item.click_share.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
            <div className={`comp-delta-col ${deltaClass}`}>{deltaStr}</div>
          </div>
        )
      })}

      {onAnalyzeClick && data.length > 0 && (
        <button
          className="sm-btn"
          style={{ marginTop: 10, width: '100%', fontSize: 11 }}
          onClick={() => onAnalyzeClick(data[0].brand)}
        >
          分析 {data[0].brand} 威胁 ↗
        </button>
      )}
    </div>
  )
}
