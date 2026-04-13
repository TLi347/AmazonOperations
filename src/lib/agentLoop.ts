/**
 * lib/agentLoop.ts
 *
 * 基于 Claude Agent SDK query() 的 Agent 执行层。
 *
 * SDK 自动处理工具调用循环，本文件负责：
 * 1. 调用 query() 并传入 MCP 工具 + system prompt
 * 2. 解析 SDKMessage 流，转换为 SSE 事件推送前端
 * 3. 返回最终结果供调用方持久化
 *
 * SSE 事件格式（与前端 ChatPanel.tsx 兼容）：
 *   { type: "session_start", sessionId: string }
 *   { type: "text_delta",   delta: string }
 *   { type: "tool_start",   tool: string, input: object }
 *   { type: "tool_done",    tool: string, resultSummary: string }
 *   { type: "done",         messageId: string }
 *   { type: "error",        message: string }
 */

import { query } from "@anthropic-ai/claude-agent-sdk"
import { yzOpsMcpServer } from "./mcpTools"

const MAX_TURNS = 10

export interface ToolCallRecord {
  tool:          string
  input:         Record<string, unknown>
  resultSummary: string
}

export interface AgentLoopResult {
  role:         "assistant"
  content:      string
  toolCalls:    ToolCallRecord[]
  sdkSessionId: string | null
}

/**
 * 从 MCP 工具名中提取短名（去掉 mcp__yz-ops__ 前缀）
 */
function shortToolName(name: string): string {
  return name.replace(/^mcp__yz-ops__/, "")
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

export async function runAgentLoop(
  sessionId:      string,
  userMessage:    string,
  systemPrompt:   string,
  onEvent:        (event: object) => void,
  sdkSessionId?:  string | null,
  model?:         string,
): Promise<AgentLoopResult> {
  const toolCalls: ToolCallRecord[] = []
  let   fullText        = ""
  let   resultSessionId = sdkSessionId ?? null
  let   hasStreamedText = false  // 标记是否通过 stream_event 收到过文字

  // 跟踪当前活跃的 tool_use，用于匹配 tool_result
  const pendingTools = new Map<string, { name: string; input: Record<string, unknown> }>()

  try {
    for await (const message of query({
      prompt: userMessage,
      options: {
        model:                  model || process.env.AGENT_MODEL || "sonnet",
        maxTurns:               MAX_TURNS,
        systemPrompt:           systemPrompt,
        includePartialMessages: true,
        permissionMode:         "bypassPermissions",
        tools:                  [],
        mcpServers:             { "yz-ops": yzOpsMcpServer },
        allowedTools:           ["mcp__yz-ops__*"],
        ...(sdkSessionId ? { resume: sdkSessionId } : {}),
      },
    })) {
      // ── system init（仅一次）───────────────────────────────────────────
      if (message.type === "system" && (message as any).subtype === "init") {
        resultSessionId = (message as any).session_id as string
        onEvent({ type: "session_start", sessionId })
      }

      // ── token 级流式（stream_event）────────────────────────────────────
      if (message.type === "stream_event" && "event" in message) {
        const event = (message as any).event
        if (event?.type === "content_block_delta" && event?.delta?.type === "text_delta") {
          const text = event.delta.text as string
          fullText += text
          hasStreamedText = true
          onEvent({ type: "text_delta", delta: text })
        }
      }

      // ── assistant 消息（含 tool_use blocks）─────────────────────────────
      if (message.type === "assistant" && "message" in message) {
        const content = (message as any).message?.content
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "tool_use") {
              const name  = shortToolName(block.name)
              const input = block.input as Record<string, unknown>
              pendingTools.set(block.id, { name, input })
              onEvent({ type: "tool_start", tool: name, input })
            }
            // 仅在非流式模式下收集文字（流式已通过 stream_event 收集完毕）
            if (block.type === "text" && !hasStreamedText) {
              fullText += block.text
            }
          }
          // assistant 消息处理完后，重置流式标记（下一轮工具调用后新的回复需要重新收集）
          hasStreamedText = false
        }
      }

      // ── user 消息（含 tool_result）───────────────────────────────────────
      if (message.type === "user" && "message" in message) {
        const content = (message as any).message?.content
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "tool_result" && block.tool_use_id) {
              const pending = pendingTools.get(block.tool_use_id)
              if (pending) {
                const resultText    = extractToolResultText(block.content)
                const resultSummary = buildResultSummary(pending.name, resultText)

                toolCalls.push({ tool: pending.name, input: pending.input, resultSummary })
                onEvent({ type: "tool_done", tool: pending.name, resultSummary })
                pendingTools.delete(block.tool_use_id)
              }
            }
          }
        }
      }

      // ── result 消息（完成）──────────────────────────────────────────────
      if (message.type === "result") {
        const result = message as any
        resultSessionId = result.session_id ?? resultSessionId

        if (result.subtype === "success") {
          // 兜底：如果流式和 assistant 都没收集到文字，用 result.result
          if (!fullText && result.result) {
            fullText = result.result
          }
        } else {
          const errorMsg = result.errors?.join("; ") ?? result.subtype ?? "Agent 执行出错"
          onEvent({ type: "error", message: errorMsg })
        }
      }
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    onEvent({ type: "error", message: errorMsg })
    return { role: "assistant", content: fullText || errorMsg, toolCalls, sdkSessionId: resultSessionId }
  }

  return { role: "assistant", content: fullText, toolCalls, sdkSessionId: resultSessionId }
}
