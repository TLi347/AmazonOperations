"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";

interface UploadedFile {
  id:           string;
  fileType:     string;
  fileName:     string;
  uploadDate:   string;
  snapshotDate: string;
  freshness:    "fresh" | "ok" | "stale";
}

const FILE_TYPE_LABELS: Record<string, string> = {
  product:          "产品报表",
  campaign_3m:      "广告活动重构",
  search_terms:     "搜索词重构",
  us_campaign_30d:  "US广告活动",
  placement_us_30d: "广告位报表",
  inventory:        "库存报表",
  cost_mgmt:        "成本管理",
  aba_search:       "ABA搜索词",
  keyword_monitor:  "关键词监控",
};

const FRESHNESS_STYLE = {
  fresh: { color: "#0ca678",  label: "新鲜" },
  ok:    { color: "#969bb0",  label: "正常" },
  stale: { color: "#d63031",  label: "过期" },
};

export default function ContextPanel() {
  const [isOpen, setIsOpen]       = useState(true);
  const [files, setFiles]         = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(() => {
    fetch("/api/files")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setFiles(data as UploadedFile[]); })
      .catch(() => {});
  }, []);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    setUploadMsg(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res  = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json() as { fileType?: string; rowCount?: number; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "上传失败");
      const label = `${FILE_TYPE_LABELS[data.fileType ?? ""] ?? data.fileType} · ${data.rowCount ?? 0} 行`;
      setUploadMsg({ ok: true, text: label });
      loadFiles();
    } catch (err) {
      setUploadMsg({ ok: false, text: err instanceof Error ? err.message : "上传失败" });
    } finally {
      setUploading(false);
      setTimeout(() => setUploadMsg(null), 5000);
    }
  };

  /* ── Collapsed ── */
  if (!isOpen) {
    return (
      <div
        style={{
          width: 28, background: "#ffffff", borderLeft: "1px solid #ecedf1",
          display: "flex", flexDirection: "column", alignItems: "center",
          flexShrink: 0, cursor: "pointer",
        }}
        onClick={() => setIsOpen(true)}
      >
        <div style={{ padding: "14px 0 8px", color: "#969bb0", fontSize: 12 }}>‹</div>
        <div style={{
          writingMode: "vertical-rl", transform: "rotate(180deg)",
          fontSize: 9, fontWeight: 600, color: "#969bb0",
          letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 4,
        }}>Context</div>
      </div>
    );
  }

  /* ── Expanded ── */
  return (
    <div style={{
      width: 256, background: "#f9f9fb", borderLeft: "1px solid #ecedf1",
      display: "flex", flexDirection: "column", flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 14px 10px", borderBottom: "1px solid #ecedf1",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1d28" }}>Context</div>
          <div style={{ fontSize: 10, color: "#969bb0", fontFamily: "monospace", marginTop: 1 }}>
            ./context/ · {files.length} 个文件
          </div>
        </div>
        <div
          onClick={() => setIsOpen(false)}
          style={{ cursor: "pointer", color: "#969bb0", fontSize: 13, padding: "4px 6px" }}
        >›</div>
      </div>

      {/* File cards 2-column grid */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "12px 10px",
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignContent: "start",
      }}>
        {files.length === 0 && (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 11, color: "#969bb0" }}>暂无已上传文件</div>
          </div>
        )}
        {files.map((f, i) => {
          const fs_ = FRESHNESS_STYLE[f.freshness] ?? FRESHNESS_STYLE.ok;
          const isHovered = hoveredIdx === i;
          return (
            <div
              key={f.id}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                background: "#fff",
                border: `1px solid ${isHovered ? "#e8e9ee" : "#e4e5ea"}`,
                borderRadius: 10, padding: "10px 10px 8px",
                position: "relative", cursor: "default",
                boxShadow: isHovered ? "0 1px 6px rgba(0,0,0,0.06)" : "none",
                transition: "box-shadow 0.12s",
              }}
            >
              {/* File type name */}
              <div style={{
                fontSize: 11, fontWeight: 600, color: "#1a1d28",
                lineHeight: 1.35, marginBottom: 4,
                wordBreak: "break-all", paddingRight: 4,
              }}>
                {FILE_TYPE_LABELS[f.fileType] ?? f.fileType}
              </div>

              {/* Date + freshness */}
              <div style={{ fontSize: 9, color: fs_.color, marginBottom: 7 }}>
                {f.snapshotDate} · {fs_.label}
              </div>

              {/* XLSX badge */}
              <div style={{
                display: "inline-flex", alignItems: "center",
                fontSize: 9, fontWeight: 600,
                background: "#f0f1f5", color: "#5c6070",
                borderRadius: 4, padding: "2px 6px",
                border: "1px solid #e8e9ee",
              }}>XLSX</div>
            </div>
          );
        })}
      </div>

      {/* Upload message */}
      {uploadMsg && (
        <div style={{
          margin: "0 10px 4px",
          padding: "6px 10px", borderRadius: 6,
          background: uploadMsg.ok ? "rgba(12,166,120,0.08)" : "rgba(214,48,49,0.08)",
          fontSize: 10, color: uploadMsg.ok ? "#0ca678" : "#d63031",
        }}>
          {uploadMsg.ok ? "✓" : "✗"} {uploadMsg.text}
        </div>
      )}

      {/* Add file button */}
      <div style={{ padding: "10px 10px 12px", borderTop: "1px solid #ecedf1" }}>
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
          style={{
            width: "100%", padding: "8px 0", borderRadius: 8,
            border: "1.5px dashed #e8e9ee", background: "transparent",
            fontSize: 11, color: "#969bb0", cursor: uploading ? "default" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            transition: "all 0.12s", opacity: uploading ? 0.6 : 1,
          }}
          onMouseEnter={(e) => { if (!uploading) { e.currentTarget.style.borderColor = "#3b5bdb"; e.currentTarget.style.color = "#3b5bdb"; } }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e8e9ee"; e.currentTarget.style.color = "#969bb0"; }}
        >
          {uploading
            ? <><Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> 解析中…</>
            : <><span style={{ fontSize: 16, lineHeight: 1 }}>+</span> 添加文件</>
          }
        </button>
      </div>
    </div>
  );
}
