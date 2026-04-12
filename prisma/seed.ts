import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

// 生成基准日期前 N 天的 YYYY-MM-DD 字符串
function daysAgo(n: number): string {
  const d = new Date("2026-04-12")
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

// 带随机浮动的数值（±pct 浮动）
function jitter(base: number, pct = 0.12): number {
  return Math.round(base * (1 + (Math.random() - 0.5) * 2 * pct) * 100) / 100
}

async function main() {
  console.log("Seeding database...")

  // CategoryMap：品类 → ASIN 列表
  const categories = [
    {
      categoryKey: "mattress",
      displayName: "床垫",
      asins: JSON.stringify(["B0GD7BF2TZ", "B0GD7K1TC9"]),
    },
    {
      categoryKey: "pump",
      displayName: "充气泵",
      asins: JSON.stringify(["B0FJKNRNZK"]),
    },
    {
      categoryKey: "scooter",
      displayName: "电动滑板车",
      asins: JSON.stringify([]),
    },
  ]

  for (const cat of categories) {
    await db.categoryMap.upsert({
      where: { categoryKey: cat.categoryKey },
      update: { displayName: cat.displayName, asins: cat.asins },
      create: cat,
    })
  }
  console.log("  CategoryMap seeded (3 categories)")

  // AsinConfig：ASIN → 品类 + 阶段
  const asinConfigs = [
    {
      asin: "B0GD7BF2TZ",
      categoryKey: "mattress",
      stage: "growth",
      displayName: 'Queen 4" 沙发床垫',
    },
    {
      asin: "B0GD7K1TC9",
      categoryKey: "mattress",
      stage: "growth",
      displayName: 'Full 4" 沙发床垫',
    },
    {
      asin: "B0FJKNRNZK",
      categoryKey: "pump",
      stage: "launch",
      displayName: "150PSI 充气泵",
    },
  ]

  for (const cfg of asinConfigs) {
    await db.asinConfig.upsert({
      where: { asin: cfg.asin },
      update: { categoryKey: cfg.categoryKey, stage: cfg.stage, displayName: cfg.displayName },
      create: cfg,
    })
  }
  console.log("  AsinConfig seeded (3 ASINs)")

  // ProductMetricDay：7天模拟数据（3个配置 ASIN，覆盖近 7 天）
  const metricSeeds: Array<{ asin: string; base: { gmv: number; orders: number; sessions: number; adSpend: number; adSales: number } }> = [
    { asin: "B0GD7BF2TZ", base: { gmv: 2580, orders: 18, sessions: 320, adSpend: 380, adSales: 1240 } },
    { asin: "B0GD7K1TC9", base: { gmv: 1940, orders: 14, sessions: 260, adSpend: 290, adSales: 960  } },
    { asin: "B0FJKNRNZK", base: { gmv: 820,  orders: 9,  sessions: 190, adSpend: 160, adSales: 560  } },
  ]

  let metricCount = 0
  for (const { asin, base } of metricSeeds) {
    for (let day = 6; day >= 0; day--) {
      const date = daysAgo(day)
      const gmv      = jitter(base.gmv)
      const orders   = Math.max(1, Math.round(jitter(base.orders)))
      const sessions = Math.max(10, Math.round(jitter(base.sessions)))
      const adSpend  = jitter(base.adSpend)
      const adSales  = jitter(base.adSales)
      const adOrders = Math.max(1, Math.round(orders * 0.55))
      const impressions = Math.round(sessions * 18)
      const clicks   = Math.round(impressions * 0.03)
      const metrics = JSON.stringify({
        gmv,
        orders,
        units:       orders + Math.round(orders * 0.1),
        ad_spend:    adSpend,
        ad_sales:    adSales,
        ad_orders:   adOrders,
        impressions,
        clicks,
        sessions,
        ocr:         orders / sessions,
        refund_rate: 0.02,
      })
      await db.productMetricDay.upsert({
        where:  { asin_date: { asin, date } },
        update: { metrics },
        create: { asin, date, metrics },
      })
      metricCount++
    }
  }
  console.log(`  ProductMetricDay seeded (${metricCount} rows)`)

  console.log("Seed complete.")
}

main()
  .then(async () => {
    await db.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await db.$disconnect()
    process.exit(1)
  })
