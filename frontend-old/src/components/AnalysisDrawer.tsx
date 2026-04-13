import React, { useState, useEffect, useRef, useCallback } from 'react'
import type { ChatMessage } from '../types/signals'
import { connectChatStream, sendChat } from '../api/client'
import type { ChatContext } from '../api/client'

interface AnalysisDrawerProps {
  isOpen: boolean
  onClose: () => void
  initialPrompt?: string
  context: ChatContext
}

export default function AnalysisDrawer({
  isOpen,
  onClose,
  initialPrompt,
  context,
}: AnalysisDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const initialPromptSentRef = useRef<string | null>(null)

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingContent, scrollToBottom])

  // Handle initial prompt when drawer opens
  useEffect(() => {
    if (
      isOpen &&
      initialPrompt &&
      initialPrompt !== initialPromptSentRef.current
    ) {
      initialPromptSentRef.current = initialPrompt
      sendMessage(initialPrompt)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialPrompt])

  // Cleanup ws on close
  useEffect(() => {
    if (!isOpen) {
      wsRef.current?.close()
      wsRef.current = null
      setIsStreaming(false)
      setStreamingContent('')
    }
  }, [isOpen])

  const sendMessage = useCallback(
    async (prompt: string) => {
      if (!prompt.trim() || isStreaming) return

      const userMsg: ChatMessage = { role: 'user', content: prompt }
      setMessages((prev) => [...prev, userMsg])
      setInput('')
      setIsStreaming(true)
      setStreamingContent('')

      // 直接使用 HTTP（WebSocket chat 端点暂未实现）
      fallbackHttpSend(prompt)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages, context, isStreaming]
  )

  const streamingContentRef = useRef('')
  useEffect(() => {
    streamingContentRef.current = streamingContent
  }, [streamingContent])

  // NOTE: streaming content is committed inside onDone / fallbackHttpSend callbacks.
  // This effect is intentionally left empty — no double-commit guard needed.

  const fallbackHttpSend = useCallback(
    async (prompt: string) => {
      try {
        const history = messages.map(m => ({ role: m.role, content: m.content }))
        const res = await sendChat(prompt, context, history)
        setMessages((prev) => [
          ...prev,
          { role: 'assistant' as const, content: res.reply },
        ])
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant' as const,
            content: '抱歉，分析请求失败，请稍后重试。',
          },
        ])
      } finally {
        setIsStreaming(false)
        setStreamingContent('')
      }
    },
    [context]
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.15)',
          zIndex: 100,
        }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 480,
          background: 'var(--color-background-primary)',
          borderLeft: '0.5px solid var(--color-border-primary)',
          zIndex: 101,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            borderBottom: '0.5px solid var(--color-border-tertiary)',
            flexShrink: 0,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--color-text-primary)',
              }}
            >
              AI 深度分析
            </div>
            <div
              style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}
            >
              基于当前产品数据的专项分析
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 16,
              color: 'var(--color-text-tertiary)',
              padding: '4px 6px',
              borderRadius: 'var(--border-radius-md)',
            }}
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {messages.length === 0 && !isStreaming && (
            <div
              style={{
                textAlign: 'center',
                color: 'var(--color-text-tertiary)',
                fontSize: 12,
                marginTop: 40,
              }}
            >
              <div style={{ fontSize: 24, marginBottom: 8 }}>🤖</div>
              <div>输入问题或点击信号卡片中的分析按钮</div>
              <div style={{ marginTop: 4 }}>开始 AI 深度分析</div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '85%',
                  padding: '8px 12px',
                  borderRadius:
                    msg.role === 'user'
                      ? '10px 10px 2px 10px'
                      : '10px 10px 10px 2px',
                  background:
                    msg.role === 'user'
                      ? 'var(--color-text-primary)'
                      : 'var(--color-background-secondary)',
                  color:
                    msg.role === 'user'
                      ? 'var(--color-background-primary)'
                      : 'var(--color-text-primary)',
                  fontSize: 13,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* Streaming message */}
          {isStreaming && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div
                style={{
                  maxWidth: '85%',
                  padding: '8px 12px',
                  borderRadius: '10px 10px 10px 2px',
                  background: 'var(--color-background-secondary)',
                  color: 'var(--color-text-primary)',
                  fontSize: 13,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {streamingContent || (
                  <span
                    style={{
                      display: 'inline-flex',
                      gap: 3,
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ animation: 'pulse 1s infinite' }}>●</span>
                    <span
                      style={{ animation: 'pulse 1s infinite', animationDelay: '0.2s' }}
                    >
                      ●
                    </span>
                    <span
                      style={{ animation: 'pulse 1s infinite', animationDelay: '0.4s' }}
                    >
                      ●
                    </span>
                  </span>
                )}
                {streamingContent && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: 2,
                      height: '1em',
                      background: 'currentColor',
                      marginLeft: 2,
                      animation: 'blink 1s step-end infinite',
                      verticalAlign: 'text-bottom',
                    }}
                  />
                )}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: '0.5px solid var(--color-border-tertiary)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'flex-end',
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入问题，Enter 发送，Shift+Enter 换行"
              disabled={isStreaming}
              rows={2}
              style={{
                flex: 1,
                resize: 'none',
                border: '0.5px solid var(--color-border-secondary)',
                borderRadius: 'var(--border-radius-md)',
                padding: '8px 10px',
                fontSize: 13,
                fontFamily: 'var(--font-sans)',
                color: 'var(--color-text-primary)',
                background: 'var(--color-background-primary)',
                outline: 'none',
                lineHeight: 1.5,
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isStreaming}
              className="abtn pri"
              style={{
                height: 36,
                paddingLeft: 14,
                paddingRight: 14,
                flexShrink: 0,
                opacity: !input.trim() || isStreaming ? 0.5 : 1,
              }}
            >
              发送
            </button>
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 10,
              color: 'var(--color-text-tertiary)',
            }}
          >
            分析基于当前产品数据上下文
          </div>
        </div>
      </div>
    </>
  )
}
