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

export interface InventoryMatrixItem {
  asin: string
  label: string
  dailyAvg: number
  daysOfSupply: number
  sellableQty: number
  quadrant: "critical" | "warning" | "healthy" | "stale" | "observe"
}

const QUADRANT_COLORS: Record<string, string> = {
  critical: "#ef4444",
  warning: "#f59e0b",
  healthy: "#22c55e",
  stale: "#a855f7",
  observe: "#6b7280",
}

const QUADRANT_LABELS: Record<string, string> = {
  critical: "紧急补货",
  warning: "注意补货",
  healthy: "健康",
  stale: "滞销风险",
  observe: "观察",
}

const chartConfig = {
  dailyAvg: { label: "日均销量", color: "#2563eb" },
  daysOfSupply: { label: "库存天数", color: "#06b6d4" },
} satisfies ChartConfig

function generateInventoryInsight(data: InventoryMatrixItem[]): string {
  const critical = data.filter((d) => d.quadrant === "critical")
  if (critical.length > 0) {
    const names = critical.map((d) => d.label || d.asin.slice(-5)).join("、")
    return `🔴 ${critical.length} 个产品库存紧急：${names}，建议立即安排补货`
  }
  const warning = data.filter((d) => d.quadrant === "warning")
  if (warning.length > 0)
    return `🟡 ${warning.length} 个产品库存偏低，建议本周安排补货计划`
  return "✅ 全部产品库存充足"
}

export function InventoryMatrixChart({
  data,
}: {
  data: InventoryMatrixItem[]
}) {
  const medianDailyAvg = useMemo(() => {
    const sorted = data.map((d) => d.dailyAvg).sort((a, b) => a - b)
    return sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0
  }, [data])

  const legendItems = useMemo(() => {
    const present = new Set(data.map((d) => d.quadrant))
    return Array.from(present).map((q) => ({
      key: q,
      label: QUADRANT_LABELS[q] ?? q,
      color: QUADRANT_COLORS[q] ?? "#6b7280",
    }))
  }, [data])

  const quadrantCounts = useMemo(() => {
    const critical = data.filter((d) => d.quadrant === "critical")
    const warning = data.filter((d) => d.quadrant === "warning")
    const healthy = data.filter((d) => d.quadrant === "healthy")
    const stale = data.filter((d) => d.quadrant === "stale" || d.quadrant === "observe")
    return { critical, warning, healthy, stale }
  }, [data])

  const insight = useMemo(() => generateInventoryInsight(data), [data])

  if (data.length === 0) return null

  return (
    <Card className="mb-6">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              库存健康矩阵
            </p>
            <p className="text-xs text-muted-foreground">
              X=日均销量, Y=库存天数, 颜色=健康状态
            </p>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-3">
            {legendItems.map((item) => (
              <div key={item.key} className="flex items-center gap-1">
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

        <ChartContainer config={chartConfig} className="h-72 w-full">
          <ScatterChart
            margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              className="stroke-border"
            />
            <XAxis
              type="number"
              dataKey="dailyAvg"
              name="日均销量"
              tick={{ fontSize: 11 }}
              unit="件"
            >
              <Label
                value="日均销量"
                position="insideBottom"
                offset={-5}
                className="text-xs fill-muted-foreground"
              />
            </XAxis>
            <YAxis
              type="number"
              dataKey="daysOfSupply"
              name="库存天数"
              tick={{ fontSize: 11 }}
              unit="天"
              domain={[0, "auto"]}
            >
              <Label
                value="库存天数"
                angle={-90}
                position="insideLeft"
                offset={5}
                className="text-xs fill-muted-foreground"
              />
            </YAxis>
            <ZAxis
              type="number"
              dataKey="sellableQty"
              range={[60, 400]}
              name="可售数量"
            />

            {/* Reference lines */}
            <ReferenceLine
              y={45}
              stroke="#f59e0b"
              strokeDasharray="5 5"
              label={{
                value: "45天",
                position: "insideTopRight",
                fontSize: 10,
                fill: "#f59e0b",
              }}
            />
            {medianDailyAvg > 0 && (
              <ReferenceLine
                x={medianDailyAvg}
                stroke="#6b7280"
                strokeDasharray="5 5"
                label={{
                  value: `中位数 ${medianDailyAvg}`,
                  position: "insideTopRight",
                  fontSize: 10,
                  fill: "#6b7280",
                }}
              />
            )}

            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name, item) => {
                    const payload = item?.payload as
                      | InventoryMatrixItem
                      | undefined
                    if (!payload) return null
                    if (name === "日均销量")
                      return `${value} 件/天`
                    if (name === "库存天数")
                      return `${value} 天`
                    if (name === "可售数量")
                      return `${value} 件`
                    return String(value)
                  }}
                  labelFormatter={(_label, payload) => {
                    const item = payload?.[0]?.payload as
                      | InventoryMatrixItem
                      | undefined
                    return item
                      ? `${item.asin} (${item.label})`
                      : String(_label)
                  }}
                />
              }
            />

            <Scatter data={data} name="ASIN">
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={QUADRANT_COLORS[entry.quadrant] ?? "#6b7280"}
                  fillOpacity={0.75}
                  stroke={QUADRANT_COLORS[entry.quadrant] ?? "#6b7280"}
                  strokeWidth={1}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ChartContainer>

        {/* Quadrant summary cards */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          <div className="rounded-md bg-red-50 p-2 text-center">
            <p className="text-lg font-bold text-destructive">{quadrantCounts.critical.length}</p>
            <p className="text-[10px] text-destructive">紧急补货</p>
            <p className="text-[10px] text-muted-foreground">&lt;30天</p>
          </div>
          <div className="rounded-md bg-amber-50 p-2 text-center">
            <p className="text-lg font-bold text-amber-700">{quadrantCounts.warning.length}</p>
            <p className="text-[10px] text-amber-600">准备补货</p>
            <p className="text-[10px] text-muted-foreground">30-45天</p>
          </div>
          <div className="rounded-md bg-emerald-50 p-2 text-center">
            <p className="text-lg font-bold text-emerald-700">{quadrantCounts.healthy.length}</p>
            <p className="text-[10px] text-emerald-600">库存健康</p>
            <p className="text-[10px] text-muted-foreground">&gt;45天</p>
          </div>
          <div className="rounded-md bg-muted p-2 text-center">
            <p className="text-lg font-bold text-muted-foreground">{quadrantCounts.stale.length}</p>
            <p className="text-[10px] text-muted-foreground">滞销/观察</p>
          </div>
        </div>

        {/* Auto-insight */}
        <p className="mt-3 text-xs text-muted-foreground">{insight}</p>
      </CardContent>
    </Card>
  )
}
