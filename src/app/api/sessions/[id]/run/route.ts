/**
 * POST /api/sessions/:id/run
 *
 * Agent Loop 入口，SSE 流式输出。
 * body: { userMessage: string }
 *
 * SSE 事件流：
 *   session_start → text_delta* → tool_start/tool_done* → done
 *   （出错时发 error 事件）
 */

import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { runAgentLoop } from "@/lib/agentSSEAdapter"

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { userMessage, model } = await req.json() as { userMessage: string; model?: string }
  const sessionId = params.id

  const stream  = new TransformStream()
  const writer  = stream.writable.getWriter()
  const encoder = new TextEncoder()

  const send = (data: object) => {
    writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
  }

  // 异步执行 agent loop（不阻塞 SSE 响应返回）
  ;(async () => {
    try {
      console.log(`[API] POST /api/sessions/${sessionId}/run model=${model ?? "default"} msg="${userMessage.slice(0, 60)}"`)

      // 1. 查询 Session，获取 SDK session ID（用于 resume 续接多轮对话）
      const session = await db.session.findUnique({ where: { id: sessionId } })
      const sdkSessionId = session?.sdkSessionId ?? null
      console.log(`[API] session found=${!!session} sdkSessionId=${sdkSessionId ?? "none"}`)

      // 2. 执行 Agent Loop（SDK 自动处理工具调用循环）
      //    系统提示通过项目根目录 CLAUDE.md 加载（Method 1）
      //    传入 req.signal：HTTP 连接断开时 generator 停止 yield，SDK 中断执行
      const result = await runAgentLoop(
        sessionId,
        userMessage,
        send,
        sdkSessionId,
        model,
        req.signal,
      )

      // 4. 持久化 SDK session ID
      //    - resume 正常：新 ID 写入（首次对话）或保持不变
      //    - contextReset（resume 静默失败）：清空旧 ID，写入新 ID，防止下次继续 resume 无效 ID
      if (result.contextReset) {
        await db.session.update({
          where: { id: sessionId },
          data:  { sdkSessionId: result.sdkSessionId ?? null },
        })
      } else if (result.sdkSessionId && result.sdkSessionId !== sdkSessionId) {
        await db.session.update({
          where: { id: sessionId },
          data:  { sdkSessionId: result.sdkSessionId },
        })
      }
      console.log(`[API] agent done — tools=${result.toolCalls.length} content=${result.content.length}chars`)

      // 5. 持久化：写入 user + assistant 消息
      const [, savedAssistant] = await Promise.all([
        db.message.create({
          data: { sessionId, role: "user", content: userMessage },
        }),
        db.message.create({
          data: {
            sessionId,
            role:      "assistant",
            content:   result.content,
            toolCalls: result.toolCalls.length > 0
              ? JSON.stringify(result.toolCalls)
              : null,
          },
        }),
      ])

      // 更新 Session.updatedAt
      await db.session.update({
        where: { id: sessionId },
        data:  { updatedAt: new Date() },
      })

      // 若是第一条消息，用消息前 30 字更新 Session 标题
      const msgCount = await db.message.count({ where: { sessionId } })
      if (msgCount <= 2) {
        await db.session.update({
          where: { id: sessionId },
          data:  { title: userMessage.slice(0, 30) },
        })
      }

      send({ type: "done", messageId: savedAssistant.id })
    } catch (err) {
      console.error(`[API] session=${sessionId} 异常:`, err)
      send({ type: "error", message: String(err) })
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
