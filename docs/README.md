# YZ-Ops AI — 文档索引

---

## Principles

1. **Define once, link everywhere** — Each concept has one canonical definition. Other docs link to it, never redefine.
2. **Describe the present** — Docs reflect current code. History lives in git and `archive/`.
3. **Don't write what code can answer** — File paths, function signatures, field lists rot. Write concepts, flows, constraints, and *why*.
4. **Structure signals lifecycle** — `features/` = what to build, `architecture/` = how it works, `proposals/` = has a status and end state, `review/` = evaluation records, `archive/` = read-only history.
5. **Archive, don't delete** — Past decisions have long-term value. Move to `archive/`, never silently remove.
6. **Proposals declare status** — Every proposal has `> Status: in-progress | partial | done`. Done proposals are archive candidates.

---

## 系统层次结构

```
┌─ 左侧导航栏（全局持久）─────────────────────────────────────────┐
│  账号总览页                                                      │
│  ├── 账号级 KPI 汇总                                            │
│  └── 各品类健康状态列表                                          │
│                                                                  │
│  Chat（全局页）                                                  │
│  ├── 多 Session：用户可建立多个对话，历史持久化，随时切换          │
│  ├── 每个 Session 运行 Agent Loop（基于 Claude Agent SDK query()） │
│  ├── 工具通过进程内 MCP Server 暴露（8 个只读查询工具）            │
│  └── 可访问全部已上传报表，通过自然语言提问跨品类/跨ASIN分析      │
│                                                                  │
│  品类视图页（如：床垫 / 充气泵 / 电动滑板车）                        │
│  ├── KPI 汇总（品类内所有ASIN）                                  │
│  ├── 每日告警（品类内所有ASIN）                                  │
│  ├── 广告优化行动清单（品类内所有ASIN）                          │
│  └── 库存健康看板（品类内所有ASIN）                              │
└──────────────────────────────────────────────────────────────────┘
                                    ┌─ 右侧 Context 面板（全局持久）┐
                                    │  所有页面可见，可收起          │
                                    │  镜像 context/ 文件夹内容      │
                                    │  支持上传 / 删除文件           │
                                    └───────────────────────────────┘
```

---

## 文档目录

### features/ — 功能需求（做什么）

| 文档 | 说明 |
|------|------|
| [01-账号总览](features/01-账号总览.md) | 全账号 KPI 汇总 + 品类健康摘要 |
| [02-品类视图](features/02-品类视图.md) | 品类级 4 Tab：KPI / 告警 / 广告 / 库存 |
| [03-每日告警](features/03-每日告警.md) | ASIN 级红/黄/绿健康状态 + SOP 建议 |
| [04-广告优化](features/04-广告优化.md) | P0-P3 广告 SOP 行动清单 + 内部竞争检测 |
| [05-库存看板](features/05-库存看板.md) | 断货风险 / 长仓费 / 滞销 / 补货建议 |
| [06-Chat](features/06-Chat.md) | 多 Session AI 对话，跨品类数据分析 |
| [07-报表需求](features/07-报表需求.md) | 9 种报表字段要求、导出步骤、模拟文件说明 |

### architecture/ — 技术架构（怎么做）

| 文档 | 说明 |
|------|------|
| [01-目录结构](architecture/01-目录结构.md) | 代码目录树、各层职责边界、fileType 枚举 |
| [02-数据库模型](architecture/02-数据库模型.md) | 7 张表 Prisma schema + 设计决策 |
| [03-数据流](architecture/03-数据流.md) | 上传 → 解析 → 存储 → 规则引擎 → 展示 |
| [04-Agent架构](architecture/04-Agent架构.md) | Agent SDK query() + 进程内 MCP + SSE 规范 |
| [05-配置系统](architecture/05-配置系统.md) | 三层参数覆盖（global → category → stage） |

### plans/ — 规划文档

| 文档 | 说明 |
|------|------|
| [agent-sdk-migration](plans/agent-sdk-migration.md) | 迁移到 Claude Agent SDK 方案（方案A已完成，方案B待定） |

### proposals/ — 提案

| 文档 | 状态 | 说明 |
|------|------|------|
| [agent-sdk-migration](proposals/agent-sdk-migration.md) | done | 迁移到 Claude Agent SDK |
| [ui-refactor-design](proposals/ui-refactor-design.md) | done | UI 全面重构 — shadcn + AI Elements |

### review/ — 评审记录

（待添加）

### prototypes/ — 原型参考

| 文件 | 说明 |
|------|------|
| [yz-ops-app.jsx](prototypes/yz-ops-app.jsx) | 初版 UI 原型（JSX） |

---

## 数据源 × 功能依赖矩阵

```
数据源                    账号总览  KPI汇总  每日告警  广告优化  库存看板  Chat
─────────────────────────────────────────────────────────────────────────────
产品报表-子ASIN视图         ✅聚合    ✅核心    ✅核心    —        ✅时序    ✅
关键词监控                  —        —        ✅评分    —        —        ✅
库存报表                    ✅汇总    —        ✅天数    —        ✅核心    ✅
搜索词重构（ASIN视图,30天）  —        —        —         ✅核心   —        ✅
广告活动重构（ASIN视图,3月） —        —        —         ✅僵尸   —        ✅
US广告活动（活动视图,30天）  —        —        ✅预算     ✅广告位 —        ✅
广告位报表（US,30天）        —        —        —         ✅P1-B   —        ✅
成本管理                    —        —        —         —        ✅积压    ✅
ABA搜索词对比               —        —        —         —        —        ✅
```

---

## 核心设计原则

1. **context/ 文件夹 = 单一数据来源** — 用户上传 XLSX → 解析后存入 SQLite
2. **两种存储策略** — 产品报表按 (asin, date) 累积；其他报表按 fileType 覆盖最新
3. **规则引擎是纯函数** — 输入 Row[]，输出 ActionItem[] / Alert[]
4. **Chat 不预加载数据** — Claude 根据问题自主选择工具查询
5. **配置参数三层覆盖** — global → category → stage
6. **存原始计数，不存比率** — ACOS/CTR/CVR 由系统动态计算

---

## 技术栈

| 层 | 技术 |
|----|------|
| 框架 | Next.js 14 (App Router) |
| 语言 | TypeScript |
| 样式 | Tailwind CSS + shadcn/ui |
| UI 组件 | shadcn/ui（Card, Table, Badge, Select, AlertDialog 等）+ AI Elements（Message, PromptInput, Suggestions） |
| 数据库 | SQLite (Prisma) |
| AI | `@anthropic-ai/claude-agent-sdk`（query() + 进程内 MCP Server） |
| XLSX | `xlsx` npm package |
