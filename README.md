# YZ-Ops AI

亚马逊电商 AI 辅助决策系统。基于 Nordhive 报表数据，提供广告优化、库存预警、竞品监控的 AI 对话工作台。

---

## 快速启动

```bash
npm install
cp .env.example .env   # 填写 ANTHROPIC_API_KEY（必填）
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
| AI | Claude API (`@anthropic-ai/sdk`) |
| 数据库 | PostgreSQL + Prisma 5（可选）|
| Excel | SheetJS `xlsx`（服务端解析）|

---

## 项目结构

```
src/
├── app/
│   ├── app/page.tsx              # 主入口（三栏布局）
│   ├── api/chat/route.ts         # Claude 流式对话
│   ├── api/upload/route.ts       # 文件上传 + 解析 + 可选 DB 写入
│   └── api/data/route.ts         # DB 查询；无 DB 返回 {error:"no_db"}
├── components/
│   ├── layout/
│   │   ├── AppInitializer.tsx    # 启动时加载数据
│   │   ├── ProductRail.tsx       # 左栏 L1（72px）：产品列表
│   │   ├── FunctionPanel.tsx     # 左栏 L2（200px）：文件上传 + 导航
│   │   └── MainPanel.tsx         # 主面板容器 + TopBar
│   └── panels/
│       ├── ChatPanel.tsx         # AI 对话（流式 + Markdown）
│       ├── DashboardPanel.tsx    # 运营看板（KPI + ACoS 图表 + 告警）
│       ├── AdsPanel.tsx          # 广告监控（实时告警 + 14 条 SOP 规则）
│       ├── InventoryPanel.tsx    # 库存管理（健康度预警）
│       └── CompetitorsPanel.tsx  # 竞品监控（手动录入）
├── store/appStore.ts             # Zustand 全局状态
└── lib/
    ├── alertEngine.ts            # 16 条告警规则引擎（Phase 5）
    ├── systemPrompt.ts           # Claude 系统提示词构建
    ├── clientMetricsHelper.ts    # 上传后客户端数据合并
    ├── mockData.ts               # 开发用内存数据
    ├── prisma.ts                 # PrismaClient 单例
    └── parsers/                  # 11 种 Nordhive 文件解析器
prisma/schema.prisma              # 13 个数据模型
```

---

## 核心概念

### Nordhive 文件格式

所有报表来自 Nordhive 第三方系统导出，**非亚马逊原生格式**：

- Row 1–2：过滤标签行
- Row 3：空行
- Row 4：真实列头
- Row 5：汇总行（解析时跳过）
- Row 6+：数据行

`parseNordhiveSheet()` 统一处理此格式；`parseFlatSheet()` 用于无前缀文件（单品归档、ABA 报表）。

### 11 种文件解析器

通过文件名前缀自动识别类型（`src/lib/parsers/identifier.ts`）：

| 文件名特征 | 解析器 | 主要输出 |
|-----------|--------|---------|
| `系统-Nordhive-*-产品报表-ASIN*` | `parseAsinReport` | GMV / 广告指标（驱动 Dashboard） |
| `系统-Nordhive-*-产品报表-SKU*` | `parseSkuReport` | SKU 维度指标 |
| `系统-Nordhive-*-广告活动*` | `parseAdCampaign` | 活动花费 / ACoS（驱动告警引擎） |
| `系统-Nordhive-*-搜索词重构*` | `parseSearchTerm` | 关键词转化数据（驱动告警引擎） |
| `系统-Nordhive-*-广告位*` | `parseAdPlacement` | 广告位分布 |
| `系统-Nordhive-*-广告活动重构*` | `parseAdRestructure` | 重构报表 |
| `系统-Nordhive-*-成本管理*` | `parseCostMgmt` | 多站点毛利率 |
| `系统-Nordhive-*-库存报表*` | `parseInventory` | 库存 / 库龄（驱动 Inventory） |
| `B0XXXXXXXX_*` | `parseSingleArchive` | 单品归档（广告日志 + 关键词 + 销售） |
| `*ABA*` / `*Search_Compare*` | `parseAbaSearch` | ABA 搜索词竞品对比 |

### 数据流

```
用户上传文件
  → POST /api/upload → 解析器 → 返回 parsed[]
  → FunctionPanel 前端处理：
      ASIN 报表    → mergeAsinUpload()       → metricsByProduct   → DashboardPanel
      库存报表     → inventoryRowsToRecords() → inventoryByProduct → InventoryPanel
      广告活动/    → setAdDataForProduct()
      搜索词报表     + runAlertRules()        → alerts             → AdsPanel
      其他报表     → 注入 Claude 系统提示词                        → ChatPanel
```

### 告警引擎（`src/lib/alertEngine.ts`）

上传广告活动或搜索词报表后自动触发，检测 16 条规则（P0–P3）：

- **P0（立即）**：零成交词、无效词爆量、超预算+高ACoS
- **P1（24h）**：高ACoS词、CTR过低、新品曝光不足
- **P2（本周）**：最优词扩量、广泛精确重叠、词组低曝光、ASIN定投承压、多站点差异
- **P3（下周期）**：广泛词沉淀、广告结构优化、季节性预算、品牌词防御

告警写入 Zustand `alerts`，AdsPanel 实时展示命中规则并高亮对应 SOP 条目。

### Zustand 主要状态字段

| 字段 | 说明 |
|------|------|
| `products` / `selectedProductId` | 产品列表与当前选中 |
| `activePanel` | `chat` / `dashboard` / `ads` / `inventory` / `competitors` |
| `metricsByProduct` | KPI 快照（ASIN 报表上传后填充）|
| `inventoryByProduct` | 库存记录（库存报表上传后填充）|
| `adDataByProduct` | 广告原始数据缓存（告警引擎消费）|
| `alerts` | 告警列表，`addAlerts` 按 triggerRule 去重合并 |
| `filesByProduct` | 各产品已上传文件列表 |
| `chatByProduct` | 各产品对话历史 |
| `pendingChatMessage` | 跨面板一键触发 Chat 的预填消息 |
| `competitorsByProduct` | 竞品列表（手动录入）|
| `eventMarkersByProduct` | 活动事件标记（供图表标注）|

---

## 注意事项

**产品切换重置**：`MainPanel` 对所有面板设置 `key={selectedProductId}`，切换产品时强制重新挂载，避免 local state 残留。

**无 DB 模式**：`HAS_DB = !!process.env.DATABASE_URL`。无 DB 时上传 API 的 Prisma 写入静默跳过，`/api/data` 返回 `{error:"no_db"}`（HTTP 200），前端保留 mock 数据。

**Mock 数据**：`mockData.ts` 含 2 个产品（Full/Queen 沙发床垫），`p1` 有 mock metrics，`p2` 为空状态，便于对比有 / 无数据的 UI 表现。

---

## 开发路线图

| Phase | 内容 | 状态 |
|-------|------|------|
| 1 | 三栏骨架 + Zustand + Prisma Schema | ✅ |
| 2 | Chat：Claude streaming + Markdown + 模型选择 | ✅ |
| 3 | 运营看板、广告监控、库存管理、竞品监控面板 | ✅ |
| 4 | 11 种解析器 + 上传 UI + 系统提示词实时数据注入 | ✅ |
| 5 | AdsPanel 动态数据层 + 16 条告警规则引擎 | ✅ |
| 6 | Docker 部署 + 动画打磨 | 待开发 |
