"use client";

import { create } from "zustand";

// ── Navigation ────────────────────────────────────────────────────────────────

/**
 * activeNav: "overview" | "chat" | categoryKey (e.g. "mattress")
 * When activeNav is a categoryKey, the function tab panel is shown.
 */
export type FuncTab = "kpi" | "alerts" | "ads" | "inventory";

// ── Model selection ───────────────────────────────────────────────────────────

export const AVAILABLE_MODELS = [
  { id: "claude-sonnet-4-6",         label: "claude-sonnet-4-6" },
  { id: "claude-opus-4-6",           label: "claude-opus-4-6"   },
] as const;

export type ModelId = (typeof AVAILABLE_MODELS)[number]["id"];

// ── Store ─────────────────────────────────────────────────────────────────────

interface AppState {
  activeNav:      string;    // "overview" | "chat" | categoryKey
  setActiveNav:   (nav: string) => void;

  activeFuncTab:    FuncTab;
  setActiveFuncTab: (tab: FuncTab) => void;

  selectedModel:    ModelId;
  setSelectedModel: (model: ModelId) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeNav:    "overview",
  setActiveNav: (nav) => set({ activeNav: nav }),

  activeFuncTab:    "kpi",
  setActiveFuncTab: (tab) => set({ activeFuncTab: tab }),

  selectedModel:
    (process.env.NEXT_PUBLIC_DEFAULT_MODEL as ModelId) || "claude-sonnet-4-6",
  setSelectedModel: (model) => set({ selectedModel: model }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const PAGE_NAVS = new Set(["overview", "chat"]);

/** Returns categoryKey if activeNav is a category, null otherwise. */
export function getCategoryKey(activeNav: string): string | null {
  return PAGE_NAVS.has(activeNav) ? null : activeNav;
}
