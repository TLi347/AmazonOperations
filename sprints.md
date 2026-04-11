# YZ-Ops AI — Sprint 计划

> **工程基础**：在现有 `yz-ops-ai/` Next.js 工程上迭代。  
> **UI 目标参考**：`功能数据流/yz-ops-app.jsx`  
> **数据流规格**：`功能数据流/` 目录下各 md 文件

---

## Sprint 1 — Store + 类型层重构

**目标**：在现有 store 上加入品类层级，不破坏已有的 ASIN 级数据结构。

### 改动文件
- `src/store/appStore.ts`
- `src/types/`（若需新建类型文件）

### 具体任务

**1.1 新增 `Category` 类型**
```ts
interface Category {
  id: string          // 如 "mattress"
  label: string       // 如 "沙发床垫"
  icon: string
  asinIds: string[]   // 指向 Product.id 的列表
}
```

**1.2 新增 store 字段**
```ts
// 品类列表
categories: Category[]
setCategories: (categories: Category[]) => void

// 品类映射：asin → categoryId（初始化时从产品线字段读取）
categoryMapping: Record<string, string>
setCategoryMapping: (mapping: Record<string, string>) => void
assignAsinToCategory: (asinId: string, categoryId: string) => void

// 导航状态
selectedCategoryId: string | null
selectedView: 'overview' | 'category'
setSelectedCategoryId: (id: string | null) => void
setSelectedView: (view: 'overview' | 'category') => void

// 品类级 Chat（区别于现有的 chatByProduct）
chatByCategory: Record<string, ChatMessage[]>
// 复用现有 addChatMessage / setChatMessages 接口，传 categoryId 即可
```

**1.3 保留现有所有字段不变**  
`metricsByProduct`、`inventoryByProduct`、`adDataByProduct`、`parsedFileDataByProduct` 等全部保留，后续 Sprint 直接使用。

### 完成标准
- Store 类型编译通过，无 TS 报错
- 已有功能（上传文件、Chat、告警）不受影响

---

## Sprint 2 — 导航 Shell 重构

**目标**：将现有平铺 ASIN 列表改为三级导航，加入功能 Tab 侧边栏，接入账号总览页。

### 改动文件
- `src/components/layout/ProductRail.tsx` → 重写为 `CategorySidebar.tsx`
- `src/components/layout/FunctionPanel.tsx` → 重写为 `FunctionTabSidebar.tsx`
- `src/components/layout/MainPanel.tsx` — 顶部栏加面包屑 + 模型选择器
- `src/app/app/page.tsx` — 接入新组件，加账号总览页路由
- 新建 `src/components/panels/OverviewPanel.tsx`

### 具体任务

**2.1 `CategorySidebar.tsx`**
- 顶部固定条目：「账号总览」
- 展开/收起：品类 → ASIN 列表
- 点击品类：`setSelectedCategoryId` + `setSelectedView('category')`
- 点击 ASIN：`setSelectedProductId` + `setSelectedView('category')`
- 未分类 ASIN 归入「未分配」分组，显示黄色 ⚠ 标记
- 选中状态样式参考 `yz-ops-app.jsx` 的 `C.sidebarActive`

**2.2 `FunctionTabSidebar.tsx`**
- 仅在非总览页显示
- 5 个 Tab：Chat / KPI汇总 / 每日告警 / 广告优化 / 库存看板
- 点击 Tab：`setActivePanel`
- 样式参考 `yz-ops-app.jsx` 第二列侧边栏

**2.3 `OverviewPanel.tsx`**
- KPI 卡片：总GMV(30d)、总广告花费(30d)、账号TACoS、FBA总可售库存
- 数据源新鲜度列表（9条，含 US广告活动、广告位报表、成本管理）
- 品类健康状态列表：各品类红/黄告警数 + GMV(7d) + TACoS
- 品类映射未完整时显示黄色提示（「X / Y 个 ASIN 未分配品类」）
- 数据来源：从 store 聚合各 ASIN 的 metrics / inventory / alerts

**2.4 顶部栏**
- 面包屑：`账号总览` 或 `品类名 › 功能名`
- 模型选择器（复用现有 `AVAILABLE_MODELS`）

### 完成标准
- 三级导航可切换，主区域随之更新
- 总览页 KPI 卡片正确聚合（即使数据为空也显示 $0）
- 原有 Chat / 告警 / 广告 / 库存面板在新导航下仍正常工作

---

## Sprint 3 — 品类映射配置

**目标**：让用户能完成 ASIN → 品类 的归属配置，系统自动读取报表中的 `产品线` 字段预填。

### 改动文件
- 新建 `src/components/panels/CategoryMappingPanel.tsx`
- `src/lib/parsers/parseAsinReport.ts` — 上传时提取 `产品线` 字段写入 store
- `src/app/api/upload/route.ts` — 上传成功后触发品类预填逻辑

### 具体任务

