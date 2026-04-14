"use client";

import { useMemo, type ReactNode } from "react";
import useSWR from "swr";
import { fetcher, swrOptions } from "@/lib/swr";
import { useAppStore } from "@/store/appStore";
import { LayoutDashboard, MessageSquare, Bed, Wrench, Bike, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CategoryInfo {
  categoryKey: string;
  displayName: string;
  redAlerts:   number;
}

const CATEGORY_ICONS: Record<string, ReactNode> = {
  mattress: <Bed size={16} />,
  pump:     <Wrench size={16} />,
  scooter:  <Bike size={16} />,
};

export default function ProductRail() {
  const { activeNav, setActiveNav, setActiveFuncTab } = useAppStore();

  const { data: categoriesRaw } = useSWR<CategoryInfo[]>("/api/categories", fetcher, swrOptions);
  const categories = Array.isArray(categoriesRaw) ? categoriesRaw : [];

  const { data: overviewRaw } = useSWR<{ period?: string }>("/api/features/overview", fetcher, swrOptions);
  const latestDate = useMemo(() => {
    if (overviewRaw?.period && typeof overviewRaw.period === "string") {
      const m = /截至\s*([\d-]+)/.exec(overviewRaw.period);
      if (m) return m[1];
    }
    return "";
  }, [overviewRaw]);

  function navTo(id: string) {
    setActiveNav(id);
    if (id !== "overview" && id !== "chat") setActiveFuncTab("kpi");
  }

  const pages: { id: string; label: string; icon: ReactNode }[] = [
    { id: "overview", label: "账号总览", icon: <LayoutDashboard size={16} /> },
    { id: "chat",     label: "Chat",     icon: <MessageSquare size={16} /> },
  ];

  return (
    <div className="w-[180px] bg-background flex flex-col shrink-0 border-r border-border h-screen">
      {/* Logo */}
      <div className="px-4 pt-5 pb-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-[7px] bg-gradient-to-br from-[#3b5bdb] to-[#7c3aed] flex items-center justify-center text-[13px] font-bold text-white">
            N
          </div>
          <div>
            <div className="text-[13px] font-bold text-foreground leading-tight">YZ-Ops</div>
            <div className="text-[9px] text-muted-foreground tracking-wide">AI · Nordhive</div>
          </div>
        </div>
      </div>

      {/* Pages */}
      <div className="px-2 pt-2.5">
        {pages.map((item) => (
          <NavItem
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={activeNav === item.id}
            onClick={() => navTo(item.id)}
          />
        ))}
      </div>

      {/* Categories */}
      <div className="px-2 py-2">
        <div className="text-[9px] font-semibold text-muted-foreground tracking-wide uppercase px-3 py-1">
          品类
        </div>

        {categories.map((cat) => (
          <NavItem
            key={cat.categoryKey}
            icon={CATEGORY_ICONS[cat.categoryKey] ?? <Package size={16} />}
            label={cat.displayName}
            active={activeNav === cat.categoryKey}
            badge={cat.redAlerts > 0 ? cat.redAlerts : undefined}
            onClick={() => navTo(cat.categoryKey)}
          />
        ))}
      </div>

      <div className="flex-1" />

      {/* Bottom: data date */}
      <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
        {latestDate ? `数据截至 ${latestDate}` : "暂无数据"}
      </div>
    </div>
  );
}

function NavItem({
  icon, label, active, badge, onClick,
}: {
  icon:    ReactNode;
  label:   string;
  active:  boolean;
  badge?:  number;
  onClick: () => void;
}) {
  return (
    <div
      data-active={active}
      onClick={onClick}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg mb-0.5 cursor-pointer
        text-[13px] text-muted-foreground transition-colors
        hover:bg-muted
        data-[active=true]:bg-primary/5 data-[active=true]:text-primary data-[active=true]:font-semibold"
    >
      <span className="w-5 flex items-center justify-center">{icon}</span>
      <span className="flex-1">{label}</span>
      {badge != null && (
        <Badge variant="destructive">{badge}红</Badge>
      )}
    </div>
  );
}
