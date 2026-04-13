# 04 — Agent 架构

[← 返回索引](../README.md)

> 对应功能设计：[features/06-Chat.md](../features/06-Chat.md)  
> **当前实现**：基于 `@anthropic-ai/claude-agent-sdk` 的 `query()` + 进程内 MCP Server。

---

## 架构概述

```
前端 ChatPanel（两栏布局）
    │
    │  Session CRUD → /api/sessions/*
    │  发送消息     → POST /api/sessions/:id/run  （SSE 流式）
    ▼

/api/sessions/:id/run/route.ts
    │
    ├── 1. buildAgentSystemPrompt()   动态构建 System Prompt
    └── 2. runAgentLoop()             调用 SDK query()
          │
          ├── query() 配置：
          │     model:          "sonnet"
          │     maxTurns:       10
          │     tools:          []                (移除所有内置工具)
          │     mcpServers:     { "yz-ops": ... } (进程内 MCP)
          │     allowedTools:   ["mcp__yz-ops__*"]
          │     systemPrompt:   动态构建
          │     includePartialMessages: true
          │     permissionMode: "bypassPermissions"
          │
          ├── SDK 内部自动处理工具调用循环
          │
          └── SDKMessage 流 → 转换为 SSE 事件 → 前端
```

---

## 一、Agent 执行（`lib/agentLoop.ts`）

使用 Agent SDK 的 `query()` 函数，SDK 自动处理工具调用循环：

```ts
import { query } from "@anthropic-ai/claude-agent-sdk"

for await (const message of query({
  prompt: userMessage,
  options: {
    model: "sonnet",
    maxTurns: 10,
    systemPrompt,
    includePartialMessages: true,
    permissionMode: "bypassPermissions",
    tools: [],
    mcpServers: { "yz-ops": yzOpsMcpServer },
    allowedTools: ["mcp__yz-ops__*"],
  },
})) {
  // 解析 SDKMessage，转换为 SSE 事件
}
```

### SDKMessage → SSE 事件映射

| SDK Message | 条件 | SSE 事件 |
|-------------|------|---------|
| `system` (subtype: init) | — | `session_start` |
| `stream_event` | content_block_delta + text_delta | `text_delta` |
| `assistant` | 含 tool_use block | `tool_start` |
| `user` | 含 tool_result | `tool_done` |
| `result` (subtype: success) | — | `done` |
| `result` (subtype: error_*) | — | `error` |

### 与旧版的关键差异

| 维度 | 旧版（手写循环） | 新版（Agent SDK） |
|------|----------------|------------------|
| 工具循环 | 手写 `for` 循环 + `stop_reason` 检查 | SDK `query()` 自动处理 |
| 工具执行 | 进程内直接调用 `executeTool()` | 进程内 MCP Server（同样直接查 DB） |
| 流式 | `messages.stream()` + `on("text")` | `includePartialMessages: true` |
| 历史管理 | 手动从 DB 加载 + 拼接 | SDK 内置 session 管理（可选） |
| 轮次控制 | `MAX_ITERATIONS = 10` | `maxTurns: 10` |

---

## 二、进程内 MCP 工具（`lib/mcpTools.ts`）

使用 Agent SDK 的 `tool()` + `createSdkMcpServer()` 定义工具，运行在同一进程内（不需要独立 MCP Server 进程）：

```ts
import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk"
import { z } from "zod"
import { executeTool } from "./agentTools"

const getMetrics = tool(
  "get_metrics",
  "查询产品 KPI 快照...",
  {
    time_window: z.enum(["today", "yesterday", "w7", "w14", "d30"]),
    asin: z.string().optional(),
  },
  async (args) => {
    const result = await executeTool("get_metrics", args)
    return { content: [{ type: "text", text: result }] }
  },
  { annotations: { readOnlyHint: true } }
)

export const yzOpsMcpServer = createSdkMcpServer({
  name: "yz-ops",
  tools: [getMetrics, /* ...其余 7 个 */],
})
```

### 工具列表

