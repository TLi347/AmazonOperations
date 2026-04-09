/**
 * Client-side helper: merges raw parsed rows (from /api/upload response)
 * into the existing Zustand ProductMetrics — used when no DB is present.
 */

import type { ProductMetrics, MetricsSnapshot, InventoryRecord } from "@/store/appStore";

// We use `any` here because parsed rows arrive as plain JSON from the API.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

function rowsToSnapshot(rows: AnyRow[]): MetricsSnapshot | undefined {
  if (!rows.length) return undefined;

  const gmv         = rows.reduce((s, r) => s + (r.gmv ?? 0), 0);
  const orders      = rows.reduce((s, r) => s + (r.orders ?? 0), 0);
  const adSpend     = rows.reduce((s, r) => s + (r.adSpend ?? 0), 0);
  const adSales     = rows.reduce((s, r) => s + (r.adSales ?? 0), 0);
  const impressions = rows.reduce((s, r) => s + (r.impressions ?? 0), 0);
  const clicks      = rows.reduce((s, r) => s + (r.clicks ?? 0), 0);
  const adOrders    = rows.reduce((s, r) => s + (r.adOrders ?? 0), 0);
  const sessions    = rows.reduce((s, r) => s + (r.sessions ?? 0), 0);

  return {
    gmv,
    orders,
    adSpend,
    sessions,
    impressions,
    clicks,
    acos: adSales > 0 ? (adSpend / adSales) * 100 : 0,
    roas: adSpend > 0 ? adSales / adSpend : 0,
    ctr:  impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc:  clicks > 0 ? adSpend / clicks : 0,
    cvr:  clicks > 0 ? (adOrders / clicks) * 100 : 0,
  };
}

/**
 * Merge an uploaded nordhive_asin_report (parsed rows) into existing ProductMetrics.
 * Filters rows by productAsin when provided.
 */
export function mergeAsinUpload(
  parsed: AnyRow[],
  productAsin: string,
  existing: ProductMetrics | undefined
): ProductMetrics {
  const current: ProductMetrics = existing ?? {};

  // Filter to rows matching this product's ASIN (multi-ASIN files are common)
  const rows = productAsin
    ? parsed.filter((r) => r.asin === productAsin)
    : parsed;

  if (!rows.length) return current;

  const timeWindow = rows[0].timeWindow as string;
  const snapshot = rowsToSnapshot(rows);

  if (timeWindow === "daily") {
    // startDate may be a Date ISO string or Date object when serialized
    const rawDate = rows[0].startDate;
    const dateStr = rawDate
      ? String(rawDate).slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    const prevHistory = current.acosHistory ?? [];
    // Replace entry for this date if it already exists, then re-sort
    const historyWithout = prevHistory.filter((h) => h.date !== dateStr);
    const newEntry = {
      date: dateStr,
      acos: snapshot?.acos ?? 0,
      gmv:  snapshot?.gmv,
    };
    const newHistory = [...historyWithout, newEntry].sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    // Re-derive today / yesterday from the sorted history
    const sortedDates = newHistory.map((h) => h.date);
    const latestDate  = sortedDates[sortedDates.length - 1];
    const prevDate    = sortedDates[sortedDates.length - 2];

    const result: ProductMetrics = { ...current, acosHistory: newHistory };
    if (dateStr === latestDate) result.today     = snapshot;
    if (dateStr === prevDate)   result.yesterday = snapshot;
    return result;
  }

  // Non-daily: map timeWindow → slot
  const result: ProductMetrics = { ...current };
  if (timeWindow === "weekly")   result.w7  = snapshot;
  if (timeWindow === "biweekly") result.w14 = snapshot;
  if (timeWindow === "monthly")  result.d30 = snapshot;
  return result;
}

/**
 * Convert raw nordhive_inventory parsed rows into InventoryRecord[].
 */
export function inventoryRowsToRecords(parsed: AnyRow[]): InventoryRecord[] {
  return parsed.map((r) => {
    const daysOfSupply = r.daysOfSupply ?? 0;
    const availableQty = r.availableQty ?? 0;
    const dailySales   = daysOfSupply > 0 ? availableQty / daysOfSupply : 0;
    return {
      sku:          r.sku ?? "",
      marketplace:  r.marketplace ?? "US",
      availableQty,
      inboundQty:   r.inboundQty ?? 0,
      daysOfSupply,
      dailySales,
      restockQty:   Math.round(dailySales * 60),
    };
  });
}
