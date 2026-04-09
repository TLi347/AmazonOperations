"use client";

import { useState } from "react";
import { UploadCloud, AlertTriangle, Package, Sparkles, ChevronDown, ChevronRight, CheckCircle2, Circle } from "lucide-react";
import { useAppStore } from "@/store/appStore";

function getStatus(days: number): { dot: string; color: string; label: string } {
  if (days < 30) return { dot: "🔴", color: "#dc2626", label: "紧急" };
  if (days < 45) return { dot: "🟡", color: "#d97706", label: "偏低" };
  return           { dot: "🟢", color: "#16a34a", label: "正常" };
}

function RequiredFileRow({ label, hint, satisfied }: { label: string; hint: string; satisfied: boolean }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      {satisfied
        ? <CheckCircle2 size={13} className="mt-0.5 flex-shrink-0" style={{ color: "#16a34a" }} />
        : <Circle       size={13} className="mt-0.5 flex-shrink-0" style={{ color: "#d4d4d4" }} />
      }
      <div>
        <span className="text-[11px] font-medium" style={{ color: satisfied ? "#16a34a" : "#1a1a1a" }}>
          {label}
        </span>
        <span className="text-[10px] ml-1.5" style={{ color: "#a3a3a3" }}>{hint}</span>
      </div>
    </div>
  );
}

