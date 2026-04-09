"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  AlertTriangle,
  Calendar,
  Plus,
  X,
  UploadCloud,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
} from "lucide-react";
import {
  useAppStore,
  type EventType,
  type MetricsSnapshot,
  type ProductStage,
} from "@/store/appStore";

// ── Types & constants ─────────────────────────────────────────────────────────

type TimeWindowKey = "today" | "yesterday" | "w7" | "w14" | "d30";

const TIME_WINDOWS: { key: TimeWindowKey; label: string }[] = [
  { key: "today", label: "今日" },
  { key: "yesterday", label: "昨日" },
  { key: "w7", label: "近7日" },
  { key: "w14", label: "近14日" },
  { key: "d30", label: "近30日" },
];

const WINDOW_HINT: Record<TimeWindowKey, string> = {
  today: "📌 今日昨日看反常",
  yesterday: "📌 今日昨日看反常",
  w7: "📈 多日报告看趋势",
  w14: "📈 多日报告看趋势",
  d30: "📈 多日报告看趋势",
};

const WINDOW_DAYS: Record<TimeWindowKey, number> = {
  today: 1,
  yesterday: 1,
  w7: 7,
  w14: 14,
  d30: 30,
};

// For delta: compare selected window vs this window
const COMPARE_WINDOW: Partial<Record<TimeWindowKey, TimeWindowKey>> = {
  today: "yesterday",
  w7: "w14",
  w14: "d30",
};

const EVENT_CONFIG: Record<EventType, { label: string; emoji: string; color: string }> = {
  ld:         { label: "Lightning Deal",  emoji: "⚡", color: "#e05252" },
  prime:      { label: "Prime Discount",  emoji: "👑", color: "#8b6cc6" },
  coupon:     { label: "Coupon",          emoji: "🎫", color: "#d4a03c" },
  bd:         { label: "Best Deal",       emoji: "🏷️", color: "#4a8fd4" },
  price_test: { label: "手动降价测试",    emoji: "📉", color: "#3dab7e" },
  price_war:  { label: "竞品价格战",      emoji: "⚔️", color: "#c74040" },
  prime_day:  { label: "Prime Day",       emoji: "🎉", color: "#7048b8" },
  bf:         { label: "Black Friday",    emoji: "🛒", color: "#3a3f4b" },
};

const PRI_STYLE: Record<string, { bg: string; color: string }> = {
  P0: { bg: "#fee2e2", color: "#dc2626" },
  P1: { bg: "#fef3c7", color: "#d97706" },
  P2: { bg: "#dbeafe", color: "#2563eb" },
  P3: { bg: "#f3f4f6", color: "#6b7280" },
};

// ACoS target by stage (for health coloring)
const ACOS_TARGET: Record<ProductStage, number> = {
  新品期: 70, 成长期: 55, 成熟期: 45, 衰退期: 45,
};
const ROAS_TARGET: Record<ProductStage, number> = {
  新品期: 1.5, 成长期: 2.0, 成熟期: 2.5, 衰退期: 2.0,
};
const CTR_TARGET: Record<ProductStage, number> = {
  新品期: 0.2, 成长期: 0.25, 成熟期: 0.3, 衰退期: 0.3,
};

// ── Delta helper ──────────────────────────────────────────────────────────────

function calcDelta(
  cur: MetricsSnapshot | undefined,
  prev: MetricsSnapshot | undefined,
  field: keyof MetricsSnapshot,
  curDays: number,
  prevDays: number,
  isRatio: boolean
): number | null {
  if (!cur || !prev) return null;
  const c = (cur[field] as number) / (isRatio ? 1 : curDays);
  const p = (prev[field] as number) / (isRatio ? 1 : prevDays);
  if (p === 0) return null;
  return ((c - p) / Math.abs(p)) * 100;
}

// ── KPI card ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: number | undefined;
  format: (v: number) => string;
  delta: number | null;
  reverseColor?: boolean; // true = down is good (ACoS, CPC)
  healthy?: boolean | null; // null = neutral
}

