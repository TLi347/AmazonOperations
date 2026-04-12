/**
 * lib/agentTools.ts
 *
 * Claude 工具定义（TOOL_DEFINITIONS）+ 服务端工具执行（executeTool）
 * 所有工具通过查询 SQLite DB 返回 JSON 字符串给 Claude。
 */

import Anthropic from "@anthropic-ai/sdk"
import { db } from "@/lib/db"

// ── 新鲜度计算 ─────────────────────────────────────────────────────────────

const FRESHNESS_THRESHOLDS: Record<string, { fresh: number; ok: number }> = {
  product:          { fresh: 1,  ok: 2  },
  keyword_monitor:  { fresh: 2,  ok: 7  },
  search_terms:     { fresh: 5,  ok: 14 },
  campaign_3m:      { fresh: 10, ok: 45 },
  us_campaign_30d:  { fresh: 5,  ok: 10 },
  placement_us_30d: { fresh: 5,  ok: 10 },
  inventory:        { fresh: 3,  ok: 7  },
  cost_mgmt:        { fresh: 30, ok: 60 },
  aba_search:       { fresh: 30, ok: 90 },
}

export function getFreshness(
  fileType: string,
  uploadDate: Date
): "fresh" | "ok" | "stale" {
  const daysAgo = (Date.now() - uploadDate.getTime()) / 86400000
  const t = FRESHNESS_THRESHOLDS[fileType]
  if (!t) return "ok"
  if (daysAgo <= t.fresh) return "fresh"
  if (daysAgo <= t.ok)    return "ok"
  return "stale"
}

// ── 工具定义 ───────────────────────────────────────────────────────────────

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: "get_metrics",
    description: "查询产品 KPI 快照（GMV、订单量、广告花费、ACOS、TACoS、CTR、CVR）。time_window: today=最新一天 / yesterday=前一天 / w7=近7天聚合 / w14=近14天聚合 / d30=近30天聚合",
    input_schema: {
      type: "object",
      properties: {
        time_window: {
          type: "string",
          enum: ["today", "yesterday", "w7", "w14", "d30"],
        },
        asin: {
          type: "string",
          description: "可选，不传则返回所有 ASIN 的聚合数据",
        },
      },
      required: ["time_window"],
    },
  },
  {
    name: "get_acos_history",
    description: "查询某 ASIN 的 ACoS + GMV 日趋势（来自 ProductMetricDay 时序表），用于分析广告效率变化趋势",
    input_schema: {
      type: "object",
      properties: {
        asin: { type: "string", description: "ASIN 编号" },
        days: { type: "number", description: "最近 N 天，默认 30" },
      },
      required: ["asin"],
    },
  },
  {
    name: "get_inventory",
    description: "查询所有 ASIN 的库存状况（可售库存量、补货建议）",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_ad_campaigns",
    description: "查询广告活动维度数据（来自广告活动重构报表）。filter: all=全部 / high_acos=高ACOS / over_budget=超预算 / top_spend=花费最高",
    input_schema: {
      type: "object",
      properties: {
        filter: {
          type: "string",
          enum: ["all", "high_acos", "over_budget", "top_spend"],
        },
        asin: { type: "string", description: "可选，限定某个 ASIN" },
      },
      required: ["filter"],
    },
  },
  {
    name: "get_search_terms",
    description: "查询搜索词广告表现数据（来自搜索词重构报表）。filter: all=全部 / zero_conv=零转化词 / winner=高效词(ACoS≤35%且CVR≥4%) / high_acos=高ACOS / high_spend=高花费",
    input_schema: {
      type: "object",
      properties: {
        filter: {
          type: "string",
          enum: ["all", "zero_conv", "winner", "high_acos", "high_spend"],
        },
        asin: { type: "string", description: "可选，限定某个 ASIN" },
      },
      required: ["filter"],
    },
  },
  {
    name: "get_alerts",
    description: "查询已触发的每日告警（最新快照）。level: red=红色危急 / yellow=黄色关注 / all=全部",
    input_schema: {
      type: "object",
      properties: {
        level: {
          type: "string",
          enum: ["all", "red", "yellow"],
          description: "red=红色危急告警 / yellow=黄色关注告警 / all=全部",
        },
        category: {
          type: "string",
          description: "可选，按品类过滤，如 'mattress' / 'pump' / 'scooter'",
        },
      },
      required: ["level"],
    },
  },
  {
    name: "list_uploaded_files",
    description: "列出 context/ 中已上传的所有报表文件及其上传日期和新鲜度状态",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_file_data",
    description: "读取任意已上传报表的原始解析数据，适用于 aba_search（ABA搜索词对比）、cost_mgmt（成本管理）、placement_us_30d（广告位报表）等无专用工具的文件类型",
    input_schema: {
      type: "object",
      properties: {
        file_type: {
          type: "string",
          description: "fileType 枚举值，如 aba_search / cost_mgmt / placement_us_30d / campaign_3m 等",
        },
        limit: {
          type: "number",
          description: "返回行数上限，默认 50",
        },
      },
      required: ["file_type"],
    },
  },
]

