```markdown
# Chat 功能说明

## 概述

Chat 面板是一个基于 **Claude Agentic Loop** 的运营分析助手。与普通聊天不同，它不依赖预注入的静态数据，而是由 Claude 根据问题自主决定调用哪些工具、查询哪些数据，再基于真实数据给出分析建议。

---

## 数据流

```
用户发送消息
    │
    ▼
ChatPanel 构建 AgentState        ← 从 Zustand 快照读取
    │  ├── metrics          (来自 metricsByProduct)
    │  ├── inventory        (来自 inventoryByProduct)
    │  ├── adData           (来自 adDataByProduct)
    │  ├── alerts           (来自 alerts)
    │  ├── files            (来自 filesByProduct)
    │  └── parsedFileData   (来自 parsedFileDataByProduct，覆盖所有文件类型)
    │
    ▼
POST /api/agent
    │  { messages, systemPrompt, model }
    │
    ▼
Claude 决策
    ├── 需要数据？
    │       │
    │       ▼
    │   返回 JSON { type:"tool_use", content:[...] }
    │       │
    │       ▼
    │   ChatPanel 本地执行工具（读 AgentState，无网络请求）
    │       │
    │       ▼
    │   追加 tool_result → 再次 POST /api/agent
    │       │
    │       └── （最多循环 10 步）
    │
    └── 分析完成？
            │
            ▼
        返回 SSE 流 { text:"..." }
            │
            ▼
        流式渲染至对话气泡
```

---

## 工具列表

| 工具 | 用途 | 对应文件类型 | 支持过滤参数 |
|------|------|------------|------------|
| `get_metrics(time_window)` | 查询 KPI 快照 | nordhive_asin_report | today / yesterday / w7 / w14 / d30 |
| `get_acos_history(days?)` | 查询 ACoS 日趋势 | nordhive_asin_report（daily）| 最近 N 天 |
| `get_inventory()` | 查询库存状况 | nordhive_inventory | — |
| `get_ad_campaigns(filter?)` | 查询广告活动 | nordhive_ad_campaign | all / high_acos / over_budget / top_spend |
| `get_search_terms(filter?)` | 查询关键词转化 | nordhive_search_term | all / zero_conv / winner / high_acos / high_spend |
| `get_alerts(priority?)` | 查询已触发告警 | 告警引擎自动生成 | all / P0 / P1 / P2 / P3 |
| `list_uploaded_files()` | 列出已上传文件 | — | — |
| `get_file_data(file_type, limit?)` | 读取任意文件原始数据 | 所有其他类型 | 行数限制 |

**文件类型 → 工具映射（Claude 强制遵守）：**

- `nordhive_asin_report` → `get_metrics` + `get_acos_history`（禁止用 `get_file_data`）
- `nordhive_ad_campaign` → `get_ad_campaigns`
- `nordhive_search_term` → `get_search_terms`
- `nordhive_inventory` → `get_inventory`
- SKU报表 / 广告位 / 成本管理 / ABA竞品 / 单品归档 / 其他 → `get_file_data(fileType)`

---

## 工具执行位置

所有工具在**浏览器本地**执行（`agentTools.ts`），直接读取 Zustand 内存状态，无需额外 API 调用，无需数据库。

---

## 数据来源

| Zustand 字段 | 来源 | 写入时机 |
|------------|------|---------|
| `metricsByProduct` | parseAsinReport → mergeAsinUpload | 上传 ASIN 报表后 |
| `inventoryByProduct` | parseInventory → inventoryRowsToRecords | 上传库存报表后 |
| `adDataByProduct` | parseAdCampaign / parseSearchTerm | 上传广告活动或搜索词报表后 |
| `alerts` | alertEngine.runAlertRules() | 上传广告活动或搜索词报表后自动触发 |
| `parsedFileDataByProduct` | 所有文件类型的 parsed[] | **每次上传后统一写入**，覆盖全部文件类型 |

> **注意**：所有数据存于内存，刷新页面后丢失，需重新上传文件。

---

## API 端点

### `POST /api/agent`

单步执行，由 ChatPanel 循环调用。

**请求：**
```json
{
  "messages": [...],    // Anthropic MessageParam[]，含历史对话 + tool_result
  "systemPrompt": "...",
  "model": "claude-sonnet-4-6"
}
```

**响应（tool_use 步）：**
```
Content-Type: application/json
{ "type": "tool_use", "content": [...tool_use blocks] }
```

**响应（end_turn 步）：**
```
Content-Type: text/event-stream
data: {"text": "..."}\n\n
data: [DONE]\n\n
```

---

## System Prompt 构建

`buildAgentSystemPrompt(product, files)` 注入：

1. 当前产品上下文（ASIN、阶段、价格、BSR）
2. 已上传文件列表（让 Claude 知道哪些数据存在）
3. 工具使用说明 + 文件类型 → 工具映射表
4. KPI 健康基准（按产品阶段：新品期 / 成长期 / 成熟期）
5. 14 条广告优化 SOP 规则（P0–P3）

**不注入实际数据**——数据由 Claude 按需通过工具调用获取。

---

## 限制

- 对话历史仅保留文本消息，不保留工具调用中间步骤；下一轮对话 Claude 会重新查询数据
- 单次对话最多执行 10 步工具调用循环（防止死循环）
- 数据不持久化，刷新页面后需重新上传文件
```