# 04 — Chat 实现

[← 返回索引](./index.md)

> 对应功能设计：`功能数据流/06-Chat功能.md`

---

## 架构概述

Chat 使用 **Claude Agentic Loop**：服务端与 Claude 来回循环调用，直到 Claude 返回最终文字回答，全程通过 **SSE（Server-Sent Events）** 流式推送到前端。

```
前端 ChatPanel
  │  POST /api/agent  { messages, systemPrompt }
  │
  ▼
/api/agent/route.ts
  │
  ├── while (Claude 返回 tool_use) {
  │     ├── Claude API call（非流式，工具调用阶段）
  │     ├── 执行工具（查 DB，返回 JSON 字符串）
  │     └── 追加 tool_result，继续循环（最多 10 次）
  │   }
  │
  └── Claude API call（流式，最终回答）
        → 逐 chunk 写入 SSE 响应
        → 前端逐字渲染
```

---

## 一、SSE 响应格式

```ts
// /api/agent/route.ts
export async function POST(req: Request) {
  const { messages, systemPrompt } = await req.json()

  const stream = new TransformStream()
  const writer = stream.writable.getWriter()
  const encoder = new TextEncoder()

  const send = (data: object) =>
    writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

  // 异步执行 agentic loop
  ;(async () => {
    try {
      const result = await runAgentLoop(messages, systemPrompt, send)
      await send({ type: "done" })
    } catch (e) {
      await send({ type: "error", message: String(e) })
    } finally {
      await writer.close()
    }
  })()

  return new Response(stream.readable, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection":    "keep-alive",
    },
  })
}
```

**SSE 事件类型**：

| type | 含义 | 额外字段 |
|------|------|---------|
| `text_delta` | 流式文字片段 | `delta: string` |
| `tool_start` | 开始执行工具 | `tool: string` |
| `tool_done` | 工具执行完毕 | `tool: string` |
| `done` | 回答结束 | — |
| `error` | 出错 | `message: string` |

---

## 二、Agentic Loop 实现

```ts
// lib/agentLoop.ts

const MAX_ITERATIONS = 10

async function runAgentLoop(
  messages:     Anthropic.MessageParam[],
  systemPrompt: string,
  onEvent:      (event: object) => void
): Promise<void> {
  const client = new Anthropic()
  let history  = [...messages]

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 4096,
      system:     systemPrompt,
      tools:      TOOL_DEFINITIONS,
      messages:   history,
    })

    // 情况1：Claude 要调用工具
    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(b => b.type === "tool_use")

      // 追加 Claude 的回复到历史
      history.push({ role: "assistant", content: response.content })

      // 执行所有工具（可并行）
      const toolResults = await Promise.all(
        toolUseBlocks.map(async (block) => {
          onEvent({ type: "tool_start", tool: block.name })
          const result = await executeTool(block.name, block.input)
          onEvent({ type: "tool_done", tool: block.name })
          return {
            type:        "tool_result" as const,
            tool_use_id: block.id,
            content:     result,
          }
        })
      )

      // 追加工具结果到历史
      history.push({ role: "user", content: toolResults })
      continue  // 继续循环
    }

    // 情况2：Claude 返回最终文字
    if (response.stop_reason === "end_turn") {
      // response.content 中已包含完整文字，直接提取并发送 SSE
      // 不再发起第二次 API 调用（重复调用会产生不同内容且浪费费用）
      for (const block of response.content) {
        if (block.type === "text") {
          onEvent({ type: "text_delta", delta: block.text })
        }
      }
      return
    }
  }

  throw new Error("超过最大工具调用次数（10次）")
}
```

---

## 三、工具定义（8 个）

```ts
// lib/agentTools.ts

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: "get_metrics",
    description: "查询产品 KPI 快照。time_window: today/yesterday/w7/w14/d30",
    input_schema: {
      type: "object",
      properties: {
        time_window: { type: "string", enum: ["today", "yesterday", "w7", "w14", "d30"] },
        asin:        { type: "string", description: "可选，不传则返回所有 ASIN 的聚合数据" },
      },
      required: ["time_window"],
    },
  },
  {
    name: "get_acos_history",
    description: "查询某 ASIN 的 ACoS 日趋势（从 ProductMetricDay 时序表）",
    input_schema: {
      type: "object",
      properties: {
        asin: { type: "string" },
        days: { type: "number", description: "最近 N 天，默认 30" },
      },
      required: ["asin"],
    },
  },
  {
    name: "get_inventory",
    description: "查询所有 ASIN 的库存状况（可售天数、补货建议）",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_ad_campaigns",
    description: "查询广告活动数据",
    input_schema: {
      type: "object",
      properties: {
        filter: {
          type: "string",
          enum: ["all", "high_acos", "over_budget", "top_spend"],
          description: "all=全部 / high_acos=高ACOS / over_budget=超预算 / top_spend=花费最高",
        },
        asin: { type: "string", description: "可选，限定某个 ASIN" },
      },
      required: ["filter"],
    },
  },
  {
    name: "get_search_terms",
    description: "查询搜索词转化数据",
    input_schema: {
      type: "object",
      properties: {
        filter: {
          type: "string",
          enum: ["all", "zero_conv", "winner", "high_acos", "high_spend"],
          description: "zero_conv=零转化 / winner=高效词 / high_acos=高ACOS / high_spend=高花费",
        },
        asin: { type: "string", description: "可选" },
      },
      required: ["filter"],
    },
  },
  {
    name: "get_alerts",
    description: "查询已触发的每日告警（最新一次快照）。level: red=红色危急 / yellow=黄色关注 / all=全部",
    input_schema: {
      type: "object",
      properties: {
        level: {
          type: "string",
          enum: ["all", "red", "yellow"],
          description: "red=红色危急告警 / yellow=黄色关注告警 / all=全部",
        },
        category: { type: "string", description: "可选，按品类过滤，如 'mattress'" },
      },
      required: ["level"],
    },
  },
  {
    name: "list_uploaded_files",
    description: "列出 context/ 中已上传的所有文件及其上传日期和新鲜度",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_file_data",
    description: "读取任意已上传文件的原始解析数据（用于不属于上方专用工具的文件类型，如 ABA 搜索词、成本管理）",
    input_schema: {
      type: "object",
      properties: {
        file_type: { type: "string", description: "fileType 枚举值" },
        limit:     { type: "number", description: "返回行数上限，默认 50" },
      },
      required: ["file_type"],
    },
  },
]
```

