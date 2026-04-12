"use client";

import { useEffect, useState } from "react";
import { useAppStore, getCategoryKey } from "@/store/appStore";
import { Loader2, AlertTriangle, CheckCircle } from "lucide-react";

interface AlertRow {
  id:           string;
  asin:         string;
  categoryKey:  string;
  metric:       string;
  level:        "red" | "yellow";
  currentValue: number;
  threshold:    number;
  stage:        string;
  suggestion:   string;
  snapshotDate: string;
}

type LevelFilter = "all" | "red" | "yellow";

const METRIC_LABELS: Record<string, string> = {
  gmv:          "GMV 下降",
  orders:       "订单量下降",
  sessions:     "流量下降",
  acos:         "ACoS 超标",
  ctr:          "CTR 过低",
  ocr:          "转化率过低",
  refund_rate:  "退款率过高",
  inventory:    "库存不足",
};

const STAGE_LABELS: Record<string, string> = {
  launch: "新品期", growth: "成长期", mature: "成熟期",
};

function pct(v: number): string { return `${(v * 100).toFixed(1)}%`; }

export default function AlertsPanel() {
  const { activeNav } = useAppStore();
  const activeCategoryKey = getCategoryKey(activeNav);
  const [level, setLevel]     = useState<LevelFilter>("all");
  const [alerts, setAlerts]   = useState<AlertRow[]>([]);
  const [snapshotDate, setSnapshotDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ level });
    if (activeCategoryKey) params.set("categoryKey", activeCategoryKey);
    fetch(`/api/features/alerts?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error as string); return; }
        setAlerts((d.alerts ?? []) as AlertRow[]);
        setSnapshotDate(d.snapshotDate as string | null);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [activeCategoryKey, level]);

  const reds    = alerts.filter((a) => a.level === "red");
  const yellows = alerts.filter((a) => a.level === "yellow");

  return (
    <div className="h-full overflow-y-auto p-6" style={{ background: "#fafaf9" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: "#1a1a1a" }}>
            {activeCategoryKey ? `${activeCategoryKey} 告警` : "全品类告警"}
          </h1>
          {snapshotDate && (
            <p className="text-xs mt-0.5" style={{ color: "#a3a3a3" }}>快照日期：{snapshotDate}</p>
          )}
        </div>
        <div className="flex gap-1">
          {(["all", "red", "yellow"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={{
                background: level === l
                  ? l === "red" ? "#dc2626" : l === "yellow" ? "#d97706" : "#1a1a1a"
                  : "#f0eeec",
                color: level === l ? "#ffffff" : "#737373",
              }}
            >
              {l === "all" ? "全部" : l === "red" ? "红色" : "黄色"}
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

      {!loading && !error && alerts.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <CheckCircle size={32} style={{ color: "#16a34a" }} className="mx-auto mb-2" />
            <p className="text-sm" style={{ color: "#737373" }}>暂无告警</p>
            <p className="text-xs mt-1" style={{ color: "#a3a3a3" }}>请先上传产品报表以生成告警分析</p>
          </div>
        </div>
      )}

      {!loading && !error && alerts.length > 0 && (
        <div className="space-y-6">
          {(level === "all" || level === "red") && reds.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "#dc2626" }}>
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ background: "#dc2626" }}
                />
                红色告警 ({reds.length})
              </h2>
              <AlertList alerts={reds} />
            </section>
          )}
          {(level === "all" || level === "yellow") && yellows.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "#d97706" }}>
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ background: "#d97706" }}
                />
                黄色告警 ({yellows.length})
              </h2>
              <AlertList alerts={yellows} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function AlertList({ alerts }: { alerts: AlertRow[] }) {
  return (
    <div className="space-y-2">
      {alerts.map((alert) => {
        const isRed = alert.level === "red";
        return (
          <div
            key={alert.id}
            className="rounded-xl border p-4"
            style={{
              background:   isRed ? "#fef2f2" : "#fffbeb",
              borderColor:  isRed ? "#fecaca" : "#fde68a",
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span
                    className="font-mono text-xs px-2 py-0.5 rounded"
                    style={{ background: isRed ? "#fee2e2" : "#fef3c7", color: isRed ? "#991b1b" : "#92400e" }}
                  >
                    {alert.asin}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded"
                    style={{ background: "#f3f4f6", color: "#6b7280" }}
                  >
                    {STAGE_LABELS[alert.stage] ?? alert.stage}
                  </span>
                  <span
                    className="text-xs font-semibold"
                    style={{ color: isRed ? "#dc2626" : "#d97706" }}
                  >
                    {METRIC_LABELS[alert.metric] ?? alert.metric}
                  </span>
                </div>
                <p className="text-xs" style={{ color: isRed ? "#7f1d1d" : "#78350f" }}>
                  当前值：<strong>{pct(alert.currentValue)}</strong>
                  {" · "}
                  阈值：{pct(alert.threshold)}
                </p>
              </div>
            </div>
            <p
              className="mt-2 text-xs leading-relaxed"
              style={{ color: isRed ? "#991b1b" : "#92400e" }}
            >
              💡 {alert.suggestion}
            </p>
          </div>
        );
      })}
    </div>
  );
}
