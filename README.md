# YZ-Ops AI

亚马逊多品类运营 AI 中台，支持报表解析、告警看板、广告优化行动清单、库存健康看板及多 Session AI Chat。

**技术栈**：Next.js 14 App Router · SQLite (Prisma) · Claude Agent SDK · OpenRouter · Tailwind CSS

---

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量（根目录新建 .env.local）
# OpenRouter 支持两种鉴权方式（任选其一）：
ANTHROPIC_API_KEY="sk-or-v1-..."             # 推荐：以 x-api-key header 发送
# ANTHROPIC_AUTH_TOKEN="Bearer sk-or-v1-..."  # 备选：以 Authorization header 发送
ANTHROPIC_BASE_URL="https://openrouter.ai/api"
CLAUDE_CODE_PATH="/Users/xxx/.local/bin/claude"   # 运行 `which claude` 获取
NEXT_PUBLIC_DEFAULT_MODEL="claude-haiku-4-5-20251001"
DATABASE_URL="file:./dev.db"

# 3. 初始化数据库
npm run db:push    # 按 schema.prisma 建表
npm run db:seed    # 写入品类/ASIN 配置

# 4. 启动开发服务器
npm run dev        # http://localhost:3000
```

> **注意**：Shell export 优先级高于 `.env.local`。若 Shell 中有空值的 `ANTHROPIC_API_KEY` 或 `ANTHROPIC_AUTH_TOKEN` 被 export，会覆盖 `.env.local` 导致鉴权失败。  
> 确认：`env | grep ANTHROPIC`；修复：`unset ANTHROPIC_API_KEY` 或重新 export 正确值。

---

## 项目结构

```
├── CLAUDE.md                       ← AI Agent 系统提示词（Claude CLI 自动加载）
├── context/                        ← 上传的原始 xlsx 文件
├── prisma/
│   ├── schema.prisma               ← 7 张表
│   └── seed.ts                     ← 初始化品类映射 + ASIN 配置
├── .claude/
│   └── skills/                     ← Agent SDK 技能目录
│       └── amazon-ops/SKILL.md
└── src/
    ├── app/
    │   ├── poc-chat/               ← 极简诊断 Chat 页（无 UI 组件依赖）
    │   └── api/
    │       ├── upload/             ← POST 上传 xlsx → 解析 → 写库 → 触发告警
    │       ├── files/              ← GET 文件列表 / DELETE 删除文件
    │       ├── categories/         ← GET 品类列表（含红色告警数）
    │       ├── test-openrouter/    ← GET 测试 OpenRouter 连通性
    │       ├── sessions/
    │       │   ├── route.ts        ← POST 新建 / GET 列表
    │       │   └── [id]/
    │       │       ├── route.ts    ← GET 详情+历史 / PATCH 重命名 / DELETE 删除
    │       │       ├── run/route.ts ← POST 启动 Agent Loop，SSE 流式输出
    │       │       └── answer/route.ts ← POST 用户答复，恢复挂起的 Agent
    │       └── features/
    │           ├── overview/       ← 全品类 KPI 聚合
    │           ├── kpi/            ← 单品类 KPI（?category=&window=）
    │           ├── alerts/         ← 告警列表（?category=&level=）
    │           ├── ads/            ← 广告行动清单（?category=）
    │           ├── inventory/      ← 库存健康看板（?category=）
    │           └── sop/            ← SOP 规则查询
    ├── components/
    │   ├── layout/
    │   │   ├── Sidebar.tsx         ← 左侧导航
    │   │   └── ContextPanel.tsx    ← 右侧文件管理面板
    │   └── panels/
    │       ├── OverviewPanel.tsx
    │       ├── KPIPanel.tsx
    │       ├── AlertsPanel.tsx
    │       ├── AdsPanel.tsx
    │       ├── InventoryPanel.tsx
    │       └── ChatPanel.tsx       ← 多 Session AI Chat（两栏布局）
    └── lib/
        ├── db.ts                   ← Prisma client 单例
        ├── config.ts               ← 三层参数配置（global → category → stage）
        ├── agentSSEAdapter.ts      ← SDK 消息流 → SSE 事件适配层
        ├── agentTools.ts           ← 8 个工具的服务端执行逻辑（由 mcpTools.ts 注册）
        ├── mcpTools.ts             ← MCP in-process server（yz-ops，8 个业务工具）
        ├── parsers/                ← xlsx 解析器（每种报表一个文件）
        │   ├── identifier.ts       ← 按文件名推断 fileType
        │   └── parse*.ts           ← 各报表 parser（共 9 种）
        └── rules/
            ├── alerts/             ← 告警规则引擎（sales/ads/inventory/reviews）
            └── sop/                ← 广告优化 SOP 规则（P0–P3）
