/**
 * lib/parsers/index.ts
 *
 * 统一 parser 入口，供 POST /api/upload 调用。
 * 每个 fileType 对应一个函数，统一返回 { rows, snapshotDate }。
 *
 * product 类型单独处理（写 ProductMetricDay），其他写 ContextFile。
 */

import { readWorkbook, sheetToRows } from "./utils"
import { parseAsinReport }   from "./parseAsinReport"
import { parseSearchTerm }   from "./parseSearchTerm"
import { parseAdRestructure } from "./parseAdRestructure"
import { parseAdCampaign }   from "./parseAdCampaign"
import { parseAdPlacement }  from "./parseAdPlacement"
import { parseInventory }    from "./parseInventory"
import { parseCostMgmt }     from "./parseCostMgmt"
import { parseAbaSearch }    from "./parseAbaSearch"
import type { FileType }     from "./identifier"

// ── 类型定义 ─────────────────────────────────────────────────────────────

/** 产品报表每日指标（仅原始计数，不含推导比率；但含报表原始比率字段） */
export interface ProductMetricRecord {
  asin: string
  metrics: {
    gmv:          number
    orders:       number
    units:        number
    ad_spend:     number   // 取绝对值（Nordhive原始值为负）
    ad_sales:     number
    ad_orders:    number
    impressions:  number
    clicks:       number
    sessions:     number
    ocr:          number   // orders / sessions，间接替代 Buy Box 占比监控
    refund_rate:  number   // 报表原始字段「退款率」，告警引擎直接使用
  }
}

export interface ProductParseResult {
  rows: ProductMetricRecord[]
  snapshotDate: string   // 报表结束日期，格式 "2026-04-08"
}

export interface ContextParseResult {
  rows: unknown[]
  snapshotDate: string
}

// ── 辅助函数 ─────────────────────────────────────────────────────────────

/**
 * 从 Nordhive 格式工作簿的 D2 单元格提取快照日期（报表结束日期）。
 * 格式："2026-03-08 - 2026-04-06" → "2026-04-06"
 */
function extractSnapshotDate(buffer: Buffer): string {
  const wb  = readWorkbook(buffer)
  const ws  = wb.Sheets[wb.SheetNames[0]]
  const raw = sheetToRows(ws)
  const dateRange = (raw[1]?.[3] as string) ?? ""
  const parts = dateRange.split(" - ")
  return (parts[1] ?? parts[0] ?? "").trim()
}

// ── 产品报表专用 parser ───────────────────────────────────────────────────

/**
 * 解析产品报表 → ProductMetricRecord[]
 *
 * 从 parseAsinReport 的输出中提取原始计数字段，
 * 过滤无效 ASIN，按 ASIN 去重（US 站点优先）。
 */
export function parseProduct(buffer: Buffer): ProductParseResult {
  const snapshotDate = extractSnapshotDate(buffer)
  const rawRows = parseAsinReport(buffer)

  // 按 ASIN 去重：US 站点优先，其次取第一条
  const byAsin = new Map<string, (typeof rawRows)[0]>()
  for (const row of rawRows) {
    if (!row.asin || !row.asin.startsWith("B0")) continue
    const existing = byAsin.get(row.asin)
    if (!existing || row.marketplace === "US") {
      byAsin.set(row.asin, row)
    }
  }

  const rows: ProductMetricRecord[] = Array.from(byAsin.values()).map(r => ({
    asin: r.asin,
    metrics: {
      gmv:          r.gmv,
      orders:       r.orders,
      units:        r.units,
      ad_spend:     r.adSpend,   // parseAsinReport 已做 Math.abs
      ad_sales:     r.adSales,
      ad_orders:    r.adOrders,
      impressions:  r.impressions,
      clicks:       r.clicks,
      sessions:     r.sessions,
      ocr:          r.sessions > 0 ? r.orders / r.sessions : 0,
      refund_rate:  r.refundRate,  // 报表原始「退款率」字段
    },
  }))

  return { rows, snapshotDate }
}

// ── ContextFile parsers ───────────────────────────────────────────────────

type ContextParser = (buffer: Buffer, filename?: string) => ContextParseResult

/** fileType → parser 映射（不含 product / keyword_monitor / unknown） */
export const contextParsers: Partial<Record<FileType, ContextParser>> = {
  search_terms: (buf) => ({
    rows:         parseSearchTerm(buf),
    snapshotDate: extractSnapshotDate(buf),
  }),
  campaign_3m: (buf) => ({
    rows:         parseAdRestructure(buf),
    snapshotDate: extractSnapshotDate(buf),
  }),
  us_campaign_30d: (buf) => ({
    rows:         parseAdCampaign(buf),
    snapshotDate: extractSnapshotDate(buf),
  }),
  placement_us_30d: (buf) => ({
    rows:         parseAdPlacement(buf),
    snapshotDate: extractSnapshotDate(buf),
  }),
  inventory: (buf) => ({
    rows:         parseInventory(buf),
    snapshotDate: extractSnapshotDate(buf),
  }),
  cost_mgmt: (buf) => ({
    rows:         parseCostMgmt(buf),
    snapshotDate: extractSnapshotDate(buf),
  }),
  aba_search: (buf, filename = "") => {
    // ABA 文件无 Nordhive 日期行，日期从文件名中提取
    const dateMatch = filename.match(/(\d{4})(\d{2})(\d{2})/)
    const snapshotDate = dateMatch
      ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
      : new Date().toISOString().slice(0, 10)
    return {
      rows:         parseAbaSearch(buf, filename),
      snapshotDate,
    }
  },
  // keyword_monitor: 暂无 parser，上传时返回错误
}
