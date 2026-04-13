import React from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Dot,
} from 'recharts'

interface AcosDataPoint {
  week: string
  acos: number
  hasDecision?: boolean
}

interface AcosTrendChartProps {
  data: AcosDataPoint[]
  targetAcos?: number
}

interface CustomDotProps {
  cx?: number
  cy?: number
  payload?: AcosDataPoint
  index?: number
}

function CustomDot(props: CustomDotProps) {
  const { cx, cy, payload } = props
  if (cx == null || cy == null || !payload) return null

  if (payload.hasDecision) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={6} fill="#E24B4A" stroke="#fff" strokeWidth={2} />
      </g>
    )
  }
  return (
    <circle cx={cx} cy={cy} r={3} fill="#378ADD" stroke="#fff" strokeWidth={1.5} />
  )
}

interface TooltipPayloadEntry {
  name: string
  value: number
  color: string
}

interface CustomTooltipProps {
  active?: boolean
  label?: string
  payload?: TooltipPayloadEntry[]
}

function CustomTooltip({ active, label, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div
      style={{
        background: 'var(--color-background-primary)',
        border: '0.5px solid var(--color-border-secondary)',
        borderRadius: 'var(--border-radius-md)',
        padding: '6px 10px',
        fontSize: 11,
      }}
    >
      <div style={{ fontWeight: 500, marginBottom: 2 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>
          {p.name}: {p.value.toFixed(1)}%
        </div>
      ))}
    </div>
  )
}

export default function AcosTrendChart({
  data,
  targetAcos = 45,
}: AcosTrendChartProps) {
  const values = data.map((d) => d.acos)
  const minVal = Math.max(0, Math.min(...values, targetAcos) - 5)
  const maxVal = Math.max(...values, targetAcos) + 10

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart
        data={data}
        margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="0"
          stroke="rgba(136,135,128,0.12)"
          vertical={false}
        />
        <XAxis
          dataKey="week"
          tick={{ fontSize: 10, fill: '#888780' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[minVal, maxVal]}
          tickFormatter={(v: number) => v + '%'}
          tick={{ fontSize: 10, fill: '#888780' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine
          y={targetAcos}
          stroke="#B4B2A9"
          strokeDasharray="4 4"
          strokeWidth={1}
          label={{
            value: `目标 ${targetAcos}%`,
            position: 'right',
            fontSize: 9,
            fill: '#B4B2A9',
          }}
        />
        <Line
          type="monotone"
          dataKey="acos"
          name="整体 ACOS"
          stroke="#378ADD"
          strokeWidth={2}
          fill="rgba(55,138,221,0.07)"
          dot={<CustomDot />}
          activeDot={{ r: 5, fill: '#378ADD' }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
