/**
 * lib/rules/sop/index.ts
 *
 * 广告优化 SOP 行动清单引擎。
 *
 * runAndPersistSopActions(fileType):
 *   - 仅当 fileType 是 SOP 依赖文件之一时触发
 *   - 从 ContextFile 读取搜索词/广告活动数据 → 对每条数据运行 P0-P3 规则 → 写入 SopAction 表
 *
 * 依赖文件：search_terms / campaign_3m / us_campaign_30d
 *
 * 规则分级：
 *   P0 止血（立即）：P0-A 高点击0转化 / P0-B 高花费0转化 / P0-C 超预算且严重亏损
 *   P1 优化（今日）：P1-A 高ACoS降出价 / P1-B 低CTR / P1-C 精确词曝光不足
 *   P2 调整（本周）：P2-A 高效词扩量 / P2-B 自内竞价 / P2-C ASIN定投高ACoS /
 *                   P2-D 词组曝光不足 / P2-E 广告活动持续高ACoS
 *                   zombie 僵尸广告组 / cross_asin 品类内部竞争
 *   P3 结构（本月）：P3-A 广泛词验证沉淀精确 / P3-B 广告组词过多
 */

import { db } from "@/lib/db"
import type { FileType } from "@/lib/parsers/identifier"
import type {
  SopCandidate,
  SearchTermRow,
  AdRestructureRow,
  AdCampaignRow,
} from "./types"

const SOP_DEPS: FileType[] = ["search_terms", "campaign_3m", "us_campaign_30d"]

/** POST /api/upload 末尾调用此函数 */
export async function runAndPersistSopActions(fileType: FileType): Promise<void> {
  if (!SOP_DEPS.includes(fileType)) return

  // 并行加载所有数据源
  const [searchTermsFile, campaign3mFile, usCampaignFile, categories, asinConfigs] = await Promise.all([
    db.contextFile.findUnique({ where: { fileType: "search_terms" } }),
    db.contextFile.findUnique({ where: { fileType: "campaign_3m" } }),
    db.contextFile.findUnique({ where: { fileType: "us_campaign_30d" } }),
    db.categoryMap.findMany(),
    db.asinConfig.findMany(),
  ])

  if (!searchTermsFile && !campaign3mFile) return

  // 构建 ASIN → categoryKey 映射
  const asinToCategory = new Map<string, string>()
  const knownAsins = new Set<string>()
  for (const config of asinConfigs) {
    asinToCategory.set(config.asin, config.categoryKey)
    knownAsins.add(config.asin)
  }

  // 构建 categoryKey → ASIN[] 映射（用于品类内竞争检测）
  const categoryToAsins = new Map<string, string[]>()
  for (const cat of categories) {
    categoryToAsins.set(cat.categoryKey, JSON.parse(cat.asins) as string[])
  }

  // 反序列化报表数据
  const searchTermRows = searchTermsFile
    ? (JSON.parse(searchTermsFile.parsedRows) as SearchTermRow[]).filter(r => knownAsins.has(r.asin))
    : []

  const campaign3mRows = campaign3mFile
    ? (JSON.parse(campaign3mFile.parsedRows) as AdRestructureRow[]).filter(r => knownAsins.has(r.asin))
    : []

  const usCampaignRows = usCampaignFile
    ? (JSON.parse(usCampaignFile.parsedRows) as AdCampaignRow[])
    : []

  // 快照日期：优先用 search_terms，其次 campaign_3m
  const snapshotDate =
    searchTermsFile?.snapshotDate ??
    campaign3mFile?.snapshotDate ??
    new Date().toISOString().slice(0, 10)

  // 构建 campaignName → { dailyBudget, startDate } 映射（来自 us_campaign_30d）
  const campaignInfoMap = new Map<string, { dailyBudget: number; startDate: Date | null }>()
  for (const row of usCampaignRows) {
    campaignInfoMap.set(row.campaignName, {
      dailyBudget: row.budget ?? 0,
      startDate: row.startDate ? new Date(row.startDate) : null,
    })
  }

  // 执行所有规则
  const actions: SopCandidate[] = [
    ...runP0(searchTermRows, campaign3mRows, campaignInfoMap, asinToCategory, snapshotDate),
    ...runP1(searchTermRows, asinToCategory, snapshotDate),
    ...runP2(searchTermRows, campaign3mRows, campaignInfoMap, asinToCategory, categoryToAsins, snapshotDate),
    ...runP3(searchTermRows, asinToCategory, snapshotDate),
    ...runZombieGroups(campaign3mRows, asinToCategory, snapshotDate),
    ...runCrossAsinCompetition(searchTermRows, asinToCategory, categoryToAsins, snapshotDate),
  ]

  // 写入 SopAction 表（先删当日旧记录，再批量插入）
  await db.sopAction.deleteMany({ where: { snapshotDate } })

  if (actions.length > 0) {
    await db.sopAction.createMany({
      data: actions.map(a => ({
        asin:         a.asin,
        categoryKey:  a.categoryKey,
        priority:     a.priority,
        rule:         a.rule,
        searchTerm:   a.searchTerm ?? null,
        matchType:    a.matchType ?? null,
        campaignName: a.campaignName ?? null,
        suggestion:   a.suggestion,
        detail:       JSON.stringify(a.detail),
        snapshotDate: a.snapshotDate,
      })),
    })
  }
}

