/**
 * lib/agentLoop.ts
 *
 * 服务端 Agentic Loop：与 Claude 循环交互直到最终回答。
 * 工具在服务端执行（查 DB），全程无需前端参与。
 *
 * onEvent 回调格式（SSE 事件）：
 *   { type: "text_delta", delta: string }
 *   { type: "tool_start", tool: string }
 *   { type: "tool_done",  tool: string }
 *   { type: "done" }
 *   { type: "error", message: string }
 */

import Anthropic from "@anthropic-ai/sdk"
import { TOOL_DEFINITIONS, executeTool } from "./agentTools"

const MAX_ITERATIONS = 10

export async function runAgentLoop(
  messages:     Anthropic.MessageParam[],
  systemPrompt: string,
  onEvent:      (event: object) => Promise<void> | void,
  model:        string = "claude-sonnet-4-6"
): Promise<void> {
  const client  = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const history = [...messages]

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system:     systemPrompt,
      tools:      TOOL_DEFINITIONS,
      messages:   history,
    })

    // ── 工具调用轮次 ───────────────────────────────────────────────────────
    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      )

      // 追加 Claude 的回复到内部历史
      history.push({ role: "assistant", content: response.content })

      // 并行执行所有工具
      const toolResults = await Promise.all(
        toolUseBlocks.map(async (block) => {
          await onEvent({ type: "tool_start", tool: block.name })
          const result = await executeTool(block.name, block.input as Record<string, unknown>)
          await onEvent({ type: "tool_done",  tool: block.name })
          return {
            type:        "tool_result" as const,
            tool_use_id: block.id,
            content:     result,
          }
        })
      )

      // 追加工具结果到内部历史
      history.push({ role: "user", content: toolResults })
      continue
    }

    // ── 最终回答（end_turn）───────────────────────────────────────────────
    if (response.stop_reason === "end_turn") {
      // 直接从 response.content 提取文字（不再发起第二次 API 调用）
      for (const block of response.content) {
        if (block.type === "text") {
          await onEvent({ type: "text_delta", delta: block.text })
        }
      }
      return
    }
  }

  throw new Error(`超过最大工具调用次数（${MAX_ITERATIONS}次）`)
}
