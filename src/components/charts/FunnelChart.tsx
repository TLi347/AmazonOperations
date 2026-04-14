"use client"

import { Card, CardContent } from "@/components/ui/card"

const FUNNEL_COLORS = ["#3b82f6", "#6366f1", "#8b5cf6", "#a855f7"]

export interface FunnelData {
  stage: string
  value: number
  rate: number | null
}

export function AdFunnelChart({ data, title }: { data: FunnelData[]; title?: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        {title && (
          <div className="mb-4">
            <p className="text-sm font-medium text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">曝光 → 点击 → 广告订单 → 总订单</p>
          </div>
        )}

        {/* Funnel bars */}
        <div className="space-y-3">
          {data.map((item, idx) => {
            const maxValue = data[0]?.value || 1
            const widthPct = Math.max((item.value / maxValue) * 100, 8) // minimum 8% width
            return (
              <div key={item.stage} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-16 text-right shrink-0">{item.stage}</span>
                <div className="flex-1 relative">
                  <div
                    className="h-8 rounded-md flex items-center px-3 transition-all"
                    style={{ width: `${widthPct}%`, backgroundColor: FUNNEL_COLORS[idx] }}
                  >
                    <span className="text-xs font-semibold text-white whitespace-nowrap">
                      {item.value.toLocaleString()}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground w-14 shrink-0">
                  {item.rate != null ? `${(item.rate * 100).toFixed(1)}%` : ""}
                </span>
              </div>
            )
          })}
        </div>

        {/* Conversion rate labels between stages */}
        <div className="mt-4 flex justify-around text-center">
          {data.slice(1).map((item, idx) => (
            <div key={item.stage}>
              <p className="text-lg font-bold font-mono text-foreground">
                {item.rate != null ? `${(item.rate * 100).toFixed(2)}%` : "—"}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {data[idx].stage} → {item.stage}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
