# OpenClaw 产品文档

> Amazon Operations AI Decision System
> Version 0.1.0

---

## 1. 产品定位

OpenClaw 是一个面向亚马逊卖家老板的 **AI 运营决策辅助系统**。

**核心问题**: 运营助理每周花费大量时间从广告后台、销售报表、BSR 排名等多个来源收集数据，再整理成可读报告给老板做决策。这个过程缓慢、重复、且依赖个人经验。

**解决方案**: 将 9 类运营数据喂给 Claude AI，自动生成带优先级的**决策信号卡片**，每张卡片包含数据证据、财务影响量化和推荐操作。老板只需 10 分钟就能做完原本需要一周分析的决策。

**目标用户**: 亚马逊卖家老板（决策者），不是运营执行层。

---

## 2. 核心概念

### 2.1 决策信号 (Decision Signal)

系统的核心输出单元。每个信号代表一个需要老板注意的事项。

```
┌─────────────────────────────────────────────┐
│  P0  零成交高消耗关键词                         │
│                                             │
│  描述: "portable air pump" 本周消耗 $47.20    │
│        但零成交，持续 3 周                      │
│                                             │
│  证据表: 关键词 | 消耗 | 点击 | 成交 | ACOS    │
│          ...    | $47  | 23  | 0   | ∞      │
│                                             │
│  财务影响: 每周损失 $47.20                      │
│  推荐操作: [暂停关键词] [降低竞价至 $0.30]       │
└─────────────────────────────────────────────┘
```

**信号优先级**:

| 优先级 | 含义 | 期望处理时间 | 典型场景 |
|--------|------|------------|---------|
| **P0** | 紧急，正在漏钱 | 今天 | 零成交高消耗词、ACOS 远超盈亏平衡 |
| **P1** | 重要，需要本周处理 | 本周内 | 高 CVR 搜索词未提升匹配类型 |
| **P2** | 可优化 | 两周内 | 竞品做 Deal 分流、结构调整建议 |
| **P3** | 机会 | 有空时 | 可放大的高 ROI 关键词 |
| **good** | 积极信号 | 继续保持 | 自然订单占比上升、BSR 改善 |

### 2.2 产品生命周期阶段 (Stage)

老板在 `product_economics` 表中手动标记每个产品所处的阶段。不同阶段，AI 的分析重点和阈值完全不同：

| 阶段 | 核心目标 | AI 关注什么 | AI 忽略什么 |
|------|---------|------------|------------|
| **new** (新品) | 获得曝光、出第一单 | 展示量是否足够、是否有初始成交 | ACOS 高（新品期 100-300% 正常）、零成交词 |
| **early** (前期) | 积累 Review、建立关键词排名 | $20+ 零成交词、高 CVR 词未精确匹配 | 严格 ACOS 管控 |
| **growth** (成长) | ACOS 优化、规模扩张 | $15+ 零成交词、ACOS 超盈亏平衡线 | — |
| **mature** (成熟) | 利润最大化、份额防守 | $10+ 零成交词、BSR 连续下降 | — |

### 2.3 盈亏平衡 ACOS

```
盈亏平衡 ACOS = (售价 - 成本 - FBA费 - 推荐费) / 售价 × 100%
```

其中推荐费默认为 `售价 × 15%`（亚马逊标准佣金）。这个值是 growth/mature 阶段判断广告是否亏钱的核心基准线。

### 2.4 健康评分 (Health Score)

对产品广告运营状态的综合评分，包含 5 个维度：

| 维度 | 评估内容 |
|------|---------|
| **conversion** | 转化率是否健康 |
| **budget_efficiency** | 预算利用效率，零成交消耗占比 |
| **traffic_quality** | 流量质量，CTR 和搜索词相关性 |
| **keyword_structure** | 关键词结构合理性（精确/短语/广泛配比） |
| **ad_efficiency** | 广告整体效率，ACOS vs 目标 |

---

## 3. 系统架构

### 3.1 整体架构

