# YZ-Ops AI

亚马逊电商 AI 运营决策工作台。上传 Nordhive 报表后，AI Agent 主动查询数据并给出广告优化、库存预警、竞品监控的具体建议。

---

## 快速启动

```bash
npm install
cp .env.example .env   # 填写 ANTHROPIC_API_KEY
npm run dev            # → http://localhost:3000
```

无需数据库即可运行。有 PostgreSQL 时：

```bash
npx prisma generate && npx prisma db push
```

### 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `ANTHROPIC_API_KEY` | 是 | Claude API 密钥 |
| `DATABASE_URL` | 否 | PostgreSQL 连接字符串（缺省时数据存内存） |
| `NEXT_PUBLIC_DEFAULT_MODEL` | 否 | 默认模型，缺省用 `claude-sonnet-4-6` |

---

## 技术栈

| 层 | 技术 |
|----|------|
| 框架 | Next.js 14 (App Router) |
| 样式 | Tailwind CSS + shadcn/ui |
| 状态 | Zustand |
| 图表 | Recharts |
| AI | Claude API — Agentic Loop with tool_use |
| 数据库 | PostgreSQL + Prisma 5（可选）|
| Excel | SheetJS `xlsx`（服务端解析）|

---

## 项目结构

```
src/
├── app/
│   ├── app/page.tsx              # 主入口（三栏布局）
│   ├── api/agent/route.ts        # Agent 单步 API（tool_use → JSON / end_turn → SSE）
│   ├── api/chat/route.ts         # 普通流式对话（备用）
│   ├── api/upload/route.ts       # 文件上传 + 解析 + 可选 DB 写入
│   └── api/data/route.ts         # DB 查询；无 DB 返回 {error:"no_db"}
├── components/
│   ├── layout/
│   │   ├── AppInitializer.tsx    # 启动时从 DB 加载数据（无 DB 时仅加载产品列表）
│   │   ├── ProductRail.tsx       # 左栏 L1（72px）：产品切换
│   │   ├── FunctionPanel.tsx     # 左栏 L2（200px）：文件上传 + 面板导航
│   │   └── MainPanel.tsx         # 主面板容器 + TopBar（模型选择）
│   └── panels/
│       ├── ChatPanel.tsx         # AI Agent 对话（agentic loop + 工具调用状态显示）
│       ├── DashboardPanel.tsx    # 运营看板（KPI + ACoS 趋势图 + 活动事件标记）
│       ├── AdsPanel.tsx          # 广告监控（实时告警 + 14 条 SOP 规则联动）
│       ├── InventoryPanel.tsx    # 库存管理（可售天数健康度预警）
│       └── CompetitorsPanel.tsx  # 竞品监控（手动录入）
├── store/appStore.ts             # Zustand 全局状态
└── lib/
    ├── agentTools.ts             # 7 个工具定义（schema + 客户端执行函数）
    ├── alertEngine.ts            # 16 条告警规则引擎
    ├── systemPrompt.ts           # buildAgentSystemPrompt / buildSystemPrompt
    ├── clientMetricsHelper.ts    # 上传后客户端合并 ASIN 数据
    ├── mockData.ts               # 开发用产品列表（无 mock metrics）
    ├── prisma.ts                 # PrismaClient 单例
    └── parsers/                  # 11 种 Nordhive 文件解析器
prisma/schema.prisma              # 13 个数据模型
```

---

## AI Agent 架构

Chat 面板使用**客户端驱动的 Agentic Loop**，数据不预注入 system prompt，而是由 Claude 按需调用工具：

```
ChatPanel（客户端）
  1. POST /api/agent { messages, systemPrompt, model }
  2. ← JSON { type:"tool_use", content:[...] }     ← Claude 需要数据
  3. executeToolCall() 读取本地 Zustand state
  4. POST /api/agent { messages + tool_results }
  5. ← SSE stream { text:"..." }                   ← Claude 最终回答
  6. 流式渲染至对话气泡
  （循环最多 10 步）
```

**7 个工具**（`src/lib/agentTools.ts`）：

| 工具 | 参数 | 数据来源 |
|------|------|---------|
| `get_metrics` | `time_window`: today/yesterday/w7/w14/d30 | `metricsByProduct` |
| `get_acos_history` | `days?` | `metricsByProduct.acosHistory` |
| `get_inventory` | — | `inventoryByProduct` |
| `get_ad_campaigns` | `filter?`: all/high_acos/over_budget/top_spend | `adDataByProduct.campaigns` |
| `get_search_terms` | `filter?`: all/zero_conv/winner/high_acos/high_spend | `adDataByProduct.searchTerms` |
| `get_alerts` | `priority?`: all/P0/P1/P2/P3 | `alerts` |
| `list_uploaded_files` | — | `filesByProduct` |

工具在浏览器内执行，**无需 DB**，无额外 API 调用。

---

## 数据流

### 上传 → 各面板

