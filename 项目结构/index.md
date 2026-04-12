# YZ-Ops AI — 项目结构文档

> 本目录是 MVP 开发的技术参考，描述代码组织、数据库模型、数据流和 Chat 实现方式。  
> 功能需求见 `功能数据流/`；阈值参数见 `功能数据流/07-配置参数.md`。

---

## 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 框架 | Next.js 14 (App Router) | 全栈，API Routes + React 页面 |
| 语言 | TypeScript | 全栈统一 |
| 样式 | Tailwind CSS + shadcn/ui | 已安装 |
| 状态 | Zustand | 前端导航状态、Context 文件列表 |
| 数据库 | SQLite (via Prisma) | 零配置，文件即数据库 |
| XLSX 解析 | `xlsx` npm package | 已安装 |
| AI | `@anthropic-ai/sdk` | 已安装，Chat agentic loop |

---

## 文档目录

| 文档 | 内容 |
|------|------|
| [01-目录结构.md](./01-目录结构.md) | 代码目录树及各模块职责说明 |
| [02-数据库模型.md](./02-数据库模型.md) | 4 张表的 Prisma schema + 设计决策说明 |
| [03-数据流.md](./03-数据流.md) | 从上传文件到页面展示的完整数据流 |
| [04-Chat实现.md](./04-Chat实现.md) | Claude agentic loop、8 个工具定义与 SSE 流式输出 |

---

## 核心设计原则

```
1. context/ 文件夹 = 单一数据来源
   用户通过 Context 面板上传 XLSX → 落地到 context/ 目录 → 解析后存入 SQLite

2. 两种存储策略（不可混用）
   产品报表  → ProductMetricDay  按 (asin, date) 累积，永不覆盖
   其他报表  → ContextFile       按 fileType upsert，保留最新版本

3. 规则引擎是纯函数
   输入: 从 DB 取出的 Row[]  →  输出: ActionItem[] 或 Alert[]
   不依赖 DB 状态，可独立单元测试

4. Chat 不预加载数据
   Claude 根据用户问题自主决定调用哪些工具；工具在服务端执行，查 DB 后返回 JSON

5. 配置参数三层覆盖
   global → category → stage，通过 getParam(key, category?, stage?) 统一读取
```
