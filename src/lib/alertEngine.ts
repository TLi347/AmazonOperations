/**
 * Phase 5: Alert Rules Engine
 * Pure client-side function — no DB, no side effects.
 * Input: parsed ad data from /api/upload response
 * Output: Alert[] to be merged into Zustand store
 */

import type { Alert, AnyRow, AdData } from "@/store/appStore";
import type { ProductStage } from "@/store/appStore";

function makeId() {
  return `alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function makeAlert(
  productId: string,
  triggerRule: string,
  priority: Alert["priority"],
  title: string,
  description: string,
  suggestedAction: string
): Alert {
  return {
    id: makeId(),
    productId,
    priority,
    title,
    description,
    triggerRule,
    suggestedAction,
    status: "open",
    createdAt: new Date().toISOString(),
  };
}

// ── Rule implementations ──────────────────────────────────────────────────────

function checkZeroConv(productId: string, searchTerms: AnyRow[]): Alert[] {
  const offenders = searchTerms.filter(
    (r) =>
      (String(r.matchType ?? "").includes("精确") ||
        String(r.matchType ?? "").includes("词组")) &&
      (r.clicks ?? 0) >= 15 &&
      (r.orders ?? 0) === 0
  );
  if (!offenders.length) return [];

  const names = offenders
    .slice(0, 5)
    .map((r) => `「${r.searchTerm}」(${r.clicks}次点击)`)
    .join("、");
  return [
    makeAlert(
      productId,
      "zero-conv",
      "P0",
      "关键词零成交止血",
      `${offenders.length} 个精确/词组词高点击零成交：${names}`,
      "立即暂停该关键词 + 广泛父组添加词组否定"
    ),
  ];
}

function checkInvalidTerm(productId: string, searchTerms: AnyRow[]): Alert[] {
  const offenders = searchTerms.filter(
    (r) => (r.spend ?? 0) > 20 && (r.orders ?? 0) === 0
  );
  if (!offenders.length) return [];

  const names = offenders
    .slice(0, 5)
    .map((r) => `「${r.searchTerm}」($${Number(r.spend ?? 0).toFixed(2)})`)
    .join("、");
  return [
    makeAlert(
      productId,
      "invalid-term",
      "P0",
      "无效搜索词爆量",
      `${offenders.length} 个词花费超$20零成交：${names}`,
      "在活动层精确否定该搜索词"
    ),
  ];
}

function checkOverBudget(productId: string, campaigns: AnyRow[]): Alert[] {
  const offenders = campaigns.filter(
    (r) =>
      (r.budget ?? 0) > 0 &&
      (r.spend ?? 0) > (r.budget ?? 0) * 1.1 &&
      (r.acos ?? 0) > 80
  );
  if (!offenders.length) return [];

  const names = offenders
    .slice(0, 3)
    .map(
      (r) =>
        `「${r.campaignName}」(花费$${Number(r.spend ?? 0).toFixed(0)} / 预算$${Number(r.budget ?? 0).toFixed(0)}, ACoS ${Number(r.acos ?? 0).toFixed(0)}%)`
    )
    .join("、");
  return [
    makeAlert(
      productId,
      "over-budget",
      "P0",
      "超预算 + 高 ACoS 双击",
      `${offenders.length} 个活动超预算且 ACoS>80%：${names}`,
      "暂停广泛组 + 降低出价 10–15%"
    ),
  ];
}

function checkHighAcos(productId: string, searchTerms: AnyRow[]): Alert[] {
  const offenders = searchTerms.filter(
    (r) =>
      (r.acos ?? 0) >= 80 &&
      (r.acos ?? 0) <= 114 &&
      (r.clicks ?? 0) >= 30
  );
  if (!offenders.length) return [];

  const names = offenders
    .slice(0, 5)
    .map(
      (r) =>
        `「${r.searchTerm ?? r.campaignName}」(ACoS ${Number(r.acos ?? 0).toFixed(0)}%, ${r.clicks}次点击)`
    )
    .join("、");
  return [
    makeAlert(
      productId,
      "high-acos-bid",
      "P1",
      "高 ACoS 词降价",
      `${offenders.length} 个词 ACoS 80–114% 且点击≥30：${names}`,
      "出价降低 30–40%"
    ),
  ];
}

function checkCtrLow(productId: string, searchTerms: AnyRow[]): Alert[] {
  const exactTerms = searchTerms.filter(
    (r) =>
      String(r.matchType ?? "").includes("精确") &&
      (r.impressions ?? 0) >= 500 &&
      (r.ctr ?? 0) < 0.2
  );
  if (!exactTerms.length) return [];

  const names = exactTerms
    .slice(0, 3)
    .map(
      (r) =>
        `「${r.searchTerm}」(曝光${r.impressions}, CTR ${Number(r.ctr ?? 0).toFixed(2)}%)`
    )
    .join("、");
  return [
    makeAlert(
      productId,
      "ctr-low",
      "P1",
      "CTR 过低检查",
      `${exactTerms.length} 个精确词曝光≥500 但 CTR<0.2%：${names}`,
      "检查主图吸引力 + 检查价格是否高于竞品 >15%"
    ),
  ];
}

function checkLowImpression(
  productId: string,
  searchTerms: AnyRow[],
  stage: ProductStage
): Alert[] {
  if (stage !== "新品期") return [];

  const exactLow = searchTerms.filter(
    (r) =>
      String(r.matchType ?? "").includes("精确") &&
      (r.impressions ?? 0) < 500
  );
  if (!exactLow.length) return [];

  const names = exactLow
    .slice(0, 3)
    .map((r) => `「${r.searchTerm}」(曝光${r.impressions ?? 0})`)
    .join("、");
  return [
    makeAlert(
      productId,
      "low-impression",
      "P1",
      "新品曝光不足",
      `新品期 ${exactLow.length} 个精确词曝光<500：${names}`,
      "热门词出价提升 20–30%，不低于类目 CPC 中位值 +15%"
    ),
  ];
}

function checkBestKwScale(productId: string, searchTerms: AnyRow[]): Alert[] {
  const winners = searchTerms.filter(
    (r) =>
      (r.acos ?? 0) > 0 &&
      (r.acos ?? 0) <= 35 &&
      (r.cvr ?? 0) >= 4 &&
      (r.clicks ?? 0) >= 30
  );
  if (!winners.length) return [];

  const names = winners
    .slice(0, 5)
    .map(
      (r) =>
        `「${r.searchTerm}」(ACoS ${Number(r.acos ?? 0).toFixed(0)}%, CVR ${Number(r.cvr ?? 0).toFixed(1)}%)`
    )
    .join("、");
  return [
    makeAlert(
      productId,
      "best-kw-scale",
      "P2",
      "最优词加价扩量",
      `${winners.length} 个词 ACoS≤35% + CVR≥4% + 点击≥30：${names}`,
      "出价 +15–20%，同步增加日预算 20%"
    ),
  ];
}

function checkKwOverlap(productId: string, searchTerms: AnyRow[]): Alert[] {
  // Find search terms that appear in both broad and exact match types
  const termMap = new Map<string, Set<string>>();
  for (const r of searchTerms) {
    const term = String(r.searchTerm ?? "").trim().toLowerCase();
    if (!term) continue;
    const matchType = String(r.matchType ?? "");
    if (!termMap.has(term)) termMap.set(term, new Set());
    if (matchType.includes("广泛")) termMap.get(term)!.add("broad");
    if (matchType.includes("精确")) termMap.get(term)!.add("exact");
  }

  const overlaps: string[] = [];
  Array.from(termMap.entries()).forEach(([term, types]) => {
    if (types.has("broad") && types.has("exact")) overlaps.push(term);
  });
  if (!overlaps.length) return [];

  const names = overlaps.slice(0, 5).map((t) => `「${t}」`).join("、");
  return [
    makeAlert(
      productId,
      "kw-overlap",
      "P2",
      "广泛精确词重叠处理",
      `${overlaps.length} 个词同时出现在广泛和精确活动：${names}`,
      "精确匹配优先，在广泛组添加该词的精确否定"
    ),
  ];
}

function checkPhraseLowImp(productId: string, searchTerms: AnyRow[]): Alert[] {
  const low = searchTerms.filter(
    (r) =>
      String(r.matchType ?? "").includes("词组") &&
      (r.impressions ?? 0) < 100
  );
  if (!low.length) return [];

  const names = low
    .slice(0, 5)
    .map((r) => `「${r.searchTerm}」(曝光${r.impressions ?? 0})`)
    .join("、");
  return [
    makeAlert(
      productId,
      "phrase-low-imp",
      "P2",
      "词组匹配低曝光",
      `${low.length} 个词组词曝光<100：${names}`,
      "出价提升 25–35%"
    ),
  ];
}

function checkAsinTargeting(productId: string, campaigns: AnyRow[]): Alert[] {
  // Campaigns with ASIN targeting characteristics (high ACoS > 70%, >14 days implied)
  const asinCamps = campaigns.filter(
    (r) =>
      (String(r.campaignName ?? "").includes("ASIN") ||
        String(r.adType ?? "").includes("SD") ||
        String(r.biddingStrategy ?? "").includes("ASIN")) &&
      (r.acos ?? 0) > 70
  );
  if (!asinCamps.length) return [];

  const names = asinCamps
    .slice(0, 3)
    .map(
      (r) =>
        `「${r.campaignName}」(ACoS ${Number(r.acos ?? 0).toFixed(0)}%)`
    )
    .join("、");
  return [
    makeAlert(
      productId,
      "asin-targeting",
      "P2",
      "竞品 ASIN 定投承压",
      `${asinCamps.length} 个 ASIN 定投活动 ACoS>70%：${names}`,
      "保留高 CVR 的 ASIN，其余降价 15%"
    ),
  ];
}

function checkBroadToExact(productId: string, searchTerms: AnyRow[]): Alert[] {
  const candidates = searchTerms.filter(
    (r) =>
      String(r.matchType ?? "").includes("广泛") &&
      (r.clicks ?? 0) >= 20 &&
      (r.cvr ?? 0) >= 3
  );
  if (!candidates.length) return [];

  const names = candidates
    .slice(0, 5)
    .map(
      (r) =>
        `「${r.searchTerm}」(${r.clicks}次点击, CVR ${Number(r.cvr ?? 0).toFixed(1)}%)`
    )
    .join("、");
  return [
    makeAlert(
      productId,
      "broad-to-exact",
      "P3",
      "广泛词沉淀精确",
      `${candidates.length} 个广泛词点击≥20 且 CVR≥3%，可沉淀精确：${names}`,
      "添加到精确匹配组，出价 = 广泛出价 × 1.2"
    ),
  ];
}

function checkAdStructure(productId: string, campaigns: AnyRow[]): Alert[] {
  // Campaigns with large ACoS spread suggesting structural issues
  const validCamps = campaigns.filter(
    (r) => (r.acos ?? 0) > 0 && (r.clicks ?? 0) >= 10
  );
  if (validCamps.length < 3) return [];

  const acosValues = validCamps.map((r) => r.acos as number);
  const maxAcos = Math.max(...acosValues);
  const minAcos = Math.min(...acosValues);

  if (maxAcos - minAcos <= 30) return [];

  return [
    makeAlert(
      productId,
      "ad-structure",
      "P3",
      "广告结构优化",
      `活动间 ACoS 差异达 ${(maxAcos - minAcos).toFixed(0)}%（最低 ${minAcos.toFixed(0)}%，最高 ${maxAcos.toFixed(0)}%），建议按效率分层`,
      "按 ACoS 高/中/低分组管理，预算向高效组倾斜"
    ),
  ];
}

function checkCrossMarket(productId: string, searchTerms: AnyRow[]): Alert[] {
  // Group by marketplace and compare CPC/CTR
  const marketMap = new Map<string, AnyRow[]>();
  for (const r of searchTerms) {
    const mkt = String(r.marketplace ?? "").toUpperCase() || "US";
    if (!marketMap.has(mkt)) marketMap.set(mkt, []);
    marketMap.get(mkt)!.push(r);
  }

  if (marketMap.size < 2) return [];

  const stats: { mkt: string; avgCpc: number; avgCtr: number }[] = [];
  Array.from(marketMap.entries()).forEach(([mkt, rows]) => {
    const totalClicks = rows.reduce((s: number, r: AnyRow) => s + (r.clicks ?? 0), 0);
    const totalImpr = rows.reduce((s: number, r: AnyRow) => s + (r.impressions ?? 0), 0);
    const totalSpend = rows.reduce((s: number, r: AnyRow) => s + (r.spend ?? 0), 0);
    stats.push({
      mkt,
      avgCpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
      avgCtr: totalImpr > 0 ? (totalClicks / totalImpr) * 100 : 0,
    });
  });

  // Check if any market pair has CPC diff > 50%
  let anomalyFound = false;
  const details: string[] = [];
  for (let i = 0; i < stats.length; i++) {
    for (let j = i + 1; j < stats.length; j++) {
      const a = stats[i];
      const b = stats[j];
      const cpcMax = Math.max(a.avgCpc, b.avgCpc);
      const cpcMin = Math.min(a.avgCpc, b.avgCpc);
      if (cpcMin > 0 && (cpcMax - cpcMin) / cpcMin > 0.5) {
        anomalyFound = true;
        details.push(
          `${a.mkt} CPC $${a.avgCpc.toFixed(2)} vs ${b.mkt} $${b.avgCpc.toFixed(2)}`
        );
      }
    }
  }

  if (!anomalyFound) return [];

  return [
    makeAlert(
      productId,
      "cross-market",
      "P2",
      "多站点广告效率差异过大",
      `站点间 CPC 差异超50%：${details.slice(0, 2).join("；")}`,
      "按站点制定差异化竞价策略，高CPC站点考虑降价或独立优化"
    ),
  ];
}

function checkSeasonalBudget(productId: string): Alert[] {
  const month = new Date().getMonth() + 1; // 1-12
  const isHotSeason = month >= 10 || month <= 1; // Q4 + Jan

  if (!isHotSeason) return [];

  return [
    makeAlert(
      productId,
      "seasonal-budget",
      "P3",
      "季节性预算调整",
      `当前为旺季（${month}月），建议主动提升预算和出价抢占流量`,
      "出价 +15–20%，日预算 +30–50%；在旺季流量高峰前提前调整"
    ),
  ];
}

function checkBrandDefense(productId: string, campaigns: AnyRow[]): Alert[] {
  // Only suggest if we have campaign data but no obvious brand defense campaign
  if (!campaigns.length) return [];

  const hasBrandCamp = campaigns.some(
    (r) =>
      String(r.campaignName ?? "").toLowerCase().includes("brand") ||
      String(r.campaignName ?? "").includes("品牌")
  );

  if (hasBrandCamp) return [];

  return [
    makeAlert(
      productId,
      "brand-defense",
      "P3",
      "品牌词防御",
      "未检测到品牌词专属活动，竞品可能截流品牌词流量",
      "添加品牌词精确匹配活动（低出价 $0.5–1）"
    ),
  ];
}

// ── Main export ───────────────────────────────────────────────────────────────

export function runAlertRules(
  productId: string,
  adData: AdData,
  stage: ProductStage
): Alert[] {
  const { campaigns, searchTerms } = adData;

  const results: Alert[] = [
    // P0
    ...checkZeroConv(productId, searchTerms),
    ...checkInvalidTerm(productId, searchTerms),
    ...checkOverBudget(productId, campaigns),
    // P1
    ...checkHighAcos(productId, searchTerms),
    ...checkCtrLow(productId, searchTerms),
    ...checkLowImpression(productId, searchTerms, stage),
    // P2
    ...checkBestKwScale(productId, searchTerms),
    ...checkKwOverlap(productId, searchTerms),
    ...checkPhraseLowImp(productId, searchTerms),
    ...checkAsinTargeting(productId, campaigns),
    ...checkCrossMarket(productId, searchTerms),
    // P3
    ...checkBroadToExact(productId, searchTerms),
    ...checkAdStructure(productId, campaigns),
    ...checkSeasonalBudget(productId),
    ...checkBrandDefense(productId, campaigns),
  ];

  return results;
}