```
用户上传文件
  → POST /api/upload → 解析器（服务端）→ 返回 parsed[]
  → FunctionPanel 前端分发：
      ASIN 报表    → mergeAsinUpload()        → metricsByProduct   → DashboardPanel / Agent
      库存报表     → inventoryRowsToRecords() → inventoryByProduct → InventoryPanel / Agent
      广告活动/    → setAdDataForProduct()
      搜索词报表     + runAlertRules()         → alerts + adData   → AdsPanel / Agent
```

### Nordhive 文件格式

所有报表来自 Nordhive 第三方系统，**非亚马逊原生格式**：

- Row 1–2：过滤标签行（含日期区间，`inferTimeWindow()` 从此解析 daily/weekly/biweekly/monthly）
- Row 3：空行
- Row 4：真实列头
- Row 5：汇总行（跳过）
- Row 6+：数据行

> **注意**：Nordhive 将广告花费存为负数（现金流出方向）。所有解析器已对 `广告花费` 字段应用 `Math.abs()`。

### 11 种文件解析器（`src/lib/parsers/`）

| 文件名特征 | 解析器 | 驱动面板 |
|-----------|--------|---------|
| `系统-Nordhive-*-产品报表-ASIN*` | `parseAsinReport` | Dashboard + Agent |
| `系统-Nordhive-*-产品报表-SKU*` | `parseSkuReport` | Agent |
| `系统-Nordhive-*-广告活动*` | `parseAdCampaign` | AdsPanel + Agent |
| `系统-Nordhive-*-搜索词重构*` | `parseSearchTerm` | AdsPanel + Agent |
| `系统-Nordhive-*-广告位*` | `parseAdPlacement` | Agent |
| `系统-Nordhive-*-广告活动重构*` | `parseAdRestructure` | Agent |
| `系统-Nordhive-*-成本管理*` | `parseCostMgmt` | Agent |
| `系统-Nordhive-*-库存报表*` | `parseInventory` | InventoryPanel + Agent |
| `B0XXXXXXXX_*` | `parseSingleArchive` | Agent |
| `*ABA*` / `*Search_Compare*` | `parseAbaSearch` | Agent |

---

## 告警引擎（`src/lib/alertEngine.ts`）

上传广告活动或搜索词报表后自动触发，检测 16 条规则（P0–P3）：

- **P0（立即）**：零成交词、无效词爆量、超预算+高ACoS
- **P1（24h）**：高ACoS词、CTR过低、新品曝光不足
- **P2（本周）**：最优词扩量、广泛精确重叠、词组低曝光、ASIN定投承压、多站点差异
- **P3（下周期）**：广泛词沉淀、广告结构优化、季节性预算、品牌词防御

告警写入 Zustand `alerts`（按 `triggerRule + productId` 去重），AdsPanel 高亮命中的 SOP 规则，Agent 可通过 `get_alerts` 工具读取。

---

## Zustand 主要状态

| 字段 | 说明 |
|------|------|
| `products` / `selectedProductId` | 产品列表与当前选中 |
| `activePanel` | `chat` / `dashboard` / `ads` / `inventory` / `competitors` |
| `metricsByProduct` | KPI 快照 + ACoS 历史（ASIN 报表填充）|
| `inventoryByProduct` | 库存记录（库存报表填充）|
| `adDataByProduct` | `{ campaigns[], searchTerms[] }`（告警引擎 + Agent 消费）|
| `alerts` | 告警列表 |
| `filesByProduct` | 各产品已上传文件 |
| `chatByProduct` | 各产品对话历史（仅展示用；Agent loop 维护独立 API 消息队列）|
| `pendingChatMessage` | 跨面板一键触发 Chat 的预填消息 |
| `eventMarkersByProduct` | 活动事件标记（渲染为 ACoS 图表 ReferenceArea）|

---

## 注意事项

**产品切换重置**：`MainPanel` 对所有面板设置 `key={selectedProductId}`，切换产品时强制重新挂载，清除 local state。

**无 DB 模式**：`HAS_DB = !!process.env.DATABASE_URL`。无 DB 时 Prisma 写入静默跳过，`/api/data` 返回 `{error:"no_db"}`（HTTP 200）。所有运营数据存于 Zustand 内存，刷新页面丢失。

**Mock 数据**：`mockData.ts` 仅提供 2 个产品定义（Full/Queen 沙发床垫）。KPI / 告警不预填，需上传真实文件后才显示数据。

**ACoS 日期格式**：统一存储为 `YYYY-MM-DD`，图表 XAxis 格式化为 `MM-DD` 显示。

---

## 开发路线图

| Phase | 内容 | 状态 |
|-------|------|------|
| 1 | 三栏骨架 + Zustand + Prisma Schema | ✅ |
| 2 | Chat：Claude streaming + Markdown + 模型选择 | ✅ |
| 3 | 运营看板、广告监控、库存管理、竞品监控面板 | ✅ |
| 4 | 11 种解析器 + 上传 UI | ✅ |
| 5 | AdsPanel 动态数据层 + 16 条告警规则引擎 | ✅ |
| 6 | Chat 升级为 Agentic Loop + 7 个数据查询工具 | ✅ |
| 7 | Docker 部署 + 数据持久化优化 | 待开发 |