```
┌──────────────────────────────────────────────────────┐
│                    Frontend (React)                    │
│  Overview ──── Dashboard ──── AnalysisDrawer(AI Chat) │
│     │              │                  │                │
│  产品列表       信号卡片/指标/趋势      追问对话          │
└──────┬──────────────┬─────────────────┬──────────────┘
       │ REST API     │ WebSocket       │ REST API
       ▼              ▼                 ▼
┌──────────────────────────────────────────────────────┐
│                  Backend (FastAPI)                     │
│                                                       │
│  products.py ── analysis.py ── decisions.py ── upload │
│                      │                                │
│              ┌───────▼────────┐                       │
│              │  Orchestrator  │ ← Claude claude-sonnet-4-6      │
│              │  (AI Engine)   │   + adaptive thinking  │
│              └───────┬────────┘                       │
│                      │                                │
│              ┌───────▼────────┐                       │
│              │   SQLite DB    │ ← 13 tables           │
│              │  (aiosqlite)   │                       │
│              └────────────────┘                       │
└──────────────────────────────────────────────────────┘
```

### 3.2 分析流水线

用户点击「触发分析」后的完整流程：

```
1. POST /api/analysis/product {asin}
   └→ 创建 task_id，启动后台协程

2. 前端连接 WebSocket /ws/analysis/{task_id}

3. Orchestrator 执行分析:
   ┌──────────────────────────────────────────────┐
   │ a) 数据采集 — 从 9 张表查询产品数据             │
   │    广告组 → 关键词 → 搜索词 → 日销 →            │
   │    库存 → BSR历史 → 竞品价格 → ABA → 财务参数   │
   │                                              │
   │ b) 数据压缩 — summarise_* 函数压缩为可读摘要     │
   │                                              │
   │ c) 提示词构建 — 注入 stage 特定指引              │
   │    {stage_context} + {break_even_acos}        │
   │                                              │
   │ d) Claude 调用 — adaptive thinking (8k tokens) │
   │    输出结构化 JSON                              │
   │                                              │
   │ e) 校验 — Pydantic 验证，失败重试最多 3 次       │
   │    第 2 次起将错误信息反馈给 Claude 修正          │
   └──────────────────────────────────────────────┘

4. WebSocket 流式推送进度事件:
   {"stage": "data_fetch",  "message": "正在读取本周广告数据..."}
   {"stage": "analysis",    "message": "分析精确匹配组异常..."}
   {"stage": "signal_p0",   "message": "发现 P0 信号：零成交词消耗 $184"}
   {"stage": "complete",    "payload": {AnalysisResult}}
```

### 3.3 技术栈

| 层 | 技术 | 版本 |
|---|------|------|
| **前端框架** | React + TypeScript | 18.2 / 5.3 |
| **构建工具** | Vite | 5.0 |
| **路由** | react-router-dom | 6.22 |
| **图表** | Recharts | 2.10 |
| **HTTP 客户端** | Axios | 1.6 |
| **后端框架** | FastAPI | >= 0.111 |
| **数据库** | SQLite (aiosqlite) | — |
| **AI 引擎** | Anthropic Claude (claude-sonnet-4-6) | SDK >= 0.28 |
| **数据处理** | pandas + openpyxl | 2.2 / 3.1 |
| **PDF 解析** | pdfplumber | 0.11 |
| **数据校验** | Pydantic v2 | >= 2.7 |

---

## 4. 数据模型

### 4.1 数据库表结构 (13 张表)

**核心业务表**:

| 表名 | 用途 | 主要字段 |
|------|------|---------|
| `products` | 产品目录 | asin (PK), name, category, marketplace, status |
| `product_economics` | 财务参数 | asin, stage, selling_price, cogs, fba_fee, referral_fee, target_acos |
| `ad_groups` | 广告组 | asin (FK), group_name, match_type, status, week |
| `ad_keywords` | 关键词表现 | group_id (FK), keyword, bid, impressions, clicks, spend, sales, acos, orders |
| `sales_daily` | 日销数据 | asin, date, orders, revenue, organic_orders, ad_orders, sessions, bsr_main |
| `inventory` | 库存状态 | asin, sellable_days, inbound_qty, inbound_eta, daily_velocity, fba_limit |

**扩展数据表**:

| 表名 | 用途 | 数据来源 |
|------|------|---------|
| `search_terms` | 搜索词报告 | 广告后台每周导出 |
| `bsr_history` | BSR 排名历史 | Keepa / 手动导入 |
| `competitor_prices` | 竞品价格监控 | 手动 / 爬虫快照 |
| `aba_keywords` | ABA 搜索词基准 | Amazon Brand Analytics 导出 |
| `competitor_share` | 竞品市场份额 | ABA 点击/转化份额 |

**系统表**:

| 表名 | 用途 |
|------|------|
| `decision_log` | 老板决策记录（confirm / reject / defer + 备注） |
| `analysis_cache` | 分析结果缓存（task_id, result_json, status） |

### 4.2 前端类型定义

核心 TypeScript 接口（`frontend/src/types/signals.ts`）：

```typescript
interface DecisionSignal {
  signal_id: string
  priority: 'P0' | 'P1' | 'P2' | 'P3' | 'good'
  title: string
  description: string
  timeline: TimelineItem[]          // 8 周趋势数据
  evidence_table: Record<string, string>[]  // 证据表格
  evidence_headers: string[]
  reasoning: string                 // AI 分析逻辑
  financial_impact: FinancialImpact // 周损益量化 (USD)
  actions: SignalAction[]           // 推荐操作按钮
  related_ad_groups: string[]       // 关联广告组
}

interface AnalysisResult {
  asin: string
  product_name: string
  signals: DecisionSignal[]
  metrics: ProductMetrics           // 周消耗/销售/ACOS
  health: HealthScore               // 5 维健康评分
  context: ProductContext            // 阶段/BSR/库存状态
}
```

---

## 5. API 接口

### 5.1 产品管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/products` | 产品列表（含健康快照：stage, health_score, p0_count） |
| `GET` | `/api/products/{asin}` | 单个产品详情 |
| `POST` | `/api/products` | 创建产品记录 |

**GET /api/products 响应示例**:

```json
[
  {
    "asin": "B0GD7BF2TZ",
    "name": "4英寸蓝白Queen床垫",
    "category": "Home & Kitchen > Mattresses",
    "marketplace": "US",
    "status": "active",
    "stage": "growth",
    "health_score": 72.5,
    "weekly_spend": 324.50,
    "weekly_sales": 1247.80,
    "acos": 26.0,
    "p0_count": 2,
    "last_analyzed": "2026-03-28T10:30:00Z"
  }
]
```

### 5.2 分析与信号

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/analysis/product` | 触发全量 AI 分析，返回 task_id |
| `WS` | `/ws/analysis/{task_id}` | WebSocket 实时接收分析进度 |
| `GET` | `/api/products/{asin}/signals` | 获取最新决策信号列表 |
| `GET` | `/api/products/{asin}/metrics` | 获取核心经营指标 |
| `GET` | `/api/products/{asin}/trend` | 获取 8 周 ACOS/BSR 趋势数据 |

**POST /api/analysis/product**:

```json
// 请求
{ "asin": "B0GD7BF2TZ", "force_refresh": false }

// 响应
{ "task_id": "a1b2c3d4-...", "asin": "B0GD7BF2TZ", "status": "pending" }
```

**WebSocket 事件流**:

```json
{"stage": "data_fetch",  "message": "正在读取本周广告数据..."}
{"stage": "data_fetch",  "message": "正在读取销售趋势..."}
{"stage": "analysis",    "message": "Claude 正在分析数据..."}
{"stage": "signal_p0",   "message": "发现 P0 信号：零成交词消耗 $184"}
{"stage": "signal_p1",   "message": "发现 P1 信号：高 CVR 词可提升为精确匹配"}
{"stage": "complete",    "payload": { /* AnalysisResult */ }}
```

### 5.3 AI 对话

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/chat` | 针对特定产品的 AI 追问对话 |

```json
// 请求
{
  "asin": "B0GD7BF2TZ",
  "prompt": "这个零成交词过去 4 周的花费趋势是什么？",
  "conversation_history": [
    {"role": "user", "content": "上一个问题..."},
    {"role": "assistant", "content": "上一个回答..."}
  ]
}

// 响应
{ "response": "过去 4 周花费分别为 $12, $18, $35, $47，呈加速上升趋势..." }
```

### 5.4 决策管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/decisions/confirm` | 记录老板对信号的决策（confirm/reject/defer） |
| `GET` | `/api/decisions/{asin}` | 查看产品的决策历史 |

