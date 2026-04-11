"use client";

import { create } from "zustand";

export type PanelId = "chat" | "dashboard" | "ads" | "inventory" | "competitors";
export type ProductStage = "新品期" | "成长期" | "成熟期" | "衰退期";

export interface Product {
  id: string;
  asin: string;
  name: string;
  shortName: string;
  emoji: string;
  category: string;
  stage: ProductStage;
  brand: string;
  marketplace: string[];
  rating: number;
  reviewCount: number;
  price: number;
  bsr: number;
}

export interface DataFile {
  id: string;
  productId: string;
  fileName: string;
  fileType: string;
  timeWindow: string;
  fileSize: number;
  storagePath: string;
  uploadedAt: string;
}

export interface Alert {
  id: string;
  productId: string;
  priority: "P0" | "P1" | "P2" | "P3";
  title: string;
  description: string;
  triggerRule: string;
  suggestedAction: string;
  status: "open" | "resolved";
  createdAt: string;
}

// ── Ad data cache (Phase 5) ───────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRow = Record<string, any>;

export interface AdData {
  campaigns: AnyRow[];
  searchTerms: AnyRow[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

// ── Event Markers ─────────────────────────────────────────────────────────────

export type EventType =
  | "ld"         // Lightning Deal
  | "prime"      // Prime Discount
  | "coupon"     // Coupon
  | "bd"         // Best Deal
  | "price_test" // 手动降价测试
  | "price_war"  // 竞品价格战
  | "prime_day"  // Prime Day
  | "bf";        // Black Friday

export interface EventMarker {
  id: string;
  productId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  eventType: EventType;
  note: string;
}

// ── Competitors ───────────────────────────────────────────────────────────────

export type ThreatLevel = "high" | "medium" | "low";
export type TrendDirection = "up" | "flat" | "down";

export interface Competitor {
  id: string;
  productId: string;
  name: string;
  asin: string;
  price: number;
  rating: number;
  reviewCount: number;
  bsr: number;
  trend: TrendDirection;
  threatLevel: ThreatLevel;
  note?: string;
}

// ── Metrics (populated by Phase 4) ───────────────────────────────────────────

export interface MetricsSnapshot {
  gmv: number;
  orders: number;
  acos: number;     // %
  roas: number;
  ctr: number;      // %
  cpc: number;      // $
  adSpend?: number;
  sessions?: number;
  impressions?: number;
  clicks?: number;
  cvr?: number;
}

export interface ProductMetrics {
  today?: MetricsSnapshot;
  yesterday?: MetricsSnapshot;
  w7?: MetricsSnapshot;
  w14?: MetricsSnapshot;
  d30?: MetricsSnapshot;
  acosHistory?: { date: string; acos: number; gmv?: number }[];
}

// ── Inventory (populated by Phase 4) ─────────────────────────────────────────

export interface InventoryRecord {
  sku: string;
  marketplace: string;
  availableQty: number;
  inboundQty: number;
  daysOfSupply: number;  // 可售天数
  dailySales: number;    // 日均销量
  restockQty: number;    // 建议补货量
}

// ── Model config ──────────────────────────────────────────────────────────────

export const AVAILABLE_MODELS = [
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6", desc: "推荐" },
  { id: "claude-opus-4-6", label: "Opus 4.6", desc: "最强" },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5", desc: "快速" },
] as const;

export type ModelId = (typeof AVAILABLE_MODELS)[number]["id"];

// ── Store ─────────────────────────────────────────────────────────────────────

interface AppState {
  // Products
  products: Product[];
  selectedProductId: string | null;
  setProducts: (products: Product[]) => void;
  setSelectedProductId: (id: string) => void;
  addProduct: (product: Omit<Product, "id">) => void;

  // Active panel
  activePanel: PanelId;
  setActivePanel: (panel: PanelId) => void;

  // Files per product
  filesByProduct: Record<string, DataFile[]>;
  setFilesForProduct: (productId: string, files: DataFile[]) => void;

  // Alerts
  alerts: Alert[];
  setAlerts: (alerts: Alert[]) => void;
  addAlerts: (productId: string, newAlerts: Alert[]) => void;
  dismissAlert: (alertId: string) => void;

  // Ad data cache per product (Phase 5)
  adDataByProduct: Record<string, AdData>;
  setAdDataForProduct: (productId: string, data: AdData) => void;

  // Chat messages per product
  chatByProduct: Record<string, ChatMessage[]>;
  addChatMessage: (productId: string, message: ChatMessage) => void;
  setChatMessages: (productId: string, messages: ChatMessage[]) => void;
  updateLastAssistantMessage: (productId: string, content: string) => void;
  removeLastMessage: (productId: string) => void;
  clearChat: (productId: string) => void;

  // Cross-panel chat trigger
  pendingChatMessage: string | null;
  setPendingChatMessage: (msg: string | null) => void;

  // Model selection
  selectedModel: ModelId;
  setSelectedModel: (model: ModelId) => void;

  // Event markers per product (user-managed)
  eventMarkersByProduct: Record<string, EventMarker[]>;
  addEventMarker: (productId: string, marker: Omit<EventMarker, "id" | "productId">) => void;
  removeEventMarker: (productId: string, markerId: string) => void;

  // Competitors per product (user-managed)
  competitorsByProduct: Record<string, Competitor[]>;
  addCompetitor: (productId: string, competitor: Omit<Competitor, "id" | "productId">) => void;
  removeCompetitor: (productId: string, competitorId: string) => void;
  updateCompetitor: (productId: string, competitorId: string, updates: Partial<Omit<Competitor, "id" | "productId">>) => void;

  // Metrics per product (Phase 4 populates)
  metricsByProduct: Record<string, ProductMetrics>;
  setMetricsForProduct: (productId: string, metrics: ProductMetrics) => void;

  // Inventory per product (Phase 4 populates)
  inventoryByProduct: Record<string, InventoryRecord[]>;
  setInventoryForProduct: (productId: string, records: InventoryRecord[]) => void;

  // Parsed file data — ALL uploaded file types stored here for Agent access
  // parsedFileDataByProduct[productId][fileType] = rows[]
  parsedFileDataByProduct: Record<string, Record<string, AnyRow[]>>;
  setParsedFileData: (productId: string, fileType: string, rows: AnyRow[]) => void;

  // Computed helpers
  getSelectedProduct: () => Product | null;
  getAlertsForProduct: (productId: string) => Alert[];
  getFilesForProduct: (productId: string) => DataFile[];
}

export const useAppStore = create<AppState>((set, get) => ({
  // ── Products ────────────────────────────────────────────────────────────────
  products: [],
  selectedProductId: null,
  setProducts: (products) =>
    set({ products, selectedProductId: products[0]?.id ?? null }),
  setSelectedProductId: (id) => set({ selectedProductId: id }),
  addProduct: (product) =>
    set((s) => ({
      products: [
        ...s.products,
        { ...product, id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 5)}` },
      ],
    })),

  // ── Active panel ────────────────────────────────────────────────────────────
  activePanel: "chat",
  setActivePanel: (panel) => set({ activePanel: panel }),

  // ── Files ───────────────────────────────────────────────────────────────────
  filesByProduct: {},
  setFilesForProduct: (productId, files) =>
    set((s) => ({
      filesByProduct: { ...s.filesByProduct, [productId]: files },
    })),

  // ── Alerts ──────────────────────────────────────────────────────────────────
  alerts: [],
  setAlerts: (alerts) => set({ alerts }),
  addAlerts: (productId, newAlerts) =>
    set((s) => {
      // Replace existing open alerts for same product+triggerRule, append new ones
      const others = s.alerts.filter(
        (a) => !(a.productId === productId && a.status === "open" &&
          newAlerts.some((n) => n.triggerRule === a.triggerRule))
      );
      return { alerts: [...others, ...newAlerts] };
    }),
  dismissAlert: (alertId) =>
    set((s) => ({
      alerts: s.alerts.map((a) =>
        a.id === alertId ? { ...a, status: "resolved" as const } : a
      ),
    })),

  // ── Ad data cache (Phase 5) ──────────────────────────────────────────────────
  adDataByProduct: {},
  setAdDataForProduct: (productId, data) =>
    set((s) => ({
      adDataByProduct: { ...s.adDataByProduct, [productId]: data },
    })),

  // ── Chat ────────────────────────────────────────────────────────────────────
  chatByProduct: {},
  addChatMessage: (productId, message) =>
    set((s) => ({
      chatByProduct: {
        ...s.chatByProduct,
        [productId]: [...(s.chatByProduct[productId] ?? []), message],
      },
    })),
  setChatMessages: (productId, messages) =>
    set((s) => ({
      chatByProduct: { ...s.chatByProduct, [productId]: messages },
    })),
  updateLastAssistantMessage: (productId, content) =>
    set((s) => {
      const msgs = s.chatByProduct[productId] ?? [];
      const idx = msgs.length - 1;
      if (idx < 0 || msgs[idx].role !== "assistant") return s;
      const updated = [...msgs];
      updated[idx] = { ...updated[idx], content };
      return { chatByProduct: { ...s.chatByProduct, [productId]: updated } };
    }),
  removeLastMessage: (productId) =>
    set((s) => {
      const msgs = s.chatByProduct[productId] ?? [];
      return {
        chatByProduct: { ...s.chatByProduct, [productId]: msgs.slice(0, -1) },
      };
    }),
  clearChat: (productId) =>
    set((s) => ({
      chatByProduct: { ...s.chatByProduct, [productId]: [] },
    })),

  pendingChatMessage: null,
  setPendingChatMessage: (msg) => set({ pendingChatMessage: msg }),

  // ── Model ────────────────────────────────────────────────────────────────────
  selectedModel:
    (process.env.NEXT_PUBLIC_DEFAULT_MODEL as ModelId) || "claude-sonnet-4-6",
  setSelectedModel: (model) => set({ selectedModel: model }),

  // ── Event markers ────────────────────────────────────────────────────────────
  eventMarkersByProduct: {},
  addEventMarker: (productId, marker) =>
    set((s) => ({
      eventMarkersByProduct: {
        ...s.eventMarkersByProduct,
        [productId]: [
          ...(s.eventMarkersByProduct[productId] ?? []),
          {
            ...marker,
            id: `em-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            productId,
          },
        ],
      },
    })),
  removeEventMarker: (productId, markerId) =>
    set((s) => ({
      eventMarkersByProduct: {
        ...s.eventMarkersByProduct,
        [productId]: (s.eventMarkersByProduct[productId] ?? []).filter(
          (m) => m.id !== markerId
        ),
      },
    })),

  // ── Competitors ──────────────────────────────────────────────────────────────
  competitorsByProduct: {},
  addCompetitor: (productId, competitor) =>
    set((s) => ({
      competitorsByProduct: {
        ...s.competitorsByProduct,
        [productId]: [
          ...(s.competitorsByProduct[productId] ?? []),
          {
            ...competitor,
            id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            productId,
          },
        ],
      },
    })),
  removeCompetitor: (productId, competitorId) =>
    set((s) => ({
      competitorsByProduct: {
        ...s.competitorsByProduct,
        [productId]: (s.competitorsByProduct[productId] ?? []).filter(
          (c) => c.id !== competitorId
        ),
      },
    })),
  updateCompetitor: (productId, competitorId, updates) =>
    set((s) => ({
      competitorsByProduct: {
        ...s.competitorsByProduct,
        [productId]: (s.competitorsByProduct[productId] ?? []).map((c) =>
          c.id === competitorId ? { ...c, ...updates } : c
        ),
      },
    })),

  // ── Metrics (Phase 4) ────────────────────────────────────────────────────────
  metricsByProduct: {},
  setMetricsForProduct: (productId, metrics) =>
    set((s) => ({
      metricsByProduct: { ...s.metricsByProduct, [productId]: metrics },
    })),

  // ── Inventory (Phase 4) ──────────────────────────────────────────────────────
  inventoryByProduct: {},
  setInventoryForProduct: (productId, records) =>
    set((s) => ({
      inventoryByProduct: { ...s.inventoryByProduct, [productId]: records },
    })),

  // ── Parsed file data (all types) ─────────────────────────────────────────────
  parsedFileDataByProduct: {},
  setParsedFileData: (productId, fileType, rows) =>
    set((s) => ({
      parsedFileDataByProduct: {
        ...s.parsedFileDataByProduct,
        [productId]: {
          ...(s.parsedFileDataByProduct[productId] ?? {}),
          [fileType]: rows,
        },
      },
    })),

  // ── Computed ─────────────────────────────────────────────────────────────────
  getSelectedProduct: () => {
    const { products, selectedProductId } = get();
    return products.find((p) => p.id === selectedProductId) ?? null;
  },
  getAlertsForProduct: (productId) =>
    get().alerts.filter(
      (a) => a.productId === productId && a.status === "open"
    ),
  getFilesForProduct: (productId) => get().filesByProduct[productId] ?? [],
}));
