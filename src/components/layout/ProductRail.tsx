"use client";

import { useState } from "react";
import { Zap, Settings, Plus, X } from "lucide-react";
import { useAppStore, type ProductStage } from "@/store/appStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const STAGES: ProductStage[] = ["新品期", "成长期", "成熟期", "衰退期"];
const MARKETPLACES = ["US", "CA", "MX", "UK", "DE", "JP"];

const BLANK_FORM = {
  asin: "",
  name: "",
  shortName: "",
  emoji: "📦",
  stage: "新品期" as ProductStage,
  brand: "",
  price: "",
  marketplace: ["US"] as string[],
};

function AddProductModal({ onClose }: { onClose: () => void }) {
  const { addProduct } = useAppStore();
  const [form, setForm] = useState(BLANK_FORM);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  function toggleMarketplace(mp: string) {
    setForm((v) => ({
      ...v,
      marketplace: v.marketplace.includes(mp)
        ? v.marketplace.filter((m) => m !== mp)
        : [...v.marketplace, mp],
    }));
  }

  function handleSubmit() {
    const errs: Record<string, string> = {};
    if (!form.asin.trim()) errs.asin = "必填";
    if (!form.name.trim()) errs.name = "必填";
    if (!form.shortName.trim()) errs.shortName = "必填";
    if (form.marketplace.length === 0) errs.marketplace = "至少选一个站点";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    addProduct({
      asin: form.asin.trim().toUpperCase(),
      name: form.name.trim(),
      shortName: form.shortName.trim(),
      emoji: form.emoji || "📦",
      category: "其他",
      stage: form.stage,
      brand: form.brand.trim(),
      marketplace: form.marketplace,
      price: parseFloat(form.price) || 0,
      rating: 0,
      reviewCount: 0,
      bsr: 9999,
    });
    onClose();
  }

  const field = (key: string) => ({
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((v) => ({ ...v, [key]: e.target.value }));
      setErrors((e2) => ({ ...e2, [key]: undefined }));
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.35)" }}
        onClick={onClose}
      />
      <div
        className="relative flex flex-col rounded-2xl overflow-hidden"
        style={{
          width: 380,
          maxHeight: "88vh",
          background: "#ffffff",
          boxShadow: "0 16px 40px rgba(0,0,0,0.18)",
          border: "1px solid #e8e5e0",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
          style={{ borderColor: "#e8e5e0" }}
        >
          <span className="font-semibold text-sm" style={{ color: "#1a1a1a" }}>添加产品</span>
          <button onClick={onClose} className="p-1 rounded-lg transition-colors hover:bg-[#f5f4f2]" style={{ color: "#a3a3a3" }}>
            <X size={16} />
          </button>
        </div>

        {/* Scrollable form body */}
        <div className="flex-1 overflow-y-auto px-5 py-4" style={{ scrollbarWidth: "thin", scrollbarColor: "#e8e5e0 transparent" }}>
          <div className="flex flex-col gap-4">

            {/* ASIN */}
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: "#737373" }}>
                ASIN <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <input
                type="text"
                value={form.asin}
                placeholder="B0XXXXXXXXX"
                className="w-full text-sm rounded-xl px-3 py-2 outline-none font-mono"
                style={{ border: `1px solid ${errors.asin ? "#dc2626" : "#e8e5e0"}`, color: "#1a1a1a", background: "#fafaf9" }}
                {...field("asin")}
              />
              {errors.asin && <p className="text-[10px] mt-0.5" style={{ color: "#dc2626" }}>{errors.asin}</p>}
            </div>

            {/* 产品名称 */}
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: "#737373" }}>
                产品名称 <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <input
                type="text"
                value={form.name}
                placeholder="如：4寸Full沙发床垫"
                className="w-full text-sm rounded-xl px-3 py-2 outline-none"
                style={{ border: `1px solid ${errors.name ? "#dc2626" : "#e8e5e0"}`, color: "#1a1a1a", background: "#fafaf9" }}
                {...field("name")}
              />
              {errors.name && <p className="text-[10px] mt-0.5" style={{ color: "#dc2626" }}>{errors.name}</p>}
            </div>

            {/* 简称 + Emoji */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-[11px] font-semibold mb-1" style={{ color: "#737373" }}>
                  简称 <span style={{ color: "#dc2626" }}>*</span>
                  <span className="font-normal ml-1" style={{ color: "#c4c4c4" }}>侧栏显示，≤8字</span>
                </label>
                <input
                  type="text"
                  value={form.shortName}
                  placeholder="Full沙发垫"
                  maxLength={8}
                  className="w-full text-sm rounded-xl px-3 py-2 outline-none"
                  style={{ border: `1px solid ${errors.shortName ? "#dc2626" : "#e8e5e0"}`, color: "#1a1a1a", background: "#fafaf9" }}
                  {...field("shortName")}
                />
                {errors.shortName && <p className="text-[10px] mt-0.5" style={{ color: "#dc2626" }}>{errors.shortName}</p>}
              </div>
              <div style={{ width: 72 }}>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: "#737373" }}>Emoji</label>
                <input
                  type="text"
                  value={form.emoji}
                  className="w-full text-center text-xl rounded-xl px-2 py-2 outline-none"
                  style={{ border: "1px solid #e8e5e0", background: "#fafaf9" }}
                  onChange={(e) => setForm((v) => ({ ...v, emoji: e.target.value }))}
                />
              </div>
            </div>

            {/* 运营阶段 */}
            <div>
              <label className="block text-[11px] font-semibold mb-1.5" style={{ color: "#737373" }}>运营阶段</label>
              <div className="flex gap-1.5 flex-wrap">
                {STAGES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm((v) => ({ ...v, stage: s }))}
                    className="px-3 py-1 rounded-full text-xs font-medium transition-all"
                    style={{
                      background: form.stage === s ? "#1a1a1a" : "#f5f4f2",
                      color: form.stage === s ? "#ffffff" : "#374151",
                      border: `1px solid ${form.stage === s ? "#1a1a1a" : "#e8e5e0"}`,
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* 站点 */}
            <div>
              <label className="block text-[11px] font-semibold mb-1.5" style={{ color: "#737373" }}>
                站点 <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {MARKETPLACES.map((mp) => {
                  const checked = form.marketplace.includes(mp);
                  return (
                    <button
                      key={mp}
                      type="button"
                      onClick={() => { toggleMarketplace(mp); setErrors((e2) => ({ ...e2, marketplace: undefined })); }}
                      className="px-3 py-1 rounded-full text-xs font-medium transition-all"
                      style={{
                        background: checked ? "#1a1a1a" : "#f5f4f2",
                        color: checked ? "#ffffff" : "#374151",
                        border: `1px solid ${checked ? "#1a1a1a" : "#e8e5e0"}`,
                      }}
                    >
                      {mp}
                    </button>
                  );
                })}
              </div>
              {errors.marketplace && <p className="text-[10px] mt-0.5" style={{ color: "#dc2626" }}>{errors.marketplace}</p>}
            </div>

            {/* 品牌 + 价格 */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-[11px] font-semibold mb-1" style={{ color: "#737373" }}>品牌</label>
                <input
                  type="text"
                  value={form.brand}
                  placeholder="如：Nordhive"
                  className="w-full text-sm rounded-xl px-3 py-2 outline-none"
                  style={{ border: "1px solid #e8e5e0", color: "#1a1a1a", background: "#fafaf9" }}
                  onChange={(e) => setForm((v) => ({ ...v, brand: e.target.value }))}
                />
              </div>
              <div style={{ width: 104 }}>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: "#737373" }}>当前价格 ($)</label>
                <input
                  type="number"
                  value={form.price}
                  placeholder="0.00"
                  min={0}
                  step={0.01}
                  className="w-full text-sm rounded-xl px-3 py-2 outline-none"
                  style={{ border: "1px solid #e8e5e0", color: "#1a1a1a", background: "#fafaf9" }}
                  onChange={(e) => setForm((v) => ({ ...v, price: e.target.value }))}
                />
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t flex-shrink-0" style={{ borderColor: "#e8e5e0" }}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm transition-colors hover:bg-[#f5f4f2]"
            style={{ color: "#737373" }}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
            style={{ background: "#1a1a1a", color: "#ffffff" }}
          >
            添加产品
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProductRail() {
  const { products, selectedProductId, setSelectedProductId, alerts } = useAppStore();
  const [showAdd, setShowAdd] = useState(false);

  const getAlertCount = (productId: string) =>
    alerts.filter((a) => a.productId === productId && a.status === "open").length;

  return (
    <>
      <div
        className="flex flex-col items-center py-3 gap-1 flex-shrink-0 border-r"
        style={{
          width: 72,
          background: "#edece9",
          borderColor: "#e0ddd8",
          height: "100vh",
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center justify-center rounded-[10px] mb-3 flex-shrink-0"
          style={{ width: 40, height: 40, background: "#1a1a1a" }}
        >
          <Zap size={20} color="#fafaf9" fill="#fafaf9" />
        </div>

        {/* Product List */}
        <ScrollArea className="flex-1 w-full px-2">
          <div className="flex flex-col gap-1">
            {products.map((product) => {
              const alertCount = getAlertCount(product.id);
              const isSelected = product.id === selectedProductId;

              return (
                <button
                  key={product.id}
                  onClick={() => setSelectedProductId(product.id)}
                  title={product.name}
                  className={cn(
                    "relative flex flex-col items-center justify-center rounded-lg py-2.5 px-1 transition-all duration-150 cursor-pointer border-2 w-full",
                    isSelected
                      ? "border-[#1a1a1a] bg-[#e2dfda]"
                      : "border-transparent hover:bg-[#eae8e4]"
                  )}
                  style={{ minHeight: 52 }}
                >
                  <span className="text-xl leading-none">{product.emoji}</span>
                  <span
                    className="text-[9px] mt-1 font-medium leading-tight text-center w-full truncate"
                    style={{ color: isSelected ? "#1a1a1a" : "#737373" }}
                  >
                    {product.shortName}
                  </span>

                  {alertCount > 0 && (
                    <span
                      className="absolute top-0.5 right-0.5 flex items-center justify-center rounded-full text-white font-bold"
                      style={{
                        background: "#ef4444",
                        fontSize: 9,
                        minWidth: 16,
                        height: 16,
                        padding: "0 3px",
                      }}
                    >
                      {alertCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </ScrollArea>

        {/* Bottom */}
        <div className="flex flex-col items-center gap-1 mt-auto px-2 w-full">
          <button
            onClick={() => setShowAdd(true)}
            title="添加产品"
            className="flex flex-col items-center justify-center rounded-lg py-2.5 px-1 w-full transition-colors hover:bg-[#eae8e4]"
            style={{ minHeight: 52 }}
          >
            <Plus size={18} color="#737373" />
            <span className="text-[9px] mt-1 font-medium" style={{ color: "#737373" }}>添加</span>
          </button>
          <button
            title="设置"
            className="flex items-center justify-center rounded-lg p-2 w-full hover:bg-[#eae8e4] transition-colors"
          >
            <Settings size={18} color="#737373" />
          </button>
        </div>
      </div>

      {showAdd && <AddProductModal onClose={() => setShowAdd(false)} />}
    </>
  );
}
