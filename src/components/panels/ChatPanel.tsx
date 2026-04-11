"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Sparkles,
  Paperclip,
  Send,
  Copy,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Check,
} from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { buildAgentSystemPrompt } from "@/lib/systemPrompt";
import {
  executeToolCall,
  TOOL_LABELS,
  type ToolName,
  type AgentState,
} from "@/lib/agentTools";
import { cn } from "@/lib/utils";
import type Anthropic from "@anthropic-ai/sdk";

// ── Markdown renderer ─────────────────────────────────────────────────────────

function parseInline(text: string): React.ReactNode {
  const regex = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={match.index}>{token.slice(2, -2)}</strong>);
    } else {
      parts.push(
        <code
          key={match.index}
          style={{
            background: "#f0eeec",
            padding: "1px 4px",
            borderRadius: 3,
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "0.85em",
          }}
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 0
    ? ""
    : parts.length === 1 && typeof parts[0] === "string"
    ? parts[0]
    : <>{parts}</>;
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  let k = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Headings
    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={k++} style={{ margin: "10px 0 3px", fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>
          {parseInline(line.slice(4))}
        </h3>
      );
      i++; continue;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={k++} style={{ margin: "12px 0 4px", fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>
          {parseInline(line.slice(3))}
        </h2>
      );
      i++; continue;
    }
    if (line.startsWith("# ")) {
      elements.push(
        <h1 key={k++} style={{ margin: "14px 0 4px", fontSize: 15, fontWeight: 800, color: "#1a1a1a" }}>
          {parseInline(line.slice(2))}
        </h1>
      );
      i++; continue;
    }

    // HR
    if (line.trim() === "---") {
      elements.push(
        <hr key={k++} style={{ border: "none", borderTop: "1px solid #e8e5e0", margin: "10px 0" }} />
      );
      i++; continue;
    }

    // Table
    if (line.startsWith("|")) {
      const tableRows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        const cells = lines[i].split("|").slice(1, -1).map((c) => c.trim());
        if (!cells.every((c) => /^[-: ]+$/.test(c))) {
          tableRows.push(cells);
        }
        i++;
      }
      if (tableRows.length > 0) {
        const [headers, ...dataRows] = tableRows;
        elements.push(
          <div key={k++} style={{ overflowX: "auto", margin: "8px 0" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }}>
              <thead>
                <tr style={{ background: "#f5f4f2" }}>
                  {headers.map((h, j) => (
                    <th
                      key={j}
                      style={{ padding: "5px 10px", textAlign: "left", borderBottom: "1px solid #e8e5e0", fontWeight: 600, color: "#1a1a1a", whiteSpace: "nowrap" }}
                    >
                      {parseInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.map((row, j) => (
                  <tr key={j} style={{ borderBottom: "1px solid #f0eeec" }}>
                    {row.map((cell, l) => (
                      <td key={l} style={{ padding: "4px 10px", color: "#374151" }}>
                        {parseInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      const qLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        qLines.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <div
          key={k++}
          style={{ borderLeft: "3px solid #d4d4d4", paddingLeft: 12, margin: "6px 0", color: "#737373" }}
        >
          {qLines.map((l, j) => (
            <p key={j} style={{ margin: "2px 0" }}>
              {parseInline(l)}
            </p>
          ))}
        </div>
      );
      continue;
    }

    // Ordered list
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ""));
        i++;
      }
      elements.push(
        <ol key={k++} style={{ paddingLeft: 20, margin: "4px 0" }}>
          {items.map((item, j) => (
            <li key={j} style={{ marginBottom: 3, color: "#1a1a1a" }}>
              {parseInline(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Unordered list
    if (line.startsWith("- ") || line.startsWith("• ")) {
      const items: string[] = [];
      while (
        i < lines.length &&
        (lines[i].startsWith("- ") || lines[i].startsWith("• "))
      ) {
        items.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={k++} style={{ paddingLeft: 20, margin: "4px 0" }}>
          {items.map((item, j) => (
            <li key={j} style={{ marginBottom: 3, color: "#1a1a1a" }}>
              {parseInline(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      elements.push(<div key={k++} style={{ height: 6 }} />);
      i++; continue;
    }

    // Paragraph
    elements.push(
      <p key={k++} style={{ margin: "2px 0", lineHeight: 1.65, color: "#1a1a1a" }}>
        {parseInline(line)}
      </p>
    );
    i++;
  }

  return <div style={{ fontSize: 13 }}>{elements}</div>;
}

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1" style={{ padding: "4px 0" }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="dot-bounce"
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#a3a3a3",
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </div>
  );
}

// ── Quick prompts ─────────────────────────────────────────────────────────────

const QUICK_PROMPTS = [
  { icon: "📊", label: "诊断广告 ACoS", text: "请帮我诊断当前广告的 ACoS 表现，识别高花费低转化的关键词，并给出优化优先级建议。" },
  { icon: "📦", label: "库存健康度", text: "请分析当前产品的库存健康状况，评估可售天数、补货紧迫性，并给出补货建议。" },
  { icon: "📅", label: "促销活动影响", text: "请分析最近的促销活动（Lightning Deal / Coupon 等）对销量和 ACoS 的影响，并评估活动效果。" },
  { icon: "🔍", label: "竞品动态", text: "请分析竞品的最新动态，包括价格变化、评分趋势、BSR 变化，以及对我们产品的潜在影响。" },
] as const;

// ── Message action button ─────────────────────────────────────────────────────

function ActionBtn({
  icon: Icon,
  title,
  active,
  onClick,
}: {
  icon: React.ElementType;
  title: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="p-1 rounded transition-colors hover:bg-[#eae8e4]"
      style={{ color: active ? "#1a1a1a" : "#a3a3a3" }}
    >
      <Icon size={13} />
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ChatPanel() {
  const {
    selectedProductId,
    chatByProduct,
    addChatMessage,
    updateLastAssistantMessage,
    removeLastMessage,
    pendingChatMessage,
    setPendingChatMessage,
    selectedModel,
    getSelectedProduct,
    getFilesForProduct,
    getAlertsForProduct,
    metricsByProduct,
    inventoryByProduct,
    adDataByProduct,
    parsedFileDataByProduct,
  } = useAppStore();

  const product = getSelectedProduct();
  const productId = product?.id ?? "";
  const messages = chatByProduct[productId] ?? [];
  const files = getFilesForProduct(productId);

  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [agentStatus, setAgentStatus] = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [dislikedIds, setDislikedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle pending message from other panels
  useEffect(() => {
    if (pendingChatMessage) {
      setInput(pendingChatMessage);
      setPendingChatMessage(null);
      textareaRef.current?.focus();
    }
  }, [pendingChatMessage, setPendingChatMessage]);

  // Clear streaming on product switch
  useEffect(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
    setInput("");
  }, [selectedProductId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const doSend = useCallback(
    async (userText: string, addUserToStore: boolean) => {
      if (!userText.trim() || isStreaming || !product) return;

      if (addUserToStore) {
        addChatMessage(productId, {
          id: `u-${Date.now()}`,
          role: "user",
          content: userText,
          createdAt: new Date().toISOString(),
        });
      }

      // Add empty assistant placeholder for streaming/status display
      addChatMessage(productId, {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      });

      setIsStreaming(true);
      setAgentStatus("思考中…");

      // Build agent state from Zustand (tool executors read from here)
      const storeState = useAppStore.getState();
      const agentState: AgentState = {
        productId,
        metrics: storeState.metricsByProduct[productId]
          ? {
              today:       storeState.metricsByProduct[productId]?.today     as Record<string, number> | undefined,
              yesterday:   storeState.metricsByProduct[productId]?.yesterday as Record<string, number> | undefined,
              w7:          storeState.metricsByProduct[productId]?.w7        as Record<string, number> | undefined,
              w14:         storeState.metricsByProduct[productId]?.w14       as Record<string, number> | undefined,
              d30:         storeState.metricsByProduct[productId]?.d30       as Record<string, number> | undefined,
              acosHistory: storeState.metricsByProduct[productId]?.acosHistory,
            }
          : undefined,
        inventory:  storeState.inventoryByProduct[productId] ?? [],
        adData:     storeState.adDataByProduct[productId],
        alerts: (storeState.alerts.filter(
          (a) => a.productId === productId
        ) as unknown) as AgentState["alerts"],
        files: storeState.filesByProduct[productId] ?? [],
        parsedFileData: storeState.parsedFileDataByProduct[productId],
      };

      // Build initial Anthropic message array from display history
      // (exclude last empty assistant placeholder we just added)
      const displayHistory = storeState.chatByProduct[productId] ?? [];
      const agentMessages: Anthropic.MessageParam[] = displayHistory
        .slice(0, -1) // drop the empty placeholder
        .filter((m) => m.content !== "")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      // Add the new user message
      agentMessages.push({ role: "user", content: userText });

      const systemPrompt = buildAgentSystemPrompt(product, files);
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const MAX_STEPS = 10;
      let stepCount = 0;

      try {
        while (stepCount < MAX_STEPS) {
          stepCount++;

          const res = await fetch("/api/agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({ messages: agentMessages, systemPrompt, model: selectedModel }),
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: "请求失败" }));
            updateLastAssistantMessage(productId, `❌ 错误：${(err as { error?: string }).error ?? "请求失败"}`);
            return;
          }

          const contentType = res.headers.get("content-type") ?? "";

          // ── SSE stream: final text response ──────────────────────────────
          if (contentType.includes("text/event-stream")) {
            setAgentStatus(null);
            const reader = res.body!.getReader();
            const decoder = new TextDecoder();
            let accumulated = "";

            outer: while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value, { stream: true });
              for (const line of chunk.split("\n")) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6).trim();
                if (data === "[DONE]") break outer;
                try {
                  const parsed = JSON.parse(data) as { text?: string; error?: string };
                  if (parsed.error) accumulated += `\n\n❌ ${parsed.error}`;
                  else if (parsed.text) accumulated += parsed.text;
                  updateLastAssistantMessage(productId, accumulated);
                } catch { /* skip malformed */ }
              }
            }

            if (!accumulated) {
              updateLastAssistantMessage(productId, "（未收到回复，请重试）");
            }
            break; // loop done
          }

          // ── JSON: tool_use step ───────────────────────────────────────────
          const json = await res.json() as {
            type: string;
            content: Anthropic.ContentBlock[];
          };

          if (json.type !== "tool_use" || !Array.isArray(json.content)) {
            updateLastAssistantMessage(productId, "❌ Agent 返回格式错误");
            break;
          }

          // Add assistant's tool_use blocks to message history
          agentMessages.push({ role: "assistant", content: json.content });

          // Execute each tool call locally
          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const block of json.content) {
            if (block.type !== "tool_use") continue;
            const toolName = block.name as ToolName;
            setAgentStatus(`查询：${TOOL_LABELS[toolName] ?? block.name}…`);
            const result = executeToolCall(
              toolName,
              block.input as Record<string, unknown>,
              agentState
            );
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(result),
            });
          }

          // Add tool results as user message and continue loop
          agentMessages.push({ role: "user", content: toolResults });
          setAgentStatus("分析中…");
        }

        if (stepCount >= MAX_STEPS) {
          updateLastAssistantMessage(productId, "（Agent 循环超出步数限制，请重试）");
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          removeLastMessage(productId);
          return;
        }
        updateLastAssistantMessage(productId, "❌ 网络错误，请稍后重试。");
      } finally {
        setIsStreaming(false);
        setAgentStatus(null);
      }
    },
    [
      isStreaming,
      product,
      productId,
      files,
      selectedModel,
      addChatMessage,
      updateLastAssistantMessage,
      removeLastMessage,
    ]
  );

  const handleSend = useCallback(
    async (text?: string) => {
      const msgText = (text ?? input).trim();
      if (!msgText) return;
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      await doSend(msgText, true);
    },
    [input, doSend]
  );

  const handleRegenerate = useCallback(async () => {
    if (isStreaming) return;
    const currentMsgs = chatByProduct[productId] ?? [];
    if (currentMsgs.length === 0) return;

    // Remove last AI message and re-send last user message
    const lastMsg = currentMsgs[currentMsgs.length - 1];
    if (lastMsg.role !== "assistant") return;
    const lastUserMsg = [...currentMsgs].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) return;

    removeLastMessage(productId);
    await doSend(lastUserMsg.content, false);
  }, [isStreaming, chatByProduct, productId, removeLastMessage, doSend]);

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  // Derived: is the last message an empty assistant placeholder (typing indicator)?
  const isTyping =
    isStreaming &&
    messages.length > 0 &&
    messages[messages.length - 1].role === "assistant" &&
    messages[messages.length - 1].content === "";

  if (!product) {
    return (
      <div className="flex flex-col h-full items-center justify-center" style={{ background: "#fafaf9", color: "#a3a3a3" }}>
        <p className="text-sm">请先在左栏选择一个产品</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ background: "#fafaf9" }}>
      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#d4d4d4 transparent" }}
      >
        <div className="mx-auto" style={{ maxWidth: 720, padding: "24px 20px 8px" }}>
          {/* Quick prompts (shown when no messages) */}
          {messages.length === 0 && !isStreaming && (
            <div className="fade-up">
              <div className="text-center mb-8">
                <div
                  className="inline-flex items-center justify-center w-10 h-10 rounded-xl mb-3"
                  style={{ background: "#1a1a1a" }}
                >
                  <Sparkles size={18} color="white" />
                </div>
                <p className="text-sm font-medium" style={{ color: "#1a1a1a" }}>
                  YZ-Ops AI
                </p>
                <p className="text-xs mt-1" style={{ color: "#a3a3a3" }}>
                  基于 {files.length} 个文件 · {product.emoji} {product.shortName}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 justify-center">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt.label}
                    onClick={() => handleSend(prompt.text)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs transition-all hover:bg-[#eae8e4] hover:scale-[1.02]"
                    style={{
                      background: "#f0eeec",
                      color: "#374151",
                      border: "1px solid #e8e5e0",
                    }}
                  >
                    <span>{prompt.icon}</span>
                    <span>{prompt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message list */}
          <div className="flex flex-col gap-4">
            {messages.map((msg, idx) => {
              const isLast = idx === messages.length - 1;
              const showTyping = isTyping && isLast && msg.role === "assistant";

              if (msg.role === "user") {
                return (
                  <div key={msg.id} className="flex justify-end fade-up">
                    <div
                      className="rounded-2xl rounded-tr-sm px-4 py-3 text-sm"
                      style={{
                        background: "#1a1a1a",
                        color: "#ffffff",
                        maxWidth: "80%",
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              }

              // Assistant message
              return (
                <div key={msg.id} className="flex gap-3 fade-up">
                  {/* Avatar */}
                  <div
                    className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg mt-0.5"
                    style={{ background: "#1a1a1a" }}
                  >
                    <Sparkles size={13} color="white" />
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Bubble */}
                    <div
                      className="rounded-2xl rounded-tl-sm px-4 py-3"
                      style={{ background: "#f5f4f2", maxWidth: "100%" }}
                    >
                      {showTyping ? (
                        agentStatus ? (
                          <div className="flex items-center gap-2" style={{ padding: "2px 0" }}>
                            <TypingDots />
                            <span className="text-xs" style={{ color: "#a3a3a3" }}>
                              {agentStatus}
                            </span>
                          </div>
                        ) : (
                          <TypingDots />
                        )
                      ) : (
                        <MarkdownContent content={msg.content} />
                      )}
                    </div>

                    {/* Action bar (only for non-empty, non-streaming messages) */}
                    {!showTyping && msg.content && (
                      <div
                        className={cn(
                          "flex items-center gap-0.5 mt-1.5",
                          isStreaming && isLast ? "opacity-0" : "opacity-100"
                        )}
                      >
                        <ActionBtn
                          icon={copiedId === msg.id ? Check : Copy}
                          title="复制"
                          active={copiedId === msg.id}
                          onClick={() => handleCopy(msg.id, msg.content)}
                        />
                        <ActionBtn
                          icon={ThumbsUp}
                          title="有帮助"
                          active={likedIds.has(msg.id)}
                          onClick={() =>
                            setLikedIds((prev) => {
                              const next = new Set(prev);
                              next.has(msg.id) ? next.delete(msg.id) : next.add(msg.id);
                              dislikedIds.has(msg.id) &&
                                setDislikedIds((d) => {
                                  const dn = new Set(d);
                                  dn.delete(msg.id);
                                  return dn;
                                });
                              return next;
                            })
                          }
                        />
                        <ActionBtn
                          icon={ThumbsDown}
                          title="没帮助"
                          active={dislikedIds.has(msg.id)}
                          onClick={() =>
                            setDislikedIds((prev) => {
                              const next = new Set(prev);
                              next.has(msg.id) ? next.delete(msg.id) : next.add(msg.id);
                              likedIds.has(msg.id) &&
                                setLikedIds((d) => {
                                  const dn = new Set(d);
                                  dn.delete(msg.id);
                                  return dn;
                                });
                              return next;
                            })
                          }
                        />
                        {isLast && (
                          <ActionBtn
                            icon={RefreshCw}
                            title="重新生成"
                            onClick={handleRegenerate}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Scroll anchor */}
          <div ref={messagesEndRef} style={{ height: 8 }} />
        </div>
      </div>

      {/* Input area */}
      <div
        className="flex-shrink-0 px-4 pb-4 pt-2"
        style={{ background: "#fafaf9" }}
      >
        <div className="mx-auto" style={{ maxWidth: 720 }}>
          {/* Quick prompts above input (when has messages) */}
          {messages.length > 0 && messages.length <= 1 && !isStreaming && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt.label}
                  onClick={() => handleSend(prompt.text)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-colors hover:bg-[#eae8e4]"
                  style={{
                    background: "#f0eeec",
                    color: "#737373",
                    border: "1px solid #e8e5e0",
                  }}
                >
                  <span>{prompt.icon}</span>
                  <span>{prompt.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Input box */}
          <div
            className="flex items-end gap-2 rounded-2xl px-3 py-2.5"
            style={{
              background: "#ffffff",
              border: "1px solid #e8e5e0",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            }}
          >
            {/* Attachment button */}
            <button
              className="flex-shrink-0 p-1.5 rounded-lg transition-colors hover:bg-[#f0eeec]"
              style={{ color: "#a3a3a3" }}
              title="上传文件（Phase 4）"
            >
              <Paperclip size={15} />
            </button>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={`基于 ${files.length} 个文件，向 AI 提问…`}
              rows={1}
              disabled={isStreaming}
              className="flex-1 resize-none bg-transparent outline-none text-sm leading-relaxed"
              style={{
                color: "#1a1a1a",
                minHeight: 22,
                maxHeight: 120,
                scrollbarWidth: "none",
              }}
            />

            {/* Send button */}
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isStreaming}
              className="flex-shrink-0 p-1.5 rounded-lg transition-all"
              style={{
                background: input.trim() && !isStreaming ? "#1a1a1a" : "#e8e5e0",
                color: input.trim() && !isStreaming ? "#ffffff" : "#a3a3a3",
              }}
              title="发送 (Enter)"
            >
              <Send size={14} />
            </button>
          </div>

          {/* Caption */}
          <p className="text-center mt-2 text-[11px]" style={{ color: "#c4c4c4" }}>
            AI 建议基于运营 SOP 和当前数据文件生成，仅供参考
          </p>
        </div>
      </div>
    </div>
  );
}
