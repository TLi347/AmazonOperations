/**
 * GET /api/data?productId=xxx&type=metrics|inventory|files|alerts
 *
 * 从 DB 查询并返回 Zustand 所需结构。
 * 无 DATABASE_URL 时返回 { error: "no_db" }，前端保持 mock 数据。
 */

import { NextRequest, NextResponse } from "next/server";

const HAS_DB = !!process.env.DATABASE_URL;

export async function GET(req: NextRequest) {
  if (!HAS_DB) {
    return NextResponse.json({ error: "no_db" });
  }

  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");
  const type = searchParams.get("type");

  if (!productId || !type) {
    return NextResponse.json({ error: "missing params" }, { status: 400 });
  }

  try {
    const { prisma } = await import("@/lib/prisma");

    switch (type) {
      // ── metrics → ProductMetrics shape ──────────────
      case "metrics": {
        const allMetrics = await prisma.metric.findMany({
          where: { productId },
          orderBy: { date: "asc" },
        });

        // 聚合为各 timeWindow 的快照
        const byWindow: Record<string, typeof allMetrics[0][]> = {};
        for (const m of allMetrics) {
          if (!byWindow[m.timeWindow]) byWindow[m.timeWindow] = [];
          byWindow[m.timeWindow].push(m);
        }

        // 取每个 timeWindow 中最新的一条（可能有多个站点，合并求和）
        const aggregate = (rows: typeof allMetrics) => {
          if (rows.length === 0) return null;
          return rows.reduce(
            (acc, r) => ({
              gmv:         acc.gmv + r.gmv,
              orders:      acc.orders + r.orders,
              adSpend:     acc.adSpend + r.adSpend,
              adSales:     acc.adSales + r.adSales,
              adOrders:    acc.adOrders + r.adOrders,
              impressions: acc.impressions + r.impressions,
              clicks:      acc.clicks + r.clicks,
              acos:        0, // 重新算
              roas:        0,
              ctr:         0,
              cpc:         0,
              cvr:         0,
            }),
            { gmv: 0, orders: 0, adSpend: 0, adSales: 0, adOrders: 0, impressions: 0, clicks: 0, acos: 0, roas: 0, ctr: 0, cpc: 0, cvr: 0 }
          );
        };

        const finalize = (agg: ReturnType<typeof aggregate>) => {
          if (!agg) return null;
          return {
            ...agg,
            acos: agg.adSales > 0 ? (agg.adSpend / agg.adSales) * 100 : 0,
            roas: agg.adSpend > 0 ? agg.adSales / agg.adSpend : 0,
            ctr:  agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : 0,
            cpc:  agg.clicks > 0 ? agg.adSpend / agg.clicks : 0,
            cvr:  agg.clicks > 0 ? (agg.adOrders / agg.clicks) * 100 : 0,
          };
        };

        // ACoS 历史（daily 记录 → 时序数组）
        const dailyRows = (byWindow["daily"] ?? []).sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        // 按日期聚合（多站点合并）
        const dateMap = new Map<string, { acos: number; gmv: number; spend: number; sales: number }>();
        for (const r of dailyRows) {
          const key = new Date(r.date).toISOString().slice(0, 10);
          const existing = dateMap.get(key);
          if (existing) {
            existing.gmv   += r.gmv;
            existing.spend += r.adSpend;
            existing.sales += r.adSales;
          } else {
            dateMap.set(key, { acos: r.acos, gmv: r.gmv, spend: r.adSpend, sales: r.adSales });
          }
        }
        const acosHistory = Array.from(dateMap.entries()).map(([date, v]) => ({
          date,
          acos: v.sales > 0 ? (v.spend / v.sales) * 100 : 0,
          gmv:  v.gmv,
        }));

        // 今日 / 昨日：找日期最近的两条 daily 记录
        const sortedDates = Array.from(dateMap.keys()).sort();
        const todayKey     = sortedDates[sortedDates.length - 1];
        const yesterdayKey = sortedDates[sortedDates.length - 2];

        const getDailySnap = (dateKey: string | undefined) => {
          if (!dateKey) return null;
          const rows = dailyRows.filter(
            (r) => new Date(r.date).toISOString().slice(0, 10) === dateKey
          );
          return finalize(aggregate(rows));
        };

        return NextResponse.json({
          today:      getDailySnap(todayKey),
          yesterday:  getDailySnap(yesterdayKey),
          w7:         finalize(aggregate(byWindow["weekly"]   ?? [])),
          w14:        finalize(aggregate(byWindow["biweekly"] ?? [])),
          d30:        finalize(aggregate(byWindow["monthly"]  ?? [])),
          acosHistory,
        });
      }

      // ── inventory → InventoryRecord[] shape ─────────
      case "inventory": {
        const snaps = await prisma.inventorySnapshot.findMany({
          where: { productId },
          orderBy: { snapshotDate: "desc" },
          distinct: ["sku", "marketplace"],
        });

        const records = snaps.map((s) => ({
          sku:          s.sku,
          marketplace:  s.marketplace,
          availableQty: s.availableQty,
          inboundQty:   s.inboundQty,
          daysOfSupply: s.daysOfSupply,
          dailySales:   s.dailySales,
          restockQty:   s.restockQty,
        }));

        return NextResponse.json(records);
      }

      // ── files → DataFile[] ───────────────────────────
      case "files": {
        const files = await prisma.dataFile.findMany({
          where: { productId },
          orderBy: { uploadedAt: "desc" },
        });
        return NextResponse.json(files);
      }

      // ── alerts → Alert[] ────────────────────────────
      case "alerts": {
        const alerts = await prisma.alert.findMany({
          where: { productId, status: "open" },
          orderBy: { createdAt: "desc" },
        });
        return NextResponse.json(alerts);
      }

      // ── products（全量，无 productId 过滤）───────────
      case "products": {
        const products = await prisma.product.findMany({
          orderBy: { createdAt: "asc" },
        });
        return NextResponse.json(products);
      }

      default:
        return NextResponse.json({ error: "unknown type" }, { status: 400 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // DB 连接失败（PostgreSQL 未运行）→ 返回 no_db，让前端保持 mock 数据
    if (msg.includes("Can't reach database") || msg.includes("connect ECONNREFUSED")) {
      return NextResponse.json({ error: "no_db" });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
