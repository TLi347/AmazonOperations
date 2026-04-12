"use client";

import { useEffect, useState } from "react";
import { useAppStore, getCategoryKey } from "@/store/appStore";
import { Loader2, AlertTriangle } from "lucide-react";

type Source = "campaign_3m" | "search_terms";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface AdsData {
  source:       string;
  snapshotDate: string;
  total:        number;
  rows:         AnyRow[];
}

function pct(v: unknown): string {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isNaN(n) ? "—" : `${(n * 100).toFixed(1)}%`;
}
function cur(v: unknown): string {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isNaN(n) ? "—" : `$${n.toFixed(2)}`;
}

function CampaignTable({ rows }: { rows: AnyRow[] }) {
  if (rows.length === 0) return (
    <p className="text-sm text-center py-6" style={{ color: "#a3a3a3" }}>暂无广告活动数据</p>
  );
  const cols = ["campaignName", "spend", "sales", "acos", "impressions", "clicks", "orders", "budget"];
  const labels: Record<string, string> = {
    campaignName: "活动名称", spend: "花费", sales: "销售额",
    acos: "ACoS", impressions: "曝光", clicks: "点击", orders: "订单", budget: "预算",
  };
  return (
    <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "#e8e5e0" }}>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr style={{ background: "#f5f4f2" }}>
            {cols.map((c) => (
              <th key={c} className="px-3 py-2 text-left text-[11px] font-semibold whitespace-nowrap"
                style={{ color: "#737373", borderBottom: "1px solid #e8e5e0" }}>
                {labels[c] ?? c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const acosVal = typeof row.acos === "number" ? row.acos : parseFloat(String(row.acos));
            const highAcos = !isNaN(acosVal) && acosVal > 0.6;
            return (
              <tr key={i} style={{ background: i % 2 === 0 ? "#ffffff" : "#fafaf9", borderBottom: "1px solid #f0eeec" }}>
                <td className="px-3 py-2 max-w-[200px] truncate text-xs" style={{ color: "#374151" }}
                  title={String(row.campaignName ?? row.campaign_name ?? "")}>
                  {row.campaignName ?? row.campaign_name ?? "—"}
                </td>
                <td className="px-3 py-2 text-xs" style={{ color: "#374151" }}>{cur(row.spend)}</td>
                <td className="px-3 py-2 text-xs" style={{ color: "#374151" }}>{cur(row.sales ?? row.ad_sales)}</td>
                <td className="px-3 py-2 text-xs font-medium" style={{ color: highAcos ? "#dc2626" : "#374151" }}>
                  {pct(row.acos)}
                </td>
                <td className="px-3 py-2 text-xs" style={{ color: "#374151" }}>{(row.impressions ?? 0).toLocaleString()}</td>
                <td className="px-3 py-2 text-xs" style={{ color: "#374151" }}>{(row.clicks ?? 0).toLocaleString()}</td>
                <td className="px-3 py-2 text-xs" style={{ color: "#374151" }}>{row.orders ?? row.ad_orders ?? "—"}</td>
                <td className="px-3 py-2 text-xs" style={{ color: "#374151" }}>{row.budget != null ? cur(row.budget) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SearchTermsTable({ rows }: { rows: AnyRow[] }) {
  if (rows.length === 0) return (
    <p className="text-sm text-center py-6" style={{ color: "#a3a3a3" }}>暂无搜索词数据</p>
  );
  const cols = ["searchTerm", "matchType", "spend", "sales", "acos", "clicks", "orders", "cvr"];
  const labels: Record<string, string> = {
    searchTerm: "搜索词", matchType: "匹配类型", spend: "花费", sales: "销售额",
    acos: "ACoS", clicks: "点击", orders: "订单", cvr: "CVR",
  };
  return (
    <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "#e8e5e0" }}>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr style={{ background: "#f5f4f2" }}>
            {cols.map((c) => (
              <th key={c} className="px-3 py-2 text-left text-[11px] font-semibold whitespace-nowrap"
                style={{ color: "#737373", borderBottom: "1px solid #e8e5e0" }}>
                {labels[c] ?? c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const acosVal = typeof row.acos === "number" ? row.acos : parseFloat(String(row.acos));
            const highAcos = !isNaN(acosVal) && acosVal > 0.8;
            return (
              <tr key={i} style={{ background: i % 2 === 0 ? "#ffffff" : "#fafaf9", borderBottom: "1px solid #f0eeec" }}>
                <td className="px-3 py-2 text-xs max-w-[200px] truncate" style={{ color: "#374151" }}>
                  {row.searchTerm ?? row.search_term ?? "—"}
                </td>
                <td className="px-3 py-2 text-xs" style={{ color: "#6b7280" }}>{row.matchType ?? row.match_type ?? "—"}</td>
                <td className="px-3 py-2 text-xs" style={{ color: "#374151" }}>{cur(row.spend)}</td>
                <td className="px-3 py-2 text-xs" style={{ color: "#374151" }}>{cur(row.sales ?? row.ad_sales)}</td>
                <td className="px-3 py-2 text-xs font-medium" style={{ color: highAcos ? "#dc2626" : "#374151" }}>
                  {pct(row.acos)}
                </td>
                <td className="px-3 py-2 text-xs" style={{ color: "#374151" }}>{(row.clicks ?? 0).toLocaleString()}</td>
                <td className="px-3 py-2 text-xs" style={{ color: "#374151" }}>{row.orders ?? row.ad_orders ?? "—"}</td>
                <td className="px-3 py-2 text-xs" style={{ color: "#374151" }}>{pct(row.cvr ?? row.conversion_rate)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function AdsPanel() {
  const { activeNav } = useAppStore();
  const activeCategoryKey = getCategoryKey(activeNav);
  const [source, setSource]   = useState<Source>("campaign_3m");
  const [data, setData]       = useState<AdsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setData(null);
    const params = new URLSearchParams({ source });
    if (activeCategoryKey) params.set("categoryKey", activeCategoryKey);
    fetch(`/api/features/ads?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error as string); return; }
        setData(d as AdsData);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [activeCategoryKey, source]);

  return (
    <div className="h-full overflow-y-auto p-6" style={{ background: "#fafaf9" }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: "#1a1a1a" }}>
            {activeCategoryKey ? `${activeCategoryKey} 广告监控` : "广告监控"}
          </h1>
          {data && (
            <p className="text-xs mt-0.5" style={{ color: "#a3a3a3" }}>
              快照：{data.snapshotDate} · {data.total} 条记录
            </p>
          )}
        </div>
        <div className="flex gap-1">
          {([
            { id: "campaign_3m",  label: "广告活动重构" },
            { id: "search_terms", label: "搜索词重构" },
          ] as const).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setSource(id)}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={{
                background: source === id ? "#1a1a1a" : "#f0eeec",
                color:      source === id ? "#ffffff"  : "#737373",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20" style={{ color: "#a3a3a3" }}>
          <Loader2 size={20} className="animate-spin mr-2" />
          <span className="text-sm">加载中…</span>
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <AlertTriangle size={32} style={{ color: "#d97706" }} className="mx-auto mb-2" />
            <p className="text-sm" style={{ color: "#737373" }}>{error}</p>
            <p className="text-xs mt-1" style={{ color: "#a3a3a3" }}>请先上传对应报表文件</p>
          </div>
        </div>
      )}

      {!loading && data && (
        source === "campaign_3m"
          ? <CampaignTable    rows={data.rows} />
          : <SearchTermsTable rows={data.rows} />
      )}
    </div>
  );
}