**3.1 上传时自动预填**
- `parseAsinReport` 解析时提取每行的 `产品线` 字段
- 上传完成后：若 `产品线` 有值（非 `--`），自动调用 `assignAsinToCategory`
- 品类不存在时自动创建（id = 产品线值的 slug，label = 产品线原值）

**3.2 `CategoryMappingPanel.tsx`**
- 显示所有已上传 ASIN 列表
- 每行：ASIN、产品标题、当前品类（下拉选择）
- 支持新建品类（输入名称）
- 「未分配」的 ASIN 置顶显示
- 保存后写入 `setCategoryMapping`

**3.3 入口**
- 总览页「品类映射未完整」提示上加「前往配置 →」链接
- 侧边栏底部加「品类配置」入口

### 完成标准
- 上传产品报表后，`产品线` = "床垫" 的 ASIN 自动归入床垫品类
- 未分配 ASIN 可手动拖拽或下拉分配品类
- 品类映射持久化到 store，刷新前不丢失

---

## Sprint 4 — 告警引擎更新

**目标**：对齐 `功能数据流/03-每日告警看板.md` 规格，修正 CVR/OCR 区分，新增缺失告警项。

### 改动文件
- `src/lib/alertEngine.ts`
- `src/store/appStore.ts` — `Product` 类型已有 `stage`，确认告警引擎使用该字段

### 具体任务

**4.1 修正 CVR/OCR 区分**
```ts
// 广告CVR = 广告订单量 ÷ 广告点击量（报表字段 adOrders / clicks）
const adCvr = adOrders / clicks

// OCR 页面转化率 = 订单量 ÷ 总流量（报表字段 orders / sessions）
const ocr = orders / sessions
```
告警规则中使用 `OCR` 判断 Buy Box 异常，不使用 `adCvr`。

**4.2 ACOS 阈值按产品阶段参数化**
```ts
const acosThresholds = {
  '新品期':  { yellow: 80,  red: 100 },
  '成长期':  { yellow: 60,  red: 75  },
  '成熟期':  { yellow: 45,  red: 55  },
}
```

**4.3 新增告警规则**

| 规则 | 字段来源 | 黄色 | 红色 |
|------|---------|------|------|
| Sessions 环比 | `总流量` 时序 | < -15% | < -30% |
| OCR（页面转化率） | `OCR` 字段 | 8–10% | < 8% |
| 广告花费利用率 | 广告花费 / 每日预算 | < 70% 或接近上限 | > 100% 超预算 |

> 广告花费利用率依赖 US广告活动报表的 `每日预算` 字段。若未上传该报表，此告警不触发（静默跳过）。

**4.4 移除或修正误用规则**
- 检查现有 16 条规则中是否存在 `CVR = orders ÷ clicks`，改为正确定义

### 完成标准
- 上传产品报表后，ACOS 阈值随产品阶段变化
- Sessions 环比告警可触发（需有 ≥2 天历史数据）
- OCR 告警可触发
- 广告预算利用率：未上传 US广告活动报表时不报错

---

## Sprint 5 — 广告优化清单更新

**目标**：对齐 `功能数据流/04-广告优化行动清单.md`，修正时间窗口，补充广告位分析，加入品类级跨 ASIN 词重叠检测。

### 改动文件
- `src/lib/alertEngine.ts` 或单独的 `src/lib/adActionEngine.ts`（若尚未拆分）
- `src/components/panels/AdsPanel.tsx`
- `src/lib/parsers/parseAdCampaign.ts` — 确认覆盖 US广告活动（`每日预算` 字段）

### 具体任务

**5.1 时间窗口修正**
- 所有 SOP 规则（P0/P1/P2）基于 30 天累计数据（搜索词重构报表的实际窗口）
- 在规则注释中标注 `// 30d window`

**5.2 P1-B 广告位分析**
- 触发条件：`曝光量 ≥ 500 且 CTR < 0.2%`
- 若已上传广告位报表，追加：按广告活动名称 JOIN，展示各广告位的 CTR 对比
- UI：在 P1-B 行下方展开「广告位详情」（搜索结果顶部 / 商品页面 / 其他）

**5.3 跨 ASIN 词重叠检测（品类级）**
- 入参：当前品类下所有 ASIN 的搜索词数据
- 逻辑：`(search_term, match_type)` 组合出现在 ≥2 个不同 ASIN → 标记 P2 内部竞争
- 输出：在广告行动清单末尾追加「内部竞争」分组（紫色标签）

**5.4 僵尸广告组识别**
- 数据源：广告活动重构报表（3个月）
- 条件：`有花费 且 成交量 = 0 且 运行天数 > 30`
- 显示在行动清单末尾独立分组

### 完成标准
- 上传搜索词重构后，P0/P1/P2 规则正确触发
- 同品类内有 2 个 ASIN 投放相同词时，内部竞争条目出现
- 广告位数据存在时，P1-B 展开广告位明细

---