```

---

## 数据模型

| 表 | 用途 | 写入策略 |
|----|------|---------|
| `CategoryMap` | 品类 → ASIN 列表 | seed.ts 初始化 |
| `AsinConfig` | ASIN → 品类 + 产品阶段 | seed.ts 初始化 |
| `ProductMetricDay` | 产品报表日粒度指标 | 按 (asin, date) upsert |
| `ContextFile` | 其他报表解析结果 | 按 fileType upsert，最新覆盖 |
| `Alert` | 每日告警记录 | 按 snapshotDate deleteMany + createMany |
| `Session` | Chat 对话 Session | 用户创建（含 `sdkSessionId` 用于 resume） |
| `Message` | Session 内消息（含 toolCalls） | done 事件后写入 |

> `Message.toolCalls` 存为 JSON 字符串，`GET /api/sessions/:id` 返回前自动 parse 为数组。

---

## 报表文件类型

| fileType | 报表名 | 存储表 | 触发告警 |
|----------|--------|--------|---------|
| `product` | 产品报表-ASIN视图 | `ProductMetricDay` | ✅ |
| `keyword_monitor` | 关键词监控 | `ContextFile` | ✅（评分告警） |
| `inventory` | 库存报表 | `ContextFile` | ✅ |
| `us_campaign_30d` | US 广告活动 | `ContextFile` | ✅ |
| `search_terms` | 搜索词重构 | `ContextFile` | — |
| `campaign_3m` | 广告活动重构（ALL） | `ContextFile` | — |
| `placement_us_30d` | 广告位报表 | `ContextFile` | — |
| `cost_mgmt` | 成本管理 | `ContextFile` | — |
| `aba_search` | ABA 搜索词对比 | `ContextFile` | — |

文件名识别逻辑：`src/lib/parsers/identifier.ts`（`campaign_3m` 需同时含"重构"+"ALL"）

---

## AI Chat 架构

采用 **`@anthropic-ai/claude-agent-sdk`** — 内部启动 `claude` CLI 子进程执行 Agent Loop：

```
ChatPanel
    │  POST /api/sessions/:id/run
    ▼
route.ts → runAgentLoop()  →  agentSSEAdapter.ts
                                  │  query({ resume, model, mcpServers, tools, canUseTool })
                                  ▼
                         claude-agent-sdk  →  claude CLI（CLAUDE_CODE_PATH）
                                               │  CLAUDE.md 作为 System Prompt
                                               │  调用 OpenRouter API
                                               ▼
                                        SDK 消息流（for await）
                                        ├── system         → SSE: session_start
                                        ├── stream_event   → SSE: text_delta / tool_start
                                        ├── user(tool_result) → SSE: tool_done
                                        ├── canUseTool     → SSE: ask_user_question
                                        │                       / approval_request
                                        │     ↑ 挂起等待
                                        │     POST /api/sessions/:id/answer
                                        │     → pendingApprovals.resolve() → 继续
                                        └── result         → 写 DB → SSE: done
```

**SSE 事件**：`session_start` · `context_reset` · `text_delta` · `tool_start` · `tool_done` · `ask_user_question` · `approval_request` · `done` · `error`

**工具体系**：
- **MCP in-process**（`mcpTools.ts`）：8 个业务工具，由 `yzOpsMcpServer` 注册，通过 `mcpServers` 选项注入
- **Skills**（`.claude/skills/amazon-ops/SKILL.md`）：行为指令文件，通过 `tools: ["Skill"]` 启用
- **AskUserQuestion**：内置工具，Agent 主动发起澄清问题，通过 `canUseTool` 回调暂停等待用户回答

**System Prompt**：来自 `CLAUDE.md`（根目录），CLI 启动时自动加载。

### 添加新工具

1. 在 `src/lib/agentTools.ts` 实现工具执行逻辑
2. 在 `src/lib/mcpTools.ts` 用 `tool()` 注册，绑定到 `yzOpsMcpServer`
3. 在 `CLAUDE.md` 的工具表中补充工具名和用途说明

---

## 告警引擎

上传以下文件时自动触发（`runAndPersistAlerts`）：

| 文件 | 触发的告警规则 |
|------|--------------|
| `product` | 销售环比 / ACoS / CTR / OCR / 退款率 / 预算利用率 |
| `keyword_monitor` | 评分（< 3.8 红色，< 4.0 黄色） |
| `inventory` | 库存可售天数不足 |
| `us_campaign_30d` | 预算利用率 |

阈值按产品阶段（launch / growth / mature）差异化配置，见 `lib/config.ts`。

---

## npm Scripts

```bash
npm run dev          # 开发服务器（http://localhost:3000）
npm run build        # 生产构建
npm run db:push      # 同步 schema → dev.db（首次或修改 schema 后运行）
npm run db:seed      # 初始化品类/ASIN 配置（首次运行）
npm run lint         # ESLint 检查
```

---

## 诊断工具

| 地址 | 用途 |
|------|------|
| `GET /api/test-openrouter` | 测试 OpenRouter 连通性，显示当前 key 前缀和 API 响应状态 |
| `http://localhost:3000/poc-chat` | 极简 Chat 诊断页（纯 HTML，无 shadcn 组件），右侧实时 SSE 事件日志 |
