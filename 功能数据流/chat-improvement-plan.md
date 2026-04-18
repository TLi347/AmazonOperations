# Chat 功能升级计划

> 基于 Claude Agent SDK 文档审阅结果，系统性修复已知问题并补全未接入功能。
> 文档来源：streaming-vs-single-mode / sessions / streaming-output / custom-tools / tool-search / modifying-system-prompts / skills

---

## 问题汇总

| # | 问题 | 严重程度 | 来源文档 |
|---|------|---------|---------|
| P0 | Haiku + Tool Search 默认开启 → 工具调用异常 | 🔴 Bug | custom-tools / tool-search |
| P1 | `tool_start` 事件延迟：等完整 AssistantMessage 才触发，而非流式感知 | 🟡 UX | streaming-output |
| P1 | Session Resume 静默失败：SDK session 文件丢失时 Claude 从空白开始，用户无感知 | 🟡 可靠性 | sessions |
| P2 | 工具错误未使用 `isError: true`，Claude 无法正确识别工具失败 | 🟡 质量 | custom-tools |
| P2 | Skills 未接通：`.claude/skills/` 文件存在但 SDK 未加载 | 🟡 功能缺失 | skills |
| P3 | Streaming Input 仍为 string 模式：Stop 按钮无法真正中断 SDK | 🟠 能力边界 | streaming-vs-single-mode |

---

## 改动总览

```
后端
├── src/lib/agentSSEAdapter.ts      ← 最核心，涉及 P0 / P1 / P1 / P2 / P3 / Skills
├── src/lib/mcpTools.ts             ← P2 isError
├── src/lib/agentTools.ts           ← P2 isError 信号传递
└── src/app/api/sessions/[id]/run/route.ts  ← P1 context_reset 事件

前端
└── src/components/panels/ChatPanel.tsx    ← P1 context_reset Banner / P3 Stop 升级

新增文件
└── .claude/skills/example/SKILL.md       ← Skills 机制验证用示例
```

---

## Item 1 — 关闭 Tool Search（P0）

**问题**：Tool Search 默认开启，但 Haiku 不支持，导致工具调用行为异常。8 个工具全量加载更高效，无需 Tool Search。

**改动**：`src/lib/agentSSEAdapter.ts`，在 `query()` options 中加一行。

```ts
// agentSSEAdapter.ts — query options
env: { ENABLE_TOOL_SEARCH: "false" },
```

**前端改动**：无。

---

## Item 2 — Tool Start 流式时序优化（P1）

**问题**：当前在 `message.type === "assistant"` 时才触发 `tool_start` SSE 事件，此时 Claude 已经生成完整工具调用并等待执行。用户在文字流结束后看到一段停顿，气泡才出现。

**文档要求**：在 `stream_event` 的 `content_block_start`（`tool_use` 类型）时立即触发，与文字流无缝衔接。

**改动**：`src/lib/agentSSEAdapter.ts`，扩展 `stream_event` 处理块。

```ts
// 改动前：仅处理 text_delta
if (message.type === "stream_event") {
  const event = message.event as { type: string; delta?: { type: string; text?: string } }
  if (event?.type === "content_block_delta" && event.delta?.type === "text_delta" ...) { ... }
}

// 改动后：同时处理 content_block_start（工具调用开始）
if (message.type === "stream_event") {
  const event = message.event as {
    type: string
    content_block?: { type: string; id?: string; name?: string }
    delta?: { type: string; text?: string }
  }

  // 工具调用开始 → 立即推送 tool_start（比当前早一个 round-trip）
  if (event?.type === "content_block_start" && event.content_block?.type === "tool_use") {
    const name = shortToolName(event.content_block.name ?? "")
    if (event.content_block.id) {
      pendingTools.set(event.content_block.id, { name, input: {} })
    }
    onEvent({ type: "tool_start", tool: name, input: {} })
  }

  // 文字流（保持不变）
  if (event?.type === "content_block_delta" && event.delta?.type === "text_delta" ...) { ... }
}
```

同时，`assistant` 消息块里的 `tool_start` 推送**移除**（改为只更新 `pendingTools.input`，`tool_done` 逻辑保持不变）。

**前端改动**：无（SSE 事件格式不变）。

---

## Item 3 — Session Resume 失败检测 + 前端提示（P1）

**问题**：SDK session 文件（`~/.claude/projects/.../xxx.jsonl`）丢失后，`resume: sdkSessionId` 静默返回新 session，Claude 从空白上下文开始，但 UI 仍显示历史消息，用户无感知。

### 后端改动

**`src/lib/agentSSEAdapter.ts`**：在 `system` 消息处理块，比较返回的 `session_id` 与传入的 `sdkSessionId`。