---

## 四、工具执行实现

```ts
// lib/agentTools.ts

export async function executeTool(name: string, input: any): Promise<string> {
  switch (name) {

    case "get_metrics": {
      const days    = timeWindowToDays(input.time_window)
      const fromDate = daysAgo(days)
      const where   = input.asin
        ? { asin: input.asin, date: { gte: fromDate } }
        : { date: { gte: fromDate } }
      const rows = await db.productMetricDay.findMany({ where })
      return JSON.stringify(aggregateMetrics(rows))
    }

    case "get_acos_history": {
      const days = input.days ?? 30
      const rows = await db.productMetricDay.findMany({
        where:   { asin: input.asin, date: { gte: daysAgo(days) } },
        orderBy: { date: "asc" },
      })
      return JSON.stringify(rows.map(r => {
        const m = r.metrics as any
        return {
          date:    r.date,
          adSpend: m.ad_spend,
          // metrics 只存原始计数，acos 在此处计算
          acos: m.ad_sales > 0 ? m.ad_spend / m.ad_sales : null,
        }
      }))
    }

    case "get_inventory": {
      const file = await db.contextFile.findUnique({ where: { fileType: "inventory" } })
      if (!file) return JSON.stringify({ error: "库存报表未上传" })
      return JSON.stringify(file.parsedRows)
    }

    case "get_ad_campaigns": {
      const file = await db.contextFile.findUnique({ where: { fileType: "campaign_3m" } })
      if (!file) return JSON.stringify({ error: "广告活动重构报表未上传" })
      let rows = file.parsedRows as any[]
      if (input.asin)              rows = rows.filter(r => r.asin === input.asin)
      if (input.filter === "high_acos")   rows = rows.filter(r => r.acos > 0.6)
      if (input.filter === "over_budget") rows = rows.filter(r => r.spend > r.daily_budget)
      if (input.filter === "top_spend")   rows = rows.sort((a, b) => b.spend - a.spend).slice(0, 20)
      return JSON.stringify(rows)
    }

    case "get_search_terms": {
      const file = await db.contextFile.findUnique({ where: { fileType: "search_terms" } })
      if (!file) return JSON.stringify({ error: "搜索词重构报表未上传" })
      let rows = file.parsedRows as any[]
      if (input.asin)                  rows = rows.filter(r => r.asin === input.asin)
      if (input.filter === "zero_conv")  rows = rows.filter(r => r.ad_orders === 0 && r.clicks >= 5)
      if (input.filter === "winner")     rows = rows.filter(r => r.acos < 0.35 && r.conversion_rate >= 0.04)
      // ↑ conversion_rate 是广告CVR（广告订单量 ÷ 点击量），来自搜索词重构报表；
      //   非产品报表的 OCR（页面转化率 = 订单量 ÷ Sessions），两者含义不同
      if (input.filter === "high_acos")  rows = rows.filter(r => r.acos > 0.8)
      if (input.filter === "high_spend") rows = rows.sort((a, b) => b.spend - a.spend).slice(0, 30)
      return JSON.stringify(rows)
    }

    case "get_alerts": {
      // 取最新一次的 snapshotDate，避免拉到历史过期告警
      const latest = await db.alert.findFirst({ orderBy: { snapshotDate: "desc" } })
      if (!latest) return JSON.stringify({ error: "暂无告警数据，请先上传产品报表" })

      const where: any = { snapshotDate: latest.snapshotDate }
      if (input.level && input.level !== "all") where.level = input.level      // "red" | "yellow"
      if (input.category) where.categoryKey = input.category

      const alerts = await db.alert.findMany({
        where,
        orderBy: { level: "asc" },   // "red" 字母序先于 "yellow"，危急优先展示
        take: 100,
      })
      return JSON.stringify(alerts)
    }

    case "list_uploaded_files": {
      const files = await db.contextFile.findMany({ orderBy: { uploadDate: "desc" } })
      return JSON.stringify(
        files.map(f => ({
          fileType:    f.fileType,
          fileName:    f.fileName,
          uploadDate:  f.uploadDate,
          snapshotDate: f.snapshotDate,
          freshness:   getFreshness(f.fileType, f.uploadDate),
        }))
      )
    }

    case "get_file_data": {
      const file = await db.contextFile.findUnique({ where: { fileType: input.file_type } })
      if (!file) return JSON.stringify({ error: `文件类型 ${input.file_type} 未上传` })
      const limit = input.limit ?? 50
      const rows  = (file.parsedRows as any[]).slice(0, limit)
      return JSON.stringify({ rows, total: (file.parsedRows as any[]).length, showing: rows.length })
    }

    default:
      return JSON.stringify({ error: `未知工具: ${name}` })
  }
}
```

