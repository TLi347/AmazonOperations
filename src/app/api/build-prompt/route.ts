/**
 * GET /api/build-prompt
 *
 * 每次 ChatPanel 发消息前调用，返回最新 System Prompt 文本。
 * System Prompt 每次重新构建，包含最新已上传文件状态。
 */

import { NextResponse } from "next/server"
import { buildAgentSystemPrompt } from "@/lib/buildSystemPrompt"

export async function GET() {
  try {
    const prompt = await buildAgentSystemPrompt()
    return new NextResponse(prompt, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