```ts
if (message.type === "system") {
  const sysMsg = message as SDKSystemMessage
  resultSessionId = sysMsg.session_id
  if (!systemInited) {
    systemInited = true
    // 检测 resume 是否静默失败：传入了旧 ID 但返回了不同的新 ID
    const resumeFailed = !!sdkSessionId && resultSessionId !== sdkSessionId
    log.info(`sdk_session=${resultSessionId} resumeFailed=${resumeFailed}`)
    onEvent({ type: "session_start", sessionId })
    if (resumeFailed) {
      // 通知前端上下文已重置
      onEvent({ type: "context_reset" })
      // 同时清空 DB 里的旧 sdkSessionId，避免下次继续 resume 无效 ID
      // （route.ts 层处理：result 里带 contextReset 标志）
    }
  }
  turnCount++
}
```

**`runAgentLoop` 返回值**新增 `contextReset: boolean` 字段：

```ts
export interface AgentLoopResult {
  role: "assistant"
  content: string
  toolCalls: ToolCallRecord[]
  sdkSessionId: string | null
  contextReset: boolean   // ← 新增
}
```

**`src/app/api/sessions/[id]/run/route.ts`**：若 `contextReset` 为 true，清空 DB 中的 `sdkSessionId`。

```ts
// route.ts — 完成后处理
if (result.contextReset) {
  await db.session.update({
    where: { id: sessionId },
    data: { sdkSessionId: null },
  })
}
```

### 前端改动

**`src/components/panels/ChatPanel.tsx`**：

1. 新增状态 `contextResetWarning: boolean`
2. 在 SSE 解析块处理 `context_reset` 事件：

```ts
if (event.type === "context_reset") {
  setContextResetWarning(true)
}
```

3. 在消息区顶部渲染警告条（可手动关闭）：

```tsx
{contextResetWarning && (
  <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 border-b border-yellow-200 text-xs text-yellow-800">
    <AlertTriangle size={13} />
    <span>⚠️ 对话上下文已重置，Claude 不记得之前的工具调用</span>
    <button onClick={() => setContextResetWarning(false)} className="ml-auto">
      <X size={13} />
    </button>
  </div>
)}
```

4. 切换 Session 时清除警告：在 `selectSession` 内加 `setContextResetWarning(false)`。

---

## Item 4 — 工具错误 isError（P2）

**问题**：`agentTools.ts` 的 `catch` 块返回错误 JSON 字符串作为普通文本，`mcpTools.ts` 原样包装，Claude 无法识别这是工具失败。

### 改动方案

在 `agentTools.ts` 的 `executeTool` 中，将错误标记为特殊格式：

```ts
// executeTool catch 块
} catch (err) {
  // 使用特殊前缀让 mcpTools 层识别并转换为 isError
  return `__TOOL_ERROR__: ${err instanceof Error ? err.message : String(err)}`
}
```

在 `mcpTools.ts` 的每个工具 handler 中，检测并返回 `isError: true`：

```ts
// mcpTools.ts — 统一 helper
function wrapResult(result: string) {
  if (result.startsWith("__TOOL_ERROR__:")) {
    return {
      content: [{ type: "text" as const, text: result.replace("__TOOL_ERROR__: ", "") }],
      isError: true,
    }
  }
  return { content: [{ type: "text" as const, text: result }] }
}

// 每个 tool handler 改为
async (args) => wrapResult(await executeTool("get_metrics", args))
```

**前端改动**：无（Claude 的错误处理行为变好，前端无需感知）。

---

## Item 5 — Skills 接通（P2）

**问题**：`.claude/skills/amazon-ops/SKILL.md` 已存在，`skillLoader.ts` 已实现，但 `agentSSEAdapter.ts` 未启用 SDK 的 Skills 机制。

### 后端改动

**`src/lib/agentSSEAdapter.ts`**，在 `query()` options 中加两行：

```ts
settingSources: ["project"] as const,      // 让 SDK 扫描 .claude/skills/ 目录
allowedTools: ["Skill", "mcp__yz-ops__*"], // 加入 "Skill"
```

> **注意**：SKILL.md frontmatter 里的 `tools` 字段在 SDK 模式下不生效（文档明确说明），工具权限仍由 `allowedTools` 中的 `mcp__yz-ops__*` 通配符控制，无需额外处理。

### 新增验证用示例 Skill

创建 `.claude/skills/example/SKILL.md`，用于验证 Skills 机制是否正常工作：

```markdown
---
name: example-greeting
description: 当用户问候或问"你好"时，用中文礼貌地回应并介绍自己的能力
---

# 示例问候技能

当用户发送问候时，你应当：
1. 用中文礼貌回应
2. 简要介绍 YZ-Ops AI 的核心能力
3. 提示用户可以询问广告、库存、告警等运营数据
```

