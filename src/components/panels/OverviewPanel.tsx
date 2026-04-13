"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/appStore";
import { cn } from "@/lib/utils";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

import { AlertTriangle, Bed, Wrench, Bike, Package, FileUp, DollarSign, ShoppingCart, TrendingUp, Percent } from "lucide-react";
import { PanelSkeleton } from "@/components/ui/panel-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/* ---------- Types ---------- */

interface DailyPoint {
  date: string;
  gmv: number;
  orders: number;
  ad_spend: number;
  ad_sales: number;
}

interface CategorySummary {
  categoryKey: string;
  displayName: string;
  asins: string[];
  kpi: {
    gmv: number;
    orders: number;
    ad_spend: number;
    ad_sales: number;
    acos: number | null;
    roas: number | null;
    dayCount: number;
  };
  daily: Array<{ date: string; gmv: number }>;
  alerts: { red: number; yellow: number };
}

interface OverviewData {
  period: string;
  categories: CategorySummary[];
  grandTotal: {
    gmv: number;
    orders: number;
    ad_spend: number;
    acos: number | null;
    roas: number | null;
  };
  dailyTotals: DailyPoint[];
  prevWeekTotal: {
    gmv: number;
    orders: number;
    ad_spend: number;
    ad_sales: number;
  };
  alertsTotal: { red: number; yellow: number };
}

/* ---------- Helpers ---------- */

function fmt(n: number, type: "currency" | "number" | "pct"): string {
  if (type === "currency")
    return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  if (type === "pct") return `${(n * 100).toFixed(1)}%`;
  return n.toLocaleString("en-US");
}

function calcDelta(
  current: number,
  previous: number,
): { value: number; label: string; color: string; arrow: string } {
  if (previous === 0)
    return { value: 0, label: "\u2014", color: "text-muted-foreground", arrow: "" };
  const pct = ((current - previous) / previous) * 100;
  const isUp = pct > 0;
  const isFlat = Math.abs(pct) < 1;
  return {
    value: pct,
    label: `${isFlat ? "\u2014" : isUp ? "\u2191" : "\u2193"} ${Math.abs(pct).toFixed(1)}%`,
    color: isFlat
      ? "text-muted-foreground"
      : isUp
        ? "text-emerald-600"
        : "text-destructive",
    arrow: isFlat ? "" : isUp ? "\u2191" : "\u2193",
  };
}

/* ---------- Chart components (shadcn chart) ---------- */

