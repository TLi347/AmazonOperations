# 06 — Chat 功能

[← 返回索引](../README.md)

> **数据范围**：全部已上传报表，不限品类。  
> **入口**：顶层导航 Chat 页，与品类视图平级。  
> **目标**：基于已上传数据和运营手册，回答"为什么"和"怎么办"类问题，补充结构化看板无法覆盖的分析场景。

---

## 功能说明

Chat 是全局分析入口，用户通过自然语言提问，系统自动调用工具查询数据并给出分析建议。

核心能力：
- **多 Session 管理** — 用户可创建、切换、删除多个对话，历史持久化
- **跨品类分析** — 不绑定品类，可一次提问涉及多个 ASIN
- **工具自动调用** — Claude 根据问题语义自主选择查询工具
- **流式响应** — 逐 token 显示回答，工具调用过程可视化

---

## 用户交互

### 页面布局

```
┌─ Session 列表（左栏）─┐   ┌─ 对话主区（右栏）──────────┐
│  + 新建对话           │   │  消息历史（从 DB 加载）      │
│  ─────────────────   │   │  工具调用状态气泡            │
│  ● Session A  ←当前  │   │  流式文字渲染                │
│  ○ Session B         │   │  输入框 + 发送               │
│  ○ Session C         │   └──────────────────────────────┘
└──────────────────────┘
```

### Session 操作

| 操作 | 说明 |
|------|------|
| 新建对话 | 创建空 Session，标题默认取首条消息前 30 字 |
| 切换 Session | 从 DB 加载历史消息，无需重建 |
| 重命名 | 编辑 Session 标题 |
| 删除 | 删除 Session 及全部消息历史 |

### 工具调用气泡

对话过程中，工具调用以气泡形式展示：
- **调用中**：显示工具名 + 参数，loading 状态
- **完成**：显示结果摘要（如"返回 22 条记录"）
- **历史消息**：工具调用记录折叠显示在助手消息上方

---

## 可用工具（8 个）

| 工具 | 用途 | 数据来源 |
|------|------|---------|
| `get_metrics(time_window, asin?)` | 产品 KPI 快照 | ProductMetricDay 时序表 |
| `get_acos_history(asin, days?)` | ACoS + GMV 日趋势 | ProductMetricDay 时序表 |
| `get_inventory()` | 库存状况 | ContextFile(inventory) |
| `get_ad_campaigns(filter, asin?)` | 广告活动数据 | ContextFile(campaign_3m) |
| `get_search_terms(filter, asin?)` | 搜索词表现 | ContextFile(search_terms) |
| `get_alerts(level, category?)` | 已触发告警 | Alert 表 |
| `list_uploaded_files()` | 已上传报表列表 + 新鲜度 | ContextFile |
| `get_file_data(file_type, limit?)` | 原始文件数据 | ContextFile(any) |

### 文件类型 → 工具强制映射

```
product           → get_metrics + get_acos_history  （禁止用 get_file_data）
campaign_3m       → get_ad_campaigns
search_terms      → get_search_terms
inventory         → get_inventory
其他所有 fileType  → get_file_data(fileType)
```

---

## 典型对话场景

| 用户问题 | Claude 调用工具 | 回答依据 |
|---------|----------------|---------|
| "这个产品 ACoS 为什么高？" | `get_search_terms(high_acos)` + `get_ad_campaigns(high_acos)` | 高消耗词明细 + SOP P0/P1 规则 |
| "现在库存还撑多久？" | `get_inventory()` + `get_metrics(w7)` | 可售天数计算 + 手册补货阈值 |
| "床垫品类哪个 ASIN 最需要关注？" | `get_alerts(level=red)` + `get_metrics(d30)` | 各 ASIN 红色告警 + GMV 对比 |
| "这周广告优化应该先做什么？" | `get_alerts(level=all)` + `get_search_terms(zero_conv)` | 红黄告警优先级 + 零成交词 |

---

## 功能边界

```
支持：
  ✅ 多 Session 并行，各自独立的对话上下文
  ✅ Session 历史持久化，刷新页面后可继续
  ✅ 跨品类分析（Chat 不绑定品类）
  ✅ 流式文字 + 工具调用可视化
  ✅ 停止生成（AbortController）
  ✅ 重新生成回答
  ✅ 错误重试
  ✅ 滚动到底部按钮
  ✅ 模型切换（Sonnet / Haiku / Opus）
  ✅ Session 删除确认对话框（AlertDialog）

不支持（本阶段）：
  · 多用户共享 Session
  · 销量预测（无预测模型）
  · 直接执行广告后台操作

约束：
  · 单 Session 历史超长时自动截断早期记录（最近 20 轮）
  · 工具调用上限 10 次/轮
  · 只基于已上传数据分析，数据缺失时明确告知
```

---

## 技术实现

详见 [architecture/04-Agent架构.md](../architecture/04-Agent架构.md)。
