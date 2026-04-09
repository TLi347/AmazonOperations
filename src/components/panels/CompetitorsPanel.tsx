"use client";

import { useState } from "react";
import { Plus, X, TrendingUp, TrendingDown, Minus, Sparkles, Globe } from "lucide-react";
import { useAppStore, type ThreatLevel, type TrendDirection } from "@/store/appStore";

// ── Constants ─────────────────────────────────────────────────────────────────

const THREAT_STYLE: Record<ThreatLevel, { bg: string; color: string; label: string }> = {
  high:   { bg: "#fee2e2", color: "#dc2626", label: "高威胁" },
  medium: { bg: "#fef3c7", color: "#d97706", label: "中威胁" },
  low:    { bg: "#dcfce7", color: "#16a34a", label: "低威胁" },
};

const THREAT_DOT: Record<ThreatLevel, string> = {
  high: "🔴",
  medium: "🟡",
  low: "🟢",
};

const TREND_CONFIG: Record<TrendDirection, { icon: React.ElementType; color: string; label: string }> = {
  up:   { icon: TrendingUp,   color: "#dc2626", label: "上升" },
  flat: { icon: Minus,        color: "#a3a3a3", label: "平稳" },
  down: { icon: TrendingDown, color: "#16a34a", label: "下降" },
};

// ── Blank form state ──────────────────────────────────────────────────────────

const BLANK_FORM = {
  name: "",
  asin: "",
  price: "",
  rating: "",
  reviewCount: "",
  bsr: "",
  trend: "flat" as TrendDirection,
  threatLevel: "medium" as ThreatLevel,
  note: "",
};

// ── Main component ────────────────────────────────────────────────────────────

