/**
 * 解析：系统-Nordhive-多站点-成本管理
 * 36列，SKU 维度，FBA/FBM 利润率及各费用占比
 */
import {
  readWorkbook,
  parseNordhiveSheet,
  toNum,
} from "./utils";

export interface CostMgmtRow {
  sku: string;
  asin: string;
  marketplace: string;
  sellingPrice: number;

  // FBA
  fbaProfit: number;
  fbaProfitRate: number;
  fbaTotalCost: number;
  fbaLogisticsPct: number;   // 物流占比
  fbaReferralPct: number;    // 佣金占比

  // FBM
  fbmProfit: number;
  fbmProfitRate: number;

  // 采购
  cogsPct: number;           // 采购占比
  fbaHeadFreightPct: number; // 头程占比

  updatedAt: string;
}

export function parseCostMgmt(buffer: Buffer): CostMgmtRow[] {
  const wb = readWorkbook(buffer);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const { rows } = parseNordhiveSheet(ws);

  return rows
    .filter((row) => row["SKU"] && String(row["SKU"]).trim())
    .map((row) => ({
      sku:          String(row["SKU"] ?? "").trim(),
      asin:         String(row["ASIN"] ?? "").trim(),
      marketplace:  String(row["站点"] ?? "").trim().toUpperCase(),
      sellingPrice: toNum(row["价格"]),

      fbaProfit:        toNum(row["FBA利润"]),
      fbaProfitRate:    toNum(row["FBA利润率"]),
      fbaTotalCost:     toNum(row["FBA总成本"]),
      fbaLogisticsPct:  toNum(row["FBA物流占比"]),
      fbaReferralPct:   toNum(row["FBA佣金占比"]),

      fbmProfit:        toNum(row["FBM利润"]),
      fbmProfitRate:    toNum(row["FBM利润率"]),

      cogsPct:          toNum(row["采购占比"]),
      fbaHeadFreightPct: toNum(row["FBA平均头程费用占比"]),

      updatedAt: String(row["修改时间"] ?? row["最近更新时间"] ?? ""),
    }));
}
