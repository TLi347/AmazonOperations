"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Loader2, Plus, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

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

const FRESHNESS_LABEL: Record<string, string> = {
  fresh: "新鲜",
  ok:    "正常",
  stale: "过期",
};

export default function ContextPanel() {
  const [isOpen, setIsOpen]       = useState(true);
  const [files, setFiles]         = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(() => {
    fetch("/api/files")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setFiles(data as UploadedFile[]); })
      .catch(() => {});
  }, []);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const handleUploadFile = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res  = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json() as { fileType?: string; rowCount?: number; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "上传失败");
      const label = `${FILE_TYPE_LABELS[data.fileType ?? ""] ?? data.fileType} · ${data.rowCount ?? 0} 行`;
      toast.success("文件上传成功", { description: label });
      loadFiles();
    } catch (err) {
      toast.error("上传失败", { description: err instanceof Error ? err.message : "上传失败" });
    } finally {
      setUploading(false);
    }
  }, [loadFiles]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    handleUploadFile(file);
  };

  /* ── Collapsed ── */
  if (!isOpen) {
    return (
      <div
        className="w-7 shrink-0 cursor-pointer border-l border-border bg-background flex flex-col items-center"
        onClick={() => setIsOpen(true)}
      >
        <div className="pt-3.5 pb-2 text-muted-foreground text-xs">&#8249;</div>
        <div className="[writing-mode:vertical-rl] rotate-180 text-[9px] font-semibold text-muted-foreground tracking-widest uppercase mt-1">
          Context
        </div>
      </div>
    );
  }

  /* ── Expanded ── */
  return (
    <div
      className="w-64 shrink-0 border-l border-border bg-muted flex flex-col relative"
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
      onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
      onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.name.endsWith('.xlsx')) {
          handleUploadFile(file);
        } else {
          toast.error("仅支持 .xlsx 文件");
        }
      }}
    >
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary/5 border-2 border-dashed border-primary rounded-lg">
          <div className="text-center">
            <Upload size={32} className="mx-auto mb-2 text-primary" />
            <p className="text-sm font-medium text-primary">拖拽 XLSX 文件到此处</p>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="px-3.5 pt-3.5 pb-2.5 border-b border-border flex justify-between items-center">
        <div>
          <div className="text-[13px] font-bold text-foreground">Context</div>
          <div className="text-[10px] text-muted-foreground font-mono mt-px">
            ./context/ · {files.length} 个文件
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setIsOpen(false)}
          className="text-muted-foreground"
        >
          &#8250;
        </Button>
      </div>

      {/* File cards 2-column grid */}
      <ScrollArea className="flex-1">
        <div className="grid grid-cols-2 gap-2 p-2.5 content-start">
          {files.length === 0 && (
            <div className="col-span-full text-center py-5">
              <div className="text-[11px] text-muted-foreground">暂无已上传文件</div>
            </div>
          )}
          {files.map((f) => (
            <Card
              key={f.id}
              size="sm"
              className="cursor-default p-2.5 pb-2 gap-1 rounded-[10px] transition-shadow hover:shadow-md"
            >
              <CardContent className="p-0">
                {/* File type name */}
                <div className="text-[11px] font-semibold text-foreground leading-tight mb-1 break-all pr-1">
                  {FILE_TYPE_LABELS[f.fileType] ?? f.fileType}
                </div>

                {/* Date + freshness badge */}
                <div className="flex items-center gap-1 mb-1.5 flex-wrap">
                  <span className="text-[9px] text-muted-foreground">{f.snapshotDate}</span>
                  {f.freshness === "fresh" && (
                    <Badge className="bg-emerald-100 text-emerald-800 text-[9px] h-4 px-1.5">
                      {FRESHNESS_LABEL.fresh}
                    </Badge>
                  )}
                  {f.freshness === "ok" && (
                    <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                      {FRESHNESS_LABEL.ok}
                    </Badge>
                  )}
                  {f.freshness === "stale" && (
                    <Badge variant="destructive" className="text-[9px] h-4 px-1.5">
                      {FRESHNESS_LABEL.stale}
                    </Badge>
                  )}
                </div>

                {/* XLSX badge */}
                <Badge variant="outline" className="text-[9px] font-semibold h-4 px-1.5">
                  XLSX
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      {/* Add file button */}
      <div className="px-2.5 pt-2.5 pb-3 border-t border-border">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={handleUpload}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="w-full border-dashed gap-1 text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-60"
        >
          {uploading
            ? <><Loader2 className="size-3 animate-spin" /> 解析中...</>
            : <><Plus className="size-4" /> 添加文件</>
          }
        </Button>
      </div>
    </div>
  );
}
