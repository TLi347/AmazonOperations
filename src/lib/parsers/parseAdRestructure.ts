/**
 * 解析：系统-Nordhive-*-广告活动重构
 * 77列，ASIN 视图，含每个广告活动对应的 ASIN + 核心广告指标
 */
import {
  readWorkbook,
  parseNordhiveSheet,
  inferTimeWindow,
  toNum,
  toInt,
} from "./utils";

export interface AdRestructureRow {
  asin: string;
  marketplace: string;
  campaignName: string;
  adGroupName: string;
  status: string;
  adType: string;
  budget: number;
  defaultBid: number;
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

export function parseAdRestructure(buffer: Buffer): AdRestructureRow[] {
  const wb = readWorkbook(buffer);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const { dateRange, rows } = parseNordhiveSheet(ws);
  const { timeWindow } = inferTimeWindow(dateRange);

  return rows.map((row) => {
    const asin = String(row["ASIN"] ?? "").trim();
    const clicks = toInt(row["点击量"]);
    const impr   = toInt(row["曝光量"]);
    const spend  = toNum(row["广告花费"]);
    const sales  = toNum(row["广告销售额"]);
    const orders = toInt(row["广告订单量"]);
    const acosRaw = toNum(row["ACoS"]);

    return {
      asin,
      marketplace: String(row["站点"] ?? "").trim().toUpperCase(),
      campaignName: String(row["广告活动"] ?? ""),
      adGroupName:  String(row["广告组"] ?? ""),
      status:       String(row["广告活动状态"] ?? ""),
      adType:       String(row["投放类型"] ?? ""),
      budget:       toNum(row["预算"]),
      defaultBid:   toNum(row["默认竞价"]),
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
