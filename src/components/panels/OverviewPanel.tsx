"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/appStore";

import { AlertTriangle, TrendingUp, DollarSign, ShoppingCart, Loader2 } from "lucide-react";

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

const CATEGORY_EMOJI: Record<string, string> = { mattress: "🛏️", pump: "💨", scooter: "🛴" };

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
      <div className="flex items-center justify-center h-full" style={{ color: "#a3a3a3" }}>
        <Loader2 size={20} className="animate-spin mr-2" />
        <span className="text-sm">加载中…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertTriangle size={32} style={{ color: "#d97706" }} className="mx-auto mb-2" />
          <p className="text-sm" style={{ color: "#737373" }}>{error ?? "无法加载数据"}</p>
          <p className="text-xs mt-1" style={{ color: "#a3a3a3" }}>请先上传产品报表文件</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6" style={{ background: "#fafaf9" }}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold" style={{ color: "#1a1a1a" }}>全品类总览</h1>
        <p className="text-xs mt-0.5" style={{ color: "#a3a3a3" }}>{data.period}</p>
      </div>

      {/* Grand total strip */}
      <div
        className="grid grid-cols-4 gap-4 p-4 rounded-xl mb-6"
        style={{ background: "#1a1a1a" }}
      >
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
              <Icon size={13} color="#9ca3af" />
              <span className="text-[11px]" style={{ color: "#9ca3af" }}>{label}</span>
            </div>
            <span className="text-xl font-bold" style={{ color: "#ffffff" }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Alert summary */}
      {(data.alertsTotal.red > 0 || data.alertsTotal.yellow > 0) && (
        <div
          className="flex items-center gap-4 px-4 py-3 rounded-xl mb-6 border"
          style={{ background: "#fff7ed", borderColor: "#fed7aa" }}
        >
          <AlertTriangle size={16} style={{ color: "#d97706" }} />
          <span className="text-sm" style={{ color: "#92400e" }}>
            当前共有
            {data.alertsTotal.red > 0 && (
              <strong className="mx-1" style={{ color: "#dc2626" }}>{data.alertsTotal.red} 条红色告警</strong>
            )}
            {data.alertsTotal.yellow > 0 && (
              <strong className="mx-1" style={{ color: "#d97706" }}>{data.alertsTotal.yellow} 条黄色告警</strong>
            )}
            需要关注
          </span>
          <button
            onClick={() => { setActiveNav("overview"); setActiveFuncTab("alerts"); }}
            className="ml-auto text-xs font-medium px-3 py-1 rounded-full transition-colors hover:opacity-80"
            style={{ background: "#d97706", color: "#ffffff" }}
          >
            查看告警
          </button>
        </div>
      )}

      {/* Category cards */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {data.categories.map((cat) => (
          <div
            key={cat.categoryKey}
            className="rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md"
            style={{ background: "#ffffff", borderColor: "#e8e5e0" }}
            onClick={() => { setActiveNav(cat.categoryKey); setActiveFuncTab("kpi"); }}
          >
            {/* Card header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{CATEGORY_EMOJI[cat.categoryKey] ?? "📦"}</span>
                <div>
                  <p className="font-semibold text-sm" style={{ color: "#1a1a1a" }}>{cat.displayName}</p>
                  <p className="text-[10px]" style={{ color: "#a3a3a3" }}>{cat.asins.length} 个 ASIN</p>
                </div>
              </div>
              {(cat.alerts.red > 0 || cat.alerts.yellow > 0) && (
                <div className="flex gap-1">
                  {cat.alerts.red > 0 && (
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: "#fef2f2", color: "#dc2626" }}
                    >
                      {cat.alerts.red} 红
                    </span>
                  )}
                  {cat.alerts.yellow > 0 && (
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: "#fffbeb", color: "#d97706" }}
                    >
                      {cat.alerts.yellow} 黄
                    </span>
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
                  <p className="text-[10px]" style={{ color: "#a3a3a3" }}>{label}</p>
                  <p
                    className="text-sm font-semibold"
                    style={{ color: warn ? "#dc2626" : "#1a1a1a" }}
                  >
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {cat.kpi.dayCount === 0 && (
              <p className="mt-3 text-[11px] text-center" style={{ color: "#a3a3a3" }}>
                暂无数据，请上传产品报表
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