```json
// 请求
{
  "asin": "B0GD7BF2TZ",
  "signal_id": "sig_zero_sale_001",
  "decision": "confirm",
  "boss_note": "同意暂停，下周观察"
}
```

### 5.5 数据上传

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/upload` | 上传 XLSX/PDF 数据文件（最大 50MB） |

支持的文件类型：`.xlsx`, `.xls`, `.csv`, `.pdf`

### 5.6 系统

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/health` | 健康检查 |
| `GET` | `/` | 服务信息 |
| `GET` | `/docs` | Swagger API 文档（FastAPI 自动生成） |

---

## 6. 前端页面

### 6.1 Overview (产品概览)

路径: `/`

产品列表网格视图，每个产品卡片展示：
- 产品名称 + ASIN
- 阶段标签 (new/early/growth/mature)
- 健康评分
- 本周消耗 / 销售 / ACOS
- P0 信号数量（红色角标）
- 最后分析时间

### 6.2 Dashboard (产品详情)

路径: `/product/{asin}`

单个产品的完整分析视图，包含以下组件：

| 组件 | 说明 |
|------|------|
| **ContextStrip** | 顶部信息条：阶段、BSR 排名/趋势、库存状态/天数 |
| **MetricsRow** | 核心 KPI 卡片：周消耗、周销售、ACOS（含环比变化） |
| **DecisionSignal** | 信号卡片列表，按优先级排序（P0 → good） |
| **AcosTrendChart** | ACOS 8 周趋势折线图 |
| **CompetitorChart** | 竞品市场份额对比图 |
| **AnalysisDrawer** | 右侧抽屉：AI 追问对话，支持上下文连续提问 |
| **LoadingState** | 分析进行中的流式进度展示 |

### 6.3 信号卡片交互

每张 DecisionSignal 卡片支持：
- 展开/折叠证据表格和 AI 推理过程
- 查看 8 周时间线趋势
- 查看量化的财务影响（周损失/收益 USD）
- 点击操作按钮：触发对应的 AI 追问或直接确认决策
- 决策按钮：确认 / 拒绝 / 推迟（带备注）

---

## 7. 数据接入

### 7.1 已实现的数据解析器

| 解析器 | 文件 | 功能 |
|--------|------|------|
| `ad_performance.py` | 广告报表 XLSX（3 个 sheet） | 解析广告日志/广告表现/销售表现，中文表头映射 |
| `aba_keywords.py` | ABA 搜索词报告 XLSX | 解析搜索词排名、Top 3 点击份额和转化份额 |
| `sales_daily.py` | 日销数据 XLSX | 解析日期、订单、收入、自然/广告订单拆分、BSR |

### 7.2 数据导入方式

1. **Web 上传**: 通过 `/api/upload` 接口上传 XLSX/PDF
2. **Seed 脚本**: 首次运行 `python seed_data.py` 从本地文件批量导入
3. **手动录入**: 通过 API 直接写入数据库

### 7.3 数据源对照

| 数据源 | 对应表 | 更新频率 | 当前状态 |
|--------|--------|---------|---------|
| 广告后台报表 | ad_groups, ad_keywords | 每周 | 已实现解析器 |
| ABA 搜索词报告 | aba_keywords, competitor_share | 每周 | 已实现解析器 |
| 业务报表/日销 | sales_daily | 每日 | 已实现解析器 |
| 搜索词报告 | search_terms | 每周 | 待实现（当前为模拟数据） |
| Keepa BSR 数据 | bsr_history | 每日 | 待实现 |
| 竞品价格 | competitor_prices | 不定期 | 待实现 |
| 库存状态 | inventory | 手动更新 | seed 脚本填充 |
| 财务参数 | product_economics | 手动设置 | seed 脚本填充 |

---

## 8. 快速开始

### 8.1 环境要求

- Python >= 3.11
- Node.js >= 18
- Anthropic API Key

### 8.2 后端启动

```bash
cd backend
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env，填写 ANTHROPIC_API_KEY

# 首次运行：建表 + 导入测试数据
python seed_data.py

# 启动服务
uvicorn app.main:app --reload --port 8000
```