// ---------------------------------------------------------------------------
// P0 — 立即止血
// ---------------------------------------------------------------------------

function runP0(
  stRows:          SearchTermRow[],
  camp3mRows:      AdRestructureRow[],
  campaignInfoMap: Map<string, { dailyBudget: number; startDate: Date | null }>,
  asinToCategory:  Map<string, string>,
  snapshotDate:    string,
): SopCandidate[] {
  const actions: SopCandidate[] = []

  // P0-A 优先匹配：记录已覆盖的 (asin, searchTerm, matchType) 防止 P0-B 重复触发
  const p0AKeys = new Set<string>()

  // P0-A: clicks ≥ 15 且 orders = 0（高点击0转化，持续消耗预算无回报）
  for (const row of stRows) {
    if (row.clicks >= 15 && row.orders === 0) {
      const key = `${row.asin}|${row.searchTerm}|${row.matchType}`
      p0AKeys.add(key)
      actions.push({
        asin:        row.asin,
        categoryKey: asinToCategory.get(row.asin) ?? "",
        priority:    "P0",
        rule:        "P0-A",
        searchTerm:  row.searchTerm,
        matchType:   row.matchType,
        campaignName: row.campaignName,
        suggestion:  "暂停该关键词；在父广泛组添加精确否定",
        detail:      { clicks: row.clicks, orders: row.orders, spend: row.spend, impressions: row.impressions },
        snapshotDate,
      })
    }
  }

  // P0-B: spend > $20 且 orders = 0（无效词花费超阈值）
  for (const row of stRows) {
    const key = `${row.asin}|${row.searchTerm}|${row.matchType}`
    if (row.spend > 20 && row.orders === 0 && !p0AKeys.has(key)) {
      actions.push({
        asin:        row.asin,
        categoryKey: asinToCategory.get(row.asin) ?? "",
        priority:    "P0",
        rule:        "P0-B",
        searchTerm:  row.searchTerm,
        matchType:   row.matchType,
        campaignName: row.campaignName,
        suggestion:  "精确否定该搜索词",
        detail:      { spend: row.spend, orders: row.orders, clicks: row.clicks },
        snapshotDate,
      })
    }
  }

  // P0-C: 广告活动 ACoS > 80% 且 日均花费 > 每日预算（超预算且严重亏损）
  // 按 (asin, campaignName) 聚合 campaign_3m 数据（~90天），JOIN us_campaign_30d 取每日预算
  const campAgg = aggregateCampaigns(camp3mRows)
  for (const [key, data] of campAgg) {
    const [asin, campaignName] = splitKey(key)
    const info = campaignInfoMap.get(campaignName)
    if (!info || info.dailyBudget <= 0) continue

    const acos = data.totalSales > 0 ? (data.totalSpend / data.totalSales) * 100 : 0
    if (acos <= 80) continue

    // 日均花费：campaign_3m 约覆盖 90 天
    const dailySpend = data.totalSpend / 90
    if (dailySpend <= info.dailyBudget) continue

    actions.push({
      asin,
      categoryKey: asinToCategory.get(asin) ?? "",
      priority:    "P0",
      rule:        "P0-C",
      campaignName,
      suggestion:  "暂停该广泛组，降低主词出价10–15%",
      detail: {
        acos:        +acos.toFixed(1),
        dailySpend:  +dailySpend.toFixed(2),
        dailyBudget: info.dailyBudget,
        totalSpend:  +data.totalSpend.toFixed(2),
      },
      snapshotDate,
    })
  }

  return actions
}

// ---------------------------------------------------------------------------
// P1 — 今日内优化
// ---------------------------------------------------------------------------

