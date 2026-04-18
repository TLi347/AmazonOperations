/**
 * lib/agentSSEAdapter.ts
 *
 * SDK 消息 → SSE 事件适配层。
 *
 * SDK 内部自动处理工具调用循环（query → tool_use → execute → tool_result → ...），
 * 本文件只是消费 SDK 产出的消息流，翻译为前端 ChatPanel 能理解的 SSE 事件：
 *   system       → session_start（+ context_reset 若 resume 失败）
 *   stream_event → text_delta / tool_start（content_block_start 时立即触发）
 *   user         → tool_done
 *   result       → done / error
 *
 * SSE 事件格式（与前端 ChatPanel.tsx 兼容）：
 *   { type: "session_start",  sessionId: string }
 *   { type: "context_reset" }                        ← resume 静默失败时推送
 *   { type: "text_delta",    delta: string }
 *   { type: "tool_start",    tool: string, input: object }
 *   { type: "tool_done",     tool: string, resultSummary: string }
 *   { type: "done",          messageId: string }
 *   { type: "error",         message: string }
 */

import {
  query,
  type SDKSystemMessage,
  type SDKResultMessage,
  type SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk"

const MAX_TURNS = 10

// ── Debug logger ─────────────────────────────────────────────────────────────
const TAG = "[Agent]"
const log = {
  info:  (...args: unknown[]) => console.log(TAG, ...args),
  tool:  (...args: unknown[]) => console.log(TAG, "[Tool]", ...args),
  stream:(...args: unknown[]) => console.log(TAG, "[Stream]", ...args),
  error: (...args: unknown[]) => console.error(TAG, "[ERROR]", ...args),
}

export interface ToolCallRecord {
  tool:          string
  input:         Record<string, unknown>
  resultSummary: string
}

export interface AgentLoopResult {
  role:          "assistant"
  content:       string
  toolCalls:     ToolCallRecord[]
  sdkSessionId:  string | null
  contextReset:  boolean
}

function shortToolName(name: string): string {
  return name.replace(/^mcp__[^_]+__/, "")
}

/**
 * 从 tool_result 的 content 中提取纯文本
 * SDK 返回的 content 可能是 string、content block 数组或嵌套结构
 */
function extractToolResultText(content: unknown): string {
  if (typeof content === "string") return content
  if (Array.isArray(content)) {
    return content
      .map(block => {
        if (typeof block === "string") return block
        if (block?.type === "text" && typeof block.text === "string") return block.text
        return JSON.stringify(block)
      })
      .join("")
  }
  return JSON.stringify(content)
}

/**
 * CLI 把 OpenRouter 的鉴权错误响应当成文本流式回来时，检测并过滤
 */
function isAuthErrorResponse(text: string): boolean {
  if (text.length > 500) return false
  return (
    text.includes("Failed to authenticate") ||
    text.includes("Missing Authentication") ||
    /API Error: 4\d\d/.test(text)
  )
}

/**
 * 构建工具结果摘要
 */
function buildResultSummary(toolName: string, resultText: string): string {
  try {
    const obj = JSON.parse(resultText)
    if (obj.error) return `错误: ${obj.error}`
    if (Array.isArray(obj)) return `返回 ${obj.length} 条记录`
    if (obj.rows && Array.isArray(obj.rows)) return `返回 ${obj.rows.length} 条记录（共 ${obj.total ?? obj.rows.length} 条）`
    if (obj.alerts && Array.isArray(obj.alerts)) return `发现 ${obj.alerts.length} 条告警`
    const s = JSON.stringify(obj)
    return s.length > 200 ? s.slice(0, 200) + "…" : s
  } catch {
    return resultText.length > 200 ? resultText.slice(0, 200) + "…" : resultText
  }
}

/**
 * 创建 Streaming Input 模式的消息 generator。
 * 单轮对话只 yield 一条 user 消息；abortSignal 触发后不再 yield，使 SDK 停止。
 */
async function* createMessageStream(
  userMessage: string,
  abortSignal: AbortSignal,
): AsyncGenerator<SDKUserMessage> {
  if (abortSignal.aborted) return
  yield {
    type: "user" as const,
    message: { role: "user" as const, content: userMessage },
    parent_tool_use_id: null,
  }
}

export async function runAgentLoop(
  sessionId:      string,
  userMessage:    string,
  onEvent:        (event: object) => void,
  sdkSessionId?:  string | null,
  model?:         string,
  abortSignal?:   AbortSignal,
): Promise<AgentLoopResult> {
  const toolCalls: ToolCallRecord[] = []
  let   fullText               = ""
  let   resultSessionId        = sdkSessionId ?? null
  let   hasStreamedText        = false  // 标记是否通过 stream_event 收到过文字
  let   systemInited           = false  // 标记 system 消息是否已处理（SDK 每轮都发）
  let   turnCount              = 0
  let   contextReset           = false  // resume 静默失败标志
  let   currentStreamingToolId: string | null = null  // 当前正在流式接收 input 的 tool_use id
  let   currentToolInputBuffer = ""     // 累积 input_json_delta

  // 跟踪当前活跃的 tool_use，用于匹配 tool_result
  const pendingTools = new Map<string, { name: string; input: Record<string, unknown> }>()

  const resolvedModel = model || process.env.AGENT_MODEL || "claude-haiku-4-5-20251001"
  const signal = abortSignal ?? new AbortController().signal
  log.info(`── 开始 ── session=${sessionId} model=${resolvedModel} resume=${!!sdkSessionId}`)
  log.info(`prompt: "${userMessage.slice(0, 100)}${userMessage.length > 100 ? "…" : ""}"`)

  const t0 = Date.now()
  const elapsed = () => `+${((Date.now() - t0) / 1000).toFixed(1)}s`

  try {
    log.info(`${elapsed()} query() 调用中…`)
    for await (const message of query({
      prompt: createMessageStream(userMessage, signal),
      options: {
        pathToClaudeCodeExecutable: process.env.CLAUDE_CODE_PATH || "/Users/tli/.local/bin/claude",
        model:                  resolvedModel,
        maxTurns:               MAX_TURNS,
        includePartialMessages: false,  // POC: 测试是否消除 ?beta=true
        permissionMode:         "bypassPermissions",
        tools:                  [],
        mcpServers:             {},
        allowedTools:           [],     // POC: 测试是否消除 ?beta=true
        settingSources:         ["project"] as const,
        env: {
          ...(process.env as Record<string, string>),
          ENABLE_TOOL_SEARCH: "false",
        },
        ...(sdkSessionId ? { resume: sdkSessionId } : {}),
      },
    })) {
      log.info(`${elapsed()} ← msg.type=${message.type}`)

      // ── system init（每轮都收到，仅首次打日志+推事件）─────────────────────
      if (message.type === "system") {
        const sysMsg = message as SDKSystemMessage
        resultSessionId = sysMsg.session_id
        if (!systemInited) {
          systemInited = true
          // 检测 resume 静默失败：传入了旧 ID 但 SDK 返回了不同的新 ID
          if (sdkSessionId && resultSessionId !== sdkSessionId) {
            contextReset = true
            log.info(`sdk_session=${resultSessionId} (resume failed, was ${sdkSessionId})`)
            onEvent({ type: "context_reset" })
          } else {
            log.info(`sdk_session=${resultSessionId}`)
          }
          onEvent({ type: "session_start", sessionId })
        }
        turnCount++
      }

      // ── token 级流式（stream_event = SDKPartialAssistantMessage）──────────
      if (message.type === "stream_event") {
        const event = message.event as {
          type: string
          content_block?: { type: string; id?: string; name?: string }
          delta?: { type: string; text?: string; partial_json?: string }
        }

        // 工具调用开始：立即推送 tool_start（比等 assistant 消息早一步）
        if (event?.type === "content_block_start" && event.content_block?.type === "tool_use") {
          const id   = event.content_block.id ?? ""
          const name = shortToolName(event.content_block.name ?? "")
          currentStreamingToolId  = id
          currentToolInputBuffer  = ""
          pendingTools.set(id, { name, input: {} })
          log.tool(`▶ ${name} (streaming)`)
          onEvent({ type: "tool_start", tool: name, input: {} })
        }

        // 非工具文本块开始：重置流式工具跟踪
        if (event?.type === "content_block_start" && event.content_block?.type !== "tool_use") {
          currentStreamingToolId = null
          currentToolInputBuffer = ""
        }

        // 工具 input JSON 流式累积
        if (event?.type === "content_block_delta" && event.delta?.type === "input_json_delta") {
          if (currentStreamingToolId && event.delta.partial_json != null) {
            currentToolInputBuffer += event.delta.partial_json
          }
        }

        // 工具 input 流式结束：解析并更新 pendingTools 的完整 input
        if (event?.type === "content_block_stop" && currentStreamingToolId) {
          try {
            const parsed = JSON.parse(currentToolInputBuffer) as Record<string, unknown>
            const pending = pendingTools.get(currentStreamingToolId)
            if (pending) pendingTools.set(currentStreamingToolId, { ...pending, input: parsed })
          } catch { /* 空 input 或不完整 JSON，保持 {} */ }
          currentStreamingToolId = null
          currentToolInputBuffer = ""
        }

        // 文字 delta
        if (event?.type === "content_block_delta" && event.delta?.type === "text_delta" && event.delta.text != null) {
          fullText += event.delta.text
          hasStreamedText = true
          onEvent({ type: "text_delta", delta: event.delta.text })
        }
      }

      // ── assistant 消息（完整消息到达）────────────────────────────────────
      if (message.type === "assistant") {
        const content = (message.message?.content ?? []) as Array<{
          type: string; id?: string; name?: string; input?: unknown; text?: string
        }>
        for (const block of content) {
          if (block.type === "tool_use" && block.id && block.name) {
            // tool_start 已在 stream_event content_block_start 时触发
            // 此处仅用完整 input 覆盖 pendingTools（确保准确性）
            const name  = shortToolName(block.name)
            const input = (block.input ?? {}) as Record<string, unknown>
            log.tool(`▶ ${name}`, JSON.stringify(input).slice(0, 200))
            pendingTools.set(block.id, { name, input })
          }
          // 仅在非流式模式下收集文字（流式已通过 stream_event 收集完毕）
          if (block.type === "text" && block.text && !hasStreamedText) {
            fullText += block.text
          }
        }
        // 重置流式标记，下一轮回复需要重新收集
        hasStreamedText = false
      }

      // ── user 消息（含 tool_result）───────────────────────────────────────
      if (message.type === "user") {
        // message.message 类型为 MessageParam，content 为 ContentBlockParam[]
        const content = (message.message?.content ?? []) as Array<{
          type: string; tool_use_id?: string; content?: unknown
        }>
        for (const block of content) {
          if (block.type === "tool_result" && block.tool_use_id) {
            const pending = pendingTools.get(block.tool_use_id)
            if (pending) {
              const resultText    = extractToolResultText(block.content)
              const resultSummary = buildResultSummary(pending.name, resultText)
              toolCalls.push({ tool: pending.name, input: pending.input, resultSummary })
              log.tool(`✓ ${pending.name} → ${resultSummary.slice(0, 120)}`)
              onEvent({ type: "tool_done", tool: pending.name, resultSummary })
              pendingTools.delete(block.tool_use_id)
            }
          }
        }
      }

      // ── result 消息（完成）──────────────────────────────────────────────
      if (message.type === "result") {
        const result = message as SDKResultMessage
        resultSessionId = result.session_id ?? resultSessionId

        if (result.subtype === "success") {
          // 兜底：如果流式和 assistant 都没收集到文字，用 result.result
          if (!fullText && result.result) {
            fullText = result.result
          }
          log.info(`── 完成 ── turns=${turnCount} tools=${toolCalls.length} text=${fullText.length}chars`)
        } else {
          const errors = (result as { errors?: string[] }).errors
          const errorMsg = errors?.join("; ") ?? result.subtype ?? "Agent 执行出错"
          log.error(`subtype=${result.subtype}`, errorMsg)
          onEvent({ type: "error", message: errorMsg })
        }
      }
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    log.error(`异常: ${errorMsg}`)
    if (fullText.length > 0) {
      // CLI 把 OpenRouter 的 401 响应当成文本流式回来，检测并过滤
      if (isAuthErrorResponse(fullText)) {
        log.error(`响应内容为鉴权错误（CLI 把 401 当成了文本），不向前端展示`)
        fullText = ""
        onEvent({ type: "error", message: "API 鉴权失败：请检查 ANTHROPIC_API_KEY 和 ANTHROPIC_BASE_URL 配置" })
        return { role: "assistant", content: "", toolCalls, sdkSessionId: resultSessionId, contextReset }
      }
      log.info(`已有响应内容，忽略清理阶段异常`)
    } else {
      onEvent({ type: "error", message: errorMsg })
      return { role: "assistant", content: errorMsg, toolCalls, sdkSessionId: resultSessionId, contextReset }
    }
  }

  return { role: "assistant", content: fullText, toolCalls, sdkSessionId: resultSessionId, contextReset }
}
