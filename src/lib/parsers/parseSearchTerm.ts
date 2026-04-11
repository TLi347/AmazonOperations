/**
 * 解析：系统-Nordhive-*-搜索词重构
 * 37列，SKU 视图，搜索词粒度的广告表现数据
 */
import {
  readWorkbook,
  parseNordhiveSheet,
  inferTimeWindow,
  toNum,
  toInt,
} from "./utils";

export interface SearchTermRow {
  asin: string;
  sku: string;
  marketplace: string;
  searchTerm: string;
  matchType: string;   // 精确/词组/广泛
  bid: number;
  campaignName: string;
  adType: string;
  timeWindow: string;

  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  orders: number;
  acos: number;
  roas: number;
  ctr: number;
  cpc: number;
  cvr: number;
}

export function parseSearchTerm(buffer: Buffer): SearchTermRow[] {
  const wb = readWorkbook(buffer);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const { dateRange, rows } = parseNordhiveSheet(ws);
  const { timeWindow } = inferTimeWindow(dateRange);

  return rows
    .filter((row) => row["搜索词"] != null && String(row["搜索词"]).trim() !== "")
    .map((row) => {
      const clicks  = toInt(row["点击量"]);
      const impr    = toInt(row["曝光量/展示次数"]);
      const spend   = Math.abs(toNum(row["广告花费"]));
      const sales   = toNum(row["广告销售额"]);
      const orders  = toInt(row["广告订单量"]);
      const acosRaw = toNum(row["ACoS"]);

      return {
        asin:        String(row["ASIN"] ?? "").trim(),
        sku:         String(row["SKU"] ?? "").trim(),
        marketplace: String(row["站点"] ?? "").trim().toUpperCase(),
        searchTerm:  String(row["搜索词"] ?? "").trim(),
        matchType:   String(row["匹配类型"] ?? "").trim(),
        bid:         toNum(row["竞价"]),
        campaignName: String(row["广告活动"] ?? "").trim(),
        adType:      String(row["投放类型"] ?? "").trim(),
        timeWindow,

        impressions: impr,
        clicks,
        spend,
        sales,
        orders,
        acos: acosRaw > 1 ? acosRaw : acosRaw * 100,
        roas: spend > 0 ? sales / spend : 0,
        ctr:  impr > 0 ? (clicks / impr) * 100 : 0,
        cpc:  clicks > 0 ? spend / clicks : 0,
        cvr:  clicks > 0 ? (orders / clicks) * 100 : 0,
      };
    });
}
