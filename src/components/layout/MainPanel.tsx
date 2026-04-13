"use client";

import { useAppStore, getCategoryKey, type FuncTab } from "@/store/appStore";
import ChatPanel      from "@/components/panels/ChatPanel";
import OverviewPanel  from "@/components/panels/OverviewPanel";
import KPIPanel       from "@/components/panels/KPIPanel";
import AlertsPanel    from "@/components/panels/AlertsPanel";
import AdsPanel       from "@/components/panels/AdsPanel";
import InventoryPanel from "@/components/panels/InventoryPanel";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";

export default function MainPanel() {
  const { activeNav, activeFuncTab } = useAppStore();
  const categoryKey = getCategoryKey(activeNav);
  const isCategory  = categoryKey !== null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Panel content */}
      <div className="flex-1 overflow-auto bg-background">
        {activeNav === "overview" && <ErrorBoundary><OverviewPanel key="overview" /></ErrorBoundary>}
        {activeNav === "chat"     && <ErrorBoundary><ChatPanel     key="chat" /></ErrorBoundary>}
        {isCategory && activeFuncTab === "kpi"       && <ErrorBoundary><KPIPanel       key={categoryKey} /></ErrorBoundary>}
        {isCategory && activeFuncTab === "alerts"    && <ErrorBoundary><AlertsPanel    key={categoryKey} /></ErrorBoundary>}
        {isCategory && activeFuncTab === "ads"       && <ErrorBoundary><AdsPanel       key={categoryKey} /></ErrorBoundary>}
        {isCategory && activeFuncTab === "inventory" && <ErrorBoundary><InventoryPanel key={categoryKey} /></ErrorBoundary>}
      </div>
    </div>
  );
}
