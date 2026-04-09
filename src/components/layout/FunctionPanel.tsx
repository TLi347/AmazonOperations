"use client";

import { useState, useRef } from "react";
import {
  MessageSquare,
  LayoutDashboard,
  Megaphone,
  Package,
  Globe,
  ChevronDown,
  ChevronRight,
  File,
  Upload,
  Loader2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useAppStore, type PanelId, type DataFile } from "@/store/appStore";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { FILE_GROUPS } from "@/lib/mockData";
import { mergeAsinUpload, inventoryRowsToRecords } from "@/lib/clientMetricsHelper";
import { runAlertRules } from "@/lib/alertEngine";

const STAGE_STYLES: Record<string, { bg: string; text: string }> = {
  新品期: { bg: "#dbeafe", text: "#2563eb" },
  成长期: { bg: "#fef3c7", text: "#d97706" },
  成熟期: { bg: "#dcfce7", text: "#16a34a" },
  衰退期: { bg: "#fee2e2", text: "#dc2626" },
};

const NAV_ITEMS: { id: PanelId; label: string; Icon: React.ElementType }[] = [
  { id: "chat", label: "Chat", Icon: MessageSquare },
  { id: "dashboard", label: "运营看板", Icon: LayoutDashboard },
  { id: "ads", label: "广告监控", Icon: Megaphone },
  { id: "inventory", label: "库存管理", Icon: Package },
  { id: "competitors", label: "竞品监控", Icon: Globe },
];

