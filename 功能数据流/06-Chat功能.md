# 06 — Chat 功能

[← 返回索引](./index.md)

> **数据范围**：全部已上传报表，不限品类。  
> **入口**：顶层导航 Chat 页，与品类视图平级。  
> **目标**：基于已上传数据和运营手册，回答"为什么"和"怎么办"类问题，补充结构化看板无法覆盖的分析场景。

---

## 架构概述

Chat 使用 **Claude Agentic Loop**：Claude 不预先接收所有数据，而是根据问题自主决定调用哪些工具查询哪些数据，再基于真实数据给出分析。

```
用户发送消息
    │
    ▼
ChatPanel
    │  POST /api/agent  { messages, systemPrompt }
    ▼
服务端 /api/agent/route.ts
    │
    ├── while (Claude 返回 tool_use，最多 10 次) {
    │     → Claude API（非流式）
    │     → 服务端执行工具（查询 SQLite DB，返回 JSON）
    │     → 追加 tool_result → 继续循环
    │   }
    │
    └── Claude 返回最终文字
          → 提取 response.content 中的文本
          → 以 SSE 事件格式推送至前端
          → 前端逐字渲染
```

---

## 输入：上下文注入

Chat 使用**静态系统 Prompt**，一次写定，不随 UI 导航状态变化。

### System Prompt 固定注入内容

```
1. 已上传文件列表（fileType + snapshotDate + 新鲜度状态）
2. 工具使用说明 + fileType → 工具强制映射表
3. KPI 健康基准（按产品阶段：新品期 / 成长期 / 成熟期）
4. 广告优化 SOP 规则摘要（P0–P3）
```

不预先注入实际业务数据。Claude 通过工具按需查询，用户的问题本身决定分析范围（品类 / ASIN / 账号）。

### 数据范围由用户问题决定

```
用户问「床垫 ACOS 为什么高」→ Claude 自动查询床垫相关数据
用户问「哪个品类最需要关注」→ Claude 查询全账号各品类数据
用户问「Full款库存还剩多久」→ Claude 查询该 ASIN 的库存报表

不需要系统提前过滤数据范围，Claude 根据问题意图自主决定调用哪些工具
```

---

## 工具列表

Claude 通过工具按需获取数据，不预先接收全部数据：

| 工具 | 用途 | 对应数据源 | 过滤参数 |
|------|------|-----------|---------|
| `get_metrics(time_window)` | 查询 KPI 快照 | 产品报表时序 | today / yesterday / w7 / w14 / d30 |
| `get_acos_history(days?)` | 查询 ACoS 日趋势 | 产品报表时序（逐日） | 最近 N 天 |
| `get_inventory()` | 查询库存状况 | 库存报表 | — |
| `get_ad_campaigns(filter?)` | 查询广告活动 | 广告活动重构 | all / high_acos / over_budget / top_spend |
| `get_search_terms(filter?)` | 查询关键词转化 | 搜索词重构 | all / zero_conv / winner / high_acos / high_spend |
| `get_alerts(level?, category?)` | 查询已触发告警 | 告警引擎输出 | all / red / yellow |
| `list_uploaded_files()` | 列出已上传文件 | 系统文件列表 | — |
| `get_file_data(file_type, limit?)` | 读取原始文件数据 | 任意已上传文件 | 行数限制 |

**文件类型 → 工具强制映射（Claude 必须遵守）：**

```
product           → get_metrics + get_acos_history  （禁止用 get_file_data）
campaign_3m       → get_ad_campaigns
search_terms      → get_search_terms
inventory         → get_inventory
其他所有 fileType  → get_file_data(fileType)
```

> fileType 枚举完整列表见 `项目结构/01-目录结构.md`。

---

## System Prompt 构建逻辑

`buildAgentSystemPrompt()` 在**每次用户发送消息时**通过 `GET /api/build-prompt` 重新获取，确保感知最新上传的文件：

```
1. 已上传文件列表（文件名 + 上传日期，让 Claude 知道哪些数据可以查询）
2. 工具使用说明 + 文件类型 → 工具映射表
3. KPI 健康基准（新品期 / 成长期 / 成熟期 阈值表）
4. 广告优化 SOP 规则全文（P0–P3）

不注入：实际业务数据（由 Claude 按需通过工具调用获取）
不需要：当前选中品类 / 当前 ASIN 等 UI 状态
```

---

## 典型对话场景

| 用户问题 | Claude 调用工具 | 回答依据 |
|---------|----------------|---------|
| 「这个产品 ACoS 为什么高？」 | `get_search_terms(high_acos)` + `get_ad_campaigns(high_acos)` | 高消耗词明细 + SOP P0/P1 规则 |
| 「现在库存还撑多久？」 | `get_inventory()` + `get_metrics(w7)` | 可售天数计算 + 手册补货阈值 |
| 「床垫品类哪个 ASIN 最需要关注？」 | `get_alerts(level=red)` + `get_metrics(d30)` | 各 ASIN 红色告警 + GMV 对比 |
| 「这周广告优化应该先做什么？」 | `get_alerts(level=all)` + `get_search_terms(zero_conv)` | 红黄告警优先级 + 零成交词 |

---

## 边界限制

```
✅ 可以：
  · 基于已上传数据做分析（含跨品类对比，如「哪个品类最需要关注」）
  · 同时查询多个品类数据后给出综合判断，但在回答中明确标注各数据来源品类
  · 引用手册规则给出操作建议
  · 对比同品类内不同 ASIN 的表现

❌ 不可以：
  · 做销量预测（不具备预测模型）
  · 直接执行操作（不对接广告后台 API）
  · 用 A 品类的数据去解释 B 品类的问题（数据归因需保持品类边界清晰）
  · 引用未上传的数据（会声明数据缺失）
```

---

## 技术限制

- 对话历史仅保留文本消息，不保留工具调用中间步骤；下一轮对话 Claude 会重新查询数据
- 单次对话最多执行 10 步工具调用循环（防止死循环）
- 已解析数据存于 SQLite，刷新页面数据保留；对话历史存于前端 state，**刷新后清空**（MVP 设计，不持久化会话记录）
- 每次发消息时重新拉取 System Prompt（GET /api/build-prompt），自动感知新上传文件，无需手动刷新
- 模型：`claude-sonnet-4-6`（可在配置中替换为 `claude-opus-4-6`）