启动后访问 http://localhost:8000/docs 查看自动生成的 Swagger 文档。

### 8.3 前端启动

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:5173，Vite 会自动将 `/api` 和 `/ws` 请求代理到后端 `localhost:8000`。

### 8.4 测试产品

系统预装了 3 个测试产品：

| ASIN | 产品 | 阶段 | 品类 |
|------|------|------|------|
| B0GD7BF2TZ | 4英寸蓝白Queen床垫 | growth | Home & Kitchen > Mattresses |
| B0FJKNRNZK | 150PSI便携式电动充气泵 | early | Automotive > Air Compressors |
| B0GLN365R2 | 电动滑板车 | new | Sports & Outdoors > Scooters |

---

## 9. 配置项

### 9.1 后端配置 (`backend/app/config.py`)

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `DB_PATH` | `./data/openclaw.db` | SQLite 数据库路径 |
| `ANTHROPIC_API_KEY` | 环境变量 | Anthropic API 密钥 |
| `CLAUDE_MODEL` | `claude-sonnet-4-6` | 使用的 Claude 模型 |
| `THINKING_BUDGET_TOKENS` | `8000` | adaptive thinking token 预算 |
| `MAX_UPLOAD_SIZE_MB` | `50` | 文件上传大小限制 |
| `ALLOWED_EXTENSIONS` | `.xlsx .xls .csv .pdf` | 允许的上传文件类型 |
| `CORS_ORIGINS` | `["*"]` | CORS 允许来源（生产环境需收紧） |
| `TASK_TTL_SECONDS` | `3600` | 内存中分析任务的保留时长 |

### 9.2 前端配置 (`frontend/vite.config.ts`)

| 配置项 | 值 | 说明 |
|--------|---|------|
| 开发端口 | `5173` | Vite 默认 |
| API 代理 | `/api → http://localhost:8000` | REST 请求转发 |
| WS 代理 | `/ws → ws://localhost:8000` | WebSocket 转发 |

---

## 10. 开发约定

### 10.1 代码风格

- **Python**: 全链路 `async/await`，无阻塞操作；Pydantic v2 严格类型标注；中文注释
- **TypeScript**: strict mode；函数式组件 + Hooks；named exports；类型定义集中在 `types/signals.ts`
- **Claude 调用**: 使用 `thinking={"type": "adaptive"}`；JSON 解析失败最多重试 3 次，第 2 次起将错误反馈给 Claude

### 10.2 数据库约定

- 开启外键约束: `PRAGMA foreign_keys=ON`
- 使用 WAL 模式: `PRAGMA journal_mode=WAL`（支持并发读取）
- 所有事务表带时间戳
- 通过 UNIQUE 约束去重

### 10.3 前端降级策略

API 不可用时，前端自动回退到 `mockData.ts` 中的模拟数据，保证 UI 可开发和演示。

---

## 11. 路线图

### Phase 1 (已完成)
- [x] 后端 FastAPI 框架 + SQLite 数据层
- [x] Orchestrator AI 分析引擎（阶段感知 + 盈亏平衡计算）
- [x] WebSocket 流式推送
- [x] 广告报表 / ABA / 日销 XLSX 解析器
- [x] 前端 Overview + Dashboard 页面
- [x] 决策信号卡片 + 健康评分 + 趋势图表
- [x] AI 追问对话

### Phase 2 (进行中)
- [ ] `product_economics` 前端配置 UI（老板自助设置售价/COGS/FBA费/目标ACOS/stage）
- [ ] 分析页显示 stage 标签和盈亏平衡 ACOS 基准线
- [ ] 搜索词报告 XLSX 解析器（替换当前模拟数据）
- [ ] 竞品价格手动导入 UI 或爬虫接入

### Phase 3 (规划中)
- [ ] 决策效果追踪：confirm 后自动对比下周数据变化
- [ ] 多产品批量分析 + 跨产品信号汇总
- [ ] 定时自动分析（每周一自动跑全量分析）
- [ ] 邮件/飞书通知 P0 信号

### Phase 4 (远期)
- [ ] Amazon SP-API 自动数据同步
- [ ] 多站点支持（US / EU / JP）
- [ ] 团队协作：运营助理标注 + 老板审批工作流
