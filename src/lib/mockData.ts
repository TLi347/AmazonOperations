import type { Product, Alert, DataFile } from "@/store/appStore";

// ── 产品列表：只保留两个沙发床垫 ─────────────────────────────────────────────
export const MOCK_PRODUCTS: Product[] = [
  {
    id: "p1",
    asin: "B0GD7K1TC9",
    name: "4寸Full沙发床垫",
    shortName: "Full沙发垫",
    category: "家居床品",
    stage: "成长期",
    brand: "Nordhive",
    marketplace: ["US"],
    rating: 4.4,
    reviewCount: 89,
    price: 119.0,
    bsr: 3240,
    emoji: "🛋️",
  },
  {
    id: "p2",
    asin: "B0GD7BF2TZ",
    name: "4寸Queen沙发床垫",
    shortName: "Queen沙发垫",
    category: "家居床品",
    stage: "新品期",
    brand: "Nordhive",
    marketplace: ["US"],
    rating: 4.2,
    reviewCount: 34,
    price: 129.0,
    bsr: 4810,
    emoji: "🛏️",
  },
];

export const MOCK_ALERTS: Alert[] = [
  {
    id: "a1",
    productId: "p2",
    priority: "P0",
    title: "广告活动超预算 + 高ACoS",
    description: "Queen沙发垫SP-广泛活动单日花费$186，超预算32%，当日ACoS 89%",
    triggerRule: "over-budget",
    suggestedAction: "暂停广泛组 + 降低出价10-15%",
    status: "open",
    createdAt: new Date().toISOString(),
  },
  {
    id: "a2",
    productId: "p1",
    priority: "P1",
    title: "CTR异常偏低",
    description: "精确词「sofa bed mattress full」曝光1,240次，CTR仅0.12%",
    triggerRule: "ctr-low",
    suggestedAction: "检查并更新主图，检查价格是否高于竞品>15%",
    status: "open",
    createdAt: new Date().toISOString(),
  },
  {
    id: "a3",
    productId: "p1",
    priority: "P2",
    title: "优质词加价扩量",
    description: "「sofa bed mattress replacement」ACoS 28%, CVR 6.9%",
    triggerRule: "best-kw-scale",
    suggestedAction: "出价+15-20%，同步增加日预算20%",
    status: "open",
    createdAt: new Date().toISOString(),
  },
];

// 默认无文件 — 用户上传后填入
export const MOCK_FILES: Record<string, DataFile[]> = {};

export const MOCK_METRICS = {
  today: {
    gmv: 2847,
    orders: 9,
    sessions: 423,
    acos: 42.3,
    roas: 2.36,
    ctr: 0.58,
    cvr: 8.2,
    cpc: 1.45,
    adSpend: 312,
  },
  yesterday: {
    gmv: 3210,
    orders: 11,
    sessions: 456,
    acos: 38.7,
    roas: 2.58,
    ctr: 0.62,
    cvr: 9.1,
    cpc: 1.38,
    adSpend: 298,
  },
  w7: {
    gmv: 21540,
    orders: 72,
    sessions: 3150,
    acos: 40.1,
    roas: 2.49,
    ctr: 0.61,
    cvr: 8.8,
    cpc: 1.41,
    adSpend: 2105,
  },
  w14: {
    gmv: 19870,
    orders: 66,
    sessions: 2980,
    acos: 43.5,
    roas: 2.3,
    ctr: 0.55,
    cvr: 8.0,
    cpc: 1.52,
    adSpend: 2230,
  },
  d30: {
    gmv: 87650,
    orders: 292,
    sessions: 12800,
    acos: 41.2,
    roas: 2.43,
    ctr: 0.59,
    cvr: 8.5,
    cpc: 1.44,
    adSpend: 8740,
  },
};

export const MOCK_ACOS_HISTORY = [
  { date: "2026-03-08", acos: 45.2 },
  { date: "2026-03-09", acos: 51.3 },
  { date: "2026-03-10", acos: 38.9 },
  { date: "2026-03-11", acos: 42.1 },
  { date: "2026-03-12", acos: 55.8 },
  { date: "2026-03-13", acos: 47.3 },
  { date: "2026-03-14", acos: 39.5 },
  { date: "2026-03-15", acos: 43.2 },
  { date: "2026-03-16", acos: 58.7 },
  { date: "2026-03-17", acos: 44.1 },
  { date: "2026-03-18", acos: 36.8 },
  { date: "2026-03-19", acos: 41.5 },
  { date: "2026-03-20", acos: 48.2 },
  { date: "2026-03-21", acos: 42.3 },
];

export const FILE_GROUPS = [
  {
    label: "产品报表",
    types: ["nordhive_asin_report", "nordhive_sku_report"],
  },
  {
    label: "广告数据",
    types: [
      "nordhive_ad_campaign",
      "nordhive_ad_placement",
      "nordhive_ad_restructure",
      "nordhive_search_term",
    ],
  },
  { label: "成本管理", types: ["nordhive_cost_mgmt"] },
  { label: "单品归档", types: ["single_product_archive"] },
  { label: "市场情报", types: ["aba_search_compare"] },
  { label: "分析报告", types: ["competitor_snapshot"] },
];