// ── 工具执行 ───────────────────────────────────────────────────────────────

export async function executeTool(
  name:  string,
  input: Record<string, unknown>
): Promise<string> {
  try {
    switch (name) {

      // ── get_metrics ──────────────────────────────────────────────────────
      case "get_metrics": {
        const tw = input.time_window as string

        // today / yesterday: 取最近 N 条不同日期的记录
        if (tw === "today" || tw === "yesterday") {
          const offset = tw === "yesterday" ? 1 : 0
          // 取所有 ASIN 最新（或次新）日期
          const distinctDates = await db.productMetricDay.findMany({
            distinct:  ["date"],
            orderBy:   { date: "desc" },
            select:    { date: true },
            take:      2,
          })
          const targetDate = distinctDates[offset]?.date
          if (!targetDate) return JSON.stringify({ error: `暂无${tw === "today" ? "今日" : "昨日"}数据` })

          const where = input.asin
            ? { asin: input.asin as string, date: targetDate }
            : { date: targetDate }
          const rows = await db.productMetricDay.findMany({ where })
          return JSON.stringify(aggregateMetrics(rows, targetDate))
        }

        // w7 / w14 / d30: 聚合多天
        const daysMap: Record<string, number> = { w7: 7, w14: 14, d30: 30 }
        const numDays = daysMap[tw] ?? 7

        const latest = await db.productMetricDay.findFirst({
          orderBy: { date: "desc" },
          select:  { date: true },
        })
        if (!latest) return JSON.stringify({ error: "暂无数据，请先上传产品报表" })

        const fromDate = subtractDays(latest.date, numDays - 1)
        const where = input.asin
          ? { asin: input.asin as string, date: { gte: fromDate } }
          : { date: { gte: fromDate } }
        const rows = await db.productMetricDay.findMany({ where })
        return JSON.stringify(aggregateMetrics(rows, `${fromDate} ~ ${latest.date}`))
      }

      // ── get_acos_history ─────────────────────────────────────────────────
      case "get_acos_history": {
        const asin = input.asin as string
        const days = (input.days as number) ?? 30
        const latest = await db.productMetricDay.findFirst({
          orderBy: { date: "desc" },
          select:  { date: true },
        })
        if (!latest) return JSON.stringify({ error: "暂无数据" })

        const fromDate = subtractDays(latest.date, days - 1)
        const rows = await db.productMetricDay.findMany({
          where:   { asin, date: { gte: fromDate } },
          orderBy: { date: "asc" },
        })
        if (rows.length === 0) return JSON.stringify({ error: `ASIN ${asin} 无历史数据` })

        return JSON.stringify(rows.map(r => {
          const m = JSON.parse(r.metrics) as Record<string, number>
          return {
            date:    r.date,
            gmv:     m.gmv,
            orders:  m.orders,
            ad_spend: m.ad_spend,
            acos:    m.ad_sales > 0 ? m.ad_spend / m.ad_sales : null,
            tacos:   m.gmv       > 0 ? m.ad_spend / m.gmv       : null,
          }
        }))
      }

      // ── get_inventory ─────────────────────────────────────────────────────
      case "get_inventory": {
        const file = await db.contextFile.findUnique({ where: { fileType: "inventory" } })
        if (!file) return JSON.stringify({ error: "库存报表未上传，请上传「库存报表」文件" })
        return JSON.stringify({ rows: JSON.parse(file.parsedRows), snapshotDate: file.snapshotDate })
      }

      // ── get_ad_campaigns ─────────────────────────────────────────────────
      case "get_ad_campaigns": {
        const file = await db.contextFile.findUnique({ where: { fileType: "campaign_3m" } })
        if (!file) return JSON.stringify({ error: "广告活动重构报表未上传" })

        let rows = JSON.parse(file.parsedRows) as Array<Record<string, unknown>>
        if (input.asin) rows = rows.filter(r => r.asin === input.asin)

        const filter = input.filter as string
        if (filter === "high_acos") {
          rows = rows.filter(r => ((r.acos as number) ?? 0) > 0.6)
        } else if (filter === "over_budget") {
          rows = rows.filter(r => {
            const spend  = (r.spend  as number) ?? 0
            const budget = (r.budget as number) ?? 0
            return budget > 0 && spend > budget
          })
        } else if (filter === "top_spend") {
          rows = rows.sort((a, b) => ((b.spend as number) ?? 0) - ((a.spend as number) ?? 0)).slice(0, 20)
        }

        return JSON.stringify({ rows: rows.slice(0, 50), snapshotDate: file.snapshotDate })
      }

      // ── get_search_terms ──────────────────────────────────────────────────
      case "get_search_terms": {
        const file = await db.contextFile.findUnique({ where: { fileType: "search_terms" } })
        if (!file) return JSON.stringify({ error: "搜索词重构报表未上传" })

        let rows = JSON.parse(file.parsedRows) as Array<Record<string, unknown>>
        if (input.asin) rows = rows.filter(r => r.asin === input.asin)

        const filter = input.filter as string
        if (filter === "zero_conv") {
          rows = rows.filter(r => ((r.clicks as number) ?? 0) >= 5 && ((r.orders as number) ?? 0) === 0)
        } else if (filter === "winner") {
          // conversion_rate = 广告CVR（广告订单量 ÷ 点击量），来自搜索词重构报表；
          // 非产品报表的 OCR（页面转化率 = 订单量 ÷ Sessions），两者含义不同
          rows = rows.filter(r => {
            const acos = (r.acos as number) ?? 999
            const cvr  = (r.cvr  as number) ?? (r.conversion_rate as number) ?? 0
            return acos < 0.35 && cvr >= 0.04
          })
        } else if (filter === "high_acos") {
          rows = rows.filter(r => ((r.acos as number) ?? 0) > 0.8)
        } else if (filter === "high_spend") {
          rows = rows.sort((a, b) => ((b.spend as number) ?? 0) - ((a.spend as number) ?? 0))
        }

        return JSON.stringify({ rows: rows.slice(0, 50), snapshotDate: file.snapshotDate })
      }

      // ── get_alerts ────────────────────────────────────────────────────────
      case "get_alerts": {
        const latest = await db.alert.findFirst({ orderBy: { snapshotDate: "desc" }, select: { snapshotDate: true } })
        if (!latest) return JSON.stringify({ error: "暂无告警数据，请先上传产品报表" })

        const alerts = await db.alert.findMany({
          where: {
            snapshotDate: latest.snapshotDate,
            ...(input.level && input.level !== "all" ? { level: input.level as string } : {}),
            ...(input.category ? { categoryKey: input.category as string } : {}),
          },
          orderBy: { level: "asc" },  // "red" 字母序先于 "yellow"
          take: 100,
        })
        return JSON.stringify({ alerts, snapshotDate: latest.snapshotDate })
      }

      // ── list_uploaded_files ───────────────────────────────────────────────
      case "list_uploaded_files": {
        const files = await db.contextFile.findMany({ orderBy: { uploadDate: "desc" } })
        return JSON.stringify(
          files.map(f => ({
            fileType:    f.fileType,
            fileName:    f.fileName,
            snapshotDate: f.snapshotDate,
            freshness:   getFreshness(f.fileType, f.uploadDate),
          }))
        )
      }

      // ── get_file_data ─────────────────────────────────────────────────────
      case "get_file_data": {
        const fileType = input.file_type as string
        if (!fileType) return JSON.stringify({ error: "缺少 file_type 参数" })

        const file = await db.contextFile.findUnique({ where: { fileType } })
        if (!file) return JSON.stringify({ error: `文件类型 "${fileType}" 未上传` })

        const limit = (input.limit as number) ?? 50
        const allRows = JSON.parse(file.parsedRows) as unknown[]
        return JSON.stringify({
          fileType,
          snapshotDate: file.snapshotDate,
          total:    allRows.length,
          showing:  Math.min(limit, allRows.length),
          rows:     allRows.slice(0, limit),
        })
      }

      default:
        return JSON.stringify({ error: `未知工具: ${name}` })
    }
  } catch (err) {
    return JSON.stringify({ error: `工具执行出错: ${err instanceof Error ? err.message : String(err)}` })
  }
}

