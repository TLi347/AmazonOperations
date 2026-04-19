# 06 — Chat 功能

[← 返回索引](./index.md)

> **数据范围**：全部已上传报表，不限品类。  
> **入口**：顶层导航 Chat 页，与品类视图平级。  
> **目标**：基于已上传数据和运营手册，回答"为什么"和"怎么办"类问题，补充结构化看板无法覆盖的分析场景。

---

## 架构概述

Chat 采用 **多 Session + Claude Agent SDK CLI** 模式：

| 层 | 技术实现 |
|----|---------|
| 前端 | `ChatPanel.tsx` — 两栏布局（Session 列表 + 对话区） |
| API | `POST /api/sessions/:id/run` — SSE 流式响应 |
| 答题 API | `POST /api/sessions/:id/answer` — 解析用户答复，恢复 Agent |
| Agent 适配层 | `src/lib/agentSSEAdapter.ts` — SDK 消息 → SSE 事件转换 |
| 执行引擎 | `@anthropic-ai/claude-agent-sdk` `query()` 函数，内部启动 `claude` CLI 子进程 |
| 模型 API | OpenRouter（`ANTHROPIC_BASE_URL` + `ANTHROPIC_AUTH_TOKEN`） |
| System Prompt | 项目根目录 `CLAUDE.md`（CLI 自动加载） |
| 持久化 | SQLite via Prisma：`Session` + `Message` 表 |

---

## 一、数据流

```
用户发消息（ChatPanel）
    │  POST /api/sessions/:id/run  { userMessage, model }
    ▼
route.ts
    ├── 查询 Session.sdkSessionId（用于 resume 续接多轮上下文）
    └── runAgentLoop()  ──→  agentSSEAdapter.ts
                                  │
                                  │  query({ prompt, options })
                                  ▼
                         claude-agent-sdk
                                  │  spawns subprocess
                                  ▼
                         claude CLI（CLAUDE_CODE_PATH）
                                  │  calls API
                                  ▼
                         OpenRouter / Claude API
                                  │  response stream
                                  ▼
                         SDK 消息流（for await）
                         ┌──────────────────────────────────────┐
                         │ system       → session_start          │
                         │ stream_event → text_delta / tool_start│
                         │ user(tool_result) → tool_done         │
                         │ canUseTool   → ask_user_question      │
                         │               / approval_request      │
                         │ result(success) → done                │
                         └──────────────────────────────────────┘
                                  │  SSE 事件
                                  ▼
                         前端 ChatPanel（Reader 逐行解析）
                                  │
                                  │  用户交互（问答 / 审批）
                                  │  POST /api/sessions/:id/answer
                                  ▼
                         answer/route.ts → pendingApprovals Map
                         → resolve Promise → query() 继续执行
                                  │
                                  ▼
                         done 事件 → 持久化 user + assistant 消息
```

---

## 二、Session 模型

```
Session（DB）
├── id            唯一标识
├── title         会话名称（默认取首条消息前 30 字，可重命名）
├── sdkSessionId  SDK 内部 session ID，用于下次 resume 续接上下文
├── createdAt / updatedAt
└── messages[]    持久化消息历史
        ├── role        "user" | "assistant"
        ├── content     最终文字内容
        └── toolCalls   本轮工具调用记录（JSON 字符串，GET 时自动 parse）
```

**Resume 机制**：每轮完成后将 `result.session_id` 写入 `Session.sdkSessionId`，下次发消息时通过 `resume: sdkSessionId` 让 SDK 续接历史上下文，无需手动传入消息历史。若 resume 失败（SDK 返回不同 ID），推送 `context_reset` 事件通知前端。

---

## 三、SSE 事件规范

服务端通过 `TransformStream` 以 `data: <JSON>\n\n` 格式推送：

