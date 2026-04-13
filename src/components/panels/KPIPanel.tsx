"use client";

import { useEffect, useState } from "react";
import { useAppStore, getCategoryKey } from "@/store/appStore";
import { BarChart3 } from "lucide-react";
import { Area, ComposedChart, CartesianGrid, Line, XAxis, YAxis } from "recharts";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Card, CardContent } from "@/components/ui/card";
import { PanelSkeleton } from "@/components/ui/panel-skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Window = "today" | "yesterday" | "w7" | "w14" | "d30";

interface AsinRow {
  asin: string;
  gmv: number; orders: number; units: number;
  ad_spend: number; ad_sales: number; ad_orders: number;
  impressions: number; clicks: number; sessions: number;
  acos: number | null; tacos: number | null;
  ctr: number | null; cvr: number | null;
  cpc: number | null; roas: number | null;
}

interface KPIData {
  period: string;
  window: string;
  categoryKey: string;
  total: AsinRow;
  byAsin: AsinRow[];
}

function pct(v: number | null): string {
  return v != null ? `${(v * 100).toFixed(1)}%` : "—";
}
function cur(v: number): string {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function num(v: number): string {
  return v.toLocaleString("en-US");
}

const WINDOWS: { id: Window; label: string }[] = [
  { id: "today", label: "今天" },
  { id: "yesterday", label: "昨天" },
  { id: "w7", label: "7天" },
  { id: "w14", label: "14天" },
  { id: "d30", label: "30天" },
];

/* ---------- Metric card config ---------- */

interface MetricDef {
  label: string;
  value: (t: AsinRow) => string;
  warn?: (t: AsinRow) => boolean;
}

const METRIC_DEFS: MetricDef[] = [
  { label: "GMV",    value: t => cur(t.gmv) },
  { label: "订单量",  value: t => num(t.orders) },
  { label: "广告花费", value: t => cur(t.ad_spend) },
  { label: "ACoS",   value: t => pct(t.acos), warn: t => t.acos != null && t.acos > 0.5 },
  { label: "CTR",    value: t => pct(t.ctr) },
  { label: "ROAS",   value: t => t.roas != null ? t.roas.toFixed(2) : "—" },
];

/* ---------- ACoS & GMV trend chart config ---------- */

const trendConfig = {
  acos: { label: "ACoS", color: "#06b6d4" },
  gmv: { label: "GMV", color: "#2563eb" },
} satisfies ChartConfig;

/* ---------- Main component ---------- */

export default function KPIPanel() {
  const { activeNav } = useAppStore();
  const activeCategoryKey = getCategoryKey(activeNav);
  const [window, setWindow] = useState<Window>("w7");
  const [data, setData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dailyData, setDailyData] = useState<Array<{ date: string; acos: number; gmv: number }>>([]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ window });
    if (activeCategoryKey) params.set("categoryKey", activeCategoryKey);
    fetch(`/api/features/kpi?${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error as string); return; }
        setData(d as KPIData);
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [activeCategoryKey, window]);

  /* Fetch daily trend data for ACoS & GMV chart */
  useEffect(() => {
    fetch("/api/features/overview")
      .then(r => r.json())
      .then(d => {
        if (d.dailyTotals) {
          setDailyData(
            d.dailyTotals.map((day: { date: string; ad_spend: number; ad_sales: number; gmv: number }) => ({
              date: day.date.slice(5),
              acos: day.ad_sales > 0 ? (day.ad_spend / day.ad_sales) * 100 : 0,
              gmv: day.gmv,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="h-full overflow-y-auto p-6 bg-background">
      {/* Header + time window tabs */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            {activeCategoryKey ? `${activeCategoryKey} KPI` : "全品类 KPI"}
          </h1>
          {data && <p className="text-xs mt-0.5 text-muted-foreground">{data.period}</p>}
        </div>
        <Tabs value={window} onValueChange={(v) => setWindow(v as Window)}>
          <TabsList>
            {WINDOWS.map(({ id, label }) => (
              <TabsTrigger key={id} value={id} className="text-xs">
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {loading && <PanelSkeleton />}

      {!loading && error && (
        <div className="flex items-center justify-center h-[60vh]">
          <Card className="max-w-sm">
            <CardContent className="text-center space-y-3 py-8">
              <BarChart3 size={40} className="mx-auto text-muted-foreground/50" />
              <h3 className="font-semibold text-foreground">暂无数据</h3>
              <p className="text-sm text-muted-foreground">上传产品报表后，KPI 汇总将自动计算</p>
            </CardContent>
          </Card>
        </div>
      )}

      {!loading && data && (
        <>
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            {METRIC_DEFS.map(metric => {
              const isWarn = metric.warn?.(data.total);
              return (
                <Card key={metric.label}>
                  <CardContent className="p-3">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      {metric.label}
                    </p>
                    <p className={cn(
                      "text-xl font-bold font-mono",
                      isWarn ? "text-destructive" : "text-foreground"
                    )}>
                      {metric.value(data.total)}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* ACoS & GMV Trend Chart */}
          {dailyData.length > 0 && (
            <Card className="mb-6">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">ACoS & GMV 趋势</p>
                    <p className="text-xs text-muted-foreground">近 7 天每日变化</p>
                  </div>
                </div>
                <ChartContainer config={trendConfig} className="h-48 w-full">
                  <ComposedChart data={dailyData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="acos" orientation="left" tick={{ fontSize: 11 }} unit="%" domain={[0, 'auto']} />
                    <YAxis yAxisId="gmv" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area yAxisId="gmv" type="natural" dataKey="gmv" stroke="var(--color-gmv)" fill="var(--color-gmv)" fillOpacity={0.1} strokeWidth={2} dot={false} />
                    <Line yAxisId="acos" type="natural" dataKey="acos" stroke="var(--color-acos)" strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          {/* Per-ASIN detail table */}
          {data.byAsin.length === 0 ? (
            <p className="text-center text-sm py-10 text-muted-foreground">无 ASIN 数据</p>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    {["ASIN", "GMV", "订单", "广告花费", "ACoS", "TACoS", "CTR", "CVR", "CPC", "ROAS"].map(h => (
                      <TableHead key={h} className="text-xs text-muted-foreground font-semibold">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byAsin.map(row => (
                    <TableRow key={row.asin} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-xs">{row.asin}</TableCell>
                      <TableCell className="font-mono text-sm font-medium">{cur(row.gmv)}</TableCell>
                      <TableCell className="font-mono text-sm">{num(row.orders)}</TableCell>
                      <TableCell className="font-mono text-sm">{cur(row.ad_spend)}</TableCell>
                      <TableCell className={cn("font-mono text-sm font-medium", row.acos != null && row.acos > 0.5 && "text-destructive")}>
                        {pct(row.acos)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{pct(row.tacos)}</TableCell>
                      <TableCell className="font-mono text-sm">{pct(row.ctr)}</TableCell>
                      <TableCell className="font-mono text-sm">{pct(row.cvr)}</TableCell>
                      <TableCell className="font-mono text-sm">{row.cpc != null ? `$${row.cpc}` : "—"}</TableCell>
                      <TableCell className="font-mono text-sm">{row.roas != null ? row.roas.toFixed(2) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
