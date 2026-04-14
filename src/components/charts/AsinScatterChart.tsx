"use client"

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ZAxis,
  Label,
  LabelList,
  Cell,
} from "recharts"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Card, CardContent } from "@/components/ui/card"
import { useMemo } from "react"

export interface AsinScatterItem {
  asin: string
  gmv: number
  acos: number
  adSpend: number
}

function getAcosColor(acos: number): string {
  if (acos < 0.35) return "#22c55e"
  if (acos < 0.55) return "#f59e0b"
  return "#ef4444"
}

const chartConfig = {
  gmv: { label: "GMV ($)", color: "#2563eb" },
  acos: { label: "ACoS (%)", color: "#06b6d4" },
  adSpend: { label: "广告花费 ($)", color: "#8b5cf6" },
} satisfies ChartConfig

function generateAsinInsight(data: AsinScatterItem[]): string {
  const inefficient = data.filter((d) => d.acos >= 0.55)
  if (inefficient.length > 0) {
    const topWaste = inefficient.sort((a, b) => b.adSpend - a.adSpend)[0]
    return `⚠️ ${inefficient.length} 个产品 ACoS > 55%，最高花费 ASIN ...${topWaste.asin.slice(-5)}（$${topWaste.adSpend.toLocaleString()}），建议优先优化`
  }
  return "✅ 全部产品广告效率在健康范围内"
}

export function AsinScatterChart({ data }: { data: AsinScatterItem[] }) {
  // Transform acos to percentage for display, add short label
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        acosPercent: +(d.acos * 100).toFixed(1),
        label: `...${d.asin.slice(-5)}`,
      })),
    [data]
  )

  const { efficient, moderate, inefficient } = useMemo(() => ({
    efficient: data.filter((d) => d.acos < 0.35),
    moderate: data.filter((d) => d.acos >= 0.35 && d.acos < 0.55),
    inefficient: data.filter((d) => d.acos >= 0.55),
  }), [data])

  const insight = useMemo(() => generateAsinInsight(data), [data])

  const legendItems = [
    { label: "ACoS <35%", color: "#22c55e" },
    { label: "ACoS 35-55%", color: "#f59e0b" },
    { label: "ACoS >55%", color: "#ef4444" },
  ]

  if (data.length === 0) return null

  return (
    <Card className="mb-6">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              ASIN 效率散点图
            </p>
            <p className="text-xs text-muted-foreground">
              X=GMV, Y=ACoS(%), 气泡大小=广告花费
            </p>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-3">
            {legendItems.map((item) => (
              <div key={item.label} className="flex items-center gap-1">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs text-muted-foreground">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <ChartContainer config={chartConfig} className="h-64 w-full">
          <ScatterChart
            margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              className="stroke-border"
            />
            <XAxis
              type="number"
              dataKey="gmv"
              name="GMV ($)"
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) =>
                v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
              }
            >
              <Label
                value="GMV ($)"
                position="insideBottom"
                offset={-5}
                className="text-xs fill-muted-foreground"
              />
            </XAxis>
            <YAxis
              type="number"
              dataKey="acosPercent"
              name="ACoS (%)"
              tick={{ fontSize: 11 }}
              unit="%"
              domain={[0, "auto"]}
            >
              <Label
                value="ACoS (%)"
                angle={-90}
                position="insideLeft"
                offset={5}
                className="text-xs fill-muted-foreground"
              />
            </YAxis>
            <ZAxis
              type="number"
              dataKey="adSpend"
              range={[60, 400]}
              name="广告花费 ($)"
            />

            {/* Target ACoS reference line at 35% */}
            <ReferenceLine
              y={35}
              stroke="#22c55e"
              strokeDasharray="5 5"
              label={{
                value: "目标 ACoS 35%",
                position: "insideTopRight",
                fontSize: 10,
                fill: "#22c55e",
              }}
            />

            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => {
                    if (name === "GMV ($)")
                      return `$${Number(value).toLocaleString()}`
                    if (name === "ACoS (%)")
                      return `${value}%`
                    if (name === "广告花费 ($)")
                      return `$${Number(value).toLocaleString()}`
                    return String(value)
                  }}
                  labelFormatter={(_label, payload) => {
                    const item = payload?.[0]?.payload as
                      | (AsinScatterItem & { acosPercent: number })
                      | undefined
                    return item ? item.asin : String(_label)
                  }}
                />
              }
            />

            <Scatter data={chartData} name="ASIN">
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getAcosColor(entry.acos)}
                  fillOpacity={0.75}
                  stroke={getAcosColor(entry.acos)}
                  strokeWidth={1}
                />
              ))}
              <LabelList dataKey="label" position="top" fontSize={10} className="fill-muted-foreground" />
            </Scatter>
          </ScatterChart>
        </ChartContainer>

        {/* Efficiency summary cards */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="rounded-md bg-emerald-50 p-2 text-center">
            <p className="text-lg font-bold text-emerald-700">{efficient.length}</p>
            <p className="text-[10px] text-emerald-600">高效产品</p>
            <p className="text-[10px] text-muted-foreground">ACoS &lt; 35%</p>
          </div>
          <div className="rounded-md bg-amber-50 p-2 text-center">
            <p className="text-lg font-bold text-amber-700">{moderate.length}</p>
            <p className="text-[10px] text-amber-600">待优化</p>
            <p className="text-[10px] text-muted-foreground">35-55%</p>
          </div>
          <div className="rounded-md bg-red-50 p-2 text-center">
            <p className="text-lg font-bold text-destructive">{inefficient.length}</p>
            <p className="text-[10px] text-destructive">低效产品</p>
            <p className="text-[10px] text-muted-foreground">ACoS &gt; 55%</p>
          </div>
        </div>

        {/* Auto-insight */}
        <p className="mt-3 text-xs text-muted-foreground">{insight}</p>
      </CardContent>
    </Card>
  )
}
