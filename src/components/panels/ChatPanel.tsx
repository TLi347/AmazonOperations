"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import {
  Sparkles, Plus, Send, Copy, Check, Wrench,
  MessageSquare, Trash2, Pencil, X,
  BarChart3, Package, Bell, TrendingUp,
} from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"

// ── Typing indicator ───────────────────────────────────────────────────────────

const DOT_DELAY_CLASS = [
  "[animation-delay:0s]",
  "[animation-delay:0.15s]",
  "[animation-delay:0.3s]",
] as const

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className={cn("size-1.5 rounded-full bg-muted-foreground dot-bounce", DOT_DELAY_CLASS[i])}
        />
      ))}
    </div>
  )
}

// ── Quick prompts ──────────────────────────────────────────────────────────────

const QUICK_PROMPTS: { icon: ReactNode; label: string; text: string }[] = [
  { icon: <BarChart3 size={13} />,  label: "诊断广告 ACoS",  text: "请帮我诊断当前广告的 ACoS 表现，识别高花费低转化的关键词，并给出优化优先级建议。" },
  { icon: <Package size={13} />,    label: "库存健康度",       text: "请分析当前产品的库存健康状况，评估可售天数和补货紧迫性，并给出补货建议。" },
  { icon: <Bell size={13} />,       label: "查看当前告警",    text: "请列出所有当前告警（红色和黄色），并按优先级给出处理建议。" },
  { icon: <TrendingUp size={13} />, label: "销售趋势分析",   text: "请分析最近7天的销售趋势，包括GMV、订单量、Sessions的日环比变化。" },
]

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

  const deleteSession = useCallback(async (sessionId: string) => {
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
    <div className="flex h-full bg-background">

      {/* ── 左栏：Session 列表 ─────────────────────────────────────────────── */}
      <div className="flex flex-col flex-shrink-0 w-[220px] border-r border-border bg-muted/50">
        {/* New chat button */}
        <div className="p-3 border-b border-border">
          <Button variant="outline" size="sm" className="w-full gap-2" onClick={createSession}>
            <Plus size={14} />
            新对话
          </Button>
        </div>

        {/* Session list */}
        <ScrollArea className="flex-1">
          <div className="py-2">
            {sessions.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                暂无对话<br />点击「新对话」开始
              </p>
            )}
            {sessions.map(session => (
              <div key={session.id}
                className={cn(
                  "group flex items-center gap-2 px-3 py-2 mx-1.5 mb-0.5 rounded-lg cursor-pointer transition-colors",
                  "hover:bg-muted",
                  activeSessionId === session.id
                    ? "bg-primary/5 shadow-sm"
                    : ""
                )}
                data-active={activeSessionId === session.id}
                onClick={() => selectSession(session.id)}>

                <MessageSquare size={13} className="text-muted-foreground flex-shrink-0" />

                {renamingId === session.id ? (
                  <Input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenamingId(null) }}
                    onClick={e => e.stopPropagation()}
                    className="flex-1 h-5 text-xs border-0 border-b border-foreground rounded-none bg-transparent px-0 py-0 focus-visible:ring-0 focus-visible:border-foreground"
                  />
                ) : (
                  <span className="flex-1 text-xs truncate text-foreground/80">
                    {session.title}
                  </span>
                )}

                {renamingId !== session.id && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon-xs" title="重命名"
                      onClick={e => startRename(session, e)}
                      className="text-muted-foreground">
                      <Pencil size={11} />
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon-xs" title="删除"
                          onClick={e => e.stopPropagation()}
                          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                          <Trash2 size={11} />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent size="sm">
                        <AlertDialogHeader>
                          <AlertDialogTitle>删除对话</AlertDialogTitle>
                          <AlertDialogDescription>
                            确定要删除「{session.title}」吗？此操作不可撤销。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction variant="destructive" onClick={() => deleteSession(session.id)}>
                            删除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* ── 右栏：对话区 ────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Messages area */}
        <ScrollArea className="flex-1">
          <div className="mx-auto max-w-[720px] px-5 pt-6 pb-2">

            {/* Welcome state */}
            {messages.length === 0 && !isStreaming && (
              <div>
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center size-10 rounded-xl bg-primary mb-3">
                    <Sparkles size={18} className="text-primary-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">YZ-Ops AI</p>
                  <p className="text-xs mt-1 text-muted-foreground">跨品类运营数据分析 · 已上传文件均可查询</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {QUICK_PROMPTS.map(prompt => (
                    <Button key={prompt.label} variant="outline" size="sm"
                      className="gap-1.5 rounded-full hover:scale-[1.02] transition-all"
                      onClick={() => handleSend(prompt.text)}>
                      <span>{prompt.icon}</span>
                      <span>{prompt.label}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Message list */}
            <div className="flex flex-col gap-4">
              {messages.map(msg => {
                if (msg.role === "user") {
                  return (
                    <Message key={msg.id} from="user">
                      <MessageContent>
                        <MessageResponse>{msg.content}</MessageResponse>
                      </MessageContent>
                    </Message>
                  )
                }

                return (
                  <Message key={msg.id} from="assistant">
                    {/* Tool call history (from DB) */}
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {msg.toolCalls.map((tc, idx) => (
                          <Badge key={idx} variant="secondary" className="gap-1 text-[10px] font-normal">
                            <Wrench size={9} />
                            {tc.tool}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <MessageContent>
                      <MessageResponse>{msg.content}</MessageResponse>
                    </MessageContent>
                    {/* Copy button */}
                    {msg.content && (
                      <Button variant="ghost" size="icon-xs" title="复制"
                        className={cn(
                          "text-muted-foreground",
                          copiedId === msg.id && "text-foreground"
                        )}
                        onClick={() => handleCopy(msg.id, msg.content)}>
                        {copiedId === msg.id ? <Check size={13} /> : <Copy size={13} />}
                      </Button>
                    )}
                  </Message>
                )
              })}

              {/* Streaming assistant message */}
              {isStreaming && (
                <Message from="assistant">
                  {/* Active tool bubbles */}
                  {toolBubbles.length > 0 && (
                    <div className="flex flex-col gap-1">
                      {toolBubbles.map((bubble, idx) => (
                        <Card key={idx} size="sm" className="w-fit py-0 ring-0 border-0 bg-muted/60">
                          <CardContent className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground">
                            <Wrench size={10} />
                            <span>{bubble.tool}</span>
                            {bubble.status === "loading" ? (
                              <span className="text-muted-foreground/60">…</span>
                            ) : (
                              <>
                                <Check size={10} className="text-green-600" />
                                {bubble.resultSummary && (
                                  <span className="text-muted-foreground/70">{bubble.resultSummary}</span>
                                )}
                              </>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                  <MessageContent>
                    {isTyping
                      ? <TypingDots />
                      : <MessageResponse isAnimating>{streamingText}</MessageResponse>
                    }
                  </MessageContent>
                </Message>
              )}
            </div>

            <div ref={messagesEndRef} className="h-2" />
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="flex-shrink-0 px-4 pb-4 pt-2 bg-background">
          <div className="mx-auto max-w-[720px]">
            <div className="flex items-end gap-2 rounded-2xl border border-border bg-card px-3 py-2.5 shadow-sm">
              <Select
                value={selectedModel}
                onValueChange={setSelectedModel}
                disabled={isStreaming}
              >
                <SelectTrigger size="sm" className="flex-shrink-0 w-auto border-0 bg-transparent shadow-none px-1.5 text-xs text-muted-foreground focus-visible:ring-0" title="选择模型">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sonnet">Sonnet</SelectItem>
                  <SelectItem value="haiku">Haiku</SelectItem>
                  <SelectItem value="opus">Opus</SelectItem>
                </SelectContent>
              </Select>

              <Textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="请提问，如：诊断本周广告效率，或：哪个 ASIN 库存最紧张？"
                rows={1}
                disabled={isStreaming}
                className="flex-1 resize-none border-0 bg-transparent shadow-none text-sm leading-relaxed min-h-[22px] max-h-[120px] py-0 px-0 focus-visible:ring-0 [scrollbar-width:none]"
              />

              <Button
                size="icon-sm"
                onClick={() => handleSend()}
                disabled={!input.trim() || isStreaming}
                title="发送 (Enter)"
              >
                <Send size={14} />
              </Button>
            </div>
            <p className="text-center mt-2 text-[11px] text-muted-foreground/60">
              AI 建议基于已上传报表数据生成，仅供参考
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
