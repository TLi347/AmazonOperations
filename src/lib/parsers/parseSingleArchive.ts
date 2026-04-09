/**
 * 解析：单品归档（B0XXXXX_产品名.xlsx）
 * 3 个 Sheet：
 *   1. 广告日志   → AdOperationLog（8 列，Row1=header）
 *   2. 广告表现   → KeywordMetric（18 列，Row1=header）
 *   3. 销售表现   → Metric（34 列，Row1=header）
 */
import {
  readWorkbook,
  getSheetByPattern,
  parseFlatSheet,
  toNum,
  toInt,
  toDate,
} from "./utils";

export interface AdLogRow {
  date: Date | null;
  marketplace: string;
  campaignName: string;
  operationType: string;
  target: string;
  detail: string;
}

export interface KeywordRow {
  date: Date | null;
  marketplace: string;
  campaignName: string;
  keyword: string;
  matchType: string;
  bid: number;
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
  sales: number;
  orders: number;
  acos: number;
  cpc: number;
  cvr: number;
}

export interface SaleRow {
  date: Date | null;
  marketplace: string;
  currency: string;
  units: number;
  gmv: number;
  adSpend: number;
  adSales: number;
  acos: number;
  grossProfit: number;
}

export interface SingleArchiveResult {
  asin: string; // extracted from filename prefix
  logs: AdLogRow[];
  keywords: KeywordRow[];
  sales: SaleRow[];
}

function extractAsinFromFilename(filename: string): string {
  const m = filename.match(/^(B0[A-Z0-9]+)_/i);
  return m ? m[1].toUpperCase() : "";
}

export function parseSingleArchive(
  buffer: Buffer,
  filename: string
): SingleArchiveResult {
  const wb = readWorkbook(buffer);
  const asin = extractAsinFromFilename(filename);

  // ── Sheet 1: 广告日志 ──────────────────────────────
  const logs: AdLogRow[] = [];
  const wsLog = getSheetByPattern(wb, /广告日志/) ?? wb.Sheets[wb.SheetNames[0]];
  if (wsLog) {
    const { rows } = parseFlatSheet(wsLog);
    for (const row of rows) {
      // 列: 操作时间 / 店铺名称 / 站点 / 广告活动编号 / 广告活动名称 / 操作对象 / 执行操作 / 调整记录
      logs.push({
        date:          toDate(row["操作时间"]),
        marketplace:   String(row["站点"] ?? "").trim().toUpperCase(),
        campaignName:  String(row["广告活动名称"] ?? "").trim(),
        operationType: String(row["执行操作"] ?? "").trim(),
        target:        String(row["操作对象"] ?? "").trim(),
        detail:        String(row["调整记录"] ?? "").trim(),
      });
    }
  }

  // ── Sheet 2: 广告表现 ──────────────────────────────
  const keywords: KeywordRow[] = [];
  const wsKw = getSheetByPattern(wb, /广告表现/) ?? wb.Sheets[wb.SheetNames[1]];
  if (wsKw) {
    const { rows } = parseFlatSheet(wsKw);
    for (const row of rows) {
      // 列: 日期 / 店铺名称 / 站点 / 广告活动名称 / 广告类型 / 匹配类型 / 关键词 / 竞价 /
      //     曝光量 / 点击量 / CTR / 花费 / 销售额 / ACOS / CPC / CVR / 订单量 / 销量
      const clicks = toInt(row["点击量"]);
      const impr   = toInt(row["曝光量"]);
      const spend  = toNum(row["花费"]);
      const sales  = toNum(row["销售额"]);
      const orders = toInt(row["订单量"]);
      const acosRaw = toNum(row["ACOS"]);

      keywords.push({
        date:        toDate(row["日期"]),
        marketplace: String(row["站点"] ?? "").trim().toUpperCase(),
        campaignName: String(row["广告活动名称"] ?? "").trim(),
        keyword:     String(row["关键词"] ?? "").trim(),
        matchType:   String(row["匹配类型"] ?? "").trim(),
        bid:         toNum(row["竞价"]),
        impressions: impr,
        clicks,
        ctr:  toNum(row["CTR"]) || (impr > 0 ? (clicks / impr) * 100 : 0),
        spend,
        sales,
        orders,
        acos: acosRaw > 1 ? acosRaw : acosRaw * 100,
        cpc:  toNum(row["CPC"]) || (clicks > 0 ? spend / clicks : 0),
        cvr:  toNum(row["CVR"]) || (clicks > 0 ? (orders / clicks) * 100 : 0),
      });
    }
  }

  // ── Sheet 3: 销售表现 ──────────────────────────────
  const salesRows: SaleRow[] = [];
  const wsSales = getSheetByPattern(wb, /销售表现/) ?? wb.Sheets[wb.SheetNames[2]];
  if (wsSales) {
    const { rows } = parseFlatSheet(wsSales);
    for (const row of rows) {
      // 列: 统计日期 / 店铺名称 / 站点 / 币种 / 销量 / 销售额 / 广告花费 / 毛利 ...
      salesRows.push({
        date:        toDate(row["统计日期"]),
        marketplace: String(row["站点"] ?? "").trim().toUpperCase(),
        currency:    String(row["币种"] ?? "USD"),
        units:       toInt(row["销量"]),
        gmv:         toNum(row["销售额"]),
        adSpend:     toNum(row["广告花费"]),
        adSales:     toNum(row["广告销售额"]),
        acos:        toNum(row["ACOS"] ?? row["ACoS"]),
        grossProfit: toNum(row["毛利"]),
      });
    }
  }

  return { asin, logs, keywords, sales: salesRows };
}
