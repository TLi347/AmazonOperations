"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Sparkles,
  Megaphone,
  CheckCircle2,
  Circle,
  AlertTriangle,
  CheckCheck,
  Zap,
} from "lucide-react";
import { useAppStore, type Alert } from "@/store/appStore";

// ── SOP Rules data ────────────────────────────────────────────────────────────

interface SopRule {
  id: number;
  ruleId: string; // matches Alert.triggerRule
  priority: "P0" | "P1" | "P2" | "P3";
  title: string;
  trigger: string;
  action: string;
  detail: string;
}

const SOP_RULES: SopRule[] = [
  {
    id: 1,
    ruleId: "zero-conv",
    priority: "P0",
    title: "关键词零成交止血",
    trigger: "精确/词组匹配 点击 ≥15次 且 成交 = 0",
    action: "立即暂停该词 + 广泛父组添加词组否定",
    detail:
      "高点击零成交词持续消耗预算而无任何回报。处理步骤：① 在精确/词组活动层暂停该关键词；② 在广泛匹配父活动层添加词组否定，防止变体继续触发；③ 24小时后观察整体 ACoS 变化趋势。",
  },
  {
    id: 2,
    ruleId: "invalid-term",
    priority: "P0",
    title: "广泛匹配无效词爆量",
    trigger: "搜索词花费 > $20 且 成交 = 0",
    action: "在活动层精确否定该搜索词",
    detail:
      "广泛匹配会触发大量关联词，部分词高流量但完全不转化。直接在活动层（Campaign Level）添加精确否定，精准切断该词的流量入口，同时不影响其他有效词的投放。",
  },
  {
    id: 3,
    ruleId: "over-budget",
    priority: "P0",
    title: "超预算 + 高 ACoS 双击",
    trigger: "单日花费 > 预算 110% 且 当日 ACoS > 80%",
    action: "暂停广泛组 + 降低出价 10–15%",
    detail:
      "预算超支叠加高 ACoS 是双重出血，必须立即止损。先暂停广泛匹配活动组（通常是最大的预算消耗方），再对整个活动的精确词统一降价 10–15%，等次日数据稳定后再评估是否恢复。",
  },
  {
    id: 4,
    ruleId: "high-acos-bid",
    priority: "P1",
    title: "高 ACoS 词降价",
    trigger: "ACoS 80–114%，点击 ≥30次",
    action: "出价降低 30–40%",
    detail:
      "ACoS 超过 80% 说明广告投入严重高于产出。有足够点击量（≥30）才可降价，否则数据置信度不足。降幅选 30–40% 一步到位，避免小幅多次调整导致数据混乱。调整后观察 3–5 天。",
  },
  {
    id: 5,
    ruleId: "ctr-low",
    priority: "P1",
    title: "CTR 过低检查",
    trigger: "精确词曝光 ≥500 且 CTR < 0.2%",
    action: "检查主图吸引力 + 检查价格是否高于竞品 > 15%",
    detail:
      "CTR 低于 0.2% 通常不是广告问题，而是 Listing 问题。检查清单：① 主图是否清晰、场景感强；② 主标题前 5 个词是否包含核心词；③ 价格对比竞品是否有明显劣势（>15%）；④ 评分是否低于类目平均。",
  },
  {
    id: 6,
    ruleId: "low-impression",
    priority: "P1",
    title: "新品曝光不足",
    trigger: "精确词曝光 < 500（活动已运行 > 7天）",
    action: "热门词出价提升 20–30%，不低于类目 CPC 中位值 +15%",
    detail:
      "新品期需要主动买流量建立销售历史。出价低于类目中位意味着广告排名靠后，曝光自然不足。提价策略：先识别类目 CPC 中位值（参考 ABA 数据），将热门词出价调至中位值 +15%，接受短期高 ACoS 换取曝光和转化积累。",
  },
  {
    id: 7,
    ruleId: "best-kw-scale",
    priority: "P2",
    title: "最优词加价扩量",
    trigger: "ACoS ≤35% 且 CVR ≥4% 且 点击 ≥30",
    action: "出价 +15–20%，同步增加日预算 20%",
    detail:
      "三重正向信号（低 ACoS + 高转化 + 足够点击）说明该词已验证盈利，应主动扩量。出价提升 15–20% 争取更高广告位，同步增加日预算防止因预算不足错失流量高峰期，通常在 Prime 时段（下午 2–6 点）。",
  },
  {
    id: 8,
    ruleId: "kw-overlap",
    priority: "P2",
    title: "广泛精确词重叠处理",
    trigger: "同一词同时出现在广泛 + 精确活动，且出价接近",
    action: "精确匹配优先，在广泛组添加该词的精确否定",
    detail:
      "同词双活动竞价会互相抬价（自我竞争），且广泛匹配的数据会污染精确词的效果分析。原则：精确组承担该词的精准流量，广泛组通过添加精确否定放弃该词，专注于发现新词。",
  },
  {
    id: 9,
    ruleId: "phrase-low-imp",
    priority: "P2",
    title: "词组匹配低曝光",
    trigger: "词组匹配曝光 < 100次/天（持续 > 3天）",
    action: "出价提升 25–35%",
    detail:
      "词组曝光过低说明当前出价排名太低，未能进入有效广告位。25–35% 的提价幅度比精确词调价幅度更大，因为词组匹配的出价弹性通常更高。如提价后曝光仍无明显改善，考虑检查词本身的搜索量是否足够。",
  },
  {
    id: 10,
    ruleId: "asin-targeting",
    priority: "P2",
    title: "竞品 ASIN 定投承压",
    trigger: "ASIN 定投 ACoS > 70% 且 持续 > 14天",
    action: "保留高 CVR 的 ASIN，其余降价 15%",
    detail:
      "ASIN 定投（Product Targeting）是精准拦截竞品流量的手段，但若长期 ACoS 过高说明对方 Listing 的转化能力强于预期。处理步骤：① 按 CVR 降序排列所有被投 ASIN；② 保留 CVR ≥3% 的 ASIN 维持投放；③ 其余 ASIN 出价统一降 15%；④ 完全无转化的 ASIN 直接暂停。",
  },
  {
    id: 11,
    ruleId: "broad-to-exact",
    priority: "P3",
    title: "广泛词沉淀精确",
    trigger: "广泛匹配跑出搜索词 点击 ≥20 且 CVR ≥3%",
    action: "添加到精确匹配组，出价 = 广泛出价 × 1.2",
    detail:
      "广泛匹配是\"探矿\"工具，精确匹配是\"开采\"工具。当广泛词挖出高质量搜索词后，应及时沉淀到精确组并适当提价，利用精确匹配的更高优先级争取更好广告位。同时在广泛组对该词添加精确否定，避免广泛继续消耗同词预算。",
  },
  {
    id: 12,
    ruleId: "ad-structure",
    priority: "P3",
    title: "广告结构优化",
    trigger: "单活动关键词 > 50个 且 ACoS 差异 > 30%",
    action: "按效率分高/中/低层，分组管理",
    detail:
      "活动词数过多、效率差异大时，混合管理会导致预算向低效词倾斜（系统默认按点击率分配预算）。建议按 ACoS 三分：① 高效组（ACoS ≤40%）：维持出价或适度提价；② 中效组（ACoS 40–70%）：保守维持；③ 低效组（ACoS >70%）：逐步降价或暂停。",
  },
  {
    id: 13,
    ruleId: "seasonal-budget",
    priority: "P3",
    title: "季节性预算调整",
    trigger: "当月为旺季（同比销量 +20%）",
    action: "出价 +15–20%，预算 +30–50%",
    detail:
      "旺季竞争激烈，整体 CPC 会上涨，不提价意味着广告排名下降。预算增幅（+30–50%）大于出价增幅（+15–20%），因为旺季流量池更大，需要确保预算不在流量高峰前耗尽。建议在旺季开始前 2 周开始逐步提价，让系统有时间学习优化。",
  },
  {
    id: 14,
    ruleId: "brand-defense",
    priority: "P3",
    title: "品牌词防御",
    trigger: "竞品品牌词点击份额 > 5%",
    action: "添加品牌词精确匹配（低出价 $0.5–1）",
    detail:
      "当竞品在搜索我们品牌词时获得 >5% 的点击份额，说明存在流量劫持风险。防御策略：用极低出价（$0.5–1）投放自己的品牌精确词，以极低成本守住品牌词阵地，防止竞品广告出现在我们品牌搜索结果的显眼位置。",
  },
];

