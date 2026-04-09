import type { Product, DataFile, ProductMetrics, InventoryRecord } from "@/store/appStore";

const FILE_TYPE_LABELS: Record<string, string> = {
  nordhive_asin_report: "产品报表(ASIN视图)",
  nordhive_sku_report: "产品报表(SKU视图)",
  nordhive_ad_campaign: "广告活动报表",
  nordhive_ad_placement: "广告位报表",
  nordhive_ad_restructure: "广告活动重构",
  nordhive_search_term: "搜索词重构",
  nordhive_cost_mgmt: "成本管理",
  single_product_archive: "单品归档",
  aba_search_compare: "ABA搜索词竞品对比",
  competitor_snapshot: "竞品监控截图",
};

const TIME_WINDOW_LABELS: Record<string, string> = {
  daily: "今日/单日",
  weekly: "近7日",
  biweekly: "近14日",
  monthly: "近30日",
  custom: "自定义区间",
};

function fmt(n: number | undefined, decimals = 1, prefix = "", suffix = ""): string {
  if (n == null || isNaN(n)) return "—";
  return `${prefix}${n.toFixed(decimals)}${suffix}`;
}

function metricsRow(label: string, m: ProductMetrics[keyof Omit<ProductMetrics, "acosHistory">] | undefined): string {
  if (!m) return `| ${label} | — | — | — | — | — | — | — |`;
  return `| ${label} | ${fmt(m.gmv, 0, "$")} | ${m.orders ?? "—"} | ${fmt(m.acos, 1, "", "%")} | ${fmt(m.roas, 2)} | ${fmt(m.ctr, 2, "", "%")} | ${fmt(m.cpc, 2, "$")} | ${fmt(m.cvr, 1, "", "%")} |`;
}

