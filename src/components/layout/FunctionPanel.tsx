"use client";

import { useState } from "react";
import { useAppStore, type FuncTab } from "@/store/appStore";

const FUNC_TABS: { id: FuncTab; label: string; icon: string }[] = [
  { id: "kpi",       label: "KPI 汇总", icon: "📈" },
  { id: "alerts",    label: "每日告警", icon: "🚨" },
  { id: "ads",       label: "广告优化", icon: "🎯" },
  { id: "inventory", label: "库存看板", icon: "📦" },
];

export default function FunctionPanel() {
  const { activeFuncTab, setActiveFuncTab } = useAppStore();

  return (
    <div style={{
      width: 150, background: "#ffffff", borderRight: "1px solid #ecedf1",
      display: "flex", flexDirection: "column", flexShrink: 0,
    }}>
      <div style={{ padding: "16px 12px 8px" }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: "#969bb0",
          letterSpacing: "0.03em", padding: "0 8px",
        }}>功能模块</div>
      </div>

      <div style={{ padding: "0 8px", flex: 1 }}>
        {FUNC_TABS.map((tab) => {
          const active = activeFuncTab === tab.id;
          return (
            <FuncTabItem
              key={tab.id}
              icon={tab.icon}
              label={tab.label}
              active={active}
              onClick={() => setActiveFuncTab(tab.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

function FuncTabItem({
  icon, label, active, onClick,
}: {
  icon:    string;
  label:   string;
  active:  boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "9px 10px", borderRadius: 7, marginBottom: 1, cursor: "pointer",
        background: active ? "rgba(59,91,219,0.07)" : hover ? "#f5f6f8" : "transparent",
        color:      active ? "#3b5bdb" : "#5c6070",
        fontSize: 12, fontWeight: active ? 600 : 400,
        transition: "background 0.12s, color 0.12s",
      }}
    >
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}
