/**
 * 解析：系统-Nordhive-*-广告活动
 * 73列，存关键指标 + 完整 JSON blob
 */
import {
  readWorkbook,
  parseNordhiveSheet,
  inferTimeWindow,
  toNum,
  toInt,
  toDate,
} from "./utils";

export interface AdCampaignRow {
  campaignName: string;
  status: string;
  adType: string;        // SP / SD
  biddingStrategy: string;
  budget: number;
  startDate: Date | null;
  marketplace: string;
  timeWindow: string;

  impressions: number;
  clicks: number;
  spend: number;
  ctr: number;
  cpc: number;
  orders: number;
  sales: number;
  acos: number;
  roas: number;
  cvr: number;

  rawJson: string; // 完整行序列化，供 AI 查询
}

export function parseAdCampaign(buffer: Buffer): AdCampaignRow[] {
  const wb = readWorkbook(buffer);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const { dateRange, rows } = parseNordhiveSheet(ws);
  const { timeWindow } = inferTimeWindow(dateRange);

  // 从 filter row 取站点
  const raw = Object.values(wb.Sheets[wb.SheetNames[0]]);
  const marketplace = "US"; // default, override if detectable

  return rows.map((row) => {
    const clicks = toInt(row["点击量"]);
    const impr   = toInt(row["曝光量"]);
    const spend  = Math.abs(toNum(row["广告花费"]));
    const sales  = toNum(row["广告销售额"]);
    const orders = toInt(row["广告订单量"]);

    return {
      campaignName:    String(row["广告活动"] ?? ""),
      status:          String(row["运行状态"] ?? ""),
      adType:          String(row["投放类型"] ?? ""),
      biddingStrategy: String(row["竞价策略"] ?? ""),
      budget:          toNum(row["每日预算"]),
      startDate:       toDate(row["开始日期"]),
      marketplace,
      timeWindow,

      impressions: impr,
      clicks,
      spend,
      ctr:  impr > 0 ? (clicks / impr) * 100 : 0,
      cpc:  clicks > 0 ? spend / clicks : 0,
      orders,
      sales,
      acos: sales > 0 ? (spend / sales) * 100 : 0,
      roas: spend > 0 ? sales / spend : 0,
      cvr:  clicks > 0 ? (orders / clicks) * 100 : 0,

      rawJson: JSON.stringify(row),
    };
  });
}
