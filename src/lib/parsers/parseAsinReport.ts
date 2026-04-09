/**
 * 解析：系统-Nordhive-ALL-产品报表-ASIN视图
 *
 * Sheet 1: 产品报表（ASIN视图）  → Metric 表
 * Sheet 2: 产品报表（ASIN视图）-费用明细 → Metric 表（补充财务字段）
 *
 * 输出：按 ASIN 聚合的 MetricRow[]，供上层写入 DB 或注入 Zustand。
 */

import {
  readWorkbook,
  parseNordhiveSheet,
  inferTimeWindow,
  toNum,
  toInt,
  fuzzyGet,
} from "./utils";

export interface AsinMetricRow {
  asin: string;
  marketplace: string;
  timeWindow: string;
  startDate: Date | null;
  endDate: Date | null;

  // 销售
  gmv: number;
  orders: number;
  units: number;
  sessions: number;
  refundRate: number;

  // 广告
  adSpend: number;
  adSales: number;
  adOrders: number;
  acos: number;
  roas: number;
  ctr: number;
  cpc: number;
  impressions: number;
  clicks: number;
  cvr: number;

  // 财务（Sheet 2 补充）
  grossProfit: number;
  grossMargin: number;
  fbaFee: number;
  referralFee: number;

  // 库存（ASIN 视图附带，作为快照）
  daysOfSupply: number;
  availableQty: number;

  // 产品信息（用于更新 Product 表）
  price: number;
  rating: number;
  reviewCount: number;
  bsr: number;
}

export function parseAsinReport(buffer: Buffer): AsinMetricRow[] {
  const wb = readWorkbook(buffer);

  // ── Sheet 1: 主指标 ──────────────────────────────────
  const ws1 = wb.Sheets[wb.SheetNames[0]];
  const { dateRange, rows: mainRows } = parseNordhiveSheet(ws1);
  const { timeWindow, startDate, endDate } = inferTimeWindow(dateRange);

  // 用 ASIN+站点 作为 key 聚合
  const map = new Map<string, AsinMetricRow>();

  for (const row of mainRows) {
    const asin = String(row["ASIN"] ?? "").trim();
    if (!asin || asin === "Total") continue;

    const marketplace = String(row["站点"] ?? "").trim().toUpperCase();
    const key = `${asin}__${marketplace}`;

    const clicks   = toInt(row["广告点击量"]);
    const impr     = toInt(row["广告曝光量"]);
    const adSpend  = Math.abs(toNum(row["广告花费"]));
    const adSales  = toNum(row["广告销售额"]);
    const acosRaw  = toNum(row["ACoS"]); // 可能是 "33.31%" 或 33.31
    const acos     = acosRaw > 1 ? acosRaw : acosRaw * 100; // 统一为百分比数值
    const orders   = toInt(row["订单量"]);

    map.set(key, {
      asin,
      marketplace,
      timeWindow,
      startDate,
      endDate,

      gmv:      toNum(row["销售额"]),
      orders,
      units:    toInt(row["销量"]),
      sessions: toInt(fuzzyGet(row, ["总流量", "会话数", "Sessions"]) ?? 0),
      refundRate: toNum(row["退款率"]),

      adSpend,
      adSales,
      adOrders: toInt(row["广告订单量"]),
      acos,
      roas:     adSpend > 0 ? adSales / adSpend : 0,
      ctr:      impr > 0 ? (clicks / impr) * 100 : 0,
      cpc:      clicks > 0 ? adSpend / clicks : 0,
      impressions: impr,
      clicks,
      cvr:      clicks > 0 ? (orders / clicks) * 100 : 0,

      // Sheet 2 will fill these
      grossProfit: 0,
      grossMargin: 0,
      fbaFee:      toNum(fuzzyGet(row, ["亚马逊物流费"])),
      referralFee: toNum(fuzzyGet(row, ["亚马逊佣金"])),

      daysOfSupply: toNum(row["预估可售天数"]),
      availableQty: toInt(row["可售库存"]),

      price:       toNum(row["价格"]),
      rating:      toNum(row["评分"]),
      reviewCount: toInt(row["评论数"]),
      bsr:         toInt(fuzzyGet(row, ["BSR排名-大类目", "BSR排名"])),
    });
  }

  // ── Sheet 2: 费用明细（可选，不存在时跳过）──────────
  if (wb.SheetNames.length > 1) {
    const ws2 = wb.Sheets[wb.SheetNames[1]];
    const { rows: feeRows } = parseNordhiveSheet(ws2);

    for (const row of feeRows) {
      const asin = String(row["ASIN"] ?? "").trim();
      if (!asin || asin === "Total") continue;
      const marketplace = String(row["站点"] ?? "").trim().toUpperCase();
      const key = `${asin}__${marketplace}`;
      const existing = map.get(key);
      if (!existing) continue;

      existing.grossProfit = toNum(row["毛利"]);
      existing.grossMargin = toNum(row["毛利率"]);
      // 更精细的 FBA 费（费用明细 sheet 有更细分的字段）
      const fbaFee = toNum(fuzzyGet(row, ["FBA配送费-按商品", "FBA配送费"]));
      if (fbaFee > 0) existing.fbaFee = fbaFee;
      existing.referralFee = toNum(fuzzyGet(row, ["销售佣金", "亚马逊佣金"]));
    }
  }

  return Array.from(map.values());
}
