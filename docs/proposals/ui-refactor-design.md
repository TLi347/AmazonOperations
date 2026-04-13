# Proposal: UI 全面重构 — shadcn 组件化

> Status: done

## 目标

将所有 UI 从 inline styles + 手写 HTML 迁移到 Tailwind tokens + shadcn 组件 + AI Elements，建立一致的设计系统。

## 设计决策

| 决策 | 选择 | 原因 |
|------|------|------|
| 配色方案 | shadcn 默认 theme（neutral base） | 零定制成本，与 shadcn tokens 对齐 |
| 暗色模式 | 不做 | 当前不需要 |
| 侧边栏结构 | 保持双栏（ProductRail 180px + FunctionPanel 150px） | 功能清晰，不变 |
| 组件库 | shadcn/ui 全面替换 | Button/Badge/Card/Table/Select/ScrollArea/AlertDialog/Input/Textarea/Separator/Tooltip |
| Chat 消息 | AI Elements | Message/MessageContent/MessageResponse，适配现有 SSE 数据 |
| Markdown | 保持手写渲染器 | 覆盖 Agent 回复常见格式，够用 |
| 样式方式 | 消除所有 inline styles，统一 Tailwind classes | 可维护性 |

## 当前问题（审计结果）

1. **70% inline styles** — 颜色、间距、字体全部硬编码在 JSX 里
2. **shadcn 组件已安装但零使用** — Button/Badge/ScrollArea 定义了但没用
3. **两套颜色系统** — CSS 变量（globals.css）和 hardcoded hex 混用
4. **无统一排版** — font-size 从 9px 到 32px 散布各处
5. **手写 HTML 替代品** — table/button/badge/select/dialog 全部手写

## 改造范围

### 基础设施

- 重新 `shadcn init -d` 配置，使用默认 neutral theme
- 安装 AI Elements 组件
- 统一 globals.css 到 shadcn CSS 变量
- 清理 tailwind.config.ts 中的自定义颜色（用 shadcn tokens 替代）

### 组件替换清单

| 文件 | 改动 |
|------|------|
| **ProductRail.tsx** | inline styles → Tailwind classes，用 Button 替换手写 nav items |
| **FunctionPanel.tsx** | inline styles → Tailwind classes，用 Button 替换手写 tab items |
| **ContextPanel.tsx** | Card 替换手写文件卡片，Badge 替换状态标签，ScrollArea 替换手写滚动 |
| **MainPanel.tsx** | 已精简，保持 |
| **OverviewPanel.tsx** | Card 替换手写卡片，Badge 替换告警标签，Table 替换手写表格 |
| **ChatPanel.tsx** | AI Elements 替换手写消息气泡，ScrollArea/Input/Button/Select/AlertDialog |
| **KPIPanel.tsx** | Card + Table 替换手写，Badge 替换状态标签 |
| **AlertsPanel.tsx** | Card + Badge 替换手写告警卡片，移除 💡 emoji |
| **AdsPanel.tsx** | Table 替换手写表格，Badge 替换状态标签 |
| **InventoryPanel.tsx** | Table + Badge 替换手写，Card 替换容器 |

### shadcn 组件安装清单

```bash
npx shadcn@latest add button badge card table select scroll-area alert-dialog input textarea separator tooltip
```

### AI Elements 安装

```bash
npx ai-elements@latest
# 安装 Message, MessageContent, MessageResponse 等
```

## 样式规范

### 颜色

全部使用 shadcn CSS 变量，不再硬编码 hex：

| 用途 | token |
|------|-------|
| 页面背景 | `bg-background` |
| 卡片背景 | `bg-card` |
| 主文字 | `text-foreground` |
| 次要文字 | `text-muted-foreground` |
| 边框 | `border-border` |
| 主强调 | `text-primary` / `bg-primary` |
| 危险 | `text-destructive` |

### 间距

统一使用 Tailwind spacing scale（基于 4px）：

| 用途 | class |
|------|-------|
| 组件内 padding | `p-4` (16px) 或 `p-3` (12px) |
| 元素间 gap | `gap-2` (8px) 到 `gap-4` (16px) |
| 区块间距 | `space-y-4` 或 `space-y-6` |

### 字体

| 用途 | class |
|------|-------|
| 页面标题 | `text-lg font-semibold` |
| 区块标题 | `text-sm font-medium` |
| 正文 | `text-sm` |
| 标签/辅助 | `text-xs text-muted-foreground` |
| 数据/代码 | `text-sm font-mono` |

### 圆角

统一使用 shadcn 默认 `--radius: 0.625rem`，通过 `rounded-md` / `rounded-lg` 引用。

## 不改的部分

- 组件功能逻辑（数据加载、SSE 流、工具调用）
- 路由结构
- Store（appStore.ts）
- API 接口
