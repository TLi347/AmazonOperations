"use client"

import { useMemo } from "react"
import { Bar, BarChart, XAxis, YAxis, Cell, LabelList } from "recharts"
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const STAGE_COLORS = ["#3b82f6", "#6366f1", "#8b5cf6", "#a855f7"]

const chartConfig = {
  value: { label: "数量" },
} satisfies ChartConfig

export interface FunnelData {
  stage: string
  value: number
  rate: number | null
}

export interface AsinFunnel {
  asin: string
  impressions: number
  clicks: number
  ad_orders: number
  orders: number
}

/* ---------- Benchmarks ---------- */

const BENCHMARKS: Record<string, number> = {
  "曝光→点击": 0.03,
  "点击→广告订单": 0.05,
}

/* ---------- Insight generator ---------- */

function generateFunnelInsight(data: FunnelData[], byAsin?: AsinFunnel[]): string {
  const ctr = data[1]?.rate
  const cvr = data[2]?.rate
  if (ctr != null && ctr < 0.03)
    return `⚠️ 点击率 ${(ctr * 100).toFixed(1)}% 低于基准 3%，建议检查主图和标题竞争力`
  if (cvr != null && cvr < 0.05)
    return `⚠️ 转化率 ${(cvr * 100).toFixed(1)}% 低于基准 5%，建议检查价格、评分和详情页`
  if (byAsin && byAsin.length > 1) {
    const totalImpressions = byAsin.reduce((s, a) => s + a.impressions, 0)
    const topAsin = byAsin[0]
    const topShare = totalImpressions > 0 ? topAsin.impressions / totalImpressions : 0
    if (topShare > 0.7)
      return `⚠️ ASIN ...${topAsin.asin.slice(-5)} 占曝光 ${(topShare * 100).toFixed(0)}%，流量集中度过高`
  }
  return `✅ 转化链路健康：CTR ${((ctr ?? 0) * 100).toFixed(1)}%，CVR ${((cvr ?? 0) * 100).toFixed(1)}%`
}

/* ---------- Component ---------- */

export function AdFunnelChart({
  data,
  byAsin,
  title,
}: {
  data: FunnelData[]
  byAsin?: AsinFunnel[]
  title?: string
}) {
  // Prepare chart data for Recharts vertical BarChart
  const chartData = useMemo(() =>
    data.map((d, i) => ({
      stage: d.stage,
      value: d.value,
      fill: STAGE_COLORS[i % STAGE_COLORS.length],
    })),
    [data]
  )

  // Conversion rate cards between stages
  const transitions = useMemo(() =>
    data.slice(1).map((item, idx) => {
      const label = `${data[idx].stage}→${item.stage}`
      const benchmark = BENCHMARKS[label]
      const rateValue = item.rate ?? 0
      const aboveBenchmark = benchmark != null ? rateValue >= benchmark : null
      return { label, rate: item.rate, benchmark, aboveBenchmark }
    }),
    [data]
  )

  return (
    <Card>
      <CardContent className="pt-4">
        {title && (
          <div className="mb-4">
            <p className="text-sm font-medium text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">曝光 → 点击 → 广告订单 → 总订单</p>
          </div>
        )}

        {/* Horizontal bar chart (vertical layout = horizontal bars) */}
        <ChartContainer config={chartConfig} className="h-48 w-full">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 60, left: 10, bottom: 0 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="stage"
              tick={{ fontSize: 12 }}
              width={70}
              axisLine={false}
              tickLine={false}
            />
            <ChartTooltip
              content={<ChartTooltipContent formatter={(value) => Number(value).toLocaleString()} />}
            />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={32}>
              {chartData.map((entry, idx) => (
                <Cell key={idx} fill={entry.fill} />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={((v: any) => Number(v).toLocaleString()) as any}
                className="fill-foreground text-xs font-semibold"
              />
            </Bar>
          </BarChart>
        </ChartContainer>

        {/* Conversion rate annotations */}
        <div className="mt-4 flex justify-around text-center">
          {transitions.map(t => (
            <div key={t.label}>
              <p className={cn(
                "text-lg font-bold font-mono",
                t.aboveBenchmark === true ? "text-emerald-600" :
                t.aboveBenchmark === false ? "text-destructive" :
                "text-foreground"
              )}>
                {t.rate != null ? `${(t.rate * 100).toFixed(2)}%` : "—"}
              </p>
              <p className="text-[10px] text-muted-foreground">{t.label}</p>
              {t.benchmark != null && (
                <p className="text-[9px] text-muted-foreground">基准 {(t.benchmark * 100).toFixed(0)}%</p>
              )}
            </div>
          ))}
        </div>

        {/* Auto-insight */}
        <p className="mt-4 text-xs text-muted-foreground border-t border-border pt-3">
          {generateFunnelInsight(data, byAsin)}
        </p>
      </CardContent>
    </Card>
  )
}