export default function CompetitorsPanel() {
  const {
    getSelectedProduct,
    competitorsByProduct,
    addCompetitor,
    removeCompetitor,
    setActivePanel,
    setPendingChatMessage,
  } = useAppStore();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof typeof BLANK_FORM, string>>>({});

  const product = getSelectedProduct();
  if (!product) {
    return (
      <div className="flex h-full items-center justify-center" style={{ background: "#fafaf9" }}>
        <p className="text-sm" style={{ color: "#a3a3a3" }}>请先在左栏选择一个产品</p>
      </div>
    );
  }

  const productId = product.id;
  const competitors = competitorsByProduct[productId] ?? [];

  function setField<K extends keyof typeof BLANK_FORM>(key: K, value: typeof BLANK_FORM[K]) {
    setForm((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validate() {
    const errs: typeof errors = {};
    if (!form.name.trim()) errs.name = "必填";
    if (!form.asin.trim()) errs.asin = "必填";
    if (!form.price || isNaN(Number(form.price)) || Number(form.price) <= 0) errs.price = "请输入正数";
    if (!form.rating || isNaN(Number(form.rating)) || Number(form.rating) < 1 || Number(form.rating) > 5) errs.rating = "1–5";
    if (!form.reviewCount || isNaN(Number(form.reviewCount))) errs.reviewCount = "请输入数字";
    if (!form.bsr || isNaN(Number(form.bsr))) errs.bsr = "请输入数字";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleAdd() {
    if (!validate()) return;
    addCompetitor(productId, {
      name: form.name.trim(),
      asin: form.asin.trim().toUpperCase(),
      price: Number(form.price),
      rating: Number(form.rating),
      reviewCount: Number(form.reviewCount),
      bsr: Number(form.bsr),
      trend: form.trend,
      threatLevel: form.threatLevel,
      note: form.note.trim() || undefined,
    });
    setForm(BLANK_FORM);
    setErrors({});
    setShowForm(false);
  }

  function handleAnalyze() {
    if (competitors.length === 0 || !product) return;
    const lines = competitors.map((c) => {
      const t = THREAT_STYLE[c.threatLevel];
      return `- ${c.name}（${c.asin}）：$${c.price}，${c.rating}星·${c.reviewCount.toLocaleString()}评，BSR #${c.bsr.toLocaleString()}，${t.label}`;
    });
    setActivePanel("chat");
    setPendingChatMessage(
      `请分析「${product.shortName}」（${product.asin}）的竞品格局，并给出竞争策略建议：\n\n**竞品列表：**\n${lines.join("\n")}\n\n重点分析：价格竞争力、评分差距、市场份额威胁，以及我们的差异化应对策略。`
    );
  }

  return (
    <div
      className="h-full overflow-y-auto"
      style={{ background: "#fafaf9", scrollbarWidth: "thin", scrollbarColor: "#d4d4d4 transparent" }}
    >
      <div className="p-5" style={{ maxWidth: 900 }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold mb-1" style={{ color: "#1a1a1a" }}>
              竞品监控 · {product.emoji} {product.shortName}
            </h2>
            <p className="text-xs" style={{ color: "#a3a3a3" }}>
              手动录入竞品信息 · 竞品数据来自 Nordhive 竞品截图 / ABA 分析
            </p>
          </div>
          <div className="flex items-center gap-2">
            {competitors.length > 0 && (
              <button
                onClick={handleAnalyze}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:bg-[#eae8e4]"
                style={{ border: "1px solid #e8e5e0", color: "#1a1a1a", background: "#ffffff" }}
              >
                <Sparkles size={11} />
                AI 分析全部
              </button>
            )}
            <button
              onClick={() => setShowForm((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:bg-[#eae8e4]"
              style={{ border: "1px solid #e8e5e0", color: "#374151", background: "#ffffff" }}
            >
              <Plus size={12} />
              添加竞品
            </button>
          </div>
        </div>

        {/* Add form */}
        {showForm && (
          <div
            className="rounded-xl p-4 mb-5"
            style={{ background: "#ffffff", border: "1px solid #e8e5e0" }}
          >
            <h3 className="text-sm font-semibold mb-3" style={{ color: "#1a1a1a" }}>添加竞品</h3>

            <div className="grid grid-cols-2 gap-3 mb-3">
              {/* Name */}
              <div>
                <label className="block text-[11px] font-medium mb-1" style={{ color: "#737373" }}>
                  竞品名称 <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="如：Novilla Queen Mattress"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  className="w-full text-xs rounded-lg px-2.5 py-1.5 outline-none"
                  style={{ border: `1px solid ${errors.name ? "#fca5a5" : "#e8e5e0"}`, color: "#1a1a1a" }}
                />
                {errors.name && <p className="text-[10px] mt-0.5" style={{ color: "#dc2626" }}>{errors.name}</p>}
              </div>

              {/* ASIN */}
              <div>
                <label className="block text-[11px] font-medium mb-1" style={{ color: "#737373" }}>
                  ASIN <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="B0XXXXXXXX"
                  value={form.asin}
                  onChange={(e) => setField("asin", e.target.value.toUpperCase())}
                  className="w-full text-xs rounded-lg px-2.5 py-1.5 outline-none font-mono"
                  style={{ border: `1px solid ${errors.asin ? "#fca5a5" : "#e8e5e0"}`, color: "#1a1a1a" }}
                />
                {errors.asin && <p className="text-[10px] mt-0.5" style={{ color: "#dc2626" }}>{errors.asin}</p>}
              </div>

              {/* Price */}
              <div>
                <label className="block text-[11px] font-medium mb-1" style={{ color: "#737373" }}>
                  售价 ($) <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  type="number"
                  placeholder="299.99"
                  value={form.price}
                  onChange={(e) => setField("price", e.target.value)}
                  className="w-full text-xs rounded-lg px-2.5 py-1.5 outline-none"
                  style={{ border: `1px solid ${errors.price ? "#fca5a5" : "#e8e5e0"}`, color: "#1a1a1a" }}
                />
                {errors.price && <p className="text-[10px] mt-0.5" style={{ color: "#dc2626" }}>{errors.price}</p>}
              </div>

              {/* Rating */}
              <div>
                <label className="block text-[11px] font-medium mb-1" style={{ color: "#737373" }}>
                  评分 (1–5) <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="5"
                  placeholder="4.5"
                  value={form.rating}
                  onChange={(e) => setField("rating", e.target.value)}
                  className="w-full text-xs rounded-lg px-2.5 py-1.5 outline-none"
                  style={{ border: `1px solid ${errors.rating ? "#fca5a5" : "#e8e5e0"}`, color: "#1a1a1a" }}
                />
                {errors.rating && <p className="text-[10px] mt-0.5" style={{ color: "#dc2626" }}>{errors.rating}</p>}
              </div>

              {/* Review count */}
              <div>
                <label className="block text-[11px] font-medium mb-1" style={{ color: "#737373" }}>
                  评价数 <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  type="number"
                  placeholder="1200"
                  value={form.reviewCount}
                  onChange={(e) => setField("reviewCount", e.target.value)}
                  className="w-full text-xs rounded-lg px-2.5 py-1.5 outline-none"
                  style={{ border: `1px solid ${errors.reviewCount ? "#fca5a5" : "#e8e5e0"}`, color: "#1a1a1a" }}
                />
                {errors.reviewCount && <p className="text-[10px] mt-0.5" style={{ color: "#dc2626" }}>{errors.reviewCount}</p>}
              </div>

              {/* BSR */}
              <div>
                <label className="block text-[11px] font-medium mb-1" style={{ color: "#737373" }}>
                  BSR 排名 <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  type="number"
                  placeholder="850"
                  value={form.bsr}
                  onChange={(e) => setField("bsr", e.target.value)}
                  className="w-full text-xs rounded-lg px-2.5 py-1.5 outline-none"
                  style={{ border: `1px solid ${errors.bsr ? "#fca5a5" : "#e8e5e0"}`, color: "#1a1a1a" }}
                />
                {errors.bsr && <p className="text-[10px] mt-0.5" style={{ color: "#dc2626" }}>{errors.bsr}</p>}
              </div>
            </div>

            {/* Trend + threat level */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[11px] font-medium mb-1.5" style={{ color: "#737373" }}>趋势</label>
                <div className="flex gap-2">
                  {(["up", "flat", "down"] as TrendDirection[]).map((t) => {
                    const cfg = TREND_CONFIG[t];
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={t}
                        onClick={() => setField("trend", t)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-all"
                        style={{
                          background: form.trend === t ? "#1a1a1a" : "#f5f4f2",
                          color: form.trend === t ? "#ffffff" : "#737373",
                          border: `1px solid ${form.trend === t ? "#1a1a1a" : "#e8e5e0"}`,
                        }}
                      >
                        <Icon size={11} />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium mb-1.5" style={{ color: "#737373" }}>威胁级别</label>
                <div className="flex gap-2">
                  {(["high", "medium", "low"] as ThreatLevel[]).map((tl) => {
                    const ts = THREAT_STYLE[tl];
                    return (
                      <button
                        key={tl}
                        onClick={() => setField("threatLevel", tl)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-all"
                        style={{
                          background: form.threatLevel === tl ? ts.color : "#f5f4f2",
                          color: form.threatLevel === tl ? "#ffffff" : "#737373",
                          border: `1px solid ${form.threatLevel === tl ? ts.color : "#e8e5e0"}`,
                        }}
                      >
                        {THREAT_DOT[tl]} {ts.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Note */}
            <div className="mb-4">
              <label className="block text-[11px] font-medium mb-1" style={{ color: "#737373" }}>备注（可选）</label>
              <input
                type="text"
                placeholder="如：近期频繁打折，主攻 queen size 关键词"
                value={form.note}
                onChange={(e) => setField("note", e.target.value)}
                className="w-full text-xs rounded-lg px-2.5 py-1.5 outline-none"
                style={{ border: "1px solid #e8e5e0", color: "#1a1a1a" }}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowForm(false); setForm(BLANK_FORM); setErrors({}); }}
                className="px-3 py-1.5 rounded-lg text-xs transition-colors hover:bg-[#f0eeec]"
                style={{ color: "#737373" }}
              >
                取消
              </button>
              <button
                onClick={handleAdd}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{ background: "#1a1a1a", color: "#ffffff" }}
              >
                保存竞品
              </button>
            </div>
          </div>
        )}

        {/* Competitor cards */}
        {competitors.length > 0 ? (
          <div className="flex flex-col gap-3">
            {competitors.map((comp) => {
              const ts = THREAT_STYLE[comp.threatLevel];
              const trend = TREND_CONFIG[comp.trend];
              const TrendIcon = trend.icon;
              const priceDiff = ((comp.price - product.price) / product.price) * 100;

              return (
                <div
                  key={comp.id}
                  className="rounded-xl px-4 py-3"
                  style={{ background: "#ffffff", border: "1px solid #e8e5e0" }}
                >
                  <div className="flex items-center gap-4">
                    {/* Threat dot */}
                    <span className="flex-shrink-0 text-lg">{THREAT_DOT[comp.threatLevel]}</span>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>
                          {comp.name}
                        </span>
                        <span
                          className="font-mono text-[10px] px-1.5 py-0.5 rounded"
                          style={{ background: "#f5f4f2", color: "#737373" }}
                        >
                          {comp.asin}
                        </span>
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                          style={{ background: ts.bg, color: ts.color }}
                        >
                          {ts.label}
                        </span>
                      </div>
                      {comp.note && (
                        <p className="text-[11px]" style={{ color: "#a3a3a3" }}>{comp.note}</p>
                      )}
                    </div>

                    {/* Metrics */}
                    <div className="flex items-center gap-5 flex-shrink-0">
                      {/* Price */}
                      <div className="text-right">
                        <div className="text-sm font-bold" style={{ color: "#1a1a1a" }}>
                          ${comp.price}
                        </div>
                        <div
                          className="text-[10px]"
                          style={{ color: priceDiff > 0 ? "#a3a3a3" : "#dc2626" }}
                        >
                          {priceDiff > 0 ? `贵 ${priceDiff.toFixed(0)}%` : `便宜 ${Math.abs(priceDiff).toFixed(0)}%`}
                        </div>
                      </div>

                      {/* Rating */}
                      <div className="text-right">
                        <div className="text-sm font-bold" style={{ color: "#1a1a1a" }}>
                          ⭐ {comp.rating.toFixed(1)}
                        </div>
                        <div className="text-[10px]" style={{ color: "#a3a3a3" }}>
                          {comp.reviewCount.toLocaleString()} 评
                        </div>
                      </div>

                      {/* BSR */}
                      <div className="text-right">
                        <div className="text-sm font-bold" style={{ color: "#1a1a1a" }}>
                          #{comp.bsr.toLocaleString()}
                        </div>
                        <div className="text-[10px]" style={{ color: "#a3a3a3" }}>BSR</div>
                      </div>

                      {/* Trend */}
                      <div className="flex flex-col items-center gap-0.5">
                        <TrendIcon size={18} style={{ color: trend.color }} />
                        <span className="text-[10px]" style={{ color: trend.color }}>{trend.label}</span>
                      </div>

                      {/* Delete */}
                      <button
                        onClick={() => removeCompetitor(productId, comp.id)}
                        className="p-1.5 rounded-lg transition-colors hover:bg-[#f5f4f2]"
                        style={{ color: "#c4c4c4" }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          !showForm && (
            <div
              className="flex flex-col items-center gap-3 rounded-xl p-8"
              style={{ border: "1.5px dashed #d4d4d4", background: "#ffffff" }}
            >
              <Globe size={36} style={{ color: "#d4d4d4" }} />
              <div className="text-center">
                <p className="text-sm font-semibold mb-1" style={{ color: "#1a1a1a" }}>暂无竞品记录</p>
                <p className="text-xs leading-relaxed" style={{ color: "#a3a3a3" }}>
                  参考「竞品监控.jpeg」截图或 ABA 搜索词分析<br />
                  手动添加竞品后可让 AI 分析竞争格局
                </p>
              </div>
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium transition-all hover:bg-[#eae8e4]"
                style={{ border: "1px solid #e8e5e0", color: "#374151", background: "#f5f4f2" }}
              >
                <Plus size={12} />
                添加第一个竞品
              </button>
            </div>
          )
        )}

      </div>
    </div>
  );
}
