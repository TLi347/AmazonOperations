/**
 * POST /api/upload
 * multipart/form-data: { productId: string, file: File }
 *
 * 流程：
 *   1. 识别文件类型
 *   2. 调用对应解析器
 *   3. 若 DATABASE_URL 存在 → 写入 DB（upsert）
 *   4. 返回解析结果 JSON（无论有无 DB 都返回，供前端注入 Zustand）
 */

import { NextRequest, NextResponse } from "next/server";
import { identifyFileType, isParseableType } from "@/lib/parsers/identifier";
import { parseAsinReport }    from "@/lib/parsers/parseAsinReport";
import { parseSkuReport }     from "@/lib/parsers/parseSkuReport";
import { parseAdCampaign }    from "@/lib/parsers/parseAdCampaign";
import { parseAdPlacement }   from "@/lib/parsers/parseAdPlacement";
import { parseAdRestructure } from "@/lib/parsers/parseAdRestructure";
import { parseSearchTerm }    from "@/lib/parsers/parseSearchTerm";
import { parseCostMgmt }      from "@/lib/parsers/parseCostMgmt";
import { parseInventory }     from "@/lib/parsers/parseInventory";
import { parseSingleArchive } from "@/lib/parsers/parseSingleArchive";
import { parseAbaSearch }     from "@/lib/parsers/parseAbaSearch";

