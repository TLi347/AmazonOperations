import { NextResponse } from "next/server"

export async function GET() {
  const key = process.env.ANTHROPIC_API_KEY
  const base = process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com"

  const url = `${base}/v1/messages`

  const authToken = process.env.ANTHROPIC_AUTH_TOKEN

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "anthropic-version": "2023-06-01",
  }
  if (authToken) {
    headers["Authorization"] = authToken
  } else if (key) {
    headers["x-api-key"] = key
  }

  let result: Record<string, unknown>
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 10,
        messages: [{ role: "user", content: "hi" }],
      }),
    })
    const body = await res.json()
    result = { status: res.status, ok: res.ok, body }
  } catch (e) {
    result = { error: String(e) }
  }

  return NextResponse.json({
    key_prefix: key?.slice(0, 12),
    auth_token_prefix: authToken?.slice(0, 20),
    base_url: base,
    result,
  })
}
