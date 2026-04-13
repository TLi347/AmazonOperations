"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import {
  Sparkles, Plus, Send, Copy, Check, Wrench,
  MessageSquare, Trash2, Pencil, X,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ── Markdown renderer ──────────────────────────────────────────────────────────

function parseInline(text: string): React.ReactNode {
  const regex = /(`[^`]+`|\*\*[^*]+\*\*)/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    const token = match[0]
    if (token.startsWith("**")) {
      parts.push(<strong key={match.index}>{token.slice(2, -2)}</strong>)
    } else {
      parts.push(
        <code key={match.index} style={{ background: "#f0eeec", padding: "1px 4px", borderRadius: 3, fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.85em" }}>
          {token.slice(1, -1)}
        </code>
      )
    }
    lastIndex = match.index + token.length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts.length === 0 ? "" : parts.length === 1 && typeof parts[0] === "string" ? parts[0] : <>{parts}</>
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n")
  const elements: React.ReactNode[] = []
  let i = 0, k = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith("### ")) { elements.push(<h3 key={k++} style={{ margin: "10px 0 3px", fontSize: 13, fontWeight: 700 }}>{parseInline(line.slice(4))}</h3>); i++; continue }
    if (line.startsWith("## "))  { elements.push(<h2 key={k++} style={{ margin: "12px 0 4px", fontSize: 14, fontWeight: 700 }}>{parseInline(line.slice(3))}</h2>); i++; continue }
    if (line.startsWith("# "))   { elements.push(<h1 key={k++} style={{ margin: "14px 0 4px", fontSize: 15, fontWeight: 800 }}>{parseInline(line.slice(2))}</h1>); i++; continue }
    if (line.trim() === "---") { elements.push(<hr key={k++} style={{ border: "none", borderTop: "1px solid #e8e5e0", margin: "10px 0" }} />); i++; continue }

    if (line.startsWith("|")) {
      const tableRows: string[][] = []
      while (i < lines.length && lines[i].startsWith("|")) {
        const cells = lines[i].split("|").slice(1, -1).map(c => c.trim())
        if (!cells.every(c => /^[-: ]+$/.test(c))) tableRows.push(cells)
        i++
      }
      if (tableRows.length > 0) {
        const [headers, ...dataRows] = tableRows
        elements.push(
          <div key={k++} style={{ overflowX: "auto", margin: "8px 0" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }}>
              <thead>
                <tr style={{ background: "#f5f4f2" }}>
                  {headers.map((h, j) => <th key={j} style={{ padding: "5px 10px", textAlign: "left", borderBottom: "1px solid #e8e5e0", fontWeight: 600, whiteSpace: "nowrap" }}>{parseInline(h)}</th>)}
                </tr>
              </thead>
              <tbody>
                {dataRows.map((row, j) => (
                  <tr key={j} style={{ borderBottom: "1px solid #f0eeec" }}>
                    {row.map((cell, l) => <td key={l} style={{ padding: "4px 10px", color: "#374151" }}>{parseInline(cell)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
      continue
    }

    if (line.startsWith("> ")) {
      const qLines: string[] = []
      while (i < lines.length && lines[i].startsWith("> ")) { qLines.push(lines[i].slice(2)); i++ }
      elements.push(<div key={k++} style={{ borderLeft: "3px solid #d4d4d4", paddingLeft: 12, margin: "6px 0", color: "#737373" }}>{qLines.map((l, j) => <p key={j} style={{ margin: "2px 0" }}>{parseInline(l)}</p>)}</div>)
      continue
    }

    if (/^\d+\. /.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\. /.test(lines[i])) { items.push(lines[i].replace(/^\d+\. /, "")); i++ }
      elements.push(<ol key={k++} style={{ paddingLeft: 20, margin: "4px 0" }}>{items.map((item, j) => <li key={j} style={{ marginBottom: 3 }}>{parseInline(item)}</li>)}</ol>)
      continue
    }

    if (line.startsWith("- ") || line.startsWith("• ")) {
      const items: string[] = []
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("• "))) { items.push(lines[i].slice(2)); i++ }
      elements.push(<ul key={k++} style={{ paddingLeft: 20, margin: "4px 0" }}>{items.map((item, j) => <li key={j} style={{ marginBottom: 3 }}>{parseInline(item)}</li>)}</ul>)
      continue
    }

    if (line.trim() === "") { elements.push(<div key={k++} style={{ height: 6 }} />); i++; continue }

    elements.push(<p key={k++} style={{ margin: "2px 0", lineHeight: 1.65 }}>{parseInline(line)}</p>)
    i++
  }
  return <div style={{ fontSize: 13 }}>{elements}</div>
}

// ── Typing indicator ───────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1" style={{ padding: "4px 0" }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#a3a3a3", animation: "bounce 1s infinite", animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  )
}

// ── Quick prompts ──────────────────────────────────────────────────────────────

const QUICK_PROMPTS = [
  { icon: "📊", label: "诊断广告 ACoS",  text: "请帮我诊断当前广告的 ACoS 表现，识别高花费低转化的关键词，并给出优化优先级建议。" },
  { icon: "📦", label: "库存健康度",       text: "请分析当前产品的库存健康状况，评估可售天数和补货紧迫性，并给出补货建议。" },
  { icon: "🔔", label: "查看当前告警",    text: "请列出所有当前告警（红色和黄色），并按优先级给出处理建议。" },
  { icon: "📈", label: "销售趋势分析",   text: "请分析最近7天的销售趋势，包括GMV、订单量、Sessions的日环比变化。" },
] as const

// ── Types ──────────────────────────────────────────────────────────────────────

interface SessionMeta {
  id:        string
  title:     string
  createdAt: string
  updatedAt: string
}

interface ChatMessage {
  id:        string
  role:      "user" | "assistant"
  content:   string
  toolCalls?: Array<{ tool: string; input: object; resultSummary: string }>
}

interface ToolBubble {
  tool:           string
  input:          object
  status:         "loading" | "done"
  resultSummary?: string
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ChatPanel() {
  const [sessions, setSessions]               = useState<SessionMeta[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages]               = useState<ChatMessage[]>([])
  const [streamingText, setStreamingText]     = useState("")
  const [toolBubbles, setToolBubbles]         = useState<ToolBubble[]>([])
  const [isStreaming, setIsStreaming]         = useState(false)
  const [input, setInput]                     = useState("")
  const [selectedModel, setSelectedModel]     = useState<string>(process.env.NEXT_PUBLIC_DEFAULT_MODEL || "sonnet")
  const [copiedId, setCopiedId]               = useState<string | null>(null)
  const [renamingId, setRenamingId]           = useState<string | null>(null)
  const [renameValue, setRenameValue]         = useState("")

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef    = useRef<HTMLTextAreaElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages, streamingText])

  // ── Session 管理 ───────────────────────────────────────────────────────────

  const loadSessions = useCallback(async () => {
    const data = await fetch("/api/sessions").then(r => r.json()) as SessionMeta[]
    setSessions(data)
    // 若没有激活 Session 且有列表，自动选第一个
    if (!activeSessionId && data.length > 0) {
      await selectSession(data[0].id, false)
    }
  }, [activeSessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadSessions() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const selectSession = useCallback(async (sessionId: string, refresh = true) => {
    setActiveSessionId(sessionId)
    setStreamingText("")
    setToolBubbles([])
    const data = await fetch(`/api/sessions/${sessionId}`).then(r => r.json()) as { messages: ChatMessage[] }
    setMessages(data.messages ?? [])
    if (refresh) loadSessions()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const createSession = useCallback(async () => {
    const session = await fetch("/api/sessions", { method: "POST" }).then(r => r.json()) as SessionMeta
    setSessions(prev => [session, ...prev])
    setActiveSessionId(session.id)
    setMessages([])
    setStreamingText("")
    setToolBubbles([])
  }, [])

  const deleteSession = useCallback(async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" })
    setSessions(prev => prev.filter(s => s.id !== sessionId))
    if (activeSessionId === sessionId) {
      setActiveSessionId(null)
      setMessages([])
    }
  }, [activeSessionId])

  const startRename = (session: SessionMeta, e: React.MouseEvent) => {
    e.stopPropagation()
    setRenamingId(session.id)
    setRenameValue(session.title)
    setTimeout(() => renameInputRef.current?.focus(), 50)
  }

  const commitRename = useCallback(async () => {
    if (!renamingId || !renameValue.trim()) { setRenamingId(null); return }
    await fetch(`/api/sessions/${renamingId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ title: renameValue.trim() }),
    })
    setSessions(prev => prev.map(s => s.id === renamingId ? { ...s, title: renameValue.trim() } : s))
    setRenamingId(null)
  }, [renamingId, renameValue])

  // ── 发送消息 ───────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming || !activeSessionId) return

    setMessages(prev => [...prev, { id: `tmp-u-${Date.now()}`, role: "user", content: text }])
    setStreamingText("")
    setToolBubbles([])
    setIsStreaming(true)

    // 本地变量累积流式文字和工具气泡，避免 stale closure 读取 React state
    let localText    = ""
    let localBubbles: ToolBubble[] = []

    const finish = () => {
      setStreamingText("")
      setToolBubbles([])
      setIsStreaming(false)
    }

    try {
      const response = await fetch(`/api/sessions/${activeSessionId}/run`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ userMessage: text, model: selectedModel }),
      })

      const reader  = response.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        for (const line of decoder.decode(value, { stream: true }).split("\n")) {
          if (!line.startsWith("data: ")) continue
          try {
            const event = JSON.parse(line.slice(6)) as {
              type:           string
              delta?:         string
              tool?:          string
              input?:         object
              resultSummary?: string
              messageId?:     string
              message?:       string
            }

            if (event.type === "text_delta" && event.delta) {
              localText += event.delta
              setStreamingText(prev => prev + event.delta!)
            }

            if (event.type === "tool_start" && event.tool) {
              const bubble: ToolBubble = { tool: event.tool!, input: event.input ?? {}, status: "loading" }
              localBubbles = [...localBubbles, bubble]
              setToolBubbles([...localBubbles])
            }

            if (event.type === "tool_done" && event.tool) {
              localBubbles = localBubbles.map(b =>
                b.tool === event.tool && b.status === "loading"
                  ? { ...b, status: "done" as const, resultSummary: event.resultSummary }
                  : b
              )
              setToolBubbles([...localBubbles])
            }

            if (event.type === "done") {
              setMessages(prev => [
                ...prev,
                {
                  id:        event.messageId ?? `tmp-a-${Date.now()}`,
                  role:      "assistant" as const,
                  content:   localText,
                  toolCalls: localBubbles.map(b => ({ tool: b.tool, input: b.input, resultSummary: b.resultSummary ?? "" })),
                },
              ])
              finish()
              loadSessions()
            }

            if (event.type === "error") {
              setMessages(prev => [...prev, {
                id:      `tmp-err-${Date.now()}`,
                role:    "assistant" as const,
                content: `错误：${event.message ?? "未知错误"}`,
              }])
              finish()
            }
          } catch { /* skip malformed lines */ }
        }
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        id:      `tmp-err-${Date.now()}`,
        role:    "assistant" as const,
        content: `网络错误：${String(err)}`,
      }])
      finish()
    }
  }, [isStreaming, activeSessionId, loadSessions, selectedModel])

  const handleSend = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg) return
    setInput("")
    if (textareaRef.current) textareaRef.current.style.height = "auto"

    // 若没有 Session，先创建一个
    let sessionId = activeSessionId
    if (!sessionId) {
      const session = await fetch("/api/sessions", { method: "POST" }).then(r => r.json()) as SessionMeta
      setSessions(prev => [session, ...prev])
      setActiveSessionId(session.id)
      sessionId = session.id
    }

    await sendMessage(msg)
  }, [input, activeSessionId, sendMessage])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = "auto"
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
  }

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1500)
    })
  }

  const isTyping = isStreaming && streamingText === "" && toolBubbles.length === 0

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full" style={{ background: "#fafaf9" }}>

      {/* ── 左栏：Session 列表 ─────────────────────────────────────────────── */}
      <div className="flex flex-col flex-shrink-0 border-r" style={{ width: 220, borderColor: "#e8e5e0", background: "#f5f4f2" }}>
        {/* New chat button */}
        <div className="p-3 border-b" style={{ borderColor: "#e8e5e0" }}>
          <button onClick={createSession}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-[#eae8e4]"
            style={{ color: "#1a1a1a", border: "1px solid #e8e5e0", background: "#ffffff" }}>
            <Plus size={14} />
            新对话
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto py-2" style={{ scrollbarWidth: "thin", scrollbarColor: "#d4d4d4 transparent" }}>
          {sessions.length === 0 && (
            <p className="px-3 py-6 text-center text-xs" style={{ color: "#a3a3a3" }}>
              暂无对话<br />点击「新对话」开始
            </p>
          )}
          {sessions.map(session => (
            <div key={session.id}
              className={cn("group flex items-center gap-2 px-3 py-2 mx-1.5 mb-0.5 rounded-lg cursor-pointer transition-colors",
                activeSessionId === session.id ? "bg-white" : "hover:bg-[#eae8e4]")}
              style={{ boxShadow: activeSessionId === session.id ? "0 1px 3px rgba(0,0,0,0.06)" : "none" }}
              onClick={() => selectSession(session.id)}>

              <MessageSquare size={13} style={{ color: "#a3a3a3", flexShrink: 0 }} />

              {renamingId === session.id ? (
                <input
                  ref={renameInputRef}
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenamingId(null) }}
                  onClick={e => e.stopPropagation()}
                  className="flex-1 text-xs bg-transparent outline-none border-b"
                  style={{ color: "#1a1a1a", borderColor: "#1a1a1a", minWidth: 0 }}
                />
              ) : (
                <span className="flex-1 text-xs truncate" style={{ color: "#374151" }}>
                  {session.title}
                </span>
              )}

              {renamingId !== session.id && (
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button title="重命名" onClick={e => startRename(session, e)}
                    className="p-0.5 rounded hover:bg-[#e0deda]" style={{ color: "#9ca3af" }}>
                    <Pencil size={11} />
                  </button>
                  <button title="删除" onClick={e => deleteSession(session.id, e)}
                    className="p-0.5 rounded hover:bg-[#fee2e2]" style={{ color: "#9ca3af" }}>
                    <Trash2 size={11} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── 右栏：对话区 ────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#d4d4d4 transparent" }}>
          <div className="mx-auto" style={{ maxWidth: 720, padding: "24px 20px 8px" }}>

            {/* Welcome state */}
            {messages.length === 0 && !isStreaming && (
              <div>
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl mb-3" style={{ background: "#1a1a1a" }}>
                    <Sparkles size={18} color="white" />
                  </div>
                  <p className="text-sm font-medium" style={{ color: "#1a1a1a" }}>YZ-Ops AI</p>
                  <p className="text-xs mt-1" style={{ color: "#a3a3a3" }}>跨品类运营数据分析 · 已上传文件均可查询</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {QUICK_PROMPTS.map(prompt => (
                    <button key={prompt.label} onClick={() => handleSend(prompt.text)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs transition-all hover:bg-[#eae8e4] hover:scale-[1.02]"
                      style={{ background: "#f0eeec", color: "#374151", border: "1px solid #e8e5e0" }}>
                      <span>{prompt.icon}</span><span>{prompt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message list */}
            <div className="flex flex-col gap-4">
              {messages.map(msg => {
                if (msg.role === "user") {
                  return (
                    <div key={msg.id} className="flex justify-end">
                      <div className="rounded-2xl rounded-tr-sm px-4 py-3 text-sm"
                        style={{ background: "#1a1a1a", color: "#fff", maxWidth: "80%", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                        {msg.content}
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={msg.id} className="flex gap-3">
                    <div className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg mt-0.5" style={{ background: "#1a1a1a" }}>
                      <Sparkles size={13} color="white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* Tool call history (from DB) */}
                      {msg.toolCalls && msg.toolCalls.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {msg.toolCalls.map((tc, idx) => (
                            <span key={idx} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px]"
                              style={{ background: "#f0eeec", color: "#6b7280" }}>
                              <Wrench size={9} />{tc.tool}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="rounded-2xl rounded-tl-sm px-4 py-3" style={{ background: "#f5f4f2" }}>
                        <MarkdownContent content={msg.content} />
                      </div>
                      {/* Copy button */}
                      {msg.content && (
                        <button title="复制" onClick={() => handleCopy(msg.id, msg.content)}
                          className="mt-1 p-1 rounded transition-colors hover:bg-[#eae8e4]"
                          style={{ color: copiedId === msg.id ? "#1a1a1a" : "#a3a3a3" }}>
                          {copiedId === msg.id ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Streaming assistant message */}
              {isStreaming && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg mt-0.5" style={{ background: "#1a1a1a" }}>
                    <Sparkles size={13} color="white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* Active tool bubbles */}
                    {toolBubbles.length > 0 && (
                      <div className="flex flex-col gap-1 mb-2">
                        {toolBubbles.map((bubble, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs"
                            style={{ background: "#f0eeec", color: "#6b7280", width: "fit-content" }}>
                            <Wrench size={10} />
                            <span>{bubble.tool}</span>
                            {bubble.status === "loading" ? (
                              <span style={{ color: "#a3a3a3" }}>…</span>
                            ) : (
                              <>
                                <Check size={10} style={{ color: "#16a34a" }} />
                                {bubble.resultSummary && (
                                  <span style={{ color: "#9ca3af" }}>{bubble.resultSummary}</span>
                                )}
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="rounded-2xl rounded-tl-sm px-4 py-3" style={{ background: "#f5f4f2" }}>
                      {isTyping
                        ? <TypingDots />
                        : <MarkdownContent content={streamingText} />
                      }
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div ref={messagesEndRef} style={{ height: 8 }} />
          </div>
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 px-4 pb-4 pt-2" style={{ background: "#fafaf9" }}>
          <div className="mx-auto" style={{ maxWidth: 720 }}>
            <div className="flex items-end gap-2 rounded-2xl px-3 py-2.5"
              style={{ background: "#ffffff", border: "1px solid #e8e5e0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={isStreaming}
                className="flex-shrink-0 bg-transparent text-xs outline-none cursor-pointer"
                style={{ color: "#8a8a8a", border: "none" }}
                title="选择模型"
              >
                <option value="sonnet">Sonnet</option>
                <option value="haiku">Haiku</option>
                <option value="opus">Opus</option>
              </select>
              <textarea ref={textareaRef} value={input} onChange={handleInputChange} onKeyDown={handleKeyDown}
                placeholder="请提问，如：诊断本周广告效率，或：哪个 ASIN 库存最紧张？"
                rows={1} disabled={isStreaming}
                className="flex-1 resize-none bg-transparent outline-none text-sm leading-relaxed"
                style={{ color: "#1a1a1a", minHeight: 22, maxHeight: 120, scrollbarWidth: "none" }} />
              <button onClick={() => handleSend()} disabled={!input.trim() || isStreaming}
                className="flex-shrink-0 p-1.5 rounded-lg transition-all"
                style={{ background: input.trim() && !isStreaming ? "#1a1a1a" : "#e8e5e0", color: input.trim() && !isStreaming ? "#fff" : "#a3a3a3" }}
                title="发送 (Enter)">
                <Send size={14} />
              </button>
            </div>
            <p className="text-center mt-2 text-[11px]" style={{ color: "#c4c4c4" }}>
              AI 建议基于已上传报表数据生成，仅供参考
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