function runP1(
  stRows:         SearchTermRow[],
  asinToCategory: Map<string, string>,
  snapshotDate:   string,
): SopCandidate[] {
  const actions: SopCandidate[] = []

  for (const row of stRows) {
    const categoryKey = asinToCategory.get(row.asin) ?? ""

    // P1-A: ACoS 80–114% 且 clicks ≥ 30（有一定成交但严重超标，降价改善效率）
    if (row.acos >= 80 && row.acos <= 114 && row.clicks >= 30) {
      actions.push({
        asin: row.asin, categoryKey,
        priority: "P1", rule: "P1-A",
        searchTerm: row.searchTerm, matchType: row.matchType, campaignName: row.campaignName,
        suggestion: "出价降低30–40%",
        detail: { acos: row.acos, clicks: row.clicks, orders: row.orders, spend: row.spend },
        snapshotDate,
      })
    }

    // P1-B: impressions ≥ 500 且 CTR < 0.2%（展示量充足但点击率过低）
    if (row.impressions >= 500 && row.ctr < 0.2) {
      actions.push({
        asin: row.asin, categoryKey,
        priority: "P1", rule: "P1-B",
        searchTerm: row.searchTerm, matchType: row.matchType, campaignName: row.campaignName,
        suggestion: "排查主图竞争力、价格是否高于竞品>15%",
        detail: { impressions: row.impressions, ctr: row.ctr, clicks: row.clicks },
        snapshotDate,
      })
    }

    // P1-C: 精确词 impressions < 500（曝光量不足，出价可能低于竞争门槛）
    if (row.matchType.includes("精确") && row.impressions < 500) {
      actions.push({
        asin: row.asin, categoryKey,
        priority: "P1", rule: "P1-C",
        searchTerm: row.searchTerm, matchType: row.matchType, campaignName: row.campaignName,
        suggestion: "出价提升20–30%",
        detail: { impressions: row.impressions, matchType: row.matchType },
        snapshotDate,
      })
    }
  }

  return actions
}

// ---------------------------------------------------------------------------
// P2 — 本周内优化
// ---------------------------------------------------------------------------

