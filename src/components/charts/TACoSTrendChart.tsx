"use client"

import {
  Line,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ReferenceLine,
  ReferenceArea,
} from "recharts"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import { Card, CardContent } from "@/components/ui/card"

interface TACoSPoint {
  date: string
  tacos: number
  acos: number
}

interface TACoSTrendChartProps {
  data: TACoSPoint[]
}

const chartConfig = {
  tacos: { label: "TACoS", color: "#f97316" },
  acos: { label: "ACoS", color: "#06b6d4" },
} satisfies ChartConfig

/* ---------- Auto-insight ---------- */

function generateTacosInsight(
  data: Array<{ tacos: number; acos: number }>,
): string {
  if (data.length < 2) return ""
  const latest = data[data.length - 1]
  const prev = data[0]
  const tacosTrend = latest.tacos - prev.tacos
  const acosTrend = latest.acos - prev.acos

  if (tacosTrend < -1 && acosTrend > 1)
    return "✅ TACoS 下降但 ACoS 上升 → 自然流量在增长，广告依赖度降低"
  if (tacosTrend > 1 && acosTrend > 1)
    return "⚠️ TACoS 和 ACoS 同时上升 → 广告效率下降，需要优化关键词"
  if (tacosTrend < -1)
    return "✅ TACoS 持续下降，广告拉动自然增长效果好"
  if (tacosTrend > 2)
    return `⚠️ TACoS 上升 ${tacosTrend.toFixed(1)}pp，越来越依赖广告`
  return "TACoS 平稳，广告与自然流量比例稳定"
}

/* ---------- Component ---------- */

export function TACoSTrendChart({ data }: TACoSTrendChartProps) {
  const insight = generateTacosInsight(data)

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="mb-4">
          <p className="text-sm font-medium text-foreground">TACoS / ACoS 趋势</p>
          <p className="text-xs text-muted-foreground">
            广告花费占比对比（绿色区域为健康区间）
          </p>
        </div>
        <ChartContainer config={chartConfig} className="h-56 w-full">
          <LineChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              tickFormatter={(v: number) => `${v.toFixed(0)}%`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => `${Number(value).toFixed(1)}%`}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />

            {/* Healthy zone */}
            <ReferenceArea
              y1={0}
              y2={20}
              fill="#22c55e"
              fillOpacity={0.05}
              label={{
                value: "健康区",
                position: "insideTopRight",
                fontSize: 10,
                fill: "#22c55e",
              }}
            />

            {/* Target line */}
            <ReferenceLine
              y={20}
              stroke="#94a3b8"
              strokeDasharray="6 3"
              label={{
                value: "目标 20%",
                position: "insideTopRight",
                fill: "#94a3b8",
                fontSize: 11,
              }}
            />

            {/* TACoS line */}
            <Line
              type="monotone"
              dataKey="tacos"
              stroke="var(--color-tacos)"
              strokeWidth={2}
              dot={{ r: 3, fill: "#f97316" }}
              activeDot={{ r: 5 }}
            />

            {/* ACoS line */}
            <Line
              type="monotone"
              dataKey="acos"
              stroke="var(--color-acos)"
              strokeWidth={2}
              dot={{ r: 3, fill: "#06b6d4" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ChartContainer>

        {/* Auto-insight */}
        {insight && (
          <p className="mt-4 text-xs text-muted-foreground border-t border-border pt-3">
            {insight}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