| type | 触发时机 | 额外字段 |
|------|---------|---------|
| `session_start` | SDK 首次返回 system 消息 | `sessionId` |
| `context_reset` | resume 失败，上下文已重置 | — |
| `text_delta` | 流式文字片段到达 | `delta: string` |
| `tool_start` | 工具调用块开始（content_block_start） | `tool: string`, `input: object` |
| `tool_done` | 工具结果返回（user 消息的 tool_result） | `tool: string`, `resultSummary: string` |
| `ask_user_question` | Agent 调用 `AskUserQuestion` 工具暂停，等待用户回答 | `requestId: string`, `questions: Question[]` |
| `approval_request` | Agent 调用其他工具前暂停，等待用户审批 | `requestId: string`, `toolName: string`, `input: object` |
| `done` | Agent 完成，消息已写 DB | `messageId: string`, `content: string`（兜底） |
| `error` | 执行出错或鉴权失败 | `message: string` |

> `done` 携带 `content` 字段：当流式 `text_delta` 未触发时，前端用此字段作兜底显示完整回复。

---

## 四、工具执行

### 4.1 工具架构

`query()` 启动时注入了三类工具：

| 类型 | 注册方式 | 示例 |
|------|---------|------|
| MCP in-process 工具 | `mcpServers: { "yz-ops": yzOpsMcpServer }` + `allowedTools: ["mcp__yz-ops__*"]` | `get_metrics`, `get_alerts` 等 8 个业务工具 |
| Skills | `tools: ["Skill"]`，加载 `.claude/skills/` 目录 | `amazon-ops/SKILL.md`（行为指令） |
| AskUserQuestion | `tools: ["AskUserQuestion"]` | Agent 主动发起澄清问题 |

> **区别**：MCP 工具是可执行函数（Node.js 进程内运行）；Skills 是 SKILL.md 行为指令文件，告诉模型如何思考和回应，不可直接执行。两者互补。

工具由 **SDK / CLI 内部自动执行**，服务端不手动调度，`agentSSEAdapter.ts` 只观察事件流：

- `stream_event.content_block_start(tool_use)` → 推 `tool_start`（立即显示加载状态）
- `stream_event.content_block_delta(input_json_delta)` → 累积 JSON input buffer
- `stream_event.content_block_stop` → 解析完整 input，更新 pendingTools
- `user` 消息的 `tool_result` → 推 `tool_done`（含结果摘要）

### 4.2 业务工具（MCP yz-ops）

| 工具 | 用途 |
|------|------|
| `get_metrics(time_window, asin?)` | KPI 快照（today/yesterday/w7/w14/d30） |
| `get_acos_history(asin, days?)` | ACoS + GMV 日趋势 |
| `get_inventory()` | 库存快照 |
| `get_ad_campaigns(filter, asin?)` | 广告活动数据 |
| `get_search_terms(filter, asin?)` | 搜索词转化数据 |
| `get_alerts(level, category?)` | 每日告警 |
| `list_uploaded_files()` | 已上传文件列表 |
| `get_file_data(file_type, limit?)` | 其他文件类型原始数据 |

---

## 五、用户输入机制（User-Input）

Agent 执行中可通过两种方式暂停等待用户：

### 5.1 澄清问题（AskUserQuestion）

Agent 调用内置 `AskUserQuestion` 工具时，`canUseTool` 拦截执行，推送 SSE 事件暂停等待：

```
Agent 调用 AskUserQuestion { questions: [...] }
    → canUseTool 拦截
    → SSE: { type: "ask_user_question", requestId, questions }
    → 前端显示问题卡片，用户选择选项
    → POST /api/sessions/:id/answer { requestId, behavior: "allow", updatedInput: { questions: [...with answers] } }
    → pendingApprovals.get(requestId).resolve(...)
    → query() 继续执行，工具收到含答案的 input
```

### 5.2 工具审批（Approval）

所有工具调用都经过 `canUseTool` 回调（当前配置下 MCP 工具自动放行，未来可按需改为需审批）：