function MetricChart({
  data,
  dataKey,
  color,
}: {
  data: Array<Record<string, unknown>>;
  dataKey: string;
  color: string;
}) {
  const config = { [dataKey]: { label: dataKey, color } } satisfies ChartConfig
  return (
    <ChartContainer config={config} className="h-16 w-full">
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`fill-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <Area
          type="natural"
          dataKey={dataKey}
          stroke={color}
          fill={`url(#fill-${dataKey})`}
          strokeWidth={2}
          dot={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}

const barConfig = {
  gmv: { label: "GMV", color: "#3b82f6" },
} satisfies ChartConfig

function CategoryBarChart({ data }: { data: Array<{ date: string; gmv: number }> }) {
  return (
    <ChartContainer config={barConfig} className="h-16 w-full">
      <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <ChartTooltip
          content={<ChartTooltipContent hideLabel formatter={(value) => `$${Number(value).toLocaleString()}`} />}
        />
        <Bar dataKey="gmv" fill="var(--color-gmv)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

/* ---------- Category icons ---------- */

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  mattress: <Bed size={24} className="text-muted-foreground" />,
  pump: <Wrench size={24} className="text-muted-foreground" />,
  scooter: <Bike size={24} className="text-muted-foreground" />,
};

/* ---------- Main component ---------- */

export default function OverviewPanel() {
  const { setActiveNav, setActiveFuncTab } = useAppStore();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/features/overview")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error as string);
          return;
        }
        setData(d as OverviewData);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <PanelSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <Card className="max-w-sm">
          <CardContent className="text-center space-y-3 py-8">
            <FileUp size={40} className="mx-auto text-muted-foreground/50" />
            <h3 className="font-semibold text-foreground">暂无数据</h3>
            <p className="text-sm text-muted-foreground">
              上传产品报表后，账号总览将自动显示
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* Compute daily ACoS for sparkline */
  const dailyTotalsWithAcos = data.dailyTotals.map((d) => ({
    ...d,
    acos: d.ad_sales > 0 ? d.ad_spend / d.ad_sales : 0,
  }));

  /* Previous ACoS */
  const prevAcos =
    data.prevWeekTotal.ad_sales > 0
      ? data.prevWeekTotal.ad_spend / data.prevWeekTotal.ad_sales
      : null;

  /* Build metric cards config */
  const metrics = [
    {
      label: "总 GMV",
      value: fmt(data.grandTotal.gmv, "currency"),
      dataKey: "gmv",
      delta: calcDelta(data.grandTotal.gmv, data.prevWeekTotal.gmv),
      sparkColor: "#2563eb",
      hasChart: true,
    },
    {
      label: "总订单",
      value: fmt(data.grandTotal.orders, "number"),
      dataKey: "orders",
      delta: calcDelta(data.grandTotal.orders, data.prevWeekTotal.orders),
      sparkColor: "#7c3aed",
      hasChart: false,
    },
    {
      label: "广告花费",
      value: fmt(data.grandTotal.ad_spend, "currency"),
      dataKey: "ad_spend",
      delta: calcDelta(data.grandTotal.ad_spend, data.prevWeekTotal.ad_spend),
      sparkColor: "#f59e0b",
      hasChart: false,
    },
    {
      label: "综合 ACoS",
      value: data.grandTotal.acos != null ? fmt(data.grandTotal.acos, "pct") : "\u2014",
      dataKey: "acos",
      delta: (() => {
        if (data.grandTotal.acos == null || prevAcos == null)
          return { value: 0, label: "\u2014", color: "text-muted-foreground", arrow: "" };
        const d = calcDelta(data.grandTotal.acos, prevAcos);
        return {
          ...d,
          color: d.value > 1 ? "text-destructive" : d.value < -1 ? "text-emerald-600" : "text-muted-foreground",
        };
      })(),
      sparkColor: "#06b6d4",
      hasChart: true,
    },
  ];

  return (
    <div className="h-full overflow-y-auto p-6 bg-background">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">全品类总览</h1>
        <p className="text-xs mt-0.5 text-muted-foreground">{data.period}</p>
      </div>

      {/* KPI Metric Cards — shadcn chart style */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {metrics.map((metric) => (
          <Card key={metric.label} className="overflow-hidden">
            <CardContent className={cn("p-4", metric.hasChart ? "pb-0" : "pb-4")}>
              <div className="flex items-center gap-1.5 mb-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{metric.label}</p>
              </div>
              <div className="flex items-baseline justify-between">
                <p className="text-2xl font-bold font-mono text-foreground">
                  {metric.value}
                </p>
                {metric.delta.value !== 0 ? (
                  <span className={cn(
                    "text-xs font-semibold px-1.5 py-0.5 rounded-md",
                    metric.delta.value > 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-destructive"
                  )}>
                    {metric.delta.label}
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground">近 7 天</span>
                )}
              </div>
            </CardContent>
            {/* Chart fused to card bottom — only for decision-useful metrics */}
            {metric.hasChart && (
              <div className="px-1 -mb-1">
                <MetricChart
                  data={dailyTotalsWithAcos}
                  dataKey={metric.dataKey}
                  color={metric.sparkColor}
                />
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Alert summary */}
      {(data.alertsTotal.red > 0 || data.alertsTotal.yellow > 0) && (
        <Card className="mb-6 border-amber-200 bg-amber-50 ring-0">
          <CardContent className="flex items-center gap-4">
            <AlertTriangle size={16} className="text-amber-600" />
            <span className="text-sm text-amber-900">
              当前共有
              {data.alertsTotal.red > 0 && (
                <strong className="mx-1 text-destructive">
                  {data.alertsTotal.red} 条红色告警
                </strong>
              )}
              {data.alertsTotal.yellow > 0 && (
                <strong className="mx-1 text-amber-600">
                  {data.alertsTotal.yellow} 条黄色告警
                </strong>
              )}
              需要关注
            </span>
            <Button
              size="xs"
              onClick={() => {
                setActiveNav("overview");
                setActiveFuncTab("alerts");
              }}
              className="ml-auto rounded-full bg-amber-600 text-white hover:bg-amber-700"
            >
              查看告警
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Category cards */}
      <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
        {data.categories.map((cat) => (
          <Card
            key={cat.categoryKey}
            className="cursor-pointer transition-all hover:shadow-md"
            onClick={() => {
              setActiveNav(cat.categoryKey);
              setActiveFuncTab("kpi");
            }}
          >
            <CardContent>
              {/* Card header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="flex items-center">
                    {CATEGORY_ICONS[cat.categoryKey] ?? (
                      <Package size={24} className="text-muted-foreground" />
                    )}
                  </span>
                  <div>
                    <p className="font-semibold text-sm text-foreground">
                      {cat.displayName}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {cat.asins.length} 个 ASIN
                    </p>
                  </div>
                </div>
                {(cat.alerts.red > 0 || cat.alerts.yellow > 0) && (
                  <div className="flex gap-1">
                    {cat.alerts.red > 0 && (
                      <Badge variant="destructive" className="text-[10px]">
                        {cat.alerts.red} 红
                      </Badge>
                    )}
                    {cat.alerts.yellow > 0 && (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]">
                        {cat.alerts.yellow} 黄
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              {/* Mini bar chart — 7-day GMV */}
              {cat.daily && cat.daily.length > 0 && (
                <div className="mb-3 rounded-md bg-muted/50 p-2">
                  <CategoryBarChart data={cat.daily} />
                  <p className="text-[10px] text-muted-foreground text-center mt-1">
                    近7天 GMV
                  </p>
                </div>
              )}

              {/* KPI grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {[
                  { label: "GMV", value: fmt(cat.kpi.gmv, "currency") },
                  { label: "订单量", value: fmt(cat.kpi.orders, "number") },
                  {
                    label: "ACoS",
                    value: cat.kpi.acos != null ? fmt(cat.kpi.acos, "pct") : "\u2014",
                    warn: cat.kpi.acos != null && cat.kpi.acos > 0.5,
                  },
                  {
                    label: "ROAS",
                    value: cat.kpi.roas != null ? cat.kpi.roas.toFixed(2) : "\u2014",
                  },
                  { label: "广告花费", value: fmt(cat.kpi.ad_spend, "currency") },
                  { label: "广告销售", value: fmt(cat.kpi.ad_sales, "currency") },
                ].map(({ label, value, warn }) => (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p
                      className={`text-sm font-semibold font-mono ${warn ? "text-destructive" : "text-foreground"}`}
                    >
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {cat.kpi.dayCount === 0 && (
                <p className="mt-3 text-[11px] text-center text-muted-foreground">
                  暂无数据，请上传产品报表
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
