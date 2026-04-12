"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import {
  Sparkles, Paperclip, Send, Copy,
  ThumbsUp, ThumbsDown, RefreshCw, Check, Wrench,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/appStore"

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

// ── Message type ───────────────────────────────────────────────────────────────

interface ChatMessage {
  id:        string
  role:      "user" | "assistant"
  content:   string
  tools?:    string[]   // 此轮调用的工具名列表
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ChatPanel() {
  const { selectedModel } = useAppStore()
  const [messages, setMessages]       = useState<ChatMessage[]>([])
  const [input, setInput]             = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [activeTools, setActiveTools] = useState<string[]>([])
  const [likedIds, setLikedIds]       = useState<Set<string>>(new Set())
  const [dislikedIds, setDislikedIds] = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId]       = useState<string | null>(null)

  const messagesEndRef       = useRef<HTMLDivElement>(null)
  const textareaRef          = useRef<HTMLTextAreaElement>(null)
  const abortControllerRef   = useRef<AbortController | null>(null)

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

  useEffect(() => () => { abortControllerRef.current?.abort() }, [])

  const doSend = useCallback(async (userText: string) => {
    if (!userText.trim() || isStreaming) return

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: userText }
    const asstMsg: ChatMessage = { id: `a-${Date.now()}`, role: "assistant", content: "", tools: [] }

    setMessages(prev => [...prev, userMsg, asstMsg])
    setIsStreaming(true)
    setActiveTools([])

    try {
      // 每次发消息重新获取最新 system prompt（包含最新文件状态）
      const systemPrompt = await fetch("/api/build-prompt").then(r => r.text())

      // 构建 Anthropic 消息历史（仅 user/assistant 文字轮次，不含 tool_use/tool_result）
      const history = messages
        .filter(m => m.content !== "")
        .map(m => ({ role: m.role, content: m.content }))
      history.push({ role: "user" as const, content: userText })

      const controller = new AbortController()
      abortControllerRef.current = controller

      const response = await fetch("/api/agent", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        signal:  controller.signal,
        body:    JSON.stringify({ messages: history, systemPrompt, model: selectedModel }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "请求失败" })) as { error?: string }
        setMessages(prev => {
          const next = [...prev]
          next[next.length - 1] = { ...next[next.length - 1], content: `❌ 错误：${err.error ?? "请求失败"}` }
          return next
        })
        return
      }

