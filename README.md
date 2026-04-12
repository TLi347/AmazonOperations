# YZ-Ops AI

Amazon 多品类运营 AI 中台（Next.js 14 + SQLite + Claude API）。

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Next.js 14 App Router · React 18 · Zustand · Recharts · Tailwind CSS |
| 后端 | Next.js API Routes · Server-Sent Events (SSE) |
| 数据库 | SQLite（Prisma ORM） |
| AI | Anthropic Claude API（claude-sonnet-4-6 / claude-opus-4-6） |

---

## 快速开始

```bash
npm install
npm run db:generate   # 生成 Prisma Client
npm run db:push       # 建表（prisma/dev.db）
npm run db:seed       # 写入品类/ASIN 配置 + 7 天模拟指标
npm run seed:reports  # 批量导入 ../../报表/ 中的 xlsx 文件
npm run dev           # 启动开发服务器 http://localhost:3000
```

> **env**：根目录新建 `.env`，填入 `ANTHROPIC_API_KEY=sk-...`

---

## 项目结构

```
yz-ops-ai/
├── prisma/
│   ├── schema.prisma          # 5 张表（见下方数据模型）
│   └── seed.ts                # 初始化品类、ASIN 配置、模拟指标
├── scripts/
│   └── seed-reports.ts        # 批量导入 xlsx → DB
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── agent/         # POST  — SSE agentic loop
│   │   │   ├── build-prompt/  # POST  — 构建系统 prompt
│   │   │   ├── categories/    # GET   — 品类列表 + 红色告警数
│   │   │   ├── files/         # GET   — 已上传文件 + 新鲜度
│   │   │   ├── upload/        # POST  — 上传 xlsx，写库，触发告警
│   │   │   └── features/
│   │   │       ├── overview/  # GET   — 全品类 KPI + 告警汇总
│   │   │       ├── kpi/       # GET   — 单品类 KPI（?window=w7&categoryKey=）
│   │   │       ├── alerts/    # GET   — 告警列表（?level=&categoryKey=）
│   │   │       ├── ads/       # GET   — 广告数据（?source=campaign_3m|search_terms）
│   │   │       └── inventory/ # GET   — 库存数据（?categoryKey=）
│   │   └── app/page.tsx       # 主应用页（/app）
│   ├── components/
│   │   ├── layout/
│   │   │   ├── ProductRail.tsx     # 左侧导航栏（180px）
│   │   │   ├── FunctionPanel.tsx   # 功能 Tab 栏（150px，仅品类激活时显示）
│   │   │   ├── MainPanel.tsx       # 主内容区（flex:1）
│   │   │   ├── ContextPanel.tsx    # 右侧上下文面板（256px，可折叠）
│   │   │   ├── CategoryGuard.tsx   # 品类路由守卫
│   │   │   └── AppInitializer.tsx  # 全局初始化
│   │   └── panels/
│   │       ├── OverviewPanel.tsx   # 全品类总览
│   │       ├── KPIPanel.tsx        # KPI 看板
│   │       ├── AlertsPanel.tsx     # 告警面板
│   │       ├── AdsPanel.tsx        # 广告监控
│   │       ├── InventoryPanel.tsx  # 库存看板
│   │       └── ChatPanel.tsx       # AI Chat（SSE 流式）
│   ├── lib/
│   │   ├── db.ts                   # Prisma 单例
│   │   ├── agentLoop.ts            # Claude agentic loop（最多 10 轮）
│   │   ├── agentTools.ts           # 工具定义 + 服务端执行（get_metrics / get_alerts / …）
│   │   ├── buildSystemPrompt.ts    # 系统 prompt 构建
│   │   ├── parsers/                # xlsx 解析器（每种报表一个文件）
│   │   └── rules/alerts/           # 告警规则引擎
│   └── store/
│       └── appStore.ts             # Zustand（导航状态：activeNav / activeFuncTab / selectedModel）
└── context/                        # 上传的原始 xlsx 文件（供 Chat 参考）
```

---

## 数据模型

```
CategoryMap       品类 → ASIN 列表（手动维护，seed.ts 初始化）
AsinConfig        ASIN → 品类归属 + 产品阶段（launch/growth/mature）
ProductMetricDay  日粒度指标快照（asin × date，时序累积，不覆盖）
ContextFile       非产品类报表（fileType 唯一，上传即覆盖）
Alert             每日告警（asin × metric × date，产品报表上传后重算）
```

---

## 导航模型

| `activeNav` 值 | 含义 |
|---|---|
| `"overview"` | 全品类总览页 |
| `"chat"` | AI Chat 页 |
| `categoryKey`（如 `"mattress"`） | 品类详情页（同时显示功能 Tab 栏） |

功能 Tab（`activeFuncTab`）：`kpi` / `alerts` / `ads` / `inventory`

---

## 报表文件类型

| fileType | 报表名 | 存储策略 |
|---|---|---|
| `product` | 产品报表-ASIN视图 | `ProductMetricDay`（按日累积） |
| `campaign_3m` | 广告活动重构（ALL） | `ContextFile`（最新覆盖） |
| `search_terms` | 搜索词重构 | `ContextFile` |
| `us_campaign_30d` | US 广告活动 | `ContextFile` |
| `placement_us_30d` | 广告位报表 | `ContextFile` |
| `inventory` | 库存报表 | `ContextFile` |
| `cost_mgmt` | 成本管理 | `ContextFile` |
| `aba_search` | ABA 搜索词对比 | `ContextFile` |
| `keyword_monitor` | 关键词监控 | 暂无 parser，跳过 |

识别逻辑见 `src/lib/parsers/identifier.ts`。

---

## 告警引擎

触发时机：上传 `product` / `inventory` / `us_campaign_30d` 报表后自动运行。

规则文件位于 `src/lib/rules/alerts/`：

- `sales.ts` — GMV / 订单量环比下降
- `ads.ts` — ACoS 超标 / CTR 过低 / OCR 过低 / 退款率过高 / 预算利用率不足
- `inventory.ts` — 可售天数不足（结合库存快照 + 7 天日均销量推算）

阈值按产品阶段（launch / growth / mature）差异化配置。

---

## AI Chat 工具

Chat 通过 SSE 流式返回，Claude 在服务端循环调用以下工具（最多 10 轮）：

| 工具 | 说明 |
|---|---|
| `get_metrics` | KPI 快照（today / w7 / w14 / d30） |
| `get_acos_history` | ACoS + GMV 日趋势 |
| `get_alerts` | 当前告警列表 |
| `get_context_file` | 读取任意 ContextFile 解析行 |
| `get_inventory` | 库存快照 |
| `get_asin_config` | ASIN 配置信息 |

模型可在界面右上角切换（sonnet-4-6 / opus-4-6）。

---

## npm scripts

```bash
npm run dev            # 开发服务器
npm run build          # 生产构建
npm run db:generate    # 生成 Prisma Client
npm run db:push        # 同步 schema → dev.db
npm run db:seed        # 初始化配置 + 写入模拟指标
npm run seed:reports   # 批量导入 ../../报表/*.xlsx
npm run lint           # ESLint 检查
```
