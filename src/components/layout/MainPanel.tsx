"use client";

import { useState, useRef, useEffect } from "react";
import { useAppStore, AVAILABLE_MODELS, getCategoryKey, type FuncTab } from "@/store/appStore";
import ChatPanel      from "@/components/panels/ChatPanel";
import OverviewPanel  from "@/components/panels/OverviewPanel";
import KPIPanel       from "@/components/panels/KPIPanel";
import AlertsPanel    from "@/components/panels/AlertsPanel";
import AdsPanel       from "@/components/panels/AdsPanel";
import InventoryPanel from "@/components/panels/InventoryPanel";

const FUNC_LABELS: Record<FuncTab, string> = {
  kpi:       "KPI 汇总",
  alerts:    "每日告警",
  ads:       "广告优化",
  inventory: "库存看板",
};

const CATEGORY_LABELS: Record<string, string> = {
  mattress: "沙发床垫",
  pump:     "充气泵",
  scooter:  "电动滑板车",
};

function ModelSelector() {
  const { selectedModel, setSelectedModel } = useAppStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = AVAILABLE_MODELS.find((m) => m.id === selectedModel) ?? AVAILABLE_MODELS[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 6, padding: "5px 12px",
          borderRadius: 6, border: "1px solid #e8e9ee", cursor: "pointer",
          fontSize: 11, color: "#5c6070", background: "#f5f6f8",
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#0ca678", flexShrink: 0 }} />
        {current.label}
        <span style={{ fontSize: 9, opacity: 0.5 }}>▼</span>
      </div>

      {open && (
        <div style={{
          position: "absolute", top: "100%", right: 0, marginTop: 4,
          background: "#fff", border: "1px solid #e8e9ee", borderRadius: 8,
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)", overflow: "hidden", zIndex: 100, minWidth: 200,
        }}>
          {AVAILABLE_MODELS.map((model) => {
            const isSelected = model.id === selectedModel;
            return (
              <div
                key={model.id}
                onClick={() => { setSelectedModel(model.id); setOpen(false); }}
                style={{
                  padding: "8px 14px", fontSize: 12, cursor: "pointer",
                  color:      isSelected ? "#3b5bdb" : "#1a1d28",
                  background: isSelected ? "rgba(59,91,219,0.07)" : "transparent",
                  fontWeight: isSelected ? 600 : 400,
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "#f5f6f8"; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
              >{model.label}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function MainPanel() {
  const { activeNav, activeFuncTab } = useAppStore();
  const categoryKey = getCategoryKey(activeNav);
  const isCategory  = categoryKey !== null;

  // Breadcrumb label
  let breadcrumb = "";
  if (activeNav === "overview") breadcrumb = "账号总览";
  else if (activeNav === "chat") breadcrumb = "Chat";
  else {
    const catLabel  = CATEGORY_LABELS[activeNav] ?? activeNav;
    const funcLabel = FUNC_LABELS[activeFuncTab];
    breadcrumb = `${catLabel} › ${funcLabel}`;
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Top bar */}
      <div style={{
        height: 48, background: "#ffffff", borderBottom: "1px solid #ecedf1",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px", flexShrink: 0,
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1d28" }}>{breadcrumb}</div>
        <ModelSelector />
      </div>

      {/* Panel content */}
      <div style={{ flex: 1, overflow: "auto", background: "#fff" }}>
        {activeNav === "overview" && <OverviewPanel key="overview" />}
        {activeNav === "chat"     && <ChatPanel     key="chat" />}
        {isCategory && activeFuncTab === "kpi"       && <KPIPanel       key={categoryKey} />}
        {isCategory && activeFuncTab === "alerts"    && <AlertsPanel    key={categoryKey} />}
        {isCategory && activeFuncTab === "ads"       && <AdsPanel       key={categoryKey} />}
        {isCategory && activeFuncTab === "inventory" && <InventoryPanel key={categoryKey} />}
      </div>
    </div>
  );
}
