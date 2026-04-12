"use client";

import { useEffect, useState } from "react";
import { useAppStore, getCategoryKey } from "@/store/appStore";
import { Loader2, AlertTriangle, Package } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface InventoryData {
  snapshotDate: string;
  total:        number;
  rows:         AnyRow[];
}

function getStockLevel(row: AnyRow): "critical" | "warning" | "ok" {
  const days = row.daysOfSupply ?? row.days_of_supply ?? row.inventoryDays ?? null;
  if (days == null) return "ok";
  if (days <= 30) return "critical";
  if (days <= 45) return "warning";
  return "ok";
}

const STOCK_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  critical: { bg: "#fef2f2", text: "#dc2626", label: "危险" },
  warning:  { bg: "#fffbeb", text: "#d97706", label: "注意" },
  ok:       { bg: "#f0fdf4", text: "#16a34a", label: "健康" },
};

export default function InventoryPanel() {
  const { activeNav } = useAppStore();
  const activeCategoryKey = getCategoryKey(activeNav);
  const [data, setData]       = useState<InventoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (activeCategoryKey) params.set("categoryKey", activeCategoryKey);
    fetch(`/api/features/inventory?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error as string); return; }
        setData(d as InventoryData);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [activeCategoryKey]);

  return (
    <div className="h-full overflow-y-auto p-6" style={{ background: "#fafaf9" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: "#1a1a1a" }}>
            {activeCategoryKey ? `${activeCategoryKey} 库存管理` : "库存管理"}
          </h1>
          {data && (
            <p className="text-xs mt-0.5" style={{ color: "#a3a3a3" }}>
              快照：{data.snapshotDate} · {data.total} 条记录
            </p>
          )}
        </div>
        <Package size={20} style={{ color: "#a3a3a3" }} />
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
            <p className="text-xs mt-1" style={{ color: "#a3a3a3" }}>请先上传库存报表文件</p>
          </div>
        </div>
      )}

      {!loading && data && data.rows.length === 0 && (
        <p className="text-center text-sm py-10" style={{ color: "#a3a3a3" }}>无库存数据</p>
      )}

      {!loading && data && data.rows.length > 0 && (
        <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "#e8e5e0" }}>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ background: "#f5f4f2" }}>
                {[
                  "ASIN / SKU", "可售数量", "在途数量", "可售天数",
                  "日均销量", "建议补货", "状态",
                ].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold whitespace-nowrap"
                    style={{ color: "#737373", borderBottom: "1px solid #e8e5e0" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => {
                const level = getStockLevel(row);
                const style = STOCK_STYLE[level];
                const sku   = row.asin ?? row.sku ?? row.fnsku ?? `row-${i}`;
                const avail = row.availableQty ?? row.available_qty ?? row.availableUnits ?? "—";
                const inbound = row.inboundQty ?? row.inbound_qty ?? row.inboundUnits ?? "—";
                const days  = row.daysOfSupply ?? row.days_of_supply ?? row.inventoryDays ?? "—";
                const daily = row.dailySales ?? row.daily_sales ?? row.avgDailySales ?? "—";
                const restock = row.restockQty ?? row.restock_qty ?? row.suggestedRestock ?? "—";
                return (
                  <tr key={i} style={{ background: i % 2 === 0 ? "#ffffff" : "#fafaf9", borderBottom: "1px solid #f0eeec" }}>
                    <td className="px-3 py-2 font-mono text-xs" style={{ color: "#374151" }}>{sku}</td>
                    <td className="px-3 py-2 text-xs font-medium" style={{ color: "#1a1a1a" }}>
                      {typeof avail === "number" ? avail.toLocaleString() : avail}
                    </td>
                    <td className="px-3 py-2 text-xs" style={{ color: "#374151" }}>
                      {typeof inbound === "number" ? inbound.toLocaleString() : inbound}
                    </td>
                    <td
                      className="px-3 py-2 text-xs font-semibold"
                      style={{ color: style.text }}
                    >
                      {typeof days === "number" ? `${days}天` : days}
                    </td>
                    <td className="px-3 py-2 text-xs" style={{ color: "#374151" }}>
                      {typeof daily === "number" ? daily.toFixed(1) : daily}
                    </td>
                    <td className="px-3 py-2 text-xs font-medium" style={{ color: "#374151" }}>
                      {typeof restock === "number" ? restock.toLocaleString() : restock}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: style.bg, color: style.text }}
                      >
                        {style.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