| MCP 工具名 | 用途 | 数据源 |
|-----------|------|--------|
| `mcp__yz-ops__get_metrics` | 产品 KPI 快照 | ProductMetricDay |
| `mcp__yz-ops__get_acos_history` | ACoS + GMV 日趋势 | ProductMetricDay |
| `mcp__yz-ops__get_inventory` | 库存状况 | ContextFile(inventory) |
| `mcp__yz-ops__get_ad_campaigns` | 广告活动数据 | ContextFile(campaign_3m) |
| `mcp__yz-ops__get_search_terms` | 搜索词表现 | ContextFile(search_terms) |
| `mcp__yz-ops__get_alerts` | 已触发告警 | Alert 表 |
| `mcp__yz-ops__list_uploaded_files` | 已上传报表列表 | ContextFile |
| `mcp__yz-ops__get_file_data` | 原始文件数据 | ContextFile(any) |

所有工具标注 `readOnlyHint: true`（只读查询，可并行调用）。工具执行逻辑复用 `agentTools.ts` 的 `executeTool()`。

---

## 三、System Prompt 构建（`lib/buildSystemPrompt.ts`）

每次用户发送消息时**动态重建**，包含：

| 部分 | 内容 | 来源 |
|------|------|------|
| 已上传文件列表 | fileType + fileName + snapshotDate | DB: ContextFile |
| 工具使用规则 | 文件类型 → 工具强制映射 | 硬编码 |
| KPI 健康基准 | 各品类 ACoS/CTR/CVR 基准值 | `config.ts` |
| SOP 规则摘要 | P0-P3 广告优化规则概要 | 硬编码 + config |
| 边界限制 | 不做预测、不执行后台操作 | 硬编码 |

---

## 四、Session 管理 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/sessions` | POST | 创建 Session |
| `/api/sessions` | GET | 列出所有 Session（按 updatedAt 倒序） |
| `/api/sessions/:id` | GET | 取 Session + 最近 40 条消息（20 轮） |
| `/api/sessions/:id` | PATCH | 重命名 |
| `/api/sessions/:id` | DELETE | 删除（级联删消息） |
| `/api/sessions/:id/run` | POST | 执行 Agent，SSE 流式响应 |

### 执行端点流程（`/api/sessions/:id/run`）

1. `buildAgentSystemPrompt()` 动态构建 system prompt
2. `runAgentLoop()` 调用 SDK `query()`，通过 SSE 回调推送事件
3. 持久化 user + assistant 消息到 DB
4. 首条消息自动设置 Session 标题（前 30 字）

---

## 五、SSE 事件规范

| type | 含义 | 额外字段 |
|------|------|---------|
| `session_start` | Agent 开始执行 | `sessionId` |
| `text_delta` | 流式文字片段 | `delta: string` |
| `tool_start` | 开始执行工具 | `tool: string`, `input: object` |
| `tool_done` | 工具执行完毕 | `tool: string`, `resultSummary: string` |
| `done` | 本轮回答结束 | `messageId: string` |
| `error` | 出错 | `message: string` |

---

## 六、消息持久化策略

| 项目 | 策略 |
|------|------|
| 存储 | user + assistant 消息在 `done` 后写入 DB |
| 工具调用记录 | 存摘要（tool + input + resultSummary），不存完整返回 JSON |
| SDK Session | SDK 内部管理完整对话历史（含 tool blocks），可通过 `resume` 续接 |
| DB Session | 自有 Session/Message 表用于 UI 展示（session 列表、消息历史） |
| 跨轮数据 | Claude 每轮重新调工具获取最新数据 |

---

## 七、关键文件

| 文件 | 职责 |
|------|------|
| `src/lib/agentLoop.ts` | 调用 SDK query()，解析 SDKMessage，转 SSE 事件 |
| `src/lib/mcpTools.ts` | 进程内 MCP Server（tool() + createSdkMcpServer） |
| `src/lib/agentTools.ts` | 8 个工具的 DB 查询执行逻辑（被 mcpTools 复用） |
| `src/lib/buildSystemPrompt.ts` | 动态 System Prompt 构建 |
| `src/app/api/sessions/[id]/run/route.ts` | SSE 流式 API 入口 |
| `src/components/panels/ChatPanel.tsx` | 前端两栏布局 + SSE 消费 |

---

## 八、依赖关系

```
@anthropic-ai/claude-agent-sdk  →  query(), tool(), createSdkMcpServer()
zod                             →  MCP 工具 schema 定义
@anthropic-ai/sdk (遗留)         →  agentTools.ts 中 TOOL_DEFINITIONS 类型（待移除）
```
