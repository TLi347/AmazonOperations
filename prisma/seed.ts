import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PRODUCTS = [
  {
    asin: "B0GLN365R2",
    name: "电动滑板车 Pro Max",
    shortName: "滑板车",
    category: "电动出行",
    stage: "成熟期",
    brand: "Nordhive",
    marketplace: ["US", "CA"],
    rating: 4.3,
    reviewCount: 287,
    price: 459.99,
    bsr: 1823,
    emoji: "🛴",
  },
  {
    asin: "B0FJKNRNZK",
    name: "便携充气泵 AirPro",
    shortName: "充气泵",
    category: "户外工具",
    stage: "成长期",
    brand: "Nordhive",
    marketplace: ["US", "CA", "MX"],
    rating: 4.1,
    reviewCount: 156,
    price: 49.99,
    bsr: 3421,
    emoji: "💨",
  },
  {
    asin: "B0QM8WTNS9",
    name: "蓝白Queen床垫",
    shortName: "Queen床垫",
    category: "家居床品",
    stage: "成熟期",
    brand: "Roadvo",
    marketplace: ["US"],
    rating: 4.5,
    reviewCount: 1203,
    price: 299.99,
    bsr: 892,
    emoji: "🛏️",
  },
  {
    asin: "B0KP3RMZL4",
    name: "折叠沙发床垫 Comfort",
    shortName: "沙发床垫",
    category: "家居床品",
    stage: "新品期",
    brand: "Roadvo",
    marketplace: ["US"],
    rating: 3.9,
    reviewCount: 42,
    price: 189.99,
    bsr: 5672,
    emoji: "🛋️",
  },
];

const ALERTS_DATA = [
  {
    asin: "B0FJKNRNZK",
    priority: "P0",
    title: "关键词零成交止血",
    description:
      "「bicycle pump portable」精确匹配点击23次，0成交，已消耗$73.6",
    triggerRule: "keyword_zero_conversion",
    suggestedAction: "立即暂停该关键词，同步在广泛匹配父组添加否定（词组否定）",
  },
  {
    asin: "B0QM8WTNS9",
    priority: "P0",
    title: "广告活动超预算",
    description: "床垫SP-广泛活动单日花费$186，超预算32%，当日ACoS 89%",
    triggerRule: "over_budget_high_acos",
    suggestedAction: "暂停广泛组 + 降低出价10-15%",
  },
  {
    asin: "B0GLN365R2",
    priority: "P1",
    title: "CTR异常偏低",
    description: "精确词「electric scooter adult」曝光1,240次，CTR仅0.12%",
    triggerRule: "low_ctr",
    suggestedAction: "检查并更新主图，检查价格是否高于竞品>15%",
  },
  {
    asin: "B0KP3RMZL4",
    priority: "P1",
    title: "新品曝光不足",
    description: "精确词累计曝光仅312次（运行9天），出价低于类目中位",
    triggerRule: "new_product_low_impression",
    suggestedAction: "热门词出价提升20-30%，不低于类目CPC中位值+15%",
  },
  {
    asin: "B0QM8WTNS9",
    priority: "P2",
    title: "优质词加价扩量",
    description: "「mattress for sleeper sofa」ACoS 28%, CVR 6.9%",
    triggerRule: "high_performance_keyword",
    suggestedAction: "出价+15-20%，同步增加日预算20%",
  },
  {
    asin: "B0FJKNRNZK",
    priority: "P0",
    title: "库存紧急预警",
    description: "可售天数仅剩18天，日均销量12件，在途库存0",
    triggerRule: "inventory_critical",
    suggestedAction: "立即安排补货，建议补货量 = 12 × (30 + 30) = 720件",
  },
];

const METRICS_DATA = [
  {
    timeWindow: "daily",
    marketplace: "ALL",
    daysAgo: 0,
    gmv: 2847,
    orders: 9,
    sessions: 423,
    acos: 42.3,
    roas: 2.36,
    ctr: 0.58,
    cvr: 8.2,
    cpc: 1.45,
    adSpend: 312,
  },
  {
    timeWindow: "daily",
    marketplace: "ALL",
    daysAgo: 1,
    gmv: 3210,
    orders: 11,
    sessions: 456,
    acos: 38.7,
    roas: 2.58,
    ctr: 0.62,
    cvr: 9.1,
    cpc: 1.38,
    adSpend: 298,
  },
  {
    timeWindow: "weekly",
    marketplace: "ALL",
    daysAgo: 7,
    gmv: 21540,
    orders: 72,
    sessions: 3150,
    acos: 40.1,
    roas: 2.49,
    ctr: 0.61,
    cvr: 8.8,
    cpc: 1.41,
    adSpend: 2105,
  },
  {
    timeWindow: "biweekly",
    marketplace: "ALL",
    daysAgo: 14,
    gmv: 19870,
    orders: 66,
    sessions: 2980,
    acos: 43.5,
    roas: 2.3,
    ctr: 0.55,
    cvr: 8.0,
    cpc: 1.52,
    adSpend: 2230,
  },
  {
    timeWindow: "monthly",
    marketplace: "ALL",
    daysAgo: 30,
    gmv: 87650,
    orders: 292,
    sessions: 12800,
    acos: 41.2,
    roas: 2.43,
    ctr: 0.59,
    cvr: 8.5,
    cpc: 1.44,
    adSpend: 8740,
  },
];

async function main() {
  console.log("🌱 Seeding database...");

  // Clear existing data
  await prisma.chatMessage.deleteMany();
  await prisma.chatSession.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.metric.deleteMany();
  await prisma.costStructure.deleteMany();
  await prisma.dataFile.deleteMany();
  await prisma.product.deleteMany();

  const now = new Date();

  // Create products
  for (const p of PRODUCTS) {
    const product = await prisma.product.create({ data: p });
    console.log(`  ✓ Product: ${product.name} (${product.asin})`);

    // Create alerts for this product
    const productAlerts = ALERTS_DATA.filter((a) => a.asin === p.asin);
    for (const alertData of productAlerts) {
      await prisma.alert.create({
        data: {
          productId: product.id,
          priority: alertData.priority,
          title: alertData.title,
          description: alertData.description,
          triggerRule: alertData.triggerRule,
          suggestedAction: alertData.suggestedAction,
          status: "open",
        },
      });
    }

    // Create metrics for Queen 床垫 (B0QM8WTNS9) as demo
    if (p.asin === "B0QM8WTNS9") {
      for (const m of METRICS_DATA) {
        const date = new Date(now);
        date.setDate(date.getDate() - m.daysAgo);
        await prisma.metric.create({
          data: {
            productId: product.id,
            date,
            timeWindow: m.timeWindow,
            marketplace: m.marketplace,
            gmv: m.gmv,
            orders: m.orders,
            sessions: m.sessions,
            acos: m.acos,
            roas: m.roas,
            ctr: m.ctr,
            cvr: m.cvr,
            cpc: m.cpc,
            adSpend: m.adSpend,
          },
        });
      }

      // Create cost structure
      await prisma.costStructure.create({
        data: {
          productId: product.id,
          sku: "BW-QUEEN-US",
          marketplace: "US",
          sellingPrice: 299.99,
          fbaFeePct: 15.2,
          referralPct: 8.0,
          adCostPct: 12.5,
          cogsPct: 35.0,
          otherPct: 2.3,
          netMarginPct: 27.0,
        },
      });
    }
  }

  console.log("✅ Seed complete!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