// ── 内部工具函数 ───────────────────────────────────────────────────────────

/** 聚合多条 ProductMetricDay 为汇总指标 */
function aggregateMetrics(
  rows:  Array<{ metrics: string }>,
  label: string = ""
): Record<string, unknown> {
  if (rows.length === 0) return { error: "无数据" }

  const totals = rows.reduce(
    (acc, row) => {
      const m = JSON.parse(row.metrics) as Record<string, number>
      return {
        gmv:         acc.gmv         + (m.gmv         ?? 0),
        orders:      acc.orders      + (m.orders      ?? 0),
        units:       acc.units       + (m.units       ?? 0),
        ad_spend:    acc.ad_spend    + (m.ad_spend    ?? 0),
        ad_sales:    acc.ad_sales    + (m.ad_sales    ?? 0),
        ad_orders:   acc.ad_orders   + (m.ad_orders   ?? 0),
        impressions: acc.impressions + (m.impressions ?? 0),
        clicks:      acc.clicks      + (m.clicks      ?? 0),
        sessions:    acc.sessions    + (m.sessions    ?? 0),
      }
    },
    { gmv: 0, orders: 0, units: 0, ad_spend: 0, ad_sales: 0, ad_orders: 0, impressions: 0, clicks: 0, sessions: 0 }
  )

  return {
    period:      label,
    day_count:   rows.length,
    ...totals,
    acos:   totals.ad_sales   > 0 ? +(totals.ad_spend   / totals.ad_sales).toFixed(4)   : null,
    tacos:  totals.gmv        > 0 ? +(totals.ad_spend   / totals.gmv).toFixed(4)        : null,
    ctr:    totals.impressions > 0 ? +(totals.clicks     / totals.impressions).toFixed(5) : null,
    cvr:    totals.clicks     > 0 ? +(totals.ad_orders  / totals.clicks).toFixed(4)     : null,
    cpc:    totals.clicks     > 0 ? +(totals.ad_spend   / totals.clicks).toFixed(2)     : null,
    roas:   totals.ad_spend   > 0 ? +(totals.ad_sales   / totals.ad_spend).toFixed(2)   : null,
  }
}

/** YYYY-MM-DD 日期减 N 天 */
function subtractDays(dateStr: string, n: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}