function KpiCard({ label, value, format, delta, reverseColor = false, healthy }: KpiCardProps) {
  const hasData = value !== undefined;

  const deltaColor = delta === null
    ? "#a3a3a3"
    : reverseColor
    ? delta > 0 ? "#dc2626" : "#16a34a"
    : delta > 0 ? "#16a34a" : "#dc2626";

  const valueColor = healthy === null || healthy === undefined
    ? "#1a1a1a"
    : healthy ? "#16a34a" : "#dc2626";

  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-1"
      style={{ background: "#ffffff", border: "1px solid #e8e5e0" }}
    >
      <span
        className="text-[10px] font-semibold uppercase tracking-wide"
        style={{ color: "#a3a3a3" }}
      >
        {label}
      </span>

      {hasData ? (
        <>
          <span className="text-lg font-bold" style={{ color: valueColor }}>
            {format(value!)}
          </span>
          <div className="flex items-center gap-1" style={{ minHeight: 16 }}>
            {delta !== null ? (
              <>
                {delta > 0 ? (
                  <TrendingUp size={11} style={{ color: deltaColor }} />
                ) : delta < 0 ? (
                  <TrendingDown size={11} style={{ color: deltaColor }} />
                ) : (
                  <Minus size={11} style={{ color: "#a3a3a3" }} />
                )}
                <span className="text-[11px] font-medium" style={{ color: deltaColor }}>
                  {delta > 0 ? "+" : ""}{delta.toFixed(1)}%
                </span>
              </>
            ) : (
              <span className="text-[10px]" style={{ color: "#d4d4d4" }}>—</span>
            )}
          </div>
        </>
      ) : (
        <>
          <span className="text-lg font-bold" style={{ color: "#d4d4d4" }}>--</span>
          <span className="text-[10px]" style={{ color: "#d4d4d4" }}>上传报表后显示</span>
        </>
      )}
    </div>
  );
}

// ── Chart tooltip ─────────────────────────────────────────────────────────────

function AcosTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs"
      style={{ background: "#1a1a1a", color: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}
    >
      <div style={{ color: "#a3a3a3" }}>{label}</div>
      <div className="font-bold mt-0.5">ACoS {v.toFixed(1)}%</div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

// ── 启动分析 Card ────────────────────────────────────────────────────────────

function RequiredFileRow({ label, hint, satisfied }: { label: string; hint: string; satisfied: boolean }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      {satisfied
        ? <CheckCircle2 size={13} className="mt-0.5 flex-shrink-0" style={{ color: "#16a34a" }} />
        : <Circle       size={13} className="mt-0.5 flex-shrink-0" style={{ color: "#d4d4d4" }} />
      }
      <div>
        <span className="text-[11px] font-medium" style={{ color: satisfied ? "#16a34a" : "#1a1a1a" }}>{label}</span>
        <span className="text-[10px] ml-1.5" style={{ color: "#a3a3a3" }}>{hint}</span>
      </div>
    </div>
  );
}

