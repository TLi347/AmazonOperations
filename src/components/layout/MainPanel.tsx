"use client";

import { useAppStore, type PanelId, AVAILABLE_MODELS } from "@/store/appStore";
import { MessageSquare, ChevronDown } from "lucide-react";
import ChatPanel from "@/components/panels/ChatPanel";
import DashboardPanel from "@/components/panels/DashboardPanel";
import AdsPanel from "@/components/panels/AdsPanel";
import InventoryPanel from "@/components/panels/InventoryPanel";
import CompetitorsPanel from "@/components/panels/CompetitorsPanel";
import { useState, useRef, useEffect } from "react";

const PANEL_LABELS: Record<PanelId, string> = {
  chat: "Chat",
  dashboard: "运营看板",
  ads: "广告监控",
  inventory: "库存管理",
  competitors: "竞品监控",
};

function ModelSelector() {
  const { selectedModel, setSelectedModel } = useAppStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = AVAILABLE_MODELS.find((m) => m.id === selectedModel) ?? AVAILABLE_MODELS[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors hover:bg-[#eae8e4]"
        style={{ color: "#737373", border: "1px solid #e8e5e0", background: open ? "#eae8e4" : "transparent" }}
      >
        <span style={{ color: "#1a1a1a" }}>{current.label}</span>
        <span style={{ color: "#a3a3a3" }}>{current.desc}</span>
        <ChevronDown size={11} style={{ color: "#a3a3a3", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden z-50"
          style={{
            background: "#ffffff",
            border: "1px solid #e8e5e0",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            minWidth: 180,
          }}
        >
          {AVAILABLE_MODELS.map((model) => {
            const isSelected = model.id === selectedModel;
            return (
              <button
                key={model.id}
                onClick={() => {
                  setSelectedModel(model.id);
                  setOpen(false);
                }}
                className="flex items-center justify-between w-full px-3 py-2.5 text-left transition-colors hover:bg-[#f5f4f2]"
                style={{ background: isSelected ? "#f5f4f2" : "transparent" }}
              >
                <div>
                  <p className="text-xs font-medium" style={{ color: "#1a1a1a" }}>
                    {model.label}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: "#a3a3a3" }}>
                    {model.id}
                  </p>
                </div>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full ml-3 flex-shrink-0"
                  style={{
                    background: isSelected ? "#1a1a1a" : "#f0eeec",
                    color: isSelected ? "#ffffff" : "#737373",
                  }}
                >
                  {model.desc}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function MainPanel() {
  const { activePanel, setActivePanel, getSelectedProduct, selectedProductId } = useAppStore();
  const product = getSelectedProduct();

  return (
    <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
      {/* Top Bar */}
      <div
        className="flex items-center justify-between px-5 flex-shrink-0 border-b"
        style={{
          height: 48,
          background: "#fafaf9",
          borderColor: "#e8e5e0",
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-sm" style={{ color: "#1a1a1a" }}>
            {PANEL_LABELS[activePanel]}
          </span>
          {product && (
            <>
              <span style={{ color: "#d4d4d4" }}>·</span>
              <span className="text-sm truncate" style={{ color: "#737373" }}>
                {product.emoji} {product.shortName}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Model selector — only on Chat panel */}
          {activePanel === "chat" && <ModelSelector />}

          {/* Chat button — only on non-chat panels */}
          {activePanel !== "chat" && (
            <button
              onClick={() => setActivePanel("chat")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors hover:bg-[#eae8e4]"
              style={{ color: "#737373", border: "1px solid #e8e5e0" }}
            >
              <MessageSquare size={12} />
              Chat
            </button>
          )}
        </div>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-hidden">
        {activePanel === "chat"        && <ChatPanel        key={selectedProductId ?? 'none'} />}
        {activePanel === "dashboard"   && <DashboardPanel   key={selectedProductId ?? 'none'} />}
        {activePanel === "ads"         && <AdsPanel         key={selectedProductId ?? 'none'} />}
        {activePanel === "inventory"   && <InventoryPanel   key={selectedProductId ?? 'none'} />}
        {activePanel === "competitors" && <CompetitorsPanel key={selectedProductId ?? 'none'} />}
      </div>
    </div>
  );
}