function runP2(
  stRows:          SearchTermRow[],
  camp3mRows:      AdRestructureRow[],
  campaignInfoMap: Map<string, { dailyBudget: number; startDate: Date | null }>,
  asinToCategory:  Map<string, string>,
  categoryToAsins: Map<string, string[]>,
  snapshotDate:    string,
): SopCandidate[] {
  const actions: SopCandidate[] = []
  const today = new Date()

  // P2-A: ACoS ≤ 35% 且 CVR ≥ 4% 且 clicks ≥ 30（高效词，扩大流量获取）
  for (const row of stRows) {
    if (row.acos > 0 && row.acos <= 35 && row.cvr >= 4 && row.clicks >= 30) {
      actions.push({
        asin: row.asin,
        categoryKey: asinToCategory.get(row.asin) ?? "",
        priority: "P2", rule: "P2-A",
        searchTerm: row.searchTerm, matchType: row.matchType, campaignName: row.campaignName,
        suggestion: "出价提升15–20%",
        detail: { acos: row.acos, cvr: row.cvr, clicks: row.clicks, orders: row.orders },
        snapshotDate,
      })
    }
  }

  // P2-B: 同一 ASIN 内，同一搜索词同时出现在广泛和精确（自内竞价）
  const termMatchMap = new Map<string, Set<string>>()  // "asin|searchTerm" → Set<matchType>
  const termRepRow   = new Map<string, SearchTermRow>() // "asin|searchTerm" → 代表行
  for (const row of stRows) {
    const key = `${row.asin}|${row.searchTerm}`
    const types = termMatchMap.get(key) ?? new Set()
    types.add(row.matchType)
    termMatchMap.set(key, types)
    // 优先保留广泛行作为代表
    if (row.matchType.includes("广泛") || !termRepRow.has(key)) termRepRow.set(key, row)
  }
  for (const [key, types] of termMatchMap) {
    const hasBroad = [...types].some(t => t.includes("广泛"))
    const hasExact = [...types].some(t => t.includes("精确"))
    if (!hasBroad || !hasExact) continue
    const [asin, searchTerm] = splitKey(key)
    const rep = termRepRow.get(key)
    actions.push({
      asin,
      categoryKey: asinToCategory.get(asin) ?? "",
      priority: "P2", rule: "P2-B",
      searchTerm,
      suggestion: "精确匹配组出价设为高于广泛组5–10%；广泛匹配组对该词添加精确否定",
      detail: { matchTypes: [...types], clicks: rep?.clicks, spend: rep?.spend },
      snapshotDate,
    })
  }

  // P2-C/E：基于 campaign_3m 聚合，ACoS > 70%（+ 运行天数判断若有 startDate）
  const campAgg = aggregateCampaigns(camp3mRows)
  for (const [key, data] of campAgg) {
    const [asin, campaignName] = splitKey(key)
    const categoryKey = asinToCategory.get(asin) ?? ""
    const acos = data.totalSales > 0 ? (data.totalSpend / data.totalSales) * 100 : 0
    if (acos <= 70) continue

    const info = campaignInfoMap.get(campaignName)
    const startDate = info?.startDate ?? null
    const runningDays = startDate
      ? Math.floor((today.getTime() - startDate.getTime()) / 86400000)
      : null
    // 若能获取 runningDays，要求 > 14；若无 startDate 信息则直接触发
    if (runningDays !== null && runningDays <= 14) continue

    const isAsinTargeting = /ASIN|PAT|定投/i.test(campaignName)
    if (isAsinTargeting) {
      // P2-C: ASIN 定投组
      actions.push({
        asin, categoryKey,
        priority: "P2", rule: "P2-C",
        campaignName,
        suggestion: "筛选转化率高的竞品ASIN保留；删除clicks>10且0成交的竞品ASIN；整组出价降15%",
        detail: {
          acos:        +acos.toFixed(1),
          runningDays: runningDays ?? "未知",
          totalSpend:  +data.totalSpend.toFixed(2),
          totalOrders: data.totalOrders,
        },
        snapshotDate,
      })
    } else {
      // P2-E: 普通广告活动持续高 ACoS
      actions.push({
        asin, categoryKey,
        priority: "P2", rule: "P2-E",
        campaignName,
        suggestion: "筛查广告组关键词，低效词降出价15%",
        detail: {
          acos:        +acos.toFixed(1),
          runningDays: runningDays ?? "未知",
          totalSpend:  +data.totalSpend.toFixed(2),
        },
        snapshotDate,
      })
    }
  }

  // P2-D: 词组匹配 30天总曝光 < 3000（出价低于入场门槛）
  for (const row of stRows) {
    if (row.matchType.includes("词组") && row.impressions < 3000) {
      actions.push({
        asin: row.asin,
        categoryKey: asinToCategory.get(row.asin) ?? "",
        priority: "P2", rule: "P2-D",
        searchTerm: row.searchTerm, matchType: row.matchType, campaignName: row.campaignName,
        suggestion: "出价提升25–35%",
        detail: { impressions: row.impressions, clicks: row.clicks },
        snapshotDate,
      })
    }
  }

  return actions
}

// ---------------------------------------------------------------------------
// P3 — 本月内结构优化
// ---------------------------------------------------------------------------

function runP3(
  stRows:         SearchTermRow[],
  asinToCategory: Map<string, string>,
  snapshotDate:   string,
): SopCandidate[] {
  const actions: SopCandidate[] = []

  // P3-A: 广泛/词组词 clicks ≥ 20 且 CVR ≥ 3%（验证词沉淀为精确组）
  for (const row of stRows) {
    const isBroadOrPhrase = row.matchType.includes("广泛") || row.matchType.includes("词组")
    if (isBroadOrPhrase && row.clicks >= 20 && row.cvr >= 3) {
      const suggestedBid = row.cpc > 0 ? +(row.cpc * 1.2).toFixed(2) : null
      actions.push({
        asin: row.asin,
        categoryKey: asinToCategory.get(row.asin) ?? "",
        priority: "P3", rule: "P3-A",
        searchTerm: row.searchTerm, matchType: row.matchType, campaignName: row.campaignName,
        suggestion: `将该搜索词添加到精确匹配广告组${suggestedBid ? `，初始出价 $${suggestedBid}（当前CPC×1.2）` : "，初始出价 = 当前CPC×1.2"}`,
        detail: { clicks: row.clicks, cvr: row.cvr, orders: row.orders, cpc: row.cpc, matchType: row.matchType },
        snapshotDate,
      })
    }
  }

  // P3-B: 单广告活动去重搜索词数量 > 50（预算分散）
  const campaignTerms = new Map<string, { asin: string; campaignName: string; terms: Set<string> }>()
  for (const row of stRows) {
    const key = `${row.asin}|${row.campaignName}`
    const existing = campaignTerms.get(key)
    if (existing) {
      existing.terms.add(row.searchTerm)
    } else {
      campaignTerms.set(key, { asin: row.asin, campaignName: row.campaignName, terms: new Set([row.searchTerm]) })
    }
  }
  for (const [, data] of campaignTerms) {
    if (data.terms.size > 50) {
      actions.push({
        asin: data.asin,
        categoryKey: asinToCategory.get(data.asin) ?? "",
        priority: "P3", rule: "P3-B",
        campaignName: data.campaignName,
        suggestion: `广告活动搜索词过多（${data.terms.size}个去重词），高效词（CVR≥3%）保留，低效词（clicks≥15且0成交）移至否定列表`,
        detail: { uniqueTermCount: data.terms.size },
        snapshotDate,
      })
    }
  }

  return actions
}

