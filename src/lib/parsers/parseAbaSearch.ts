/**
 * 解析：US_ABA_Search_Compare_*.xlsx
 * 31列，Row1=header，搜索词 + 竞品点击/转化份额
 */
import {
  readWorkbook,
  parseFlatSheet,
  toNum,
  toInt,
} from "./utils";

export interface AbaSearchRow {
  searchFreqRank: number;
  searchTerm: string;
  reportDate: string;       // 来自文件名或单元格
  marketplace: string;

  topClickedAsin1: string;
  topClickShare1: number;
  topConvShare1: number;

  topClickedAsin2: string;
  topClickShare2: number;
  topConvShare2: number;

  topClickedAsin3: string;
  topClickShare3: number;
  topConvShare3: number;

  isNew: boolean;
  rankChange: number;
}

export function parseAbaSearch(
  buffer: Buffer,
  filename: string
): AbaSearchRow[] {
  // 从文件名提取报告日期，e.g. US_ABA_Search_Compare_20260119162211.xlsx → 2026-01-19
  const dateMatch = filename.match(/(\d{4})(\d{2})(\d{2})/);
  const reportDate = dateMatch
    ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
    : "";

  const wb = readWorkbook(buffer);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const { headers, rows } = parseFlatSheet(ws);

  // 动态找列索引（ABA 列名可能含空格或换行）
  function findCol(candidates: string[]): string {
    return (
      headers.find((h) =>
        candidates.some((c) => h.replace(/\s+/g, "").includes(c.replace(/\s+/g, "")))
      ) ?? ""
    );
  }

  const col = {
    rank:     findCol(["搜索频率排名"]),
    term:     findCol(["搜索词"]),
    // 品牌1-3 + ASIN1-3 + 点击份额1-3 + 转化份额1-3
    brand1:   findCol(["点击量最高的品牌#1", "点击量最高的品牌 #1"]),
    asin1:    findCol(["点击量最高的ASIN#1", "点击量最高的ASIN #1"]),
    click1:   findCol(["#1点击份额", "品牌#1点击份额"]),
    conv1:    findCol(["#1转化份额", "品牌#1转化份额"]),
    brand2:   findCol(["点击量最高的品牌#2", "点击量最高的品牌 #2"]),
    asin2:    findCol(["点击量最高的ASIN#2", "点击量最高的ASIN #2"]),
    click2:   findCol(["#2点击份额", "品牌#2点击份额"]),
    conv2:    findCol(["#2转化份额", "品牌#2转化份额"]),
    brand3:   findCol(["点击量最高的品牌#3", "点击量最高的品牌 #3"]),
    asin3:    findCol(["点击量最高的ASIN#3", "点击量最高的ASIN #3"]),
    click3:   findCol(["#3点击份额", "品牌#3点击份额"]),
    conv3:    findCol(["#3转化份额", "品牌#3转化份额"]),
    isNew:    findCol(["是否新增词", "是否新增"]),
    rankChg:  findCol(["排名涨跌", "排名变化"]),
  };

  return rows
    .filter((row) => row[col.rank] != null && row[col.term] != null)
    .map((row) => ({
      searchFreqRank: toInt(row[col.rank]),
      searchTerm:     String(row[col.term] ?? "").trim(),
      reportDate,
      marketplace:    "US",

      topClickedAsin1: String(row[col.asin1] ?? "").trim(),
      topClickShare1:  toNum(row[col.click1]),
      topConvShare1:   toNum(row[col.conv1]),

      topClickedAsin2: String(row[col.asin2] ?? "").trim(),
      topClickShare2:  toNum(row[col.click2]),
      topConvShare2:   toNum(row[col.conv2]),

      topClickedAsin3: String(row[col.asin3] ?? "").trim(),
      topClickShare3:  toNum(row[col.click3]),
      topConvShare3:   toNum(row[col.conv3]),

      isNew:      String(row[col.isNew] ?? "").trim() === "是",
      rankChange: toInt(row[col.rankChg]),
    }));
}
