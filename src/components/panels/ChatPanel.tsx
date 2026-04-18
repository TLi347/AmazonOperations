"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import {
  Sparkles, Plus, Copy, Check, Wrench,
  MessageSquare, Trash2, Pencil, X,
  BarChart3, Package, Bell, TrendingUp,
  RefreshCw, ArrowDown, User, AlertTriangle,
} from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent } from "@/components/ui/card"
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
  MessageToolbar,
  MessageActions,
  MessageAction,
} from "@/components/ai-elements/message"
import { PromptInputSubmit } from "@/components/ai-elements/prompt-input"
import { Suggestions, Suggestion } from "@/components/ai-elements/suggestion"

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

// ── Relative time helper ──────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "刚刚"
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}天前`
  return new Date(dateStr).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })
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
  const [selectedModel, setSelectedModel]     = useState<string>(process.env.NEXT_PUBLIC_DEFAULT_MODEL || "haiku")
  const [copiedId, setCopiedId]               = useState<string | null>(null)
  const [renamingId, setRenamingId]           = useState<string | null>(null)
  const [renameValue, setRenameValue]         = useState("")
  const [contextResetWarning, setContextResetWarning] = useState(false)

  const [showScrollBtn, setShowScrollBtn] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef    = useRef<HTMLTextAreaElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const abortRef       = useRef<AbortController | null>(null)
  const scrollRef      = useRef<HTMLDivElement>(null)
  const isNearBottomRef = useRef(true)

  // 直接操作 scrollRef.scrollTop，避免 scrollIntoView 滚动错误的祖先容器
  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollRef.current
    if (!el) return
    if (smooth) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
    } else {
      el.scrollTop = el.scrollHeight
    }
    isNearBottomRef.current = true
  }, [])

  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollToBottom(false)
    }
  }, [messages, scrollToBottom])

  // streaming 时平滑跟随
  useEffect(() => {
    if (isNearBottomRef.current && streamingText) {
      scrollToBottom(false)
    }
  }, [streamingText, scrollToBottom])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150
    isNearBottomRef.current = isNearBottom
    setShowScrollBtn(!isNearBottom)
  }, [])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    setIsStreaming(false)
    setStreamingText("")
    setToolBubbles([])
  }, [])

  // ── Session 管理 ───────────────────────────────────────────────────────────

  // 用 ref 跟踪最新的 activeSessionId，避免 useCallback 闭包陈旧
  const activeSessionRef = useRef(activeSessionId)
  activeSessionRef.current = activeSessionId

  const loadSessions = useCallback(async (skipAutoSelect = false) => {
    const data = await fetch("/api/sessions").then(r => r.json()) as SessionMeta[]
    setSessions(data)
    // 仅在初始加载（无激活 session）时自动选第一个
    if (!skipAutoSelect && !activeSessionRef.current && data.length > 0) {
      setActiveSessionId(data[0].id)
      const detail = await fetch(`/api/sessions/${data[0].id}`).then(r => r.json()) as { messages: ChatMessage[] }
      setMessages(detail.messages ?? [])
    }
  }, [])

  useEffect(() => { loadSessions() }, [loadSessions])

  const selectSession = useCallback(async (sessionId: string) => {
    setActiveSessionId(sessionId)
    setStreamingText("")
    setToolBubbles([])
    setContextResetWarning(false)
    const data = await fetch(`/api/sessions/${sessionId}`).then(r => r.json()) as { messages: ChatMessage[] }
    setMessages(data.messages ?? [])
    loadSessions(true) // 刷新列表但不自动选择
  }, [loadSessions])

  const createSession = useCallback(async () => {
    const session = await fetch("/api/sessions", { method: "POST" }).then(r => r.json()) as SessionMeta
    setSessions(prev => [session, ...prev])
    setActiveSessionId(session.id)
    setMessages([])
    setStreamingText("")
    setToolBubbles([])
    toast.success("新对话已创建")
  }, [])

  const deleteSession = useCallback(async (sessionId: string) => {
    await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" })
    setSessions(prev => prev.filter(s => s.id !== sessionId))
    if (activeSessionId === sessionId) {
      setActiveSessionId(null)
      setMessages([])
    }
    toast.success("对话已删除")
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
      abortRef.current = new AbortController()
      const response = await fetch(`/api/sessions/${activeSessionId}/run`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ userMessage: text, model: selectedModel }),
        signal:  abortRef.current.signal,
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

            if (event.type === "context_reset") {
              setContextResetWarning(true)
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
      toast.error("网络错误", { description: String(err) })
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

  const handleRegenerate = useCallback(async (msg: ChatMessage) => {
    const idx = messages.findIndex(m => m.id === msg.id)
    if (idx <= 0) return
    const userMsg = messages[idx - 1]
    if (userMsg.role !== "user") return
    setMessages(prev => prev.slice(0, idx))
    await sendMessage(userMsg.content)
  }, [messages, sendMessage])

  const handleRetry = useCallback(async (msg: ChatMessage) => {
    const idx = messages.findIndex(m => m.id === msg.id)
    if (idx <= 0) return
    const userMsg = messages[idx - 1]
    if (userMsg.role !== "user") return
    setMessages(prev => prev.slice(0, idx))
    await sendMessage(userMsg.content)
  }, [messages, sendMessage])

  const isTyping = isStreaming && streamingText === "" && toolBubbles.length === 0

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-background">

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
                  "group flex flex-col px-3 py-2 mx-1.5 mb-0.5 rounded-lg cursor-pointer transition-colors",
                  "hover:bg-muted",
                  activeSessionId === session.id ? "bg-primary/5 shadow-sm" : ""
                )}
                data-active={activeSessionId === session.id}
                onClick={() => selectSession(session.id)}>

                {/* 顶行：图标 + 标题 + 重命名（hover 显示）*/}
                <div className="flex items-center gap-2">
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
                    <span className="flex-1 text-xs truncate text-foreground/80">{session.title}</span>
                  )}
                  {renamingId !== session.id && (
                    <Button variant="ghost" size="icon-xs" title="重命名"
                      onClick={e => startRename(session, e)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground flex-shrink-0">
                      <Pencil size={11} />
                    </Button>
                  )}
                </div>

                {/* 底行：时间 + 删除按钮（常显）*/}
                <div className="flex items-center justify-between mt-0.5 pl-5">
                  <span className="text-[10px] text-muted-foreground">{relativeTime(session.updatedAt)}</span>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon-xs" title="删除"
                        onClick={e => e.stopPropagation()}
                        className="text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive flex-shrink-0">
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
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* ── 右栏：对话区 ────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0">

        {/* Context reset warning */}
        {contextResetWarning && (
          <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 border-b border-yellow-200 text-xs text-yellow-800 flex-shrink-0">
            <AlertTriangle size={13} className="flex-shrink-0" />
            <span>对话上下文已重置，Claude 不记得之前的工具调用记录</span>
            <button
              onClick={() => setContextResetWarning(false)}
              className="ml-auto p-0.5 rounded hover:bg-yellow-100"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* Messages area */}
        <div className="relative flex-1 overflow-hidden">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto"
        >
          <div className="mx-auto max-w-[720px] px-5 pt-6 pb-2">

            {/* Welcome state */}
            {messages.length === 0 && !isStreaming && (
              <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-primary mb-4">
                  <Sparkles size={24} className="text-primary-foreground" />
                </div>
                <p className="text-base font-semibold text-foreground">YZ-Ops AI</p>
                <p className="text-sm mt-1 text-muted-foreground">跨品类运营数据分析助手</p>
                <p className="text-xs mt-0.5 text-muted-foreground/60">已上传的报表文件均可查询分析</p>
                <div className="mt-8">
                  <Suggestions className="justify-center flex-wrap">
                    {QUICK_PROMPTS.map(prompt => (
                      <Suggestion
                        key={prompt.label}
                        suggestion={prompt.text}
                        onClick={(text) => handleSend(text)}
                        className="gap-1.5"
                      >
                        <span>{prompt.icon}</span>
                        <span>{prompt.label}</span>
                      </Suggestion>
                    ))}
                  </Suggestions>
                </div>
              </div>
            )}

            {/* Message list */}
            <div className="flex flex-col gap-4">
              {messages.map(msg => {
                if (msg.role === "user") {
                  return (
                    <div key={msg.id} className="flex gap-3 items-start justify-end">
                      <div className="flex-1 min-w-0">
                        <Message from="user">
                          <MessageContent>
                            <MessageResponse>{msg.content}</MessageResponse>
                          </MessageContent>
                        </Message>
                      </div>
                      <div className="flex-shrink-0 size-7 rounded-full bg-muted flex items-center justify-center mt-0.5">
                        <User size={14} className="text-muted-foreground" />
                      </div>
                    </div>
                  )
                }

                const isError = msg.content.startsWith("错误：") || msg.content.startsWith("网络错误：")

                if (isError) {
                  return (
                    <div key={msg.id} className="flex gap-3 items-start group/msg">
                      <div className="flex-shrink-0 size-7 rounded-full bg-primary flex items-center justify-center mt-0.5">
                        <Sparkles size={14} className="text-primary-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Message from="assistant">
                          <MessageContent>
                            <div className="text-destructive text-sm">{msg.content}</div>
                          </MessageContent>
                          <MessageToolbar className="opacity-0 group-hover/msg:opacity-100 transition-opacity">
                            <MessageActions>
                              <MessageAction tooltip="重试" onClick={() => handleRetry(msg)}>
                                <RefreshCw size={14} />
                              </MessageAction>
                            </MessageActions>
                          </MessageToolbar>
                        </Message>
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={msg.id} className="flex gap-3 items-start group/msg">
                    <div className="flex-shrink-0 size-7 rounded-full bg-primary flex items-center justify-center mt-0.5">
                      <Sparkles size={14} className="text-primary-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Message from="assistant">
                        {/* Tool call history (from DB) */}
                        {msg.toolCalls && msg.toolCalls.length > 0 && (
                          <div className="flex flex-col gap-1 mb-1">
                            {msg.toolCalls.map((tc, idx) => (
                              <div key={idx} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Wrench size={10} />
                                <span>{tc.tool}</span>
                                <Check size={10} className="text-emerald-600" />
                                {tc.resultSummary && (
                                  <span className="text-muted-foreground/70">{tc.resultSummary}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        <MessageContent>
                          <MessageResponse>{msg.content}</MessageResponse>
                        </MessageContent>
                        {msg.content && (
                          <MessageToolbar className="opacity-0 group-hover/msg:opacity-100 transition-opacity">
                            <MessageActions>
                              <MessageAction tooltip="复制" onClick={() => handleCopy(msg.id, msg.content)}>
                                {copiedId === msg.id ? <Check size={14} /> : <Copy size={14} />}
                              </MessageAction>
                              <MessageAction tooltip="重新生成" onClick={() => handleRegenerate(msg)}>
                                <RefreshCw size={14} />
                              </MessageAction>
                            </MessageActions>
                          </MessageToolbar>
                        )}
                      </Message>
                    </div>
                  </div>
                )
              })}

              {/* Streaming assistant message */}
              {isStreaming && (
                <div className="flex gap-3 items-start">
                  <div className="flex-shrink-0 size-7 rounded-full bg-primary flex items-center justify-center mt-0.5">
                    <Sparkles size={14} className="text-primary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
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
                  </div>
                </div>
              )}
            </div>

            <div ref={messagesEndRef} className="h-2" />
          </div>
        </div>
        {showScrollBtn && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full shadow-md gap-1"
              onClick={() => scrollToBottom()}
            >
              <ArrowDown size={14} />
              回到底部
            </Button>
          </div>
        )}
        </div>

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

              <PromptInputSubmit
                status={isStreaming ? "streaming" : "ready"}
                onStop={handleStop}
                onClick={() => handleSend()}
                disabled={!input.trim() && !isStreaming}
              />
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
