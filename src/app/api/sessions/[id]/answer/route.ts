import { NextRequest, NextResponse } from "next/server"
import { pendingApprovals } from "@/lib/agentSSEAdapter"

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { requestId, behavior, updatedInput, message } = await req.json() as {
    requestId:     string
    behavior:      "allow" | "deny"
    updatedInput?: Record<string, unknown>
    message?:      string
  }

  const pending = pendingApprovals.get(requestId)
  if (!pending) {
    return NextResponse.json({ error: "request not found or already resolved" }, { status: 404 })
  }

  pendingApprovals.delete(requestId)

  if (behavior === "allow") {
    pending.resolve({ behavior: "allow", updatedInput: updatedInput ?? {} })
  } else {
    pending.resolve({ behavior: "deny", message: message ?? "用户拒绝了此操作" })
  }

  return NextResponse.json({ ok: true })
}