// ---------------------------------------------------------------------------
// 僵尸广告组
// ---------------------------------------------------------------------------

function runZombieGroups(
  camp3mRows:     AdRestructureRow[],
  asinToCategory: Map<string, string>,
  snapshotDate:   string,
): SopCandidate[] {
  const actions: SopCandidate[] = []
  const campAgg = aggregateCampaigns(camp3mRows)

  for (const [key, data] of campAgg) {
    const [asin, campaignName] = splitKey(key)
    // 僵尸广告组：3个月内有花费但 0 成交（$10 最低门槛过滤噪音）
    if (data.totalSpend > 10 && data.totalOrders === 0) {
      actions.push({
        asin,
        categoryKey: asinToCategory.get(asin) ?? "",
        priority:    "P2",
        rule:        "zombie",
        campaignName,
        suggestion:  "暂停该广告活动，预算转移到高效组",
        detail:      { totalSpend: +data.totalSpend.toFixed(2), totalOrders: 0 },
        snapshotDate,
      })
    }
  }

  return actions
}

// ---------------------------------------------------------------------------
// 品类内部竞争（cross-ASIN）
// ---------------------------------------------------------------------------

function runCrossAsinCompetition(
  stRows:          SearchTermRow[],
  asinToCategory:  Map<string, string>,
  categoryToAsins: Map<string, string[]>,
  snapshotDate:    string,
): SopCandidate[] {
  const actions: SopCandidate[] = []

  // 按 (categoryKey, searchTerm, matchType) 聚合出现的 ASIN 集合
  const termAsins = new Map<string, Set<string>>()  // "cat|term|match" → Set<asin>
  for (const row of stRows) {
    const categoryKey = asinToCategory.get(row.asin) ?? ""
    if (!categoryKey) continue
    const key = `${categoryKey}|${row.searchTerm}|${row.matchType}`
    const asins = termAsins.get(key) ?? new Set()
    asins.add(row.asin)
    termAsins.set(key, asins)
  }

  // 找出 ≥ 2 个不同 ASIN 共同投放同一词×同一匹配类型的情况
  for (const [key, asins] of termAsins) {
    if (asins.size < 2) continue
    const [categoryKey, searchTerm, matchType] = key.split("|", 3)
    const asinList = [...asins]
    actions.push({
      asin:        asinList[0],  // 记主要 ASIN，其余在 detail 中
      categoryKey,
      priority:    "P2",
      rule:        "cross_asin",
      searchTerm,
      matchType,
      suggestion:  "品类内部竞争：在低效ASIN的广告组中否定该词，让流量集中到主力ASIN",
      detail:      { competingAsins: asinList },
      snapshotDate,
    })
  }

  return actions
}

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

/** 按 (asin, campaignName) 聚合 campaign_3m 行 */
function aggregateCampaigns(rows: AdRestructureRow[]): Map<string, {
  asin:        string
  campaignName: string
  totalSpend:  number
  totalSales:  number
  totalOrders: number
  totalClicks: number
}> {
  const map = new Map<string, ReturnType<typeof aggregateCampaigns> extends Map<string, infer V> ? V : never>()
  for (const row of rows) {
    const key = `${row.asin}|${row.campaignName}`
    const existing = map.get(key)
    if (existing) {
      existing.totalSpend  += row.spend
      existing.totalSales  += row.sales
      existing.totalOrders += row.orders
      existing.totalClicks += row.clicks
    } else {
      map.set(key, {
        asin:        row.asin,
        campaignName: row.campaignName,
        totalSpend:  row.spend,
        totalSales:  row.sales,
        totalOrders: row.orders,
        totalClicks: row.clicks,
      })
    }
  }
  return map
}

/** 分割 "asin|campaignName" key，campaignName 可能包含 "|" */
function splitKey(key: string): [string, string] {
  const idx = key.indexOf("|")
  return [key.slice(0, idx), key.slice(idx + 1)]
}
