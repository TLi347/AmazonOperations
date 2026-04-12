"use client";

import { useEffect, useState } from "react";
import { useAppStore, getCategoryKey } from "@/store/appStore";
import { Loader2, AlertTriangle } from "lucide-react";

type Window = "today" | "yesterday" | "w7" | "w14" | "d30";

interface AsinRow {
  asin:        string;
  gmv:         number;
  orders:      number;
  units:       number;
  ad_spend:    number;
  ad_sales:    number;
  ad_orders:   number;
  impressions: number;
  clicks:      number;
  sessions:    number;
  acos:        number | null;
  tacos:       number | null;
  ctr:         number | null;
  cvr:         number | null;
  cpc:         number | null;
  roas:        number | null;
}

interface KPIData {
  period:      string;
  window:      string;
  categoryKey: string;
  total:       AsinRow;
  byAsin:      AsinRow[];
}

function pct(v: number | null): string {
  return v != null ? `${(v * 100).toFixed(1)}%` : "—";
}
function cur(v: number): string {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function num(v: number): string {
  return v.toLocaleString("en-US");
}

const WINDOWS: { id: Window; label: string }[] = [
  { id: "today",     label: "今天"   },
  { id: "yesterday", label: "昨天"   },
  { id: "w7",        label: "近7天"  },
  { id: "w14",       label: "近14天" },
  { id: "d30",       label: "近30天" },
];

export default function KPIPanel() {
  const { activeNav } = useAppStore();
  const activeCategoryKey = getCategoryKey(activeNav);
  const [window, setWindow]   = useState<Window>("w7");
  const [data, setData]       = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ window });
    if (activeCategoryKey) params.set("categoryKey", activeCategoryKey);
    fetch(`/api/features/kpi?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error as string); return; }
        setData(d as KPIData);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [activeCategoryKey, window]);

  return (
    <div className="h-full overflow-y-auto p-6" style={{ background: "#fafaf9" }}>
      {/* Header + window switcher */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: "#1a1a1a" }}>
            {activeCategoryKey ? `${activeCategoryKey} KPI` : "全品类 KPI"}
          </h1>
          {data && <p className="text-xs mt-0.5" style={{ color: "#a3a3a3" }}>{data.period}</p>}
        </div>
        <div className="flex gap-1">
          {WINDOWS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setWindow(id)}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={{
                background: window === id ? "#1a1a1a" : "#f0eeec",
                color:      window === id ? "#ffffff"  : "#737373",
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
          </div>
        </div>
      )}

      {!loading && data && (
        <>
          {/* Total summary row */}
          <div
            className="grid grid-cols-6 gap-4 p-4 rounded-xl mb-6"
            style={{ background: "#1a1a1a" }}
          >
            {[
              { label: "GMV",    value: cur(data.total.gmv)                                        },
              { label: "订单量",  value: num(data.total.orders)                                    },
              { label: "广告花费", value: cur(data.total.ad_spend)                                 },
              { label: "ACoS",   value: pct(data.total.acos), warn: (data.total.acos ?? 0) > 0.5  },
              { label: "CTR",    value: pct(data.total.ctr)                                        },
              { label: "ROAS",   value: data.total.roas != null ? data.total.roas.toFixed(2) : "—" },
            ].map(({ label, value, warn }) => (
              <div key={label}>
                <p className="text-[10px] mb-1" style={{ color: "#9ca3af" }}>{label}</p>
                <p className="text-lg font-bold" style={{ color: warn ? "#fca5a5" : "#ffffff" }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Per-ASIN table */}
          {data.byAsin.length === 0 ? (
            <p className="text-center text-sm py-10" style={{ color: "#a3a3a3" }}>无 ASIN 数据</p>
          ) : (
            <div
              className="rounded-xl border overflow-hidden"
              style={{ borderColor: "#e8e5e0" }}
            >
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr style={{ background: "#f5f4f2" }}>
                    {["ASIN", "GMV", "订单", "广告花费", "ACoS", "TACoS", "CTR", "CVR", "CPC", "ROAS"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2 text-left text-[11px] font-semibold"
                        style={{ color: "#737373", borderBottom: "1px solid #e8e5e0" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.byAsin.map((row, i) => (
                    <tr
                      key={row.asin}
                      style={{ background: i % 2 === 0 ? "#ffffff" : "#fafaf9", borderBottom: "1px solid #f0eeec" }}
                    >
                      <td className="px-4 py-2 font-mono text-xs" style={{ color: "#374151" }}>{row.asin}</td>
                      <td className="px-4 py-2 font-medium" style={{ color: "#1a1a1a" }}>{cur(row.gmv)}</td>
                      <td className="px-4 py-2" style={{ color: "#374151" }}>{num(row.orders)}</td>
                      <td className="px-4 py-2" style={{ color: "#374151" }}>{cur(row.ad_spend)}</td>
                      <td
                        className="px-4 py-2 font-medium"
                        style={{ color: row.acos != null && row.acos > 0.5 ? "#dc2626" : "#374151" }}
                      >
                        {pct(row.acos)}
                      </td>
                      <td className="px-4 py-2" style={{ color: "#374151" }}>{pct(row.tacos)}</td>
                      <td className="px-4 py-2" style={{ color: "#374151" }}>{pct(row.ctr)}</td>
                      <td className="px-4 py-2" style={{ color: "#374151" }}>{pct(row.cvr)}</td>
                      <td className="px-4 py-2" style={{ color: "#374151" }}>{row.cpc != null ? `$${row.cpc}` : "—"}</td>
                      <td className="px-4 py-2" style={{ color: "#374151" }}>{row.roas != null ? row.roas.toFixed(2) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
