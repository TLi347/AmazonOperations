"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/appStore";

import { AlertTriangle, TrendingUp, DollarSign, ShoppingCart, Loader2, Bed, Wrench, Bike, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface CategorySummary {
  categoryKey:  string;
  displayName:  string;
  asins:        string[];
  kpi: {
    gmv:       number;
    orders:    number;
    ad_spend:  number;
    ad_sales:  number;
    acos:      number | null;
    roas:      number | null;
    dayCount:  number;
  };
  alerts: { red: number; yellow: number };
}

interface OverviewData {
  period:       string;
  categories:   CategorySummary[];
  grandTotal: {
    gmv:      number;
    orders:   number;
    ad_spend: number;
    acos:     number | null;
    roas:     number | null;
  };
  alertsTotal: { red: number; yellow: number };
}

function fmt(n: number, type: "currency" | "number" | "pct"): string {
  if (type === "currency") return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  if (type === "pct") return `${(n * 100).toFixed(1)}%`;
  return n.toLocaleString("en-US");
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  mattress: <Bed size={24} className="text-muted-foreground" />,
  pump:     <Wrench size={24} className="text-muted-foreground" />,
  scooter:  <Bike size={24} className="text-muted-foreground" />,
};

export default function OverviewPanel() {
  const { setActiveNav, setActiveFuncTab } = useAppStore();
  const [data, setData]       = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/features/overview")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error as string); return; }
        setData(d as OverviewData);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <Loader2 size={20} className="animate-spin mr-2" />
        <span className="text-sm">加载中…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertTriangle size={32} className="mx-auto mb-2 text-amber-600" />
          <p className="text-sm text-muted-foreground">{error ?? "无法加载数据"}</p>
          <p className="text-xs mt-1 text-muted-foreground">请先上传产品报表文件</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 bg-background">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">全品类总览</h1>
        <p className="text-xs mt-0.5 text-muted-foreground">{data.period}</p>
      </div>

      {/* Grand total strip */}
      <Card className="bg-foreground text-background mb-6 ring-0">
        <CardContent className="grid grid-cols-4 gap-4">
          {[
            { label: "总GMV",    value: fmt(data.grandTotal.gmv,      "currency"), Icon: DollarSign  },
            { label: "总订单",   value: fmt(data.grandTotal.orders,   "number"),  Icon: ShoppingCart },
            { label: "总广告花费", value: fmt(data.grandTotal.ad_spend, "currency"), Icon: TrendingUp  },
            {
              label: "综合ACoS",
              value: data.grandTotal.acos != null ? fmt(data.grandTotal.acos, "pct") : "—",
              Icon: TrendingUp,
            },
          ].map(({ label, value, Icon }) => (
            <div key={label}>
              <div className="flex items-center gap-1.5 mb-1">
                <Icon size={13} className="text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">{label}</span>
              </div>
              <span className="text-xl font-bold font-mono">{value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Alert summary */}
      {(data.alertsTotal.red > 0 || data.alertsTotal.yellow > 0) && (
        <Card className="mb-6 border-amber-200 bg-amber-50 ring-0">
          <CardContent className="flex items-center gap-4">
            <AlertTriangle size={16} className="text-amber-600" />
            <span className="text-sm text-amber-900">
              当前共有
              {data.alertsTotal.red > 0 && (
                <strong className="mx-1 text-destructive">{data.alertsTotal.red} 条红色告警</strong>
              )}
              {data.alertsTotal.yellow > 0 && (
                <strong className="mx-1 text-amber-600">{data.alertsTotal.yellow} 条黄色告警</strong>
              )}
              需要关注
            </span>
            <Button
              size="xs"
              onClick={() => { setActiveNav("overview"); setActiveFuncTab("alerts"); }}
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
            onClick={() => { setActiveNav(cat.categoryKey); setActiveFuncTab("kpi"); }}
          >
            <CardContent>
              {/* Card header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="flex items-center">{CATEGORY_ICONS[cat.categoryKey] ?? <Package size={24} className="text-muted-foreground" />}</span>
                  <div>
                    <p className="font-semibold text-sm text-foreground">{cat.displayName}</p>
                    <p className="text-[10px] text-muted-foreground">{cat.asins.length} 个 ASIN</p>
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

              {/* KPI grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {[
                  { label: "GMV",    value: fmt(cat.kpi.gmv,    "currency") },
                  { label: "订单量",  value: fmt(cat.kpi.orders, "number")  },
                  {
                    label: "ACoS",
                    value: cat.kpi.acos != null ? fmt(cat.kpi.acos, "pct") : "—",
                    warn:  cat.kpi.acos != null && cat.kpi.acos > 0.5,
                  },
                  {
                    label: "ROAS",
                    value: cat.kpi.roas != null ? cat.kpi.roas.toFixed(2) : "—",
                  },
                  { label: "广告花费", value: fmt(cat.kpi.ad_spend, "currency") },
                  { label: "广告销售", value: fmt(cat.kpi.ad_sales, "currency") },
                ].map(({ label, value, warn }) => (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className={`text-sm font-semibold font-mono ${warn ? "text-destructive" : "text-foreground"}`}>
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