function buildDataSection(metrics?: ProductMetrics, inventory?: InventoryRecord[]): string {
  const hasMetrics = metrics && (metrics.today || metrics.w7 || metrics.d30);
  const hasInventory = inventory && inventory.length > 0;
  if (!hasMetrics && !hasInventory) return "";

  const lines: string[] = ["\n## 实时数据快照（来源：已上传报表文件）\n"];

  if (hasMetrics) {
    lines.push("### 核心指标");
    lines.push("| 时间段 | GMV | 订单 | ACoS | ROAS | CTR | CPC | CVR |");
    lines.push("|--------|-----|------|------|------|-----|-----|-----|");
    lines.push(metricsRow("今日", metrics.today));
    lines.push(metricsRow("昨日", metrics.yesterday));
    lines.push(metricsRow("近7日", metrics.w7));
    lines.push(metricsRow("近14日", metrics.w14));
    lines.push(metricsRow("近30日", metrics.d30));
    lines.push("");

    if (metrics.acosHistory && metrics.acosHistory.length > 0) {
      const recent = metrics.acosHistory.slice(-14);
      lines.push("### ACoS 趋势（最近数据点）");
      lines.push(
        recent.map((h) => `${h.date}: ACoS ${fmt(h.acos, 1, "", "%")}${h.gmv != null ? ` / GMV ${fmt(h.gmv, 0, "$")}` : ""}`).join("，")
      );
      lines.push("");
    }
  }

  if (hasInventory) {
    lines.push("### 库存状况");
    lines.push("| SKU | 市场 | 可售库存 | 可售天数 | 日均销量 | 建议补货量 |");
    lines.push("|-----|------|---------|---------|---------|----------|");
    for (const inv of inventory) {
      lines.push(
        `| ${inv.sku} | ${inv.marketplace} | ${inv.availableQty} | ${fmt(inv.daysOfSupply, 0, "", "天")} | ${fmt(inv.dailySales, 1, "", "件/天")} | ${inv.restockQty}件 |`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function buildSystemPrompt(
  product: Product,
  files: DataFile[],
  metrics?: ProductMetrics,
  inventory?: InventoryRecord[]
): string {
  const filesSummary =
    files.length > 0
      ? files
          .map(
            (f) =>
              `  - ${FILE_TYPE_LABELS[f.fileType] ?? f.fileType}（${TIME_WINDOW_LABELS[f.timeWindow] ?? f.timeWindow}）：${f.fileName}`
          )
          .join("\n")
      : "  暂无已加载文件，以下分析仅基于产品基础信息";

  return `你是 YZ-Ops AI，一个亚马逊电商运营辅助决策助手，专注于帮助运营团队做日常广告调优与运营决策。

## 当前产品上下文
- 产品名称: ${product.name}
- ASIN: ${product.asin}
- 品牌: ${product.brand}
- 运营站点: ${product.marketplace.join("、")}
- 产品阶段: ${product.stage}
- 评分/评价: ${product.rating}星 · ${product.reviewCount.toLocaleString()}条评价
- BSR排名: #${product.bsr.toLocaleString()}
- 当前售价: $${product.price}

## 当前已加载数据文件（共${files.length}个）
${filesSummary}
${buildDataSection(metrics, inventory)}

## KPI健康基准（来源：运营指导手册）
| 指标 | 新品期基准 | 成长期基准 | 成熟期基准 |
|------|-----------|-----------|-----------|
| ACoS | ≤70% | ≤55% | ≤45% |
| ROAS | ≥1.5 | ≥2.0 | ≥2.5 |
| CTR（精确词）| ≥0.2% | ≥0.25% | ≥0.3% |
| CTR（广泛词）| ≥0.15% | ≥0.18% | ≥0.2% |
| CVR | ≥3% | ≥4% | ≥5% |

当前产品阶段为「${product.stage}」，请以此阶段基准判断指标健康度。

## 广告优化SOP规则（14条，按优先级）

### P0 — 立即处理（当日）
1. **关键词零成交止血**：精确/词组匹配 点击≥15次 且 成交=0 → 立即暂停该词 + 在广泛父组添加词组否定
2. **广泛匹配无效词爆量**：搜索词花费>$20 且 无成交 → 在活动层精确否定该词
3. **超预算+高ACoS**：单日花费>预算110% 且 当日ACoS>80% → 暂停广泛组 + 降低出价10-15%

### P1 — 24小时内处理
4. **高ACoS词降价**：ACoS 80-114%，点击≥30次 → 出价降低30-40%
5. **CTR过低检查**：精确词曝光≥500 且 CTR<0.2% → 检查主图是否吸引人、价格是否高于竞品>15%
6. **新品曝光不足**：精确词曝光<500（活动运行>7天）→ 热门词出价提升20-30%，不低于类目CPC中位值+15%

### P2 — 本周内处理
7. **最优词加价扩量**：ACoS≤35% 且 CVR≥4% 且 点击≥30 → 出价+15-20%，同步增加日预算20%
8. **广泛精确词重叠**：同一词出现在广泛+精确匹配，且出价接近 → 精确匹配优先，在广泛组否定
9. **词组匹配低曝光**：词组曝光<100次/天（持续>3天）→ 出价提升25-35%
10. **竞品ASIN定投承压**：ASIN定投ACoS>70% 且 持续>14天 → 筛选留高CVR的ASIN，其余降出价15%

### P3 — 下次周期优化
11. **广泛词沉淀精确**：广泛跑出搜索词 点击≥20 且 CVR≥3% → 添加到精确组，出价=广泛出价×1.2
12. **广告结构优化**：单活动关键词>50个 且 ACoS差异>30% → 按效率分高/中/低层，分组管理
13. **季节性预算调整**：当月为旺季（同比销量+20%）→ 出价+15-20%，预算+30-50%
14. **品牌词防御**：竞品品牌词点击份额>5% → 添加品牌词精确匹配（低出价$0.5-1）

## 分析原则
1. **今日/昨日数据**：重点做异常检测，对比环比变化，发现反常波动
2. **7日/14日/30日数据**：重点做趋势分析，识别持续性趋势
3. **活动期间数据**：分析时自动分离 Lightning Deal / Prime折扣等活动期与正常期数据
4. **建议按优先级输出**：P0(立即) > P1(24h) > P2(本周) > P3(下次)
5. **引用具体数据依据**：每条建议必须标注来源文件和具体数字
6. **格式要求**：使用Markdown格式，表格展示对比数据，重要数字加粗

## 回答语言
用中文回答，数字和专业术语保持原样（如 ACoS、ROAS、CTR、CPC、CVR、ASIN、BSR 等）。`;
}
