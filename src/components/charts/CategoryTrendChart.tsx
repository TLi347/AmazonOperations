"use client"

import { useState } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface CategoryMeta {
  key: string
  label: string
}

interface CategoryTrendChartProps {
  data: Array<Record<string, string | number>>
  categories: CategoryMeta[]
}

const COLORS: Record<string, string> = {
  mattress: "#2563eb",
  pump: "#7c3aed",
  scooter: "#f59e0b",
}

export function CategoryTrendChart({ data, categories }: CategoryTrendChartProps) {
  const [mode, setMode] = useState<"absolute" | "proportion">("absolute")

  const chartConfig = categories.reduce<ChartConfig>((acc, cat) => {
    acc[cat.key] = {
      label: cat.label,
      color: COLORS[cat.key] ?? "#6b7280",
    }
    return acc
  }, {})

  const chartData =
    mode === "proportion"
      ? data.map((row) => {
          const total = categories.reduce(
            (sum, cat) => sum + (Number(row[cat.key]) || 0),
            0,
          )
          const result: Record<string, unknown> = { date: row.date }
          categories.forEach((cat) => {
            result[cat.key] =
              total > 0
                ? +((Number(row[cat.key]) || 0) / total * 100).toFixed(1)
                : 0
          })
          return result
        })
      : data

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-foreground">品类 GMV 趋势</p>
            <p className="text-xs text-muted-foreground">按品类的每日 GMV</p>
          </div>
          <Tabs
            value={mode}
            onValueChange={(v) => setMode(v as "absolute" | "proportion")}
          >
            <TabsList className="h-7">
              <TabsTrigger value="absolute" className="text-[10px] px-2 h-5">
                绝对值
              </TabsTrigger>
              <TabsTrigger value="proportion" className="text-[10px] px-2 h-5">
                占比
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              {categories.map((cat) => (
                <linearGradient
                  key={cat.key}
                  id={`fill-${cat.key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor={COLORS[cat.key] ?? "#6b7280"}
                    stopOpacity={0.4}
                  />
                  <stop
                    offset="95%"
                    stopColor={COLORS[cat.key] ?? "#6b7280"}
                    stopOpacity={0.05}
                  />
                </linearGradient>
              ))}
            </defs>
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
              tickFormatter={(v: number) =>
                mode === "proportion"
                  ? `${v}%`
                  : `$${(v / 1000).toFixed(0)}k`
              }
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) =>
                    mode === "proportion"
                      ? `${Number(value).toFixed(1)}%`
                      : `$${Number(value).toLocaleString()}`
                  }
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            {categories.map((cat) => (
              <Area
                key={cat.key}
                type="monotone"
                dataKey={cat.key}
                stackId="1"
                stroke={COLORS[cat.key] ?? "#6b7280"}
                fill={`url(#fill-${cat.key})`}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