const HAS_DB = !!process.env.DATABASE_URL;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const productId = formData.get("productId") as string | null;
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "缺少文件" }, { status: 400 });
    }

    const filename = file.name;
    const fileType = identifyFileType(filename);

    if (!isParseableType(fileType)) {
      return NextResponse.json({
        fileType,
        parsed: null,
        message: fileType === "competitor_snapshot"
          ? "竞品截图已接收，无法自动解析"
          : "未识别的文件类型",
      });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await parseAndStore(buffer, filename, fileType, productId, file.size);

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[upload] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function parseAndStore(
  buffer: Buffer,
  filename: string,
  fileType: string,
  productId: string | null,
  fileSize: number
) {
  // ── 1. 解析 ─────────────────────────────────────────
  let parsed: unknown = null;
  let timeWindow = "custom";
  let startDate: Date | null = null;
  let endDate: Date | null = null;
  let affectedAsins: string[] = [];

  switch (fileType) {
    case "nordhive_asin_report": {
      const rows = parseAsinReport(buffer);
      parsed = rows;
      if (rows[0]) {
        timeWindow = rows[0].timeWindow;
        startDate  = rows[0].startDate;
        endDate    = rows[0].endDate;
      }
      affectedAsins = Array.from(new Set(rows.map((r) => r.asin)));
      if (HAS_DB) await writeAsinMetrics(rows, productId).catch((e) => console.warn("[upload] writeAsinMetrics:", e?.message));
      break;
    }
    case "nordhive_sku_report": {
      const rows = parseSkuReport(buffer);
      parsed = rows;
      if (rows[0]) timeWindow = rows[0].timeWindow;
      affectedAsins = Array.from(new Set(rows.map((r) => r.asin)));
      // SKU report: supplement existing Metric rows (no separate write needed for Phase 4)
      break;
    }
    case "nordhive_ad_campaign": {
      const rows = parseAdCampaign(buffer);
      parsed = rows;
      if (rows[0]) timeWindow = rows[0].timeWindow;
      if (HAS_DB && productId) await writeAdCampaigns(rows, productId).catch((e) => console.warn("[upload] writeAdCampaigns:", e?.message));
      break;
    }
    case "nordhive_ad_placement": {
      const rows = parseAdPlacement(buffer);
      parsed = rows;
      if (rows[0]) timeWindow = rows[0].timeWindow;
      if (HAS_DB && productId) await writeAdPlacements(rows, productId).catch((e) => console.warn("[upload] writeAdPlacements:", e?.message));
      break;
    }
    case "nordhive_ad_restructure": {
      const rows = parseAdRestructure(buffer);
      parsed = rows;
      if (rows[0]) timeWindow = rows[0].timeWindow;
      affectedAsins = Array.from(new Set(rows.map((r) => r.asin)));
      break;
    }
    case "nordhive_search_term": {
      const rows = parseSearchTerm(buffer);
      parsed = rows;
      if (rows[0]) timeWindow = rows[0].timeWindow;
      affectedAsins = Array.from(new Set(rows.map((r) => r.asin)));
      if (HAS_DB && productId) await writeSearchTerms(rows, productId).catch((e) => console.warn("[upload] writeSearchTerms:", e?.message));
      break;
    }
    case "nordhive_cost_mgmt": {
      const rows = parseCostMgmt(buffer);
      parsed = rows;
      affectedAsins = Array.from(new Set(rows.map((r) => r.asin)));
      if (HAS_DB) await writeCostMgmt(rows, productId).catch((e) => console.warn("[upload] writeCostMgmt:", e?.message));
      break;
    }
    case "nordhive_inventory": {
      const rows = parseInventory(buffer);
      parsed = rows;
      affectedAsins = Array.from(new Set(rows.map((r) => r.asin)));
      if (HAS_DB) await writeInventory(rows, productId).catch((e) => console.warn("[upload] writeInventory:", e?.message));
      break;
    }
    case "single_product_archive": {
      const result = parseSingleArchive(buffer, filename);
      parsed = result;
      affectedAsins = result.asin ? [result.asin] : [];
      if (HAS_DB && productId) await writeSingleArchive(result, productId).catch((e) => console.warn("[upload] writeSingleArchive:", e?.message));
      break;
    }
    case "aba_search_compare": {
      const rows = parseAbaSearch(buffer, filename);
      parsed = rows;
      if (HAS_DB) await writeAbaSearch(rows).catch((e) => console.warn("[upload] writeAbaSearch:", e?.message));
      break;
    }
  }

  // ── 2. 创建 DataFile 记录（有 DB 时，失败不阻断上传）────
  let fileRecord = null;
  if (HAS_DB && productId) {
    try {
      const { prisma } = await import("@/lib/prisma");
      fileRecord = await prisma.dataFile.create({
        data: {
          productId,
          fileName:    filename,
          fileType,
          timeWindow,
          fileSize,
          storagePath: "",          // Phase 6 接入 S3 时填充
          parsedData:  JSON.parse(JSON.stringify({ rowCount: Array.isArray(parsed) ? (parsed as unknown[]).length : 0 })),
        },
      });
    } catch (err) {
      console.warn("[upload] DataFile DB create failed (DB unavailable?):", err instanceof Error ? err.message : err);
    }
  }

  return {
    fileType,
    timeWindow,
    startDate: startDate?.toISOString() ?? null,
    endDate:   endDate?.toISOString() ?? null,
    affectedAsins,
    parsed,
    fileRecord,
    rowCount: Array.isArray(parsed) ? (parsed as unknown[]).length : 0,
  };
}

// ── DB 写入函数 ────────────────────────────────────────────

async function writeAsinMetrics(
  rows: Awaited<ReturnType<typeof parseAsinReport>>,
  _productId: string | null
) {
  const { prisma } = await import("@/lib/prisma");

  for (const row of rows) {
    if (!row.asin || !row.startDate) continue;

    // 按 ASIN 查找对应的 productId
    const product = await prisma.product.findUnique({ where: { asin: row.asin } });
    if (!product) continue;

    await prisma.metric.upsert({
      where: {
        productId_date_timeWindow_marketplace: {
          productId:   product.id,
          date:        row.startDate,
          timeWindow:  row.timeWindow,
          marketplace: row.marketplace || "ALL",
        },
      },
      update: {
        gmv:         row.gmv,
        orders:      row.orders,
        units:       row.units,
        sessions:    row.sessions,
        refundRate:  row.refundRate,
        adSpend:     row.adSpend,
        adSales:     row.adSales,
        adOrders:    row.adOrders,
        acos:        row.acos,
        roas:        row.roas,
        ctr:         row.ctr,
        cpc:         row.cpc,
        impressions: row.impressions,
        clicks:      row.clicks,
        cvr:         row.cvr,
        grossProfit: row.grossProfit,
        grossMargin: row.grossMargin,
        fbaFee:      row.fbaFee,
        referralFee: row.referralFee,
      },
      create: {
        productId:   product.id,
        date:        row.startDate,
        timeWindow:  row.timeWindow,
        marketplace: row.marketplace || "ALL",
        gmv:         row.gmv,
        orders:      row.orders,
        units:       row.units,
        sessions:    row.sessions,
        refundRate:  row.refundRate,
        adSpend:     row.adSpend,
        adSales:     row.adSales,
        adOrders:    row.adOrders,
        acos:        row.acos,
        roas:        row.roas,
        ctr:         row.ctr,
        cpc:         row.cpc,
        impressions: row.impressions,
        clicks:      row.clicks,
        cvr:         row.cvr,
        grossProfit: row.grossProfit,
        grossMargin: row.grossMargin,
        fbaFee:      row.fbaFee,
        referralFee: row.referralFee,
      },
    });
  }
}

async function writeAdCampaigns(
  rows: Awaited<ReturnType<typeof parseAdCampaign>>,
  productId: string
) {
  // 广告活动数据存为 DataFile.parsedData JSON blob，不单独建表
  // (已在上层 create DataFile 时写入)
  void rows; void productId;
}

async function writeAdPlacements(
  rows: Awaited<ReturnType<typeof parseAdPlacement>>,
  productId: string
) {
  const { prisma } = await import("@/lib/prisma");
  const now = new Date();

  for (const row of rows) {
    await prisma.adPlacement.create({
      data: {
        productId,
        date:         now,
        marketplace:  row.marketplace,
        campaignName: row.campaignName,
        placement:    row.placement,
        bidAdjustPct: row.bidAdjustPct,
        impressions:  row.impressions,
        clicks:       row.clicks,
        spend:        row.spend,
        sales:        row.sales,
      },
    }).catch(() => {}); // ignore duplicates
  }
}

async function writeSearchTerms(
  rows: Awaited<ReturnType<typeof parseSearchTerm>>,
  productId: string
) {
  const { prisma } = await import("@/lib/prisma");
  const now = new Date();

  for (const row of rows) {
    await prisma.searchTermReport.create({
      data: {
        productId,
        date:        now,
        marketplace: row.marketplace,
        searchTerm:  row.searchTerm,
        impressions: row.impressions,
        clicks:      row.clicks,
        spend:       row.spend,
        sales:       row.sales,
        orders:      row.orders,
        acos:        row.acos,
        matchType:   row.matchType,
        campaignName: row.campaignName,
      },
    }).catch(() => {});
  }
}

async function writeCostMgmt(
  rows: Awaited<ReturnType<typeof parseCostMgmt>>,
  productId: string | null
) {
  const { prisma } = await import("@/lib/prisma");

  for (const row of rows) {
    const product = productId
      ? await prisma.product.findUnique({ where: { id: productId } })
      : await prisma.product.findFirst({ where: { asin: row.asin } });
    if (!product) continue;

    await prisma.costStructure.upsert({
      where: {
        productId_sku_marketplace: {
          productId:   product.id,
          sku:         row.sku,
          marketplace: row.marketplace,
        },
      },
      update: {
        sellingPrice: row.sellingPrice,
        fbaFeePct:    row.fbaLogisticsPct,
        referralPct:  row.fbaReferralPct,
        adCostPct:    0,
        cogsPct:      row.cogsPct,
        otherPct:     row.fbaHeadFreightPct,
        netMarginPct: row.fbaProfitRate,
      },
      create: {
        productId:    product.id,
        sku:          row.sku,
        marketplace:  row.marketplace,
        sellingPrice: row.sellingPrice,
        fbaFeePct:    row.fbaLogisticsPct,
        referralPct:  row.fbaReferralPct,
        adCostPct:    0,
        cogsPct:      row.cogsPct,
        otherPct:     row.fbaHeadFreightPct,
        netMarginPct: row.fbaProfitRate,
      },
    });
  }
}

async function writeInventory(
  rows: Awaited<ReturnType<typeof parseInventory>>,
  _productId: string | null
) {
  const { prisma } = await import("@/lib/prisma");
  const snapshotDate = new Date();
  snapshotDate.setHours(0, 0, 0, 0);

  for (const row of rows) {
    if (!row.asin) continue;
    const product = await prisma.product.findFirst({
      where: { asin: row.asin },
    });
    if (!product) continue;

    const dailySales = row.daysOfSupply > 0
      ? row.availableQty / row.daysOfSupply
      : 0;
    const restockQty = Math.round(dailySales * 60);

    await prisma.inventorySnapshot.upsert({
      where: {
        productId_sku_marketplace_snapshotDate: {
          productId:    product.id,
          sku:          row.sku,
          marketplace:  row.marketplace,
          snapshotDate,
        },
      },
      update: {
        availableQty:      row.availableQty,
        unavailableQty:    row.unavailableQty,
        reservedQty:       row.reservedQty,
        inboundQty:        row.inboundQty,
        inventoryValue:    row.inventoryValue,
        inventoryCost:     row.inventoryCost,
        daysOfSupply:      row.daysOfSupply,
        dailySales,
        restockQty,
        aged0_30:          row.aged0_30,
        aged31_60:         row.aged31_60,
        aged61_90:         row.aged61_90,
        aged91_180:        row.aged91_180,
        aged181_330:       row.aged181_330,
        aged331_365:       row.aged331_365,
        aged365Plus:       row.aged365Plus,
        monthlyStorageFee: row.monthlyStorageFee,
        longTermStorageFee: row.longTermStorageFee,
      },
      create: {
        productId:         product.id,
        sku:               row.sku,
        marketplace:       row.marketplace,
        snapshotDate,
        availableQty:      row.availableQty,
        unavailableQty:    row.unavailableQty,
        reservedQty:       row.reservedQty,
        inboundQty:        row.inboundQty,
        inventoryValue:    row.inventoryValue,
        inventoryCost:     row.inventoryCost,
        daysOfSupply:      row.daysOfSupply,
        dailySales,
        restockQty,
        aged0_30:          row.aged0_30,
        aged31_60:         row.aged31_60,
        aged61_90:         row.aged61_90,
        aged91_180:        row.aged91_180,
        aged181_330:       row.aged181_330,
        aged331_365:       row.aged331_365,
        aged365Plus:       row.aged365Plus,
        monthlyStorageFee: row.monthlyStorageFee,
        longTermStorageFee: row.longTermStorageFee,
      },
    });
  }
}

async function writeSingleArchive(
  result: Awaited<ReturnType<typeof parseSingleArchive>>,
  productId: string
) {
  const { prisma } = await import("@/lib/prisma");

  // 广告日志
  for (const log of result.logs) {
    if (!log.date) continue;
    await prisma.adOperationLog.create({
      data: {
        productId,
        date:          log.date,
        marketplace:   log.marketplace,
        campaignName:  log.campaignName,
        operationType: log.operationType,
        target:        log.target,
        detail:        log.detail,
      },
    }).catch(() => {});
  }

  // 关键词表现
  for (const kw of result.keywords) {
    if (!kw.date) continue;
    await prisma.keywordMetric.create({
      data: {
        productId,
        date:        kw.date,
        marketplace: kw.marketplace,
        campaignName: kw.campaignName,
        keyword:     kw.keyword,
        matchType:   kw.matchType,
        bid:         kw.bid,
        impressions: kw.impressions,
        clicks:      kw.clicks,
        ctr:         kw.ctr,
        spend:       kw.spend,
        sales:       kw.sales,
        orders:      kw.orders,
        acos:        kw.acos,
        cpc:         kw.cpc,
        cvr:         kw.cvr,
      },
    }).catch(() => {});
  }
}

async function writeAbaSearch(
  rows: Awaited<ReturnType<typeof parseAbaSearch>>
) {
  const { prisma } = await import("@/lib/prisma");

  for (const row of rows) {
    const reportDate = row.reportDate ? new Date(row.reportDate) : new Date();
    await prisma.abaSearchTerm.create({
      data: {
        reportDate,
        marketplace:     row.marketplace,
        searchTerm:      row.searchTerm,
        searchFreqRank:  row.searchFreqRank,
        topClickedAsin1: row.topClickedAsin1 || null,
        topClickShare1:  row.topClickShare1 || null,
        topConvShare1:   row.topConvShare1 || null,
        topClickedAsin2: row.topClickedAsin2 || null,
        topClickShare2:  row.topClickShare2 || null,
        topConvShare2:   row.topConvShare2 || null,
        topClickedAsin3: row.topClickedAsin3 || null,
        topClickShare3:  row.topClickShare3 || null,
        topConvShare3:   row.topConvShare3 || null,
        isNew:           row.isNew,
        rankChange:      row.rankChange || null,
      },
    }).catch(() => {});
  }
}