```
Agent 调用任意工具
    → canUseTool 拦截
    → SSE: { type: "approval_request", requestId, toolName, input }
    → 前端显示审批卡片
    → POST /api/sessions/:id/answer { requestId, behavior: "allow"|"deny" }
    → query() 继续执行或终止
```

### 5.3 Promise 桥

`canUseTool` 是同步等待的：它返回一个 Promise，`query()` 阻塞直到 Promise resolve。实现上用模块级 Map 存储：

```ts
// agentSSEAdapter.ts
export const pendingApprovals = new Map<string, { resolve, reject }>()

// answer/route.ts
pendingApprovals.get(requestId).resolve({ behavior, updatedInput })
```

防泄漏措施：5 分钟超时 + AbortSignal（SSE 断开时自动 reject）。

---

## 六、前端交互

```
ChatPanel 两栏布局
├── 左栏：Session 列表
│   ├── + 新对话（创建空 Session）
│   └── Session 卡片（按 updatedAt 倒序）
│       ├── 顶行：标题 + 重命名（hover 显示）
│       └── 底行：时间 + 删除按钮（常显）
│
└── 右栏：对话区
    ├── 消息历史（切换 Session 时从 DB 重新加载）
    ├── 工具调用气泡（tool_start → loading → tool_done → 结果摘要）
    ├── 流式渲染（text_delta 逐字追加）
    ├── 问题卡片（ask_user_question：选项 pill 按钮 + 提交）
    ├── 审批卡片（approval_request：工具名 + input 预览 + 允许/拒绝）
    ├── context_reset 警告条（黄色，可关闭）
    ├── 模型选择器（Haiku / Sonnet / Opus）
    └── 输入框（Enter 发送，Shift+Enter 换行，发送中可中止）
```

---

## 七、环境配置

```env
# .env.local（必填）
ANTHROPIC_AUTH_TOKEN="Bearer sk-or-v1-..."   # OpenRouter Bearer token（含 "Bearer " 前缀）
ANTHROPIC_BASE_URL="https://openrouter.ai/api"
CLAUDE_CODE_PATH="/Users/xxx/.local/bin/claude"   # `which claude` 获取
NEXT_PUBLIC_DEFAULT_MODEL="claude-haiku-4-5-20251001"
```

> **注意**：Shell export 优先级高于 `.env.local`。若 Shell 中有空值的 `ANTHROPIC_AUTH_TOKEN` export，会覆盖 `.env.local` 导致鉴权失败。确认方式：`env | grep ANTHROPIC`。

---

## 八、诊断工具

| 路由 | 用途 |
|------|------|
| `GET /api/test-openrouter` | 直接测试 OpenRouter 连通性，返回 key 前缀和 API 响应 |
| `http://localhost:3000/poc-chat` | 极简 HTML Chat 页（无 shadcn 组件），右侧实时 SSE 事件日志 |

---

## 九、技术限制

```
✅ 支持：
  · 多 Session，各自独立上下文（通过 SDK resume 维护）
  · Session 历史持久化，刷新后可继续
  · 跨品类分析
  · 工具调用流程实时可见（气泡状态）
  · MCP in-process 自定义工具（8 个业务工具）
  · Skills 行为指令（.claude/skills/amazon-ops/SKILL.md）
  · 用户输入：Agent 主动提问 + 工具审批

❌ 不支持：
  · 多用户共享 Session
  · 直接执行广告后台操作

⚠️ 约束：
  · SDK 内置最多 10 轮工具调用（MAX_TURNS = 10）
  · CLAUDE.md 修改后重启生效（CLI 进程在启动时加载）
  · Tool Search 需要 Sonnet 4+，当前关闭（ENABLE_TOOL_SEARCH=false）
  · OpenRouter 支持 x-api-key 和 Bearer 两种鉴权方式；目前用 ANTHROPIC_AUTH_TOKEN 是为了规避 shell 空值覆盖问题
```
