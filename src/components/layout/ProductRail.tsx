"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/appStore";

interface CategoryInfo {
  categoryKey: string;
  displayName: string;
  redAlerts:   number;
}

const CATEGORY_EMOJI: Record<string, string> = {
  mattress: "🛏",
  pump:     "🔧",
  scooter:  "🛴",
};

const C = {
  sidebar:           "#ffffff",
  sidebarHover:      "#f0f1f5",
  sidebarActive:     "rgba(59,91,219,0.07)",
  sidebarText:       "#5c6070",
  sidebarTextActive: "#3b5bdb",
  text:              "#1a1d28",
  textDim:           "#969bb0",
  border:            "#e8e9ee",
  accent:            "#3b5bdb",
};

export default function ProductRail() {
  const { activeNav, setActiveNav, setActiveFuncTab } = useAppStore();
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [latestDate, setLatestDate]  = useState<string>("");

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCategories(data as CategoryInfo[]);
      })
      .catch(() => {});

    // Get latest data date from overview
    fetch("/api/features/overview")
      .then((r) => r.json())
      .then((d) => {
        if (d.period && typeof d.period === "string") {
          // Extract end date from "近7天 (截至 2026-04-11)"
          const m = /截至\s*([\d-]+)/.exec(d.period);
          if (m) setLatestDate(m[1]);
        }
      })
      .catch(() => {});
  }, []);

  function navTo(id: string) {
    setActiveNav(id);
    if (id !== "overview" && id !== "chat") setActiveFuncTab("kpi");
  }

  const pages = [
    { id: "overview", label: "账号总览", icon: "📊" },
    { id: "chat",     label: "Chat",     icon: "💬" },
  ];

  return (
    <div style={{
      width: 180, background: C.sidebar, display: "flex", flexDirection: "column",
      flexShrink: 0, borderRight: `1px solid #ecedf1`, height: "100vh",
    }}>
      {/* Logo */}
      <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid #ecedf1" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: "linear-gradient(135deg, #3b5bdb, #7c3aed)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700, color: "#fff",
          }}>N</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.1 }}>YZ-Ops</div>
            <div style={{ fontSize: 9, color: C.textDim, letterSpacing: "0.08em" }}>AI · Nordhive</div>
          </div>
        </div>
      </div>

      {/* Pages */}
      <div style={{ padding: "10px 8px 0" }}>
        {pages.map((item) => {
          const active = activeNav === item.id;
          return (
            <NavItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={active}
              onClick={() => navTo(item.id)}
            />
          );
        })}
      </div>

      {/* Categories */}
      <div style={{ padding: "8px 8px" }}>
        <div style={{
          fontSize: 9, fontWeight: 600, color: C.textDim,
          letterSpacing: "0.08em", padding: "4px 12px",
          textTransform: "uppercase",
        }}>品类</div>

        {categories.map((cat) => {
          const active = activeNav === cat.categoryKey;
          return (
            <NavItem
              key={cat.categoryKey}
              icon={CATEGORY_EMOJI[cat.categoryKey] ?? "📦"}
              label={cat.displayName}
              active={active}
              badge={cat.redAlerts > 0 ? cat.redAlerts : undefined}
              onClick={() => navTo(cat.categoryKey)}
            />
          );
        })}
      </div>

      <div style={{ flex: 1 }} />

      {/* Bottom: data date */}
      <div style={{
        padding: "12px 16px", borderTop: "1px solid #ecedf1",
        fontSize: 10, color: C.textDim,
      }}>
        {latestDate ? `数据截至 ${latestDate}` : "暂无数据"}
      </div>
    </div>
  );
}

function NavItem({
  icon, label, active, badge, onClick,
}: {
  icon:    string;
  label:   string;
  active:  boolean;
  badge?:  number;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "9px 12px", borderRadius: 8, marginBottom: 2, cursor: "pointer",
        background: active ? "rgba(59,91,219,0.07)" : hover ? "#f0f1f5" : "transparent",
        color:      active ? "#3b5bdb" : "#5c6070",
        fontSize: 13, fontWeight: active ? 600 : 400,
        transition: "background 0.12s, color 0.12s",
        position: "relative",
      }}
    >
      <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge != null && (
        <span style={{
          fontSize: 9, fontWeight: 700,
          color: "#d63031", background: "rgba(214,48,49,0.12)",
          padding: "1px 5px", borderRadius: 8,
        }}>{badge}红</span>
      )}
    </div>
  );
}