## Sprint 6 — 库存看板修正

**目标**：对齐 `功能数据流/05-库存健康看板.md`，修正库龄字段，FBM 产品正确计算可售天数，补全多站点展示。

### 改动文件
- `src/lib/parsers/parseInventory.ts`
- `src/components/panels/InventoryPanel.tsx`
- `src/store/appStore.ts` — `InventoryRecord` 类型扩展

### 具体任务

**6.1 修正库龄字段映射**
```ts
// 旧（错误假设）
aging_0_90 / aging_91_180 / aging_181_270

// 正确（实际报表字段）
aging_0_30 / aging_31_60 / aging_61_90 / aging_91_180 /
aging_181_330 / aging_331_365 / aging_365_plus
```

**6.2 FBM 产品可售天数**
- FBM 产品的 `可售库存` 字段即卖家自管库存，计算逻辑与 FBA 相同
- 删除当前代码中对 FBM 产品返回 `"—"` 的特殊处理
- 可售天数 = `sellable_qty ÷ 日均销量`（日均 = 近30天订单量 ÷ 30）

**6.3 长期仓储费风险**
- 黄色：`aging_181_330 > 0`
- 红色：`aging_331_365 > 0 || aging_365_plus > 0`
- 精确费用：使用报表细分字段（181-210天仓储费 + 211-240天仓储费 + … 各段直接加总）

**6.4 多站点 SKU 展示**
- 同一 ASIN 在 US / CA / MX 各站点的 SKU 分行显示
- 不合并跨站点库存

### 完成标准
- 上传库存报表后，FBM 产品显示正确可售天数（非 "—"）
- 库龄 > 181 天的 SKU 触发黄色预警
- US / CA 站点库存分行显示

---

## Sprint 7 — Chat 上下文分级注入

**目标**：对齐 `功能数据流/06-Chat功能.md`，按当前页面层级（ASIN / 品类 / 账号）注入不同范围的上下文。

### 改动文件
- `src/lib/systemPrompt.ts` — `buildAgentSystemPrompt`
- `src/components/panels/ChatPanel.tsx`
- `src/lib/agentTools.ts` — `get_metrics` 等工具支持品类/账号级查询

### 具体任务

**7.1 `buildAgentSystemPrompt` 分层**
```ts
function buildAgentSystemPrompt(
  context: AsinContext | CategoryContext | AccountContext,
  files: DataFile[]
): string
```
- `AsinContext`：注入单 ASIN 的指标、库存、广告结构、告警、成本
- `CategoryContext`：在 ASIN 基础上追加品类内所有 ASIN 汇总对比 + 关键词重叠列表 + 品类 TACoS
- `AccountContext`：在品类基础上追加全账号 KPI + 各品类健康摘要
- 所有层级均注入：运营手册阈值 + 广告 SOP 规则

**7.2 ChatPanel 判断当前上下文层级**
```ts
const contextLevel = selectedView === 'overview'
  ? 'account'
  : selectedProductId
    ? 'asin'
    : 'category'
```
- 品类页未选中具体 ASIN 时：品类级 Chat，使用 `chatByCategory[categoryId]`
- 选中具体 ASIN 时：ASIN 级 Chat，使用现有 `chatByProduct[productId]`
- 总览页：账号级 Chat（单独 key，如 `chatByCategory['__account__']`）

**7.3 Agent tools 扩展**
- `get_metrics(time_window, scope?)` — `scope` 可选 `'asin' | 'category' | 'account'`
- 品类级调用时，聚合品类内所有 ASIN 的原始计数后再计算比率

**7.4 Context badge 更新**
- 显示当前上下文层级：`ASIN级` / `品类级 · 沙发床垫` / `账号级`
- 切换品类/ASIN 时 Chat 历史保留（不清空）

### 完成标准
- 在品类页发送「Queen 和 Full 哪款效率更高？」时，AI 能看到两个 ASIN 的数据
- 在总览页发送「哪个品类最需要关注？」时，AI 能看到所有品类的汇总
- 切换品类不清空对话历史

---

## 依赖关系

```
Sprint 1（Store）
  └── Sprint 2（Shell）
        ├── Sprint 3（品类映射）   ← 独立，可并行
        ├── Sprint 4（告警引擎）   ← 依赖 Sprint 1 的 stage 字段
        ├── Sprint 5（广告清单）   ← 依赖 Sprint 3 的 categoryMapping
        ├── Sprint 6（库存看板）   ← 独立，可并行
        └── Sprint 7（Chat分层）   ← 依赖 Sprint 3 的品类结构
```

## 不在本次 Sprint 范围内

- 数据库持久化（PostgreSQL / Prisma）— 当前仍为内存存储
- 多账号支持
- 自动每日拉取（需 API 对接 Nordhive）
- Buy Box 精确数据（需 Seller Central Business Report 额外集成）
- 竞品监控手动录入 UI（Chat 中已可查询，暂不建独立面板）