验证方式：启动后在 Chat 中发送"你好"，观察 Claude 是否通过 `Skill` 工具调用该 SKILL.md。

### 前端改动

无代码改动。工具气泡已支持任意工具名，`"Skill"` 调用会显示为工具气泡。若需美化展示（如显示 skill 名称而非 "Skill"），可后续迭代。

---

## Item 6 — Streaming Input 升级（P3）

**目标**：将 `prompt: string` 升级为 `prompt: AsyncGenerator`，实现真正的 SDK 级中断，并为未来图片上传打基础。

### 核心改动

**`src/lib/agentSSEAdapter.ts`**：

```ts
// 新增 generator 工厂函数
async function* createUserMessageStream(
  userMessage: string,
  abortSignal: AbortSignal
): AsyncGenerator<{ type: "user"; message: { role: "user"; content: string } }> {
  // 若请求已中止，不 yield
  if (abortSignal.aborted) return
  yield {
    type: "user" as const,
    message: { role: "user" as const, content: userMessage },
  }
  // 单轮对话：yield 一次后结束
  // 未来图片上传：在此 yield 更多消息
}

// runAgentLoop 入参新增 abortSignal
export async function runAgentLoop(
  sessionId: string,
  userMessage: string,
  systemPrompt: string,
  onEvent: (event: object) => void,
  sdkSessionId?: string | null,
  model?: string,
  abortSignal?: AbortSignal,  // ← 新增
): Promise<AgentLoopResult> {
  // ...
  const messageStream = createUserMessageStream(userMessage, abortSignal ?? new AbortController().signal)

  for await (const message of query({
    prompt: messageStream,  // ← 由 string 改为 AsyncGenerator
    options: { ... },
  })) { ... }
}
```

**`src/app/api/sessions/[id]/run/route.ts`**：

```ts
// 将请求的 AbortSignal 传入 agent loop
const result = await runAgentLoop(
  sessionId, userMessage, systemPrompt, send, sdkSessionId, model,
  req.signal,  // ← 新增，绑定 HTTP 请求的生命周期
)
```

### 前端改动

**`src/components/panels/ChatPanel.tsx`**：

Stop 按钮当前行为：`abortRef.current?.abort()` 只断开浏览器侧的 SSE fetch，服务端 SDK 仍在运行。

升级后，`req.signal` 已绑定到 HTTP 连接生命周期——前端 `abort()` → fetch 断开 → Next.js 标记 `req.signal.aborted = true` → `agentSSEAdapter` 中 generator 检测到 abort → 不再 yield → SDK 停止接收新消息。

**前端代码无需修改**，Stop 按钮原有的 `abortRef.current?.abort()` 已足够触发整条链路。

> **边界说明**：`req.signal` 的行为依赖 Next.js 版本和部署环境（Vercel / Node.js standalone）。如果 `req.signal` 在断开时未能正确 abort，可补充一个 `DELETE /api/sessions/:id/run` 端点作为显式取消接口（post-MVP 再加）。

---

## 实施顺序

```
Week 1（修复 + 稳定性）
  ├── Item 1：关闭 Tool Search          ← 30 分钟，一行代码
  ├── Item 2：Tool Start 时序优化       ← 2 小时
  └── Item 3：Session Resume 失败检测   ← 3 小时（后端 2h + 前端 1h）

Week 2（质量 + 功能）
  ├── Item 4：isError 工具错误处理      ← 1 小时
  └── Item 5：Skills 接通               ← 2 小时（含示例 Skill 验证）

Week 3（能力升级）
  └── Item 6：Streaming Input 升级      ← 4 小时
```

---

## 改动文件索引

| 文件 | 涉及 Item | 改动规模 |
|------|----------|---------|
| `src/lib/agentSSEAdapter.ts` | 1 / 2 / 3 / 5 / 6 | 大（核心文件） |
| `src/lib/mcpTools.ts` | 4 | 小 |
| `src/lib/agentTools.ts` | 4 | 小 |
| `src/app/api/sessions/[id]/run/route.ts` | 3 / 6 | 小 |
| `src/components/panels/ChatPanel.tsx` | 3 | 小（Banner UI） |
| `.claude/skills/example/SKILL.md` | 5 | 新增 |

---

## 不在本计划内

- System Prompt Caching 优化（内部单用户工具，低并发，影响甚微）
- Skills 内容扩展（amazon-ops 之外的新 Skill）
- 图片上传 UI（Streaming Input 升级后再跟进）
- Session 跨主机迁移（非当前部署场景）
