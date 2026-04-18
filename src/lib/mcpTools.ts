/**
 * lib/mcpTools.ts
 *
 * 进程内 MCP 工具定义（Agent SDK `tool()` + `createSdkMcpServer()`）
 * 复用 agentTools.ts 中的 executeTool() 逻辑，包装为 MCP 工具格式。
 */

import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk"
import { z } from "zod"
import { executeTool } from "./agentTools"

// ── 工具结果包装 ───────────────────────────────────────────────────────────

/** 将 executeTool 的返回值转为 MCP tool result 格式，识别 __TOOL_ERROR__ 前缀 */
function wrapResult(result: string) {
  if (result.startsWith("__TOOL_ERROR__: ")) {
    return {
      content: [{ type: "text" as const, text: result.slice("__TOOL_ERROR__: ".length) }],
      isError: true,
    }
  }
  return { content: [{ type: "text" as const, text: result }] }
}

// ── 工具定义 ───────────────────────────────────────────────────────────────

const getMetrics = tool(
  "get_metrics",
  "查询产品 KPI 快照（GMV、订单量、广告花费、ACOS、TACoS、CTR、CVR）。time_window: today=最新一天 / yesterday=前一天 / w7=近7天聚合 / w14=近14天聚合 / d30=近30天聚合",
  {
    time_window: z.enum(["today", "yesterday", "w7", "w14", "d30"]),
    asin: z.string().optional().describe("可选，不传则返回所有 ASIN 的聚合数据"),
  },
  async (args) => {
    return wrapResult(await executeTool("get_metrics", args))
  },
  { annotations: { readOnlyHint: true } }
)

const getAcosHistory = tool(
  "get_acos_history",
  "查询某 ASIN 的 ACoS + GMV 日趋势（来自 ProductMetricDay 时序表），用于分析广告效率变化趋势",
  {
    asin: z.string().describe("ASIN 编号"),
    days: z.number().optional().describe("最近 N 天，默认 30"),
  },
  async (args) => {
    return wrapResult(await executeTool("get_acos_history", args))
  },
  { annotations: { readOnlyHint: true } }
)

const getInventory = tool(
  "get_inventory",
  "查询所有 ASIN 的库存状况（可售库存量、补货建议）",
  {},
  async (args) => {
    return wrapResult(await executeTool("get_inventory", args))
  },
  { annotations: { readOnlyHint: true } }
)

const getAdCampaigns = tool(
  "get_ad_campaigns",
  "查询广告活动维度数据（来自广告活动重构报表）。filter: all=全部 / high_acos=高ACOS / over_budget=超预算 / top_spend=花费最高",
  {
    filter: z.enum(["all", "high_acos", "over_budget", "top_spend"]),
    asin: z.string().optional().describe("可选，限定某个 ASIN"),
  },
  async (args) => {
    return wrapResult(await executeTool("get_ad_campaigns", args))
  },
  { annotations: { readOnlyHint: true } }
)

const getSearchTerms = tool(
  "get_search_terms",
  "查询搜索词广告表现数据（来自搜索词重构报表）。filter: all=全部 / zero_conv=零转化词 / winner=高效词(ACoS≤35%且CVR≥4%) / high_acos=高ACOS / high_spend=高花费",
  {
    filter: z.enum(["all", "zero_conv", "winner", "high_acos", "high_spend"]),
    asin: z.string().optional().describe("可选，限定某个 ASIN"),
  },
  async (args) => {
    return wrapResult(await executeTool("get_search_terms", args))
  },
  { annotations: { readOnlyHint: true } }
)

const getAlerts = tool(
  "get_alerts",
  "查询已触发的每日告警（最新快照）。level: red=红色危急 / yellow=黄色关注 / all=全部",
  {
    level: z.enum(["all", "red", "yellow"]).describe("red=红色危急告警 / yellow=黄色关注告警 / all=全部"),
    category: z.string().optional().describe("可选，按品类过滤，如 'mattress' / 'pump' / 'scooter'"),
  },
  async (args) => {
    return wrapResult(await executeTool("get_alerts", args))
  },
  { annotations: { readOnlyHint: true } }
)

const listUploadedFiles = tool(
  "list_uploaded_files",
  "列出 context/ 中已上传的所有报表文件及其上传日期和新鲜度状态",
  {},
  async (args) => {
    return wrapResult(await executeTool("list_uploaded_files", args))
  },
  { annotations: { readOnlyHint: true } }
)

const getFileData = tool(
  "get_file_data",
  "读取任意已上传报表的原始解析数据，适用于 aba_search（ABA搜索词对比）、cost_mgmt（成本管理）、placement_us_30d（广告位报表）等无专用工具的文件类型",
  {
    file_type: z.string().describe("fileType 枚举值，如 aba_search / cost_mgmt / placement_us_30d / campaign_3m 等"),
    limit: z.number().optional().describe("返回行数上限，默认 50"),
  },
  async (args) => {
    return wrapResult(await executeTool("get_file_data", args))
  },
  { annotations: { readOnlyHint: true } }
)

// ── MCP Server ────────────────────────────────────────────────────────────

export const yzOpsMcpServer = createSdkMcpServer({
  name: "yz-ops",
  version: "1.0.0",
  tools: [
    getMetrics,
    getAcosHistory,
    getInventory,
    getAdCampaigns,
    getSearchTerms,
    getAlerts,
    listUploadedFiles,
    getFileData,
  ],
})
