import * as XLSX from "xlsx";

export type RawRow = Record<string, unknown>;

/**
 * Nordhive 系统导出文件结构：
 *   Row 1 (idx 0): 筛选条件标签
 *   Row 2 (idx 1): 筛选条件值（含时间范围 col[3]）
 *   Row 3 (idx 2): 空行
 *   Row 4 (idx 3): 真正的列头
 *   Row 5 (idx 4): Total 汇总行（需跳过）
 *   Row 6+ (idx 5+): 数据行
 *
 * 单品归档 / ABA 文件：Row 1 直接是列头，无前置元数据行。
 */

export function readWorkbook(buffer: Buffer): XLSX.WorkBook {
  return XLSX.read(buffer, { type: "buffer", cellDates: true });
}

export function getSheet(wb: XLSX.WorkBook, index = 0): XLSX.WorkSheet {
  return wb.Sheets[wb.SheetNames[index]];
}

export function getSheetByPattern(wb: XLSX.WorkBook, pattern: RegExp): XLSX.WorkSheet | null {
  const name = wb.SheetNames.find((n) => pattern.test(n));
  return name ? wb.Sheets[name] : null;
}

/** 将 Sheet 转换为行数组（含原始值） */
export function sheetToRows(ws: XLSX.WorkSheet): unknown[][] {
  const data = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: null,
    raw: false,        // 日期转字符串，数字保持数字
    dateNF: "yyyy-mm-dd",
  });
  return data as unknown[][];
}

/**
 * 针对 Nordhive 系统导出文件：
 * - 列头固定在 row 4（index 3）
 * - 数据从 row 6（index 5）开始（row 5 是 Total，跳过）
 * - Row 2（index 1）的 col[3] 包含时间范围字符串
 */
export function parseNordhiveSheet(ws: XLSX.WorkSheet): {
  dateRange: string;
  headers: string[];
  rows: RawRow[];
} {
  const raw = sheetToRows(ws);
  const dateRange = (raw[1]?.[3] as string) ?? "";
  const headers = (raw[3] ?? []).map((h) => String(h ?? "").trim());
  const rows: RawRow[] = [];

  for (let i = 5; i < raw.length; i++) {
    const row = raw[i];
    if (!row || !row[0] || String(row[0]).trim() === "") continue;
    const obj: RawRow = {};
    headers.forEach((h, j) => {
      if (h) obj[h] = row[j] ?? null;
    });
    rows.push(obj);
  }
  return { dateRange, headers, rows };
}

/**
 * 针对单品归档 / ABA 等直接从 Row 1 开始的文件：
 * - Row 1（index 0）是列头
 * - Row 2+（index 1+）是数据
 */
export function parseFlatSheet(ws: XLSX.WorkSheet): {
  headers: string[];
  rows: RawRow[];
} {
  const raw = sheetToRows(ws);
  const headers = (raw[0] ?? []).map((h) => String(h ?? "").trim());
  const rows: RawRow[] = [];

  for (let i = 1; i < raw.length; i++) {
    const row = raw[i];
    if (!row || row.every((c) => c === null || c === "")) continue;
    const obj: RawRow = {};
    headers.forEach((h, j) => {
      if (h) obj[h] = row[j] ?? null;
    });
    rows.push(obj);
  }
  return { headers, rows };
}

/** 模糊匹配：从 candidates 中找第一个与 header 包含关系匹配的值 */
export function fuzzyGet(row: RawRow, candidates: string[]): unknown {
  for (const key of Object.keys(row)) {
    if (candidates.some((c) => key.includes(c) || c.includes(key))) {
      return row[key];
    }
  }
  return null;
}

/** 安全数字转换 */
export function toNum(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return isNaN(v) ? 0 : v;
  const s = String(v).replace(/[%,]/g, "").trim();
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/** 安全整数转换 */
export function toInt(v: unknown): number {
  return Math.round(toNum(v));
}

/** 解析日期字符串 → Date，失败返回 null */
export function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

/**
 * 从 Nordhive 时间范围字符串推断 timeWindow
 * e.g. "2026-04-08 - 2026-04-08" → "daily"
 *      "2026-03-30 - 2026-04-05" → "weekly"
 */
export function inferTimeWindow(dateRange: string): {
  timeWindow: string;
  startDate: Date | null;
  endDate: Date | null;
} {
  const parts = dateRange.split(" - ").map((s) => s.trim());
  const startDate = toDate(parts[0]);
  const endDate = toDate(parts[1] ?? parts[0]);

  if (!startDate || !endDate) {
    return { timeWindow: "custom", startDate: null, endDate: null };
  }

  const days = Math.round(
    (endDate.getTime() - startDate.getTime()) / 86400000
  ) + 1;

  let timeWindow = "custom";
  if (days <= 1) timeWindow = "daily";
  else if (days <= 8) timeWindow = "weekly";
  else if (days <= 16) timeWindow = "biweekly";
  else if (days <= 35) timeWindow = "monthly";

  return { timeWindow, startDate, endDate };
}