// ── Constants ─────────────────────────────────────────────────────────────────

const PRI_STYLE: Record<string, { bg: string; color: string }> = {
  P0: { bg: "#fee2e2", color: "#dc2626" },
  P1: { bg: "#fef3c7", color: "#d97706" },
  P2: { bg: "#dbeafe", color: "#2563eb" },
  P3: { bg: "#f3f4f6", color: "#6b7280" },
};

const PRI_SECTIONS = [
  { key: "P0", label: "P0 — 立即处理（当日）" },
  { key: "P1", label: "P1 — 24小时内" },
  { key: "P2", label: "P2 — 本周内" },
  { key: "P3", label: "P3 — 下次周期" },
] as const;

// ── Alert Card ────────────────────────────────────────────────────────────────

function AlertCard({
  alert,
  onDismiss,
  onGuide,
}: {
  alert: Alert;
  onDismiss: () => void;
  onGuide: () => void;
}) {
  const ps = PRI_STYLE[alert.priority];
  return (
    <div
      className="rounded-xl p-3 mb-2"
      style={{
        background: "#ffffff",
        border: `1px solid ${alert.priority === "P0" ? "#fca5a5" : alert.priority === "P1" ? "#fde68a" : "#e8e5e0"}`,
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
            style={{ background: ps.bg, color: ps.color }}
          >
            {alert.priority}
          </span>
          <span className="text-xs font-semibold" style={{ color: "#1a1a1a" }}>
            {alert.title}
          </span>
        </div>
        <button
          onClick={onDismiss}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] flex-shrink-0 hover:bg-[#f0eeec] transition-colors"
          style={{ color: "#a3a3a3", border: "1px solid #e8e5e0" }}
          title="标记为已处理"
        >
          <CheckCheck size={10} />
          处理
        </button>
      </div>
      <p className="text-[11px] leading-relaxed mb-2" style={{ color: "#737373" }}>
        {alert.description}
      </p>
      <div className="flex items-center gap-2">
        <span className="text-[10px]" style={{ color: "#a3a3a3" }}>
          建议：{alert.suggestedAction}
        </span>
      </div>
      <div className="mt-2">
        <button
          onClick={onGuide}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all hover:opacity-90"
          style={{ background: "#1a1a1a", color: "#ffffff" }}
        >
          <Sparkles size={9} />
          AI 指导操作
        </button>
      </div>
    </div>
  );
}

// ── Live Alerts Section ───────────────────────────────────────────────────────

function LiveAlertsSection({
  alerts,
  hasAdData,
  onDismiss,
  onGuide,
}: {
  alerts: Alert[];
  hasAdData: boolean;
  onDismiss: (id: string) => void;
  onGuide: (alert: Alert) => void;
}) {
  const openAlerts = alerts.filter((a) => a.status === "open");
  const p0Count = openAlerts.filter((a) => a.priority === "P0").length;
  const p1Count = openAlerts.filter((a) => a.priority === "P1").length;

  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className="rounded-xl mb-5 overflow-hidden"
      style={{ background: "#ffffff", border: "1px solid #e8e5e0" }}
    >
      {/* Header */}
      <button
        className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-[#fafaf9] transition-colors"
        onClick={() => setCollapsed((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle size={13} style={{ color: p0Count > 0 ? "#dc2626" : "#737373" }} />
          <span className="text-xs font-semibold" style={{ color: "#1a1a1a" }}>
            实时告警
          </span>
          {openAlerts.length > 0 && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{
                background: p0Count > 0 ? "#fee2e2" : "#fef3c7",
                color: p0Count > 0 ? "#dc2626" : "#d97706",
              }}
            >
              {openAlerts.length}
            </span>
          )}
          {p0Count > 0 && (
            <span className="text-[10px] font-semibold" style={{ color: "#dc2626" }}>
              {p0Count} 个P0紧急
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {openAlerts.length === 0 && hasAdData && (
            <span className="text-[10px]" style={{ color: "#16a34a" }}>
              ✓ 无异常
            </span>
          )}
          {collapsed ? (
            <ChevronRight size={13} style={{ color: "#a3a3a3" }} />
          ) : (
            <ChevronDown size={13} style={{ color: "#a3a3a3" }} />
          )}
        </div>
      </button>

      {/* Body */}
      {!collapsed && (
        <div className="px-4 pb-4 pt-1" style={{ borderTop: "1px solid #f0eeec" }}>
          {!hasAdData ? (
            <div
              className="text-[11px] px-3 py-2.5 rounded-lg"
              style={{ background: "#fef3c7", color: "#d97706" }}
            >
              上传「广告活动报表」或「搜索词重构报表」后，系统自动检测 16 条 SOP 规则并生成告警
            </div>
          ) : openAlerts.length === 0 ? (
            <div
              className="flex items-center gap-2 text-[11px] px-3 py-2.5 rounded-lg"
              style={{ background: "#f0fdf4", color: "#16a34a" }}
            >
              <CheckCircle2 size={13} />
              当前广告数据未命中任何告警规则，运营状态良好
            </div>
          ) : (
            <>
              <p className="text-[10px] mb-3" style={{ color: "#a3a3a3" }}>
                共 {openAlerts.length} 条告警 · {p0Count > 0 ? `${p0Count} 条P0需立即处理 · ` : ""}
                {p1Count > 0 ? `${p1Count} 条P1需24小时内处理` : ""}
              </p>
              {/* Sort: P0 first, then P1, P2, P3 */}
              {["P0", "P1", "P2", "P3"].flatMap((pri) =>
                openAlerts
                  .filter((a) => a.priority === pri)
                  .map((alert) => (
                    <AlertCard
                      key={alert.id}
                      alert={alert}
                      onDismiss={() => onDismiss(alert.id)}
                      onGuide={() => onGuide(alert)}
                    />
                  ))
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── File requirement row ──────────────────────────────────────────────────────

function RequiredFileRow({
  label,
  hint,
  satisfied,
}: {
  label: string;
  hint: string;
  satisfied: boolean;
}) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      {satisfied ? (
        <CheckCircle2
          size={13}
          className="mt-0.5 flex-shrink-0"
          style={{ color: "#16a34a" }}
        />
      ) : (
        <Circle
          size={13}
          className="mt-0.5 flex-shrink-0"
          style={{ color: "#d4d4d4" }}
        />
      )}
      <div>
        <span
          className="text-[11px] font-medium"
          style={{ color: satisfied ? "#16a34a" : "#1a1a1a" }}
        >
          {label}
        </span>
        <span className="text-[10px] ml-1.5" style={{ color: "#a3a3a3" }}>
          {hint}
        </span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdsPanel() {
  const {
    setActivePanel,
    setPendingChatMessage,
    getSelectedProduct,
    getFilesForProduct,
    getAlertsForProduct,
    dismissAlert,
    adDataByProduct,
  } = useAppStore();

  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const product = getSelectedProduct();
  const files = product ? getFilesForProduct(product.id) : [];
  const alerts = product ? getAlertsForProduct(product.id) : [];
  const adData = product ? adDataByProduct[product.id] : undefined;
  const hasAdCampaign = files.some((f) => f.fileType === "nordhive_ad_campaign");
  const hasSearchTerm = files.some((f) => f.fileType === "nordhive_search_term");
  const hasAdData = !!(adData && (adData.campaigns.length > 0 || adData.searchTerms.length > 0));

  function toggleRule(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleAdsAnalysis() {
    const openAlerts = alerts.filter((a) => a.status === "open");
    const alertSummary =
      openAlerts.length > 0
        ? `\n\n当前检测到 ${openAlerts.length} 条告警：\n` +
          openAlerts
            .slice(0, 5)
            .map((a) => `- [${a.priority}] ${a.title}：${a.description}`)
            .join("\n")
        : "";

    setActivePanel("chat");
    setPendingChatMessage(
      `请对「${product?.name ?? "当前产品"}」的广告账户进行全面诊断，结合已上传的广告数据：\n\n1. 识别当前命中哪些 SOP 规则（P0-P3）\n2. 按优先级列出具体操作清单\n3. 给出本周最需要处理的 3 个问题\n4. 如有高 ACoS 词，请列出并给出降价幅度建议${alertSummary}`
    );
  }

  function handleGuideFromAlert(alert: Alert) {
    setActivePanel("chat");
    setPendingChatMessage(
      `请根据广告告警「${alert.title}」给出具体操作指导：\n\n**告警详情：** ${alert.description}\n**建议动作：** ${alert.suggestedAction}\n\n请帮我逐步执行该操作，并说明注意事项。`
    );
  }

  function handleGuide(rule: SopRule) {
    setActivePanel("chat");
    setPendingChatMessage(
      `请根据广告SOP规则「${rule.title}」，结合当前产品${product ? `「${product.shortName}」` : ""}的实际数据，给出具体的操作指导：\n\n**触发条件：** ${rule.trigger}\n**执行动作：** ${rule.action}\n\n请帮我分析当前是否命中该规则，如果是，请给出逐步操作建议。`
    );
  }

  // Count alerts per rule
  const alertsByRule = new Map<string, Alert[]>();
  for (const a of alerts) {
    if (a.status !== "open") continue;
    if (!alertsByRule.has(a.triggerRule)) alertsByRule.set(a.triggerRule, []);
    alertsByRule.get(a.triggerRule)!.push(a);
  }

  return (
    <div
      className="h-full overflow-y-auto"
      style={{
        background: "#fafaf9",
        scrollbarWidth: "thin",
        scrollbarColor: "#d4d4d4 transparent",
      }}
    >
      <div className="p-5" style={{ maxWidth: 800 }}>

        {/* ── 实时告警区块 ── */}
        <LiveAlertsSection
          alerts={alerts}
          hasAdData={hasAdData}
          onDismiss={dismissAlert}
          onGuide={handleGuideFromAlert}
        />

        {/* ── 分析指南 Card ── */}
        <div
          className="rounded-xl mb-5 overflow-hidden"
          style={{ background: "#ffffff", border: "1px solid #e8e5e0" }}
        >
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <Megaphone size={13} style={{ color: "#737373" }} />
              <span className="text-xs font-semibold" style={{ color: "#1a1a1a" }}>
                数据文件状态
              </span>
            </div>
            <button
              onClick={handleAdsAnalysis}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold hover:opacity-90 transition-all"
              style={{
                background: hasAdData ? "#1a1a1a" : "#e5e7eb",
                color: hasAdData ? "#ffffff" : "#9ca3af",
                cursor: hasAdData ? "pointer" : "not-allowed",
              }}
              disabled={!hasAdData}
            >
              <Sparkles size={9} />
              AI 广告诊断
            </button>
          </div>
          <div className="px-4 pb-3 pt-1" style={{ borderTop: "1px solid #f0eeec" }}>
            <RequiredFileRow
              label="广告活动报表"
              hint="系统-Nordhive-*-广告活动*.xlsx — 含活动花费/ACoS/预算数据"
              satisfied={hasAdCampaign}
            />
            <RequiredFileRow
              label="搜索词重构报表"
              hint="系统-Nordhive-*-搜索词重构*.xlsx — 含关键词转化/曝光/CTR数据"
              satisfied={hasSearchTerm}
            />
            <p className="mt-2 text-[10px] leading-relaxed" style={{ color: "#a3a3a3" }}>
              建议上传<span className="font-semibold" style={{ color: "#1a1a1a" }}>近 7-14 天</span>的报表（文件名中含日期区间，如{" "}
              <span className="font-mono">03-26~04-05</span>）以获得最佳告警精度
            </p>
            {hasAdData && (
              <div className="mt-2 flex items-center gap-1.5 text-[10px]" style={{ color: "#16a34a" }}>
                <Zap size={10} />
                告警引擎已运行 · 检测 16 条 SOP 规则
              </div>
            )}
          </div>
        </div>

        {/* ── SOP 规则列表 ── */}
        <div className="mb-5">
          <h2 className="text-base font-bold mb-1" style={{ color: "#1a1a1a" }}>
            广告优化 SOP
          </h2>
          <p className="text-xs" style={{ color: "#a3a3a3" }}>
            14条规则 · 命中规则自动高亮 · 点击「让AI指导」获取具体操作建议
          </p>
        </div>

        <div className="flex flex-col gap-5">
          {PRI_SECTIONS.map(({ key, label }) => {
            const rules = SOP_RULES.filter((r) => r.priority === key);
            const ps = PRI_STYLE[key];
            return (
              <div key={key}>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded"
                    style={{ background: ps.bg, color: ps.color }}
                  >
                    {key}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: "#737373" }}>
                    {label}
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {rules.map((rule) => {
                    const isOpen = expanded.has(rule.id);
                    const ruleAlerts = alertsByRule.get(rule.ruleId) ?? [];
                    const isTriggered = ruleAlerts.length > 0;

                    return (
                      <div
                        key={rule.id}
                        className="rounded-xl overflow-hidden"
                        style={{
                          background: "#ffffff",
                          border: isTriggered
                            ? `1px solid ${ps.color}40`
                            : "1px solid #e8e5e0",
                          borderLeft: isTriggered ? `3px solid ${ps.color}` : undefined,
                        }}
                      >
                        {/* Summary row */}
                        <button
                          className="flex items-center gap-3 w-full px-4 py-3 text-left transition-colors hover:bg-[#fafaf9]"
                          onClick={() => toggleRule(rule.id)}
                        >
                          <span
                            className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded"
                            style={{ background: ps.bg, color: ps.color }}
                          >
                            {rule.priority}
                          </span>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className="text-sm font-semibold"
                                style={{ color: "#1a1a1a" }}
                              >
                                {rule.title}
                              </span>
                              {isTriggered && (
                                <span
                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                  style={{ background: ps.bg, color: ps.color }}
                                >
                                  已命中
                                </span>
                              )}
                              <span
                                className="text-[11px]"
                                style={{ color: "#a3a3a3" }}
                              >
                                {rule.trigger}
                              </span>
                              <span style={{ color: "#d4d4d4", fontSize: 10 }}>→</span>
                              <span
                                className="text-[11px] font-medium"
                                style={{ color: "#374151" }}
                              >
                                {rule.action}
                              </span>
                            </div>
                          </div>

                          <span
                            className="flex-shrink-0"
                            style={{ color: "#a3a3a3" }}
                          >
                            {isOpen ? (
                              <ChevronDown size={14} />
                            ) : (
                              <ChevronRight size={14} />
                            )}
                          </span>
                        </button>

                        {/* Detail */}
                        {isOpen && (
                          <div
                            className="px-4 pb-4 pt-1"
                            style={{ borderTop: "1px solid #f0eeec" }}
                          >
                            {/* Show triggered alert detail if available */}
                            {isTriggered && (
                              <div
                                className="mb-3 p-2.5 rounded-lg text-[11px]"
                                style={{ background: `${ps.bg}80`, color: ps.color }}
                              >
                                <span className="font-semibold">实时数据：</span>{" "}
                                {ruleAlerts[0].description}
                              </div>
                            )}
                            <p
                              className="text-xs leading-relaxed mb-3"
                              style={{ color: "#737373" }}
                            >
                              {rule.detail}
                            </p>
                            <button
                              onClick={() => handleGuide(rule)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:bg-[#eae8e4]"
                              style={{
                                border: "1px solid #e8e5e0",
                                color: "#1a1a1a",
                              }}
                            >
                              <Sparkles size={11} />
                              让AI指导
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
