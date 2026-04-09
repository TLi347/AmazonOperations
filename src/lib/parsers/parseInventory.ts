/**
 * 解析：系统-Nordhive-多站点-库存报表
 * 60列，SKU 维度，库存健康度 + 库龄分布 + 在途
 */
import {
  readWorkbook,
  parseNordhiveSheet,
  toNum,
  toInt,
  fuzzyGet,
} from "./utils";

export interface InventoryRow {
  sku: string;
  asin: string;
  marketplace: string;

  availableQty: number;
  unavailableQty: number;
  reservedQty: number;
  inboundCreated: number;   // 在途-已创建
  inboundShipped: number;   // 在途-已发货
  inboundReceiving: number; // 在途-接收中
  inboundQty: number;       // 合计

  inventoryValue: number;
  inventoryCost: number;

  // 库存健康
  daysOfSupply: number;     // 预估可售天数（需从 ASIN 报表导入，此处若有则用）
  turnoverRatio: number;    // 库销比

  monthlyStorageFee: number;
  longTermStorageFee: number;

  // 库龄分布（数量）
  aged0_30: number;
  aged31_60: number;
  aged61_90: number;
  aged91_180: number;
  aged181_330: number;
  aged331_365: number;
  aged365Plus: number;
}

export function parseInventory(buffer: Buffer): InventoryRow[] {
  const wb = readWorkbook(buffer);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const { rows } = parseNordhiveSheet(ws);

  return rows
    .filter((row) => row["SKU"] && String(row["SKU"]).trim())
    .map((row) => {
      const inboundCreated  = toInt(fuzzyGet(row, ["在途库存-已创建"]));
      const inboundShipped  = toInt(fuzzyGet(row, ["在途库存-已发货"]));
      const inboundReceiving = toInt(fuzzyGet(row, ["在途库存-接收中"]));

      return {
        sku:          String(row["SKU"] ?? "").trim(),
        asin:         String(row["ASIN"] ?? "").trim(),
        marketplace:  String(row["站点"] ?? "").trim().toUpperCase(),

        availableQty:  toInt(row["可售库存"]),
        unavailableQty: toInt(row["不可售库存"]),
        reservedQty:   toInt(row["预留库存"]),
        inboundCreated,
        inboundShipped,
        inboundReceiving,
        inboundQty: inboundCreated + inboundShipped + inboundReceiving,

        inventoryValue: toNum(row["库存货值"]),
        inventoryCost:  toNum(row["库存成本"]),

        daysOfSupply:  0, // 库存报表无此列，从 ASIN 报表填充
        turnoverRatio: toNum(row["库销比"]),

        monthlyStorageFee:  toNum(row["月度仓储费"]),
        longTermStorageFee: toNum(fuzzyGet(row, ["长期仓储费 已收取", "长期仓储费"])),

        aged0_30:   toInt(row["0-30天库存"]),
        aged31_60:  toInt(row["31-60天库存"]),
        aged61_90:  toInt(row["61-90天库存"]),
        aged91_180: toInt(row["91-180天库存"]),
        aged181_330: toInt(row["181-330天库存"]),
        aged331_365: toInt(row["331-365天库存"]),
        aged365Plus: toInt(row["大于365天库存"]),
      };
    });
}