---

## 五、System Prompt 构建

System Prompt 在会话开始时构建一次，之后不变：

```ts
// lib/buildSystemPrompt.ts

export async function buildAgentSystemPrompt(): Promise<string> {
  // 1. 已上传文件列表（让 Claude 知道哪些数据可查）
  const files = await db.contextFile.findMany()
  const fileList = files.map(f =>
    `- ${f.fileType}: ${f.fileName}（${f.snapshotDate}，${getFreshness(f.fileType, f.uploadDate)}）`
  ).join("\n")

  // 2. 工具使用规则（强制映射）
  const toolRules = `
## 工具使用规则（必须遵守）
- 产品报表相关问题 → get_metrics 或 get_acos_history（禁止用 get_file_data）
- 广告活动数据 → get_ad_campaigns
- 搜索词数据 → get_search_terms
- 库存数据 → get_inventory
- 其他文件类型 → get_file_data(file_type)
`

  // 3. KPI 健康基准（从 config 读取）
  const benchmarks = buildBenchmarkText()  // 按品类输出阈值表

  // 4. 广告 SOP 规则摘要
  const sopSummary = SOP_SUMMARY_TEXT  // 静态常量，从 07-配置参数.md 提取

  return `
你是 YZ-Ops AI，亚马逊运营数据分析助手。基于以下已上传数据回答问题。

## 已上传文件
${fileList}

${toolRules}

## KPI 健康基准
${benchmarks}

## 广告优化 SOP（P0–P3 规则摘要）
${sopSummary}

## 边界限制
- 只基于已上传数据分析，不做销量预测
- 不直接执行广告后台操作
- 若数据不存在，明确告知缺少哪份报表
`.trim()
}
```

---

## 六、前端 ChatPanel 核心逻辑

```ts
// components/panels/ChatPanel.tsx（核心片段）

async function sendMessage(userText: string) {
  const userMsg = { role: "user", content: userText }
  setMessages(prev => [...prev, userMsg, { role: "assistant", content: "" }])

  const systemPrompt = await fetch("/api/build-prompt").then(r => r.text())

  const response = await fetch("/api/agent", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ messages: [...messages, userMsg], systemPrompt }),
  })

  const reader  = response.body!.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const lines = decoder.decode(value).split("\n")
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue
      const event = JSON.parse(line.slice(6))

      if (event.type === "text_delta") {
        // 追加到最后一条消息
        setMessages(prev => {
          const last = { ...prev[prev.length - 1] }
          last.content += event.delta
          return [...prev.slice(0, -1), last]
        })
      }
      if (event.type === "tool_start") {
        setActiveTools(prev => [...prev, event.tool])  // 显示工具执行状态
      }
      if (event.type === "done") {
        setActiveTools([])
      }
    }
  }
}
```

---

## 七、对话历史策略

这里涉及两套"历史"概念，需明确区分：

```
前端 messages（用户可见的对话记录）
  └── [{ role:"user", content:"string" }, { role:"assistant", content:"string" }, ...]
  └── 只含纯文字消息对；tool_use/tool_result 轮次不写入此数组
  └── 每轮 POST /api/agent 时，把此数组作为 messages 参数发给服务端

服务端 history（agentLoop 内部的 Anthropic API 消息数组，单次请求生命周期）
  └── 从前端 messages 复制初始化，格式相同
  └── 工具调用循环中会追加 tool_use、tool_result 块（Claude API 要求）
  └── POST /api/agent 响应结束后即丢弃，不返回给前端，不持久化
```

| 项目 | 策略 | 原因 |
|------|------|------|
| 前端消息历史 | 仅保留 user/assistant 文字轮次 | 工具调用细节对用户不可见，减少 context 增长 |
| 服务端内部历史 | 单次请求内完整保留所有块（含 tool_use/tool_result） | Anthropic API 多轮工具调用格式要求 |
| 跨轮数据 | Claude 每轮重新调工具获取最新数据 | 数据可能因上传新报表而变化 |
| 持久化 | MVP 不持久化，刷新页面历史清空 | 简化复杂度 |
| 最大轮次 | 10 次工具调用循环上限 | 防止死循环 |
