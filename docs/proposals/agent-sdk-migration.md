# Proposal: 迁移到 Claude Agent SDK

> Status: done
>
> 已完成迁移。已知问题：SDK 存在 API rate limit 触发频率较高的问题。

## 目标

将 Chat 模块从手写 Agent Loop（`@anthropic-ai/sdk` + `messages.stream()`）迁移到 Claude Agent SDK（`@anthropic-ai/claude-agent-sdk`）。

## 动机

1. **消息历史不完整** — 当前只传纯文字，丢失 tool_use/tool_result 中间轮次
2. **手写循环维护成本** — 需要手动处理 stop_reason、tool dispatch、轮次控制
3. **SDK 内置能力** — session 持久化、token 流式、动态 maxTurns、abort 支持、hooks

## 架构变化

```
Before:
  API Route → agentLoop.ts → client.messages.stream() → executeTool() (in-process DB)
  手写 for 循环、手动 tool dispatch、手动 SSE 推送

After:
  API Route → query() from @anthropic-ai/claude-agent-sdk
                ├── createSdkMcpServer() — 进程内 MCP，8 个工具直接查 DB
                ├── includePartialMessages: true — token 级流式
                └── systemPrompt — 动态构建
              → parse SDKMessage → convert to SSE → Frontend
```

核心区别：
- **不再手写 agent loop** — SDK 的 `query()` 返回 async generator，自动处理工具调用循环
- **工具通过进程内 MCP 暴露** — `tool()` + `createSdkMcpServer()`，无需单独 MCP Server 进程
- **Session 可由 SDK 管理** — `resume` 选项续接会话，内置 session 持久化

## 依赖变化

| 操作 | 包 | 用途 |
|------|-----|------|
| 新增 | `@anthropic-ai/claude-agent-sdk` | Agent SDK 核心 |
| 新增 | `zod` | MCP 工具 schema 定义（`tool()` 函数要求） |
| 移除 | `@anthropic-ai/sdk` | 被 Agent SDK 替代 |

不需要：`@modelcontextprotocol/sdk`（Agent SDK 内置）、`tsx`（进程内 MCP 无需独立脚本）

## 实施步骤

1. 安装依赖：`@anthropic-ai/claude-agent-sdk`, `zod`
2. 新建 `src/lib/mcpTools.ts` — 用 `tool()` + `createSdkMcpServer()` 定义进程内 MCP 工具
3. 重写 `src/lib/agentLoop.ts` — 用 `query()` 替换手写循环，解析 SDKMessage 转 SSE 事件
4. 适配 `src/app/api/sessions/[id]/run/route.ts` — 对接新 agent loop
5. 保留旧文件到 `archive/` 供参考

## SSE 事件映射

| SDK Message 类型 | SSE 事件 |
|-----------------|---------|
| `system` (subtype: init) | `session_start` |
| `stream_event` (content_block_delta, text_delta) | `text_delta` |
| `assistant` (含 tool_use blocks) | `tool_start`（每个 tool_use block） |
| `user` (含 tool_result) | `tool_done`（每个 tool_result） |
| `result` (subtype: success) | `done` |
| `result` (subtype: error_*) | `error` |

## 兼容性

- **前端不变** — SSE 事件格式保持兼容（text_delta / tool_start / tool_done / done / error）
- **DB 表保留** — Session/Message 表继续用于 UI 展示和自有 session 管理
- **工具逻辑不变** — `agentTools.ts` 的 `executeTool()` 被 MCP tool handler 直接调用
- **System Prompt 不变** — `buildSystemPrompt.ts` 继续使用

## query() 关键配置

```typescript
query({
  prompt: userMessage,
  options: {
    model: "sonnet",
    maxTurns: 10,
    systemPrompt: await buildAgentSystemPrompt(),
    includePartialMessages: true,           // token 级流式
    permissionMode: "bypassPermissions",    // 非交互式服务端
    mcpServers: {
      "yz-ops": createSdkMcpServer({       // 进程内 MCP
        name: "yz-ops",
        tools: yzOpsTools,                  // tool() 定义的 8 个工具
      }),
    },
    allowedTools: [                         // 只允许 MCP 工具
      "mcp__yz-ops__get_metrics",
      "mcp__yz-ops__get_acos_history",
      // ... 其余 6 个
    ],
    resume: sdkSessionId,                   // 续接会话（可选）
  },
})
```

## 风险与注意事项

- `query()` 底层 spawn Claude Code 子进程，每次调用有进程开销（低并发内部工具可接受）
- 需要 `claude` CLI 已安装（当前环境已有 v2.1.104）
- 需要 `ANTHROPIC_API_KEY` 环境变量
- `bypassPermissions` 仅限服务端非交互式场景
