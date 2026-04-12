/**
 * POST /api/agent
 * { messages: MessageParam[], systemPrompt: string }
 *
 * 服务端 Agentic Loop：循环调用 Claude，服务端执行工具查询 DB，
 * 通过 SSE 流式推送事件到前端。
 *
 * SSE 事件：
 *   { type: "text_delta", delta: string }
 *   { type: "tool_start", tool: string }
 *   { type: "tool_done",  tool: string }
 *   { type: "done" }
 *   { type: "error", message: string }
 */

import { NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { runAgentLoop } from "@/lib/agentLoop"

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "请先在 .env.local 中配置 ANTHROPIC_API_KEY" }, { status: 500 })
  }

  let body: { messages: Anthropic.MessageParam[]; systemPrompt: string; model?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 })
  }

  const { messages, systemPrompt, model } = body
  if (!messages || !systemPrompt) {
    return Response.json({ error: "缺少 messages 或 systemPrompt 字段" }, { status: 400 })
  }

  const stream  = new TransformStream()
  const writer  = stream.writable.getWriter()
  const encoder = new TextEncoder()

  const send = async (data: object) => {
    await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
  }

  // 异步执行 agentic loop（不阻塞响应流的建立）
  ;(async () => {
    try {
      await runAgentLoop(messages, systemPrompt, send, model)
      await send({ type: "done" })
    } catch (e) {
      await send({ type: "error", message: e instanceof Error ? e.message : String(e) })
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