function DashboardAnalysisCard({
  productName,
  asin,
  stage,
  hasAsinReport,
  hasAdCampaign,
  onAnalyze,
}: {
  productName: string;
  asin: string;
  stage: string;
  hasAsinReport: boolean;
  hasAdCampaign: boolean;
  onAnalyze: () => void;
}) {
  const [open, setOpen] = useState(false);
  const canAnalyze = hasAsinReport;

  return (
    <div className="rounded-xl mb-5 overflow-hidden" style={{ background: "#ffffff", border: "1px solid #e8e5e0" }}>
      <button
        className="flex items-center justify-between w-full px-4 py-3 text-left transition-colors hover:bg-[#fafaf9]"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <UploadCloud size={13} style={{ color: "#737373" }} />
          <span className="text-xs font-semibold" style={{ color: "#1a1a1a" }}>分析指南</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "#f5f4f2", color: "#a3a3a3" }}>运营看板</span>
        </div>
        <div className="flex items-center gap-2">
          {canAnalyze && (
            <button
              onClick={(e) => { e.stopPropagation(); onAnalyze(); }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold hover:opacity-90 transition-all"
              style={{ background: "#1a1a1a", color: "#ffffff" }}
            >
              <Sparkles size={9} /> AI 综合分析
            </button>
          )}
          {open ? <ChevronDown size={13} style={{ color: "#a3a3a3" }} /> : <ChevronRight size={13} style={{ color: "#a3a3a3" }} />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1" style={{ borderTop: "1px solid #f0eeec" }}>
          <p className="text-[11px] mb-2" style={{ color: "#737373" }}>上传以下文件后 KPI 指标、ACoS 趋势图自动刷新：</p>
          <RequiredFileRow
            label="ASIN视图报表（必填）"
            hint="文件名：系统-Nordhive-*-产品报表-ASIN*.xlsx — 每个文件对应一个日期区间；上传多天 daily 文件可显示 ACoS 趋势"
            satisfied={hasAsinReport}
          />
          <RequiredFileRow
            label="广告活动报表（可选）"
            hint="文件名：系统-Nordhive-*-广告活动*.xlsx — 补全广告花费概览"
            satisfied={hasAdCampaign}
          />
          <div className="mt-3 px-3 py-2 rounded-lg text-[10px] leading-relaxed" style={{ background: "#f5f4f2", color: "#737373" }}>
            <span className="font-semibold" style={{ color: "#1a1a1a" }}>ACoS 趋势图：</span>
            {" "}依次上传各天 daily 报表（文件名日期区间为单日，如{" "}
            <span className="font-mono">03-26~03-26</span>），上传 7+ 天后趋势图效果最佳。
            <br />
            <span className="font-semibold" style={{ color: "#1a1a1a" }}>KPI 快照：</span>
            {" "}上传 weekly（7天）、biweekly（14天）、monthly（30天）报表可填充近7日/近14日/近30日标签页。
          </div>
          {!canAnalyze && (
            <p className="text-[10px] mt-2 px-3 py-2 rounded-lg" style={{ background: "#fef3c7", color: "#d97706" }}>
              至少上传一份 ASIN视图报表后「AI 综合分析」按钮自动激活
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const BLANK_EVENT = { startDate: "", endDate: "", eventType: "ld" as EventType, note: "" };

export default function DashboardPanel() {
  const {
    getSelectedProduct,
    getAlertsForProduct,
    getFilesForProduct,
    eventMarkersByProduct,
    addEventMarker,
    removeEventMarker,
    metricsByProduct,
    setActivePanel,
    setPendingChatMessage,
  } = useAppStore();

  const [window, setWindow] = useState<TimeWindowKey>("today");
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEvent, setNewEvent] = useState(BLANK_EVENT);

  const product = getSelectedProduct();
  if (!product) {
    return (
      <div className="flex h-full items-center justify-center" style={{ background: "#fafaf9" }}>
        <p className="text-sm" style={{ color: "#a3a3a3" }}>请先在左栏选择一个产品</p>
      </div>
    );
  }

  const productId = product.id;
  const alerts = getAlertsForProduct(productId);
  const eventMarkers = eventMarkersByProduct[productId] ?? [];
  const productMetrics = metricsByProduct[productId] ?? {};

  // File checklist for guide card
  const uploadedFiles   = getFilesForProduct(productId);
  const hasAsinReport   = uploadedFiles.some((f) => f.fileType === "nordhive_asin_report");
  const hasAdCampaign   = uploadedFiles.some((f) => f.fileType === "nordhive_ad_campaign");

  const curSnap = productMetrics[window];
  const cmpKey = COMPARE_WINDOW[window];
  const cmpSnap = cmpKey ? productMetrics[cmpKey] : undefined;
  const curDays = WINDOW_DAYS[window];
  const cmpDays = cmpKey ? WINDOW_DAYS[cmpKey] : 1;
  const acosHistory = productMetrics.acosHistory ?? [];

  const stage = product.stage;

  // Health checks (null if no data)
  const acosHealthy = curSnap ? curSnap.acos <= ACOS_TARGET[stage] : null;
  const roasHealthy = curSnap ? curSnap.roas >= ROAS_TARGET[stage] : null;
  const ctrHealthy = curSnap ? curSnap.ctr >= CTR_TARGET[stage] : null;

  // Detect anomaly banner for today/yesterday view
  const showAnomalyBanner =
    (window === "today" || window === "yesterday") &&
    curSnap &&
    curSnap.acos > ACOS_TARGET[stage];

  function handleFullAnalysis() {
    setActivePanel("chat");
    setPendingChatMessage(
      `请对「${product!.name}」（${product!.asin}）进行全面运营看板分析，当前阶段：${product!.stage}。\n\n请分析：\n1. 各时间窗口 KPI 健康度（GMV/ACoS/ROAS/CTR）\n2. ACoS 趋势是否在目标范围内（${product!.stage}目标 ≤${ACOS_TARGET[stage]}%）\n3. 当前主要问题和风险\n4. 针对${product!.stage}阶段的具体优化建议（3条以上）`
    );
  }

  function handleAlertChat(title: string, description: string, action: string) {
    setActivePanel("chat");
    setPendingChatMessage(
      `请分析这条告警并给出具体处理建议：\n\n**${title}**\n${description}\n\n建议动作：${action}`
    );
  }

  function handleAddEvent() {
    if (!newEvent.startDate || !newEvent.endDate) return;
    addEventMarker(productId, newEvent);
    setNewEvent(BLANK_EVENT);
    setShowAddEvent(false);
  }

  const getBarFill = (acos: number) => {
    if (acos > 50) return { fill: "#ef4444", opacity: 0.85 };
    if (acos > 45) return { fill: "#f59e0b", opacity: 0.85 };
    return { fill: "#1a1a1a", opacity: 0.5 };
  };

  return (
    <div
      className="h-full overflow-y-auto"
      style={{ background: "#fafaf9", scrollbarWidth: "thin", scrollbarColor: "#d4d4d4 transparent" }}
    >
      <div className="p-5" style={{ maxWidth: 1100 }}>

        {/* ── 启动分析 Card ── */}
        <DashboardAnalysisCard
          productName={product.name}
          asin={product.asin}
          stage={stage}
          hasAsinReport={hasAsinReport}
          hasAdCampaign={hasAdCampaign}
          onAnalyze={handleFullAnalysis}
        />

        {/* ── Time Window Selector ── */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex gap-1.5">
            {TIME_WINDOWS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setWindow(key)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: window === key ? "#1a1a1a" : "#ffffff",
                  color: window === key ? "#ffffff" : "#737373",
                  border: `1px solid ${window === key ? "#1a1a1a" : "#e8e5e0"}`,
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-xs" style={{ color: "#a3a3a3" }}>
            {WINDOW_HINT[window]}
          </span>
        </div>

        {/* ── KPI Cards Grid ── */}
        <div className="grid grid-cols-6 gap-3 mb-5">
          <KpiCard
            label="GMV"
            value={curSnap?.gmv}
            format={(v) => `$${v.toLocaleString()}`}
            delta={calcDelta(curSnap, cmpSnap, "gmv", curDays, cmpDays, false)}
          />
          <KpiCard
            label="订单量"
            value={curSnap?.orders}
            format={(v) => v.toLocaleString()}
            delta={calcDelta(curSnap, cmpSnap, "orders", curDays, cmpDays, false)}
          />
          <KpiCard
            label="ACoS"
            value={curSnap?.acos}
            format={(v) => `${v.toFixed(1)}%`}
            delta={calcDelta(curSnap, cmpSnap, "acos", curDays, cmpDays, true)}
            reverseColor
            healthy={acosHealthy}
          />
          <KpiCard
            label="ROAS"
            value={curSnap?.roas}
            format={(v) => v.toFixed(2)}
            delta={calcDelta(curSnap, cmpSnap, "roas", curDays, cmpDays, true)}
            healthy={roasHealthy}
          />
          <KpiCard
            label="CTR"
            value={curSnap?.ctr}
            format={(v) => `${v.toFixed(2)}%`}
            delta={calcDelta(curSnap, cmpSnap, "ctr", curDays, cmpDays, true)}
            healthy={ctrHealthy}
          />
          <KpiCard
            label="CPC"
            value={curSnap?.cpc}
            format={(v) => `$${v.toFixed(2)}`}
            delta={calcDelta(curSnap, cmpSnap, "cpc", curDays, cmpDays, true)}
            reverseColor
          />
        </div>

        {/* ── Chart + Alerts (3:2) ── */}
        <div className="flex gap-4 mb-5" style={{ minHeight: 280 }}>

          {/* ACoS Trend Chart */}
          <div
            className="flex-[3] rounded-xl p-4"
            style={{ background: "#ffffff", border: "1px solid #e8e5e0" }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>
                ACoS 趋势
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "#f5f4f2", color: "#737373" }}>
                目标 ≤{ACOS_TARGET[stage]}%
              </span>
            </div>

            {acosHistory.length > 0 ? (
              <>
                {showAnomalyBanner && (
                  <div
                    className="flex items-center gap-2 rounded-lg px-3 py-2 mb-3 text-xs"
                    style={{ background: "#fef3c7", color: "#d97706" }}
                  >
                    <AlertTriangle size={13} />
                    <span>
                      当前 ACoS {curSnap!.acos.toFixed(1)}% 超过{stage}阶段目标（{ACOS_TARGET[stage]}%），请重点关注
                    </span>
                  </div>
                )}
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={acosHistory} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0eeec" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "#a3a3a3" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(d: string) => d.length >= 10 ? d.slice(5) : d}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#a3a3a3" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v}%`}
                      domain={[0, "auto"]}
                    />
                    <Tooltip content={<AcosTooltip />} cursor={{ fill: "#f5f4f2" }} />
                    {/* Event marker reference areas */}
                    {eventMarkers.map((marker) => {
                      const cfg = EVENT_CONFIG[marker.eventType];
                      return (
                        <ReferenceArea
                          key={marker.id}
                          x1={marker.startDate}
                          x2={marker.endDate}
                          fill={cfg.color}
                          fillOpacity={0.12}
                          stroke={cfg.color}
                          strokeOpacity={0.4}
                          strokeWidth={1}
                          label={{ value: cfg.emoji, position: "insideTop", fontSize: 11 }}
                        />
                      );
                    })}
                    <ReferenceLine
                      y={55}
                      stroke="#ef4444"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{ value: "55%", fill: "#ef4444", fontSize: 10, position: "insideTopRight" }}
                    />
                    <ReferenceLine
                      y={45}
                      stroke="#f59e0b"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{ value: "45%", fill: "#f59e0b", fontSize: 10, position: "insideTopRight" }}
                    />
                    <Bar dataKey="acos" radius={[3, 3, 0, 0]}>
                      {acosHistory.map((entry, i) => {
                        const { fill, opacity } = getBarFill(entry.acos);
                        return <Cell key={i} fill={fill} fillOpacity={opacity} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 gap-3">
                <UploadCloud size={32} style={{ color: "#d4d4d4" }} />
                <div className="text-center">
                  <p className="text-sm font-medium" style={{ color: "#a3a3a3" }}>暂无趋势数据</p>
                  <p className="text-xs mt-1 text-center leading-relaxed" style={{ color: "#c4c4c4" }}>
                    依次上传多天 daily 报表后显示<br />
                    <span className="font-mono text-[10px]">系统-Nordhive-*-产品报表-ASIN*（每天一个文件）</span>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Alerts Panel */}
          <div
            className="flex-[2] rounded-xl flex flex-col overflow-hidden"
            style={{ background: "#ffffff", border: "1px solid #e8e5e0" }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#f0eeec" }}>
              <span className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>告警</span>
              {alerts.length > 0 && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: "#fee2e2", color: "#dc2626" }}
                >
                  {alerts.length}
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#e8e5e0 transparent" }}>
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <span style={{ fontSize: 28 }}>✅</span>
                  <p className="text-xs" style={{ color: "#a3a3a3" }}>暂无告警</p>
                </div>
              ) : (
                <div className="flex flex-col" style={{ borderColor: "#f5f4f2" }}>
                  {alerts.map((alert) => {
                    const ps = PRI_STYLE[alert.priority];
                    return (
                      <div key={alert.id} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{ background: ps.bg, color: ps.color }}
                          >
                            {alert.priority}
                          </span>
                          <span className="text-[10px] flex-shrink-0" style={{ color: "#c4c4c4" }}>
                            {new Date(alert.createdAt).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}
                          </span>
                        </div>
                        <p className="text-xs font-medium mb-1" style={{ color: "#1a1a1a" }}>{alert.title}</p>
                        <p className="text-[11px] leading-relaxed mb-2" style={{ color: "#737373" }}>
                          {alert.description}
                        </p>
                        <button
                          onClick={() => handleAlertChat(alert.title, alert.description, alert.suggestedAction)}
                          className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full transition-colors hover:bg-[#eae8e4]"
                          style={{ color: "#1a1a1a", border: "1px solid #e8e5e0" }}
                        >
                          <Sparkles size={10} />
                          AI 分析
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Event Markers ── */}
        <div
          className="rounded-xl p-4"
          style={{ border: "1.5px dashed #d4d4d4", background: "#fafaf9" }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar size={15} style={{ color: "#737373" }} />
              <span className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>活动事件标记</span>
              <span className="text-[11px]" style={{ color: "#a3a3a3" }}>· AI 分析时自动分离活动期数据</span>
            </div>
            <button
              onClick={() => setShowAddEvent((v) => !v)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-[#eae8e4]"
              style={{ border: "1px solid #e8e5e0", color: "#374151", background: "#ffffff" }}
            >
              <Plus size={12} />
              添加
            </button>
          </div>

          {/* Add Event Form */}
          {showAddEvent && (
            <div
              className="rounded-xl p-4 mb-3"
              style={{ background: "#ffffff", border: "1px solid #e8e5e0" }}
            >
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-[11px] font-medium mb-1" style={{ color: "#737373" }}>开始日期</label>
                  <input
                    type="date"
                    value={newEvent.startDate}
                    onChange={(e) => setNewEvent((v) => ({ ...v, startDate: e.target.value }))}
                    className="w-full text-xs rounded-lg px-2.5 py-1.5 outline-none"
                    style={{ border: "1px solid #e8e5e0", color: "#1a1a1a" }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium mb-1" style={{ color: "#737373" }}>结束日期</label>
                  <input
                    type="date"
                    value={newEvent.endDate}
                    onChange={(e) => setNewEvent((v) => ({ ...v, endDate: e.target.value }))}
                    className="w-full text-xs rounded-lg px-2.5 py-1.5 outline-none"
                    style={{ border: "1px solid #e8e5e0", color: "#1a1a1a" }}
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="block text-[11px] font-medium mb-1.5" style={{ color: "#737373" }}>活动类型</label>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.entries(EVENT_CONFIG) as [EventType, typeof EVENT_CONFIG[EventType]][]).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => setNewEvent((v) => ({ ...v, eventType: key }))}
                      className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] transition-all"
                      style={{
                        background: newEvent.eventType === key ? cfg.color : "#f5f4f2",
                        color: newEvent.eventType === key ? "#ffffff" : "#374151",
                        border: `1px solid ${newEvent.eventType === key ? cfg.color : "#e8e5e0"}`,
                      }}
                    >
                      <span>{cfg.emoji}</span>
                      <span>{cfg.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-3">
                <label className="block text-[11px] font-medium mb-1" style={{ color: "#737373" }}>备注</label>
                <input
                  type="text"
                  placeholder="如：满减券 20% off，价格降至 $X"
                  value={newEvent.note}
                  onChange={(e) => setNewEvent((v) => ({ ...v, note: e.target.value }))}
                  className="w-full text-xs rounded-lg px-2.5 py-1.5 outline-none"
                  style={{ border: "1px solid #e8e5e0", color: "#1a1a1a" }}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setShowAddEvent(false); setNewEvent(BLANK_EVENT); }}
                  className="px-3 py-1.5 rounded-lg text-xs transition-colors hover:bg-[#f0eeec]"
                  style={{ color: "#737373" }}
                >
                  取消
                </button>
                <button
                  onClick={handleAddEvent}
                  disabled={!newEvent.startDate || !newEvent.endDate}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: newEvent.startDate && newEvent.endDate ? "#1a1a1a" : "#e8e5e0",
                    color: newEvent.startDate && newEvent.endDate ? "#ffffff" : "#a3a3a3",
                  }}
                >
                  保存标记
                </button>
              </div>
            </div>
          )}

          {/* Existing markers */}
          {eventMarkers.length > 0 ? (
            <div className="flex flex-col gap-2">
              {eventMarkers.map((marker) => {
                const cfg = EVENT_CONFIG[marker.eventType];
                return (
                  <div
                    key={marker.id}
                    className="flex items-center gap-3 rounded-lg px-3 py-2"
                    style={{ background: "#ffffff", border: "1px solid #e8e5e0" }}
                  >
                    <span
                      className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-sm"
                      style={{ background: cfg.color + "22" }}
                    >
                      {cfg.emoji}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium" style={{ color: "#1a1a1a" }}>
                          {cfg.label}
                        </span>
                        <span className="text-[10px] font-mono" style={{ color: "#a3a3a3" }}>
                          {marker.startDate} ~ {marker.endDate}
                        </span>
                      </div>
                      {marker.note && (
                        <p className="text-[11px] truncate mt-0.5" style={{ color: "#737373" }}>
                          {marker.note}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => removeEventMarker(productId, marker.id)}
                      className="flex-shrink-0 p-1 rounded transition-colors hover:bg-[#f5f4f2]"
                      style={{ color: "#c4c4c4" }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            !showAddEvent && (
              <p className="text-xs text-center py-2" style={{ color: "#c4c4c4" }}>
                暂无活动事件，点击「添加」标记促销时间段
              </p>
            )
          )}
        </div>

      </div>
    </div>
  );
}