function AnalysisGuideCard({
  productName,
  hasData,
  onAnalyze,
}: {
  productName: string;
  hasData: boolean;
  onAnalyze: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl mb-4 overflow-hidden" style={{ background: "#ffffff", border: "1px solid #e8e5e0" }}>
      <button
        className="flex items-center justify-between w-full px-4 py-3 text-left transition-colors hover:bg-[#fafaf9]"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Package size={13} style={{ color: "#737373" }} />
          <span className="text-xs font-semibold" style={{ color: "#1a1a1a" }}>分析指南</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "#f5f4f2", color: "#a3a3a3" }}>库存管理</span>
        </div>
        <div className="flex items-center gap-2">
          {hasData && (
            <button
              onClick={(e) => { e.stopPropagation(); onAnalyze(); }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold hover:opacity-90 transition-all"
              style={{ background: "#1a1a1a", color: "#ffffff" }}
            >
              <Sparkles size={9} /> AI 补货分析
            </button>
          )}
          {open ? <ChevronDown size={13} style={{ color: "#a3a3a3" }} /> : <ChevronRight size={13} style={{ color: "#a3a3a3" }} />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1" style={{ borderTop: "1px solid #f0eeec" }}>
          <p className="text-[11px] mb-2" style={{ color: "#737373" }}>
            上传以下文件后可解析可售天数、在途库存、库龄分布等 60 个字段，自动生成补货方案：
          </p>
          <RequiredFileRow
            label="多站点库存报表"
            hint="系统-Nordhive-多站点-库存报表*.xlsx"
            satisfied={hasData}
          />
          {!hasData && (
            <p className="text-[10px] mt-3 px-3 py-2 rounded-lg" style={{ background: "#fef3c7", color: "#d97706" }}>
              上传库存报表后「AI 补货分析」按钮自动激活
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function InventoryPanel() {
  const {
    getSelectedProduct,
    inventoryByProduct,
    getFilesForProduct,
    setActivePanel,
    setPendingChatMessage,
  } = useAppStore();

  const product = getSelectedProduct();

  if (!product) {
    return (
      <div className="flex h-full items-center justify-center" style={{ background: "#fafaf9" }}>
        <p className="text-sm" style={{ color: "#a3a3a3" }}>请先在左栏选择一个产品</p>
      </div>
    );
  }

  const records = inventoryByProduct[product.id] ?? [];
  const files   = getFilesForProduct(product.id);
  const hasInventoryFile = files.some((f) => f.fileType === "nordhive_inventory") || records.length > 0;

  function handleAnalyze() {
    setActivePanel("chat");
    setPendingChatMessage(
      `请对「${product!.name}」（${product!.asin}）进行库存健康分析：\n\n当前可售天数、日均销量、在途库存情况，并给出：\n1. 最晚补货时间节点\n2. 建议补货量（按60天安全库存计算）\n3. 注意事项（旺季系数、头程时长等）`
    );
  }

  function handleUrgentChat() {
    setActivePanel("chat");
    const minDays = records.length > 0 ? Math.min(...records.map((r) => r.daysOfSupply)) : 0;
    const totalDailySales = records.reduce((s, r) => s + r.dailySales, 0);
    setPendingChatMessage(
      `请紧急分析「${product!.name}」（${product!.asin}）的库存情况：\n\n可售天数仅剩 ${minDays} 天，日均销量 ${totalDailySales.toFixed(1)} 件，在途库存 ${records.reduce((s, r) => s + r.inboundQty, 0)} 件。\n\n请给出补货方案，包括建议补货量、最晚下单时间和注意事项。`
    );
  }

  const totalAvail      = records.reduce((s, r) => s + r.availableQty, 0);
  const totalInbound    = records.reduce((s, r) => s + r.inboundQty, 0);
  const totalDailySales = records.reduce((s, r) => s + r.dailySales, 0);
  const totalRestock    = records.reduce((s, r) => s + r.restockQty, 0);
  const minDays         = records.length > 0 ? Math.min(...records.map((r) => r.daysOfSupply)) : 0;
  const status          = getStatus(minDays);

  return (
    <div
      className="h-full overflow-y-auto"
      style={{ background: "#fafaf9", scrollbarWidth: "thin", scrollbarColor: "#d4d4d4 transparent" }}
    >
      <div className="p-5" style={{ maxWidth: 900 }}>

        {/* Header */}
        <div className="mb-4">
          <h2 className="text-base font-bold mb-1" style={{ color: "#1a1a1a" }}>库存管理</h2>
          <p className="text-xs" style={{ color: "#a3a3a3" }}>
            {product.emoji} {product.shortName} · {product.asin} · 可售天数 &lt;30天时预警
          </p>
        </div>

        {/* 启动分析 Card */}
        <AnalysisGuideCard
          productName={product.name}
          hasData={records.length > 0}
          onAnalyze={handleAnalyze}
        />

        {/* Empty state */}
        {records.length === 0 && (
          <div
            className="flex flex-col items-center gap-3 rounded-xl p-8"
            style={{ border: "1.5px dashed #d4d4d4", background: "#ffffff" }}
          >
            <UploadCloud size={36} style={{ color: "#d4d4d4" }} />
            <div className="text-center">
              <p className="text-sm font-semibold mb-1" style={{ color: "#1a1a1a" }}>暂无库存数据</p>
              <p className="text-xs leading-relaxed" style={{ color: "#a3a3a3" }}>
                上传「系统-Nordhive-多站点-库存报表」后自动解析<br />
                可售天数、在途库存、库龄分布等 60 个字段
              </p>
            </div>
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
              style={{ background: "#f5f4f2", color: "#737373", border: "1px solid #e8e5e0" }}
            >
              <Package size={12} />
              文件前缀：系统-Nordhive-多站点-库存报表
            </div>
          </div>
        )}

        {/* Data view */}
        {records.length > 0 && (
          <>
            <div
              className="rounded-xl mb-4"
              style={{ background: "#ffffff", border: `1.5px solid ${minDays < 30 ? "#fca5a5" : "#e8e5e0"}` }}
            >
              <div className="flex items-center gap-4 px-5 py-4">
                <span className="text-2xl flex-shrink-0">{status.dot}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>{product.shortName}</span>
                    <span className="font-mono text-[10px]" style={{ color: "#a3a3a3" }}>{product.asin}</span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                      style={{ background: status.color + "15", color: status.color }}
                    >
                      {status.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-[11px]" style={{ color: "#737373" }}>
                    <span>日均销量 {totalDailySales.toFixed(1)} 件</span>
                    <span>可售库存 {totalAvail.toLocaleString()} 件</span>
                    <span>在途 {totalInbound.toLocaleString()} 件</span>
                    <span>建议补货 {totalRestock.toLocaleString()} 件</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 mr-3">
                  <div className="text-3xl font-bold" style={{ color: status.color }}>{minDays}</div>
                  <div className="text-[10px]" style={{ color: "#a3a3a3" }}>可售天数</div>
                </div>
                {minDays < 30 && (
                  <button
                    onClick={handleUrgentChat}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold flex-shrink-0 transition-all hover:opacity-90"
                    style={{ background: "#dc2626", color: "#ffffff" }}
                  >
                    <Sparkles size={11} />
                    紧急处理
                  </button>
                )}
              </div>

              {records.length > 1 && (
                <div className="px-5 pb-4" style={{ borderTop: "1px solid #f5f4f2" }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide mb-2 mt-3" style={{ color: "#a3a3a3" }}>
                    SKU 明细
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {records.map((rec, i) => {
                      const s = getStatus(rec.daysOfSupply);
                      return (
                        <div key={i} className="flex items-center gap-3 text-[11px]">
                          <span>{s.dot}</span>
                          <span className="font-mono flex-shrink-0" style={{ color: "#737373" }}>{rec.sku}</span>
                          <span style={{ color: "#a3a3a3" }}>{rec.marketplace}</span>
                          <span style={{ color: s.color, fontWeight: 600 }}>{rec.daysOfSupply}天</span>
                          <span style={{ color: "#a3a3a3" }}>
                            可售{rec.availableQty} · 在途{rec.inboundQty} · 日均{rec.dailySales.toFixed(1)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div
              className="px-4 py-3 rounded-xl text-xs flex items-start gap-2"
              style={{ background: "#f5f4f2", color: "#737373" }}
            >
              <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" style={{ color: "#d97706" }} />
              <span>
                <strong style={{ color: "#1a1a1a" }}>补货公式：</strong>
                日均销量 × (航运天数 + 安全库存天数) · 安全库存 30天，旺季翻倍
              </span>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
