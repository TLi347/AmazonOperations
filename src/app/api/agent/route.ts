/**
 * POST /api/agent
 *
 * One step of the agentic loop:
 *  - Calls Claude with tools
 *  - If stop_reason === "tool_use"  → returns JSON { type:"tool_use", content:[...] }
 *  - If stop_reason === "end_turn"  → returns SSE stream of the text response
 *
 * The client drives the loop: it executes tool calls locally (from Zustand state)
 * and re-posts with tool_result messages until end_turn.
 */

import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { AGENT_TOOLS } from "@/lib/agentTools";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === "your-api-key-here") {
    return NextResponse.json({ error: "请先在 .env 中配置 ANTHROPIC_API_KEY" }, { status: 500 });
  }

  let body: {
    messages: Anthropic.MessageParam[];
    systemPrompt: string;
    model: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const { messages, systemPrompt, model } = body;

  try {
    const response = await client.messages.create({
      model: model || process.env.NEXT_PUBLIC_DEFAULT_MODEL || "claude-sonnet-4-6",
      max_tokens: 8096,
      system: systemPrompt,
      tools: AGENT_TOOLS as unknown as Anthropic.Tool[],
      messages,
    });

    // ── Tool use: return tool_use blocks as JSON ──────────────────────────────
    if (response.stop_reason === "tool_use") {
      return NextResponse.json({
        type: "tool_use",
        content: response.content,
      });
    }

    // ── End turn: stream text response as SSE ─────────────────────────────────
    const textBlocks = response.content.filter(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );
    const fullText = textBlocks.map((b) => b.text).join("");

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Chunk text for a realistic streaming effect (~30 chars/chunk)
        const CHUNK = 30;
        for (let i = 0; i < fullText.length; i += CHUNK) {
          const slice = fullText.slice(i, i + CHUNK);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text: slice })}\n\n`)
          );
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
