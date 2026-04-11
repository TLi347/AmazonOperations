# 06 — Chat 功能

[← 返回索引](./index.md)

> **数据范围**：随当前页面层级自动扩展（ASIN 级 / 品类级 / 账号级）。  
> **触发时机**：用户主动在 Chat 面板发送消息。  
> **目标**：基于已上传数据和运营手册，回答"为什么"和"怎么办"类问题，补充结构化看板无法覆盖的分析场景。

---

## 架构概述

Chat 使用 **Claude Agentic Loop**：Claude 不预先接收所有数据，而是根据问题自主决定调用哪些工具查询哪些数据，再基于真实数据给出分析。

```
用户发送消息
    │
    ▼
ChatPanel 构建 AgentState（从系统内存读取当前产品数据）
    │
    ▼
POST /api/agent  { messages, systemPrompt, model }
    │
    ▼
Claude 判断
    ├── 需要数据？
    │     → 返回 tool_use 请求
    │     → ChatPanel 本地执行工具（读 AgentState，无网络请求）
    │     → 追加 tool_result → 再次 POST /api/agent
    │     → （最多循环 10 步）
    │
    └── 分析完成？
          → 返回 SSE 流式文本
          → 前端逐字渲染
```

---

## 输入：上下文注入层级

Chat 的数据范围随当前页面层级自动决定，**不允许跨层级混用数据**。

### ASIN 级（在某个 ASIN 的 Chat Tab 中）

```
注入内容：
  · 产品基础信息：ASIN、标题、站点、品类归属、产品阶段
  · 近7天/近30天销售聚合：GMV、订单量、退货率、广告花费、ACOS、ROAS、TACoS、CTR、CVR
  · 当前广告结构：运行中的广告活动（名称/投放类型/花费/ACOS）
  · 近7天 Top 搜索词：高消耗词、高转化词、高 ACOS 词
  · 库存状态：可售天数、库龄分布、在途库存
  · 关键词排名：监控词的自然排名 / SP排名 / 综合排名及变化
  · 当前告警状态：触发红/黄标的指标列表
  · 成本结构：售价、FBA费、货值、毛利率

不注入：其他 ASIN 或其他品类的数据
```

### 品类级（在品类视图中打开 Chat）

```
在 ASIN 级基础上追加：
  · 本品类所有 ASIN 的汇总指标对比（GMV/ACOS/可售天数并排）
  · 品类内跨 ASIN 关键词重叠列表
  · 品类级 SP/SB/SD 广告花费分配比例
  · 品类总 TACoS = 品类总广告花费 ÷ 品类总 GMV
  · 品类内各 ASIN 预算占比

不注入：其他品类的数据
```

### 账号级（在账号总览页打开 Chat）

```
在品类级基础上追加：
  · 全账号 GMV、总广告花费、账号 TACoS
  · FBA 总库存使用率
  · 各品类健康状态汇总（红/黄告警数量）
```

### 所有层级始终注入

```
· 运营手册规则：
    - 数据基准速查阈值（红/黄/绿判断标准）
    - 广告操作 SOP 决策树（P0–P2 规则原文）
  （作为 Claude 生成建议的判断依据，不依赖 Claude 自身训练知识）
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
| `get_alerts(priority?)` | 查询已触发告警 | 告警引擎输出 | all / P0 / P1 / P2 |
| `list_uploaded_files()` | 列出已上传文件 | 系统文件列表 | — |
| `get_file_data(file_type, limit?)` | 读取原始文件数据 | 任意已上传文件 | 行数限制 |

**文件类型 → 工具强制映射（Claude 必须遵守）：**

```
nordhive_asin_report   → get_metrics + get_acos_history  （禁止用 get_file_data）
nordhive_ad_campaign   → get_ad_campaigns
nordhive_search_term   → get_search_terms
nordhive_inventory     → get_inventory
其他所有文件类型        → get_file_data(fileType)
```

---

## System Prompt 构建逻辑

`buildAgentSystemPrompt(product, files)` 在每轮对话前注入：

```
1. 当前产品上下文（ASIN、阶段、价格、BSR）
2. 已上传文件列表（让 Claude 知道哪些数据可以查询）
3. 工具使用说明 + 文件类型 → 工具映射表
4. KPI 健康基准（按产品阶段：新品期 / 成长期 / 成熟期）
5. 14 条广告优化 SOP 规则（P0–P2）全文
6. 当前上下文层级声明（ASIN级 / 品类级 / 账号级）

不注入：实际业务数据（由 Claude 按需通过工具调用获取）
```

---

## 典型对话场景

| 用户问题 | Claude 调用工具 | 回答依据 |
|---------|----------------|---------|
| 「这个产品 ACoS 为什么高？」 | `get_search_terms(high_acos)` + `get_ad_campaigns(high_acos)` | 高消耗词明细 + SOP P0/P1 规则 |
| 「现在库存还撑多久？」 | `get_inventory()` + `get_metrics(w7)` | 可售天数计算 + 手册补货阈值 |
| 「床垫品类哪个 ASIN 最需要关注？」 | `get_alerts(P0)` + `get_metrics(d30)` | 各 ASIN 告警数量 + GMV 对比 |
| 「这周广告优化应该先做什么？」 | `get_alerts(all)` + `get_search_terms(zero_conv)` | P0 规则优先级 |

---

## 边界限制

```
✅ 可以：
  · 基于已上传数据做分析
  · 引用手册规则给出操作建议
  · 在当前上下文层级内对比 ASIN

❌ 不可以：
  · 做销量预测（不具备预测模型）
  · 直接执行操作（不对接广告后台 API）
  · 跨品类混用数据回答问题
  · 引用未上传的数据（会声明数据缺失）
```

---

## 技术限制

- 对话历史仅保留文本消息，不保留工具调用中间步骤；下一轮对话 Claude 会重新查询数据
- 单次对话最多执行 10 步工具调用循环（防止死循环）
- 所有数据存于内存（Zustand），刷新页面后需重新上传文件
- 模型：`claude-sonnet-4-6`（可在配置中替换为 `claude-opus-4-6`）