      const reader  = response.body!.getReader()
      const decoder = new TextDecoder()
      const calledTools: string[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const lines = decoder.decode(value, { stream: true }).split("\n")
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const event = JSON.parse(line.slice(6)) as {
              type:     string
              delta?:   string
              tool?:    string
              message?: string
            }

            if (event.type === "text_delta" && event.delta) {
              setMessages(prev => {
                const next = [...prev]
                const last = { ...next[next.length - 1] }
                last.content += event.delta!
                next[next.length - 1] = last
                return next
              })
            }

            if (event.type === "tool_start" && event.tool) {
              calledTools.push(event.tool)
              setActiveTools([...calledTools])
            }

            if (event.type === "tool_done") {
              // keep showing tools until done
            }

            if (event.type === "done") {
              setActiveTools([])
              // record which tools were used for this message
              if (calledTools.length > 0) {
                setMessages(prev => {
                  const next = [...prev]
                  next[next.length - 1] = { ...next[next.length - 1], tools: [...calledTools] }
                  return next
                })
              }
            }

            if (event.type === "error") {
              setMessages(prev => {
                const next = [...prev]
                next[next.length - 1] = { ...next[next.length - 1], content: `❌ ${event.message ?? "未知错误"}` }
                return next
              })
            }
          } catch { /* skip malformed events */ }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        // 用户中断，移除空的 assistant placeholder
        setMessages(prev => prev.filter(m => !(m.role === "assistant" && m.content === "")))
        return
      }
      setMessages(prev => {
        const next = [...prev]
        next[next.length - 1] = { ...next[next.length - 1], content: "❌ 网络错误，请稍后重试。" }
        return next
      })
    } finally {
      setIsStreaming(false)
      setActiveTools([])
    }
  }, [isStreaming, messages])

  const handleSend = useCallback(async (text?: string) => {
    const msgText = (text ?? input).trim()
    if (!msgText) return
    setInput("")
    if (textareaRef.current) textareaRef.current.style.height = "auto"
    await doSend(msgText)
  }, [input, doSend])

  const handleRegenerate = useCallback(async () => {
    if (isStreaming || messages.length === 0) return
    const last = messages[messages.length - 1]
    if (last.role !== "assistant") return
    const lastUser = [...messages].reverse().find(m => m.role === "user")
    if (!lastUser) return
    setMessages(prev => prev.slice(0, -1))  // remove last assistant message
    await doSend(lastUser.content)
  }, [isStreaming, messages, doSend])

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1500)
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = "auto"
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
  }

  const isTyping = isStreaming && messages.length > 0 &&
    messages[messages.length - 1].role === "assistant" &&
    messages[messages.length - 1].content === ""

  return (
    <div className="flex flex-col h-full" style={{ background: "#fafaf9" }}>
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
            {messages.map((msg, idx) => {
              const isLast    = idx === messages.length - 1
              const showTyping = isTyping && isLast && msg.role === "assistant"

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
                    {/* Tool activity indicator (during streaming) */}
                    {isLast && isStreaming && activeTools.length > 0 && (
                      <div className="flex items-center gap-1.5 mb-2 text-xs" style={{ color: "#a3a3a3" }}>
                        <Wrench size={11} />
                        <span>查询中：{activeTools[activeTools.length - 1]}</span>
                      </div>
                    )}
                    <div className="rounded-2xl rounded-tl-sm px-4 py-3" style={{ background: "#f5f4f2" }}>
                      {showTyping ? <TypingDots /> : <MarkdownContent content={msg.content} />}
                    </div>

                    {/* Tools used (shown after response) */}
                    {!showTyping && msg.content && msg.tools && msg.tools.length > 0 && (
                      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                        {msg.tools.map(tool => (
                          <span key={tool} className="flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px]"
                            style={{ background: "#f0eeec", color: "#6b7280" }}>
                            <Wrench size={9} />{tool}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Action buttons */}
                    {!showTyping && msg.content && (
                      <div className={cn("flex items-center gap-0.5 mt-1", isStreaming && isLast ? "opacity-0" : "opacity-100")}>
                        <button title="复制" onClick={() => handleCopy(msg.id, msg.content)}
                          className="p-1 rounded transition-colors hover:bg-[#eae8e4]" style={{ color: copiedId === msg.id ? "#1a1a1a" : "#a3a3a3" }}>
                          {copiedId === msg.id ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                        <button title="有帮助" onClick={() => setLikedIds(prev => { const n = new Set(prev); n.has(msg.id) ? n.delete(msg.id) : n.add(msg.id); return n })}
                          className="p-1 rounded transition-colors hover:bg-[#eae8e4]" style={{ color: likedIds.has(msg.id) ? "#1a1a1a" : "#a3a3a3" }}>
                          <ThumbsUp size={13} />
                        </button>
                        <button title="没帮助" onClick={() => setDislikedIds(prev => { const n = new Set(prev); n.has(msg.id) ? n.delete(msg.id) : n.add(msg.id); return n })}
                          className="p-1 rounded transition-colors hover:bg-[#eae8e4]" style={{ color: dislikedIds.has(msg.id) ? "#1a1a1a" : "#a3a3a3" }}>
                          <ThumbsDown size={13} />
                        </button>
                        {isLast && (
                          <button title="重新生成" onClick={handleRegenerate}
                            className="p-1 rounded transition-colors hover:bg-[#eae8e4]" style={{ color: "#a3a3a3" }}>
                            <RefreshCw size={13} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div ref={messagesEndRef} style={{ height: 8 }} />
        </div>
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 px-4 pb-4 pt-2" style={{ background: "#fafaf9" }}>
        <div className="mx-auto" style={{ maxWidth: 720 }}>
          <div className="flex items-end gap-2 rounded-2xl px-3 py-2.5"
            style={{ background: "#ffffff", border: "1px solid #e8e5e0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <button className="flex-shrink-0 p-1.5 rounded-lg transition-colors hover:bg-[#f0eeec]"
              style={{ color: "#a3a3a3" }} title="上传文件（使用右侧 Context 面板上传报表）">
              <Paperclip size={15} />
            </button>
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
  )
}
