/**
 * 解析：系统-Nordhive-*-广告位
 * 广告位 = 搜索结果顶部首页 / 搜索结果其余位置 / 商品页面
 */
import {
  readWorkbook,
  parseNordhiveSheet,
  inferTimeWindow,
  toNum,
  toInt,
} from "./utils";

export interface AdPlacementRow {
  campaignName: string;
  placement: string;    // "top_of_search" | "rest_of_search" | "product_page"
  bidAdjustPct: number;
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  orders: number;
  acos: number;
  timeWindow: string;
  marketplace: string;
}

const PLACEMENT_MAP: Record<string, string> = {
  "搜索结果顶部（首页）": "top_of_search",
  "搜索结果其余位置":     "rest_of_search",
  "商品页面":             "product_page",
};

export function parseAdPlacement(buffer: Buffer): AdPlacementRow[] {
  const wb = readWorkbook(buffer);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const { dateRange, rows } = parseNordhiveSheet(ws);
  const { timeWindow } = inferTimeWindow(dateRange);

  return rows.map((row) => {
    const rawPlacement = String(row["广告位"] ?? "");
    const adjRaw = String(row["竞价调整"] ?? "0").replace("%", "");

    return {
      campaignName: String(row["广告活动"] ?? ""),
      placement:    PLACEMENT_MAP[rawPlacement] ?? rawPlacement,
      bidAdjustPct: parseFloat(adjRaw) || 0,
      impressions:  toInt(row["曝光量"]),
      clicks:       toInt(row["点击量"]),
      spend:        toNum(row["广告花费"]),
      sales:        toNum(row["广告销售额"]),
      orders:       toInt(row["广告订单量"]),
      acos:         toNum(row["ACoS"]),
      timeWindow,
      marketplace:  "US",
    };
  });
}