export default function FunctionPanel() {
  const {
    activePanel,
    setActivePanel,
    getSelectedProduct,
    getFilesForProduct,
    getAlertsForProduct,
    setFilesForProduct,
    setMetricsForProduct,
    setInventoryForProduct,
    metricsByProduct,
    adDataByProduct,
    setAdDataForProduct,
    addAlerts,
  } = useAppStore();

  const [filesOpen, setFilesOpen]   = useState(true);
  const [uploading, setUploading]   = useState(false);
  const [uploadMsg, setUploadMsg]   = useState<{ ok: boolean; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const product = getSelectedProduct();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !product) return;
    // Reset input so the same file can be re-uploaded
    e.target.value = "";

    setUploading(true);
    setUploadMsg(null);

    try {
      const fd = new FormData();
      fd.append("productId", product.id);
      fd.append("file", file);

      const res  = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json() as {
        fileType: string;
        timeWindow?: string;
        parsed?: Record<string, unknown>[];
        fileRecord?: DataFile | null;
        rowCount?: number;
        error?: string;
        message?: string;
      };

      if (!res.ok || data.error) throw new Error(data.error ?? "上传失败");

      // ── 更新文件列表 ─────────────────────────────────────
      const currentFiles = getFilesForProduct(product.id);
      const fileRecord: DataFile = data.fileRecord ?? {
        id:          `local-${Date.now()}`,
        productId:   product.id,
        fileName:    file.name,
        fileType:    data.fileType,
        timeWindow:  data.timeWindow ?? "custom",
        fileSize:    file.size,
        storagePath: "",
        uploadedAt:  new Date().toISOString(),
      };
      // Replace existing record with same filename, or prepend
      const withoutDupe = currentFiles.filter((f) => f.fileName !== file.name);
      setFilesForProduct(product.id, [fileRecord, ...withoutDupe]);

      // ── 更新 Metrics（ASIN 报表）────────────────────────
      if (data.fileType === "nordhive_asin_report" && Array.isArray(data.parsed)) {
        const existing = metricsByProduct[product.id];
        const merged   = mergeAsinUpload(data.parsed, product.asin, existing);
        setMetricsForProduct(product.id, merged);
      }

      // ── 更新 Inventory（库存报表）────────────────────────
      if (data.fileType === "nordhive_inventory" && Array.isArray(data.parsed)) {
        setInventoryForProduct(product.id, inventoryRowsToRecords(data.parsed));
      }

      // ── 更新广告数据 + 触发告警引擎（Phase 5）───────────
      if (
        (data.fileType === "nordhive_ad_campaign" ||
          data.fileType === "nordhive_search_term") &&
        Array.isArray(data.parsed)
      ) {
        const existing = adDataByProduct[product.id] ?? { campaigns: [], searchTerms: [] };
        const newAdData =
          data.fileType === "nordhive_ad_campaign"
            ? { ...existing, campaigns: data.parsed }
            : { ...existing, searchTerms: data.parsed };
        setAdDataForProduct(product.id, newAdData);
        const newAlerts = runAlertRules(product.id, newAdData, product.stage);
        addAlerts(product.id, newAlerts);
      }

      const label = data.message ?? `${data.fileType} · ${data.rowCount ?? 0} 行`;
      setUploadMsg({ ok: true, text: label });
    } catch (err) {
      setUploadMsg({ ok: false, text: err instanceof Error ? err.message : "上传失败" });
    } finally {
      setUploading(false);
      // Auto-clear feedback after 4 s
      setTimeout(() => setUploadMsg(null), 4000);
    }
  };

  if (!product) {
    return (
      <div
        className="border-r flex items-center justify-center flex-shrink-0"
        style={{ width: 200, background: "#f5f4f2", borderColor: "#e8e5e0" }}
      >
        <span style={{ color: "#a3a3a3", fontSize: 12 }}>选择产品</span>
      </div>
    );
  }

  const files = getFilesForProduct(product.id);
  const alertCount = getAlertsForProduct(product.id).length;
  const stageStyle = STAGE_STYLES[product.stage] ?? { bg: "#e5e7eb", text: "#374151" };

  const groupedFiles = FILE_GROUPS.map((group) => ({
    ...group,
    files: files.filter((f) => group.types.includes(f.fileType)),
  })).filter((g) => g.files.length > 0);

  const ungroupedFiles = files.filter(
    (f) => !FILE_GROUPS.some((g) => g.types.includes(f.fileType))
  );

  return (
    <div
      className="flex flex-col border-r overflow-hidden flex-shrink-0"
      style={{ width: 200, background: "#f5f4f2", borderColor: "#e8e5e0" }}
    >
      {/* Product Context Header */}
      <div className="p-3 border-b" style={{ borderColor: "#e8e5e0" }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl flex-shrink-0">{product.emoji}</span>
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate" style={{ color: "#1a1a1a" }}>
              {product.shortName}
            </div>
            <div className="font-mono text-[10px]" style={{ color: "#a3a3a3" }}>
              {product.asin}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded"
            style={{ background: stageStyle.bg, color: stageStyle.text }}
          >
            {product.stage}
          </span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded"
            style={{ background: "#f3f4f6", color: "#6b7280" }}
          >
            ⭐ {product.rating} · {product.reviewCount.toLocaleString()}
          </span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded"
            style={{ background: "#f3f4f6", color: "#6b7280" }}
          >
            BSR #{product.bsr.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Files Toggle */}
      <div className="border-b" style={{ borderColor: "#e8e5e0" }}>
        <button
          className="flex items-center justify-between w-full px-3 py-2 hover:bg-[#eae8e4] transition-colors"
          onClick={() => setFilesOpen((v) => !v)}
        >
          <span className="text-xs font-semibold" style={{ color: "#737373" }}>
            当前文件
          </span>
          <div className="flex items-center gap-1">
            {files.length > 0 && (
              <Badge variant="default" className="text-[9px] px-1.5 py-0 h-4 min-w-[16px]">
                {files.length}
              </Badge>
            )}
            {filesOpen ? (
              <ChevronDown size={12} color="#a3a3a3" />
            ) : (
              <ChevronRight size={12} color="#a3a3a3" />
            )}
          </div>
        </button>

        {filesOpen && (
          <ScrollArea maxHeight={140}>
            {files.length === 0 ? (
              <div className="px-3 py-2 text-[11px]" style={{ color: "#a3a3a3" }}>
                暂无文件，请上传
              </div>
            ) : (
              <>
                {groupedFiles.map((group) => (
                  <div key={group.label}>
                    <div
                      className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide"
                      style={{ color: "#a3a3a3" }}
                    >
                      {group.label}
                    </div>
                    {group.files.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-[#eae8e4] cursor-pointer"
                        title={file.fileName}
                      >
                        <File size={11} color="#a3a3a3" className="flex-shrink-0" />
                        <span className="text-[11px] truncate flex-1" style={{ color: "#737373" }}>
                          {file.fileName}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
                {ungroupedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-[#eae8e4] cursor-pointer"
                    title={file.fileName}
                  >
                    <File size={11} color="#a3a3a3" className="flex-shrink-0" />
                    <span className="text-[11px] truncate flex-1" style={{ color: "#737373" }}>
                      {file.fileName}
                    </span>
                  </div>
                ))}
              </>
            )}
          </ScrollArea>
        )}
        {/* Upload button */}
        <div className="px-3 py-2 border-t" style={{ borderColor: "#e8e5e0" }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded text-[11px] font-medium transition-colors hover:bg-[#e2dfda] disabled:opacity-50"
            style={{ color: "#737373", background: "#eae8e4" }}
          >
            {uploading ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Upload size={11} />
            )}
            {uploading ? "解析中…" : "上传文件"}
          </button>

          {uploadMsg && (
            <div
              className="flex items-start gap-1 mt-1.5 text-[10px] leading-snug"
              style={{ color: uploadMsg.ok ? "#16a34a" : "#dc2626" }}
            >
              {uploadMsg.ok ? (
                <CheckCircle size={10} className="mt-0.5 flex-shrink-0" />
              ) : (
                <XCircle size={10} className="mt-0.5 flex-shrink-0" />
              )}
              <span className="break-all">{uploadMsg.text}</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5 p-2 flex-1">
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const isActive = activePanel === id;
          return (
            <button
              key={id}
              onClick={() => setActivePanel(id)}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all duration-150",
                isActive ? "bg-[#e2dfda] font-semibold" : "hover:bg-[#eae8e4]"
              )}
              style={{ color: isActive ? "#1a1a1a" : "#737373" }}
            >
              <Icon size={15} />
              <span className="flex-1 text-left">{label}</span>
              {id === "chat" && alertCount > 0 && (
                <Badge variant="danger" className="text-[9px] px-1.5 py-0 h-4 min-w-[16px]">
                  {alertCount}
                </Badge>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom: Price + BSR */}
      <div
        className="px-3 py-2.5 border-t text-xs"
        style={{ borderColor: "#e8e5e0", color: "#a3a3a3" }}
      >
        <span className="font-mono font-medium" style={{ color: "#737373" }}>
          ${product.price}
        </span>
        {" · "}
        <span>BSR #{product.bsr.toLocaleString()}</span>
      </div>
    </div>
  );
}
