"use client";

import { useEffect, useState } from "react";
import { useAppStore, getCategoryKey } from "@/store/appStore";
import { AlertTriangle, Bell, CheckCircle, Lightbulb } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PanelSkeleton } from "@/components/ui/panel-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
    <div className="h-full overflow-y-auto p-6 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            {activeCategoryKey ? `${activeCategoryKey} 告警` : "全品类告警"}
          </h1>
          {snapshotDate && (
            <p className="text-xs mt-0.5 text-muted-foreground">快照日期：{snapshotDate}</p>
          )}
        </div>
        <div className="flex gap-1">
          {(["all", "red", "yellow"] as const).map((l) => {
            const isActive = level === l;
            let variant: "default" | "outline" | "destructive" = "outline";
            let extraClass = "";
            if (isActive) {
              if (l === "red") {
                variant = "destructive";
                extraClass = "bg-destructive text-destructive-foreground hover:bg-destructive/90";
              } else if (l === "yellow") {
                variant = "default";
                extraClass = "bg-amber-600 text-white hover:bg-amber-700";
              } else {
                variant = "default";
              }
            }
            return (
              <Button
                key={l}
                size="xs"
                variant={variant}
                className={`rounded-full ${extraClass}`}
                onClick={() => setLevel(l)}
              >
                {l === "all" ? "全部" : l === "red" ? "红色" : "黄色"}
              </Button>
            );
          })}
        </div>
      </div>

      {loading && <PanelSkeleton />}

      {!loading && error && (
        <div className="flex items-center justify-center h-full p-8">
          <Card className="max-w-sm">
            <CardContent className="text-center space-y-3 py-8">
              <Bell size={40} className="mx-auto text-muted-foreground/50" />
              <h3 className="font-semibold text-foreground">暂无告警</h3>
              <p className="text-sm text-muted-foreground">
                暂无告警，上传最新报表后将自动检测
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {!loading && !error && alerts.length === 0 && (
        <div className="flex items-center justify-center h-full p-8">
          <Card className="max-w-sm">
            <CardContent className="text-center space-y-3 py-8">
              <Bell size={40} className="mx-auto text-muted-foreground/50" />
              <h3 className="font-semibold text-foreground">暂无告警</h3>
              <p className="text-sm text-muted-foreground">
                暂无告警，上传最新报表后将自动检测
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {!loading && !error && alerts.length > 0 && (
        <div className="space-y-6">
          {(level === "all" || level === "red") && reds.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2 text-destructive">
                <span className="w-2 h-2 rounded-full inline-block bg-destructive" />
                红色告警 ({reds.length})
              </h2>
              <AlertList alerts={reds} />
            </section>
          )}
          {(level === "all" || level === "yellow") && yellows.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2 text-amber-600">
                <span className="w-2 h-2 rounded-full inline-block bg-amber-600" />
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
          <Card
            key={alert.id}
            className={
              isRed
                ? "border-red-200 bg-red-50 ring-0"
                : "border-amber-200 bg-amber-50 ring-0"
            }
          >
            <CardContent>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge
                      variant="outline"
                      className={`font-mono text-xs ${isRed ? "bg-red-100 text-red-900 border-red-200" : "bg-amber-100 text-amber-900 border-amber-200"}`}
                    >
                      {alert.asin}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {STAGE_LABELS[alert.stage] ?? alert.stage}
                    </Badge>
                    <span className={`text-xs font-semibold ${isRed ? "text-destructive" : "text-amber-600"}`}>
                      {METRIC_LABELS[alert.metric] ?? alert.metric}
                    </span>
                  </div>
                  <p className={`text-xs ${isRed ? "text-red-900" : "text-amber-900"}`}>
                    当前值：<strong className="font-mono">{pct(alert.currentValue)}</strong>
                    {" · "}
                    阈值：<span className="font-mono">{pct(alert.threshold)}</span>
                  </p>
                </div>
              </div>
              <p className={`mt-2 text-xs leading-relaxed flex items-start gap-1 ${isRed ? "text-red-800" : "text-amber-800"}`}>
                <Lightbulb size={14} className="shrink-0 mt-0.5" />
                <span>{alert.suggestion}</span>
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
