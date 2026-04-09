/**
 * 解析：系统-Nordhive-ALL-产品报表-SKU视图
 * 60列，含今天/昨天/上周三段快照列
 */
import {
  readWorkbook,
  parseNordhiveSheet,
  inferTimeWindow,
  toNum,
  toInt,
} from "./utils";

export interface SkuMetricRow {
  sku: string;
  asin: string;
  marketplace: string;
  timeWindow: string;

  orders: number;
  adSpend: number;
  adSales: number;
  acos: number;
  roas: number;
  ctr: number;
  cpc: number;
  impressions: number;
  clicks: number;

  // 库存相关
  daysOfSupply: number;
  availableQty: number;
  inboundQty: number;

  // 三段价格快照
  priceToday: number;
  priceYesterday: number;
  priceLastWeek: number;

  grossProfit: number;
  grossMargin: number;
}

export function parseSkuReport(buffer: Buffer): SkuMetricRow[] {
  const wb = readWorkbook(buffer);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const { dateRange, rows } = parseNordhiveSheet(ws);
  const { timeWindow } = inferTimeWindow(dateRange);

  return rows
    .filter((row) => row["SKU"] && String(row["SKU"]).trim())
    .map((row) => {
      const clicks = toInt(row["广告点击量"]);
      const impr   = toInt(row["广告曝光量"]);
      const spend  = toNum(row["广告花费"]);
      const sales  = toNum(row["广告销售额"]);
      const acosRaw = toNum(row["ACoS"]);

      return {
        sku:         String(row["SKU"] ?? "").trim(),
        asin:        String(row["ASIN"] ?? "").trim(),
        marketplace: String(row["站点"] ?? "").trim().toUpperCase(),
        timeWindow,

        orders:      toInt(row["订单量"]),
        adSpend:     spend,
        adSales:     sales,
        acos:        acosRaw > 1 ? acosRaw : acosRaw * 100,
        roas:        spend > 0 ? sales / spend : 0,
        ctr:         impr > 0 ? (clicks / impr) * 100 : 0,
        cpc:         clicks > 0 ? spend / clicks : 0,
        impressions: impr,
        clicks,

        daysOfSupply: toNum(row["预估可售天数"]),
        availableQty: toInt(row["可售库存"]),
        inboundQty:   toInt(row["在途库存-已发货"]) + toInt(row["在途库存-已创建"]),

        priceToday:     toNum(row["价格-今天"]),
        priceYesterday: toNum(row["价格-昨天"]),
        priceLastWeek:  toNum(row["价格-上周"]),

        grossProfit: toNum(row["毛利"]),
        grossMargin: toNum(row["毛利率"]),
      };
    });
}
