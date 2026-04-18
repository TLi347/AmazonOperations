"use client"

/**
 * POC Chat — 隔离测试删除按钮 + Chat 功能
 * 访问：http://localhost:3000/poc-chat
 *
 * 不使用任何 shadcn/Radix UI 组件，纯 HTML + Tailwind，排除组件层问题
 */

import { useState, useRef, useEffect } from "react"

interface Session {
  id: string
  title: string
  updatedAt: string
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

export default function PocChat() {
  const [sessions, setSessions]         = useState<Session[]>([])
  const [activeId, setActiveId]         = useState<string | null>(null)
  const [messages, setMessages]         = useState<Message[]>([])
  const [input, setInput]               = useState("")
  const [streaming, setStreaming]       = useState("")
  const [isLoading, setIsLoading]       = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null)
  const [log, setLog]                   = useState<string[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const addLog = (msg: string) => setLog(p => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...p.slice(0, 49)])

  // ── Sessions ──────────────────────────────────────────────────────────────
  const loadSessions = async () => {
    const data = await fetch("/api/sessions").then(r => r.json()) as Session[]
    setSessions(data)
    addLog(`Loaded ${data.length} sessions`)
  }

  const createSession = async () => {
    const s = await fetch("/api/sessions", { method: "POST" }).then(r => r.json()) as Session
    setSessions(p => [s, ...p])
    setActiveId(s.id)
    setMessages([])
    addLog(`Created session ${s.id.slice(0, 8)}`)
  }

  const deleteSession = async (id: string) => {
    addLog(`Deleting session ${id.slice(0, 8)}…`)
    const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" })
    const json = await res.json()
    addLog(`Delete response: ${JSON.stringify(json)}`)
    setSessions(p => p.filter(s => s.id !== id))
    if (activeId === id) { setActiveId(null); setMessages([]) }
    setDeleteTarget(null)
  }

  const selectSession = async (id: string) => {
    setActiveId(id)
    setStreaming("")
    const data = await fetch(`/api/sessions/${id}`).then(r => r.json()) as { messages: Message[] }
    setMessages(data.messages ?? [])
    addLog(`Selected session ${id.slice(0, 8)}, ${data.messages?.length ?? 0} msgs`)
  }

  useEffect(() => { loadSessions() }, [])

  // ── Send ──────────────────────────────────────────────────────────────────
  const send = async () => {
    if (!input.trim() || isLoading) return
    const text = input.trim()
    setInput("")

    let sid = activeId
    if (!sid) {
      const s = await fetch("/api/sessions", { method: "POST" }).then(r => r.json()) as Session
      setSessions(p => [s, ...p])
      setActiveId(s.id)
      sid = s.id
    }

    setMessages(p => [...p, { id: `u-${Date.now()}`, role: "user", content: text }])
    setStreaming("")
    setIsLoading(true)
    addLog(`Sending to ${sid!.slice(0, 8)}: "${text.slice(0, 40)}"`)

    let localText = ""
    try {
      abortRef.current = new AbortController()
      const resp = await fetch(`/api/sessions/${sid}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userMessage: text }),
        signal: abortRef.current.signal,
      })
      addLog(`SSE connected, status=${resp.status}`)

      const reader = resp.body!.getReader()
      const dec = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) { addLog("SSE stream done"); break }
        const chunk = dec.decode(value, { stream: true })
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue
          try {
            const ev = JSON.parse(line.slice(6)) as { type: string; delta?: string; message?: string; messageId?: string }
            addLog(`SSE event: ${ev.type}${ev.delta ? ` delta(${ev.delta.length}ch)` : ""}`)
            if (ev.type === "text_delta" && ev.delta) {
              localText += ev.delta
              setStreaming(localText)
            }
            if (ev.type === "done") {
              setMessages(p => [...p, { id: ev.messageId ?? `a-${Date.now()}`, role: "assistant", content: localText }])
              setStreaming("")
            }
            if (ev.type === "error") {
              addLog(`ERROR from server: ${ev.message}`)
              setMessages(p => [...p, { id: `err-${Date.now()}`, role: "assistant", content: `❌ ${ev.message}` }])
              setStreaming("")
            }
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      addLog(`Fetch error: ${String(e)}`)
    } finally {
      setIsLoading(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-gray-50 font-mono text-sm">

      {/* Session list */}
      <div className="w-56 bg-white border-r flex flex-col">
        <div className="p-3 border-b">
          <button onClick={createSession}
            className="w-full py-1.5 px-3 bg-blue-500 text-white rounded text-xs hover:bg-blue-600">
            + 新对话
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.map(s => (
            <div key={s.id}
              className={`rounded border p-2 cursor-pointer ${activeId === s.id ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}
              onClick={() => selectSession(s.id)}>
              <div className="text-xs truncate text-gray-800">{s.title}</div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-gray-400">{s.id.slice(0, 8)}</span>
                {/* 删除按钮 — 无任何 Radix/shadcn 组件 */}
                <button
                  onClick={e => { e.stopPropagation(); setDeleteTarget(s) }}
                  className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-[10px] hover:bg-red-200">
                  🗑 删除
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map(m => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[70%] rounded p-2 text-xs whitespace-pre-wrap ${
                m.role === "user" ? "bg-blue-500 text-white" : "bg-white border text-gray-800"
              }`}>
                {m.content || <span className="text-gray-400 italic">(empty)</span>}
              </div>
            </div>
          ))}
          {streaming && (
            <div className="flex justify-start">
              <div className="max-w-[70%] rounded p-2 text-xs bg-white border text-gray-800 whitespace-pre-wrap">
                {streaming}<span className="animate-pulse">▊</span>
              </div>
            </div>
          )}
          {isLoading && !streaming && (
            <div className="text-xs text-gray-400">⏳ 等待响应…</div>
          )}
        </div>

        <div className="border-t p-3 flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="发送消息…"
            className="flex-1 border rounded px-2 py-1.5 text-xs outline-none focus:border-blue-400"
          />
          <button onClick={send} disabled={isLoading}
            className="px-3 py-1.5 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 disabled:opacity-50">
            发送
          </button>
        </div>
      </div>

      {/* Debug log */}
      <div className="w-64 bg-gray-900 text-green-400 p-2 overflow-y-auto text-[10px] flex flex-col-reverse">
        {log.map((l, i) => <div key={i}>{l}</div>)}
      </div>

      {/* Delete confirm — 原生 dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-5 w-72 shadow-xl">
            <p className="text-sm font-medium mb-1">删除对话</p>
            <p className="text-xs text-gray-500 mb-4">确定删除「{deleteTarget.title}」？不可撤销。</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 border rounded text-xs hover:bg-gray-50">
                取消
              </button>
              <button onClick={() => deleteSession(deleteTarget.id)}
                className="px-3 py-1.5 bg-red-500 text-white rounded text-xs hover:bg-red-600">
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
