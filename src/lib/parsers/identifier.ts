export type RealFileType =
  | "nordhive_asin_report"     // 系统-Nordhive-ALL-产品报表-ASIN视图
  | "nordhive_sku_report"      // 系统-Nordhive-ALL-产品报表-SKU视图
  | "nordhive_ad_campaign"     // 系统-Nordhive-*-广告活动（非重构）
  | "nordhive_ad_placement"    // 系统-Nordhive-*-广告位
  | "nordhive_ad_restructure"  // 系统-Nordhive-*-广告活动重构
  | "nordhive_search_term"     // 系统-Nordhive-*-搜索词重构
  | "nordhive_cost_mgmt"       // 系统-Nordhive-多站点-成本管理
  | "nordhive_inventory"       // 系统-Nordhive-多站点-库存报表
  | "single_product_archive"   // B0XXXXX_产品名.xlsx（三 Sheet）
  | "aba_search_compare"       // ABA 搜索词竞品对比
  | "competitor_snapshot"      // 竞品监控.jpeg
  | "unknown";

/** 根据文件名前缀识别报表类型（顺序敏感，越具体的规则越靠前）*/
export function identifyFileType(filename: string): RealFileType {
  const f = filename.toLowerCase();

  if (f.startsWith("系统-nordhive") || f.startsWith("系统-Nordhive".toLowerCase())) {
    if (f.includes("产品报表") && f.includes("asin")) return "nordhive_asin_report";
    if (f.includes("产品报表") && f.includes("sku"))  return "nordhive_sku_report";
    if (f.includes("广告活动重构"))                     return "nordhive_ad_restructure";
    if (f.includes("搜索词重构"))                       return "nordhive_search_term";
    if (f.includes("广告位"))                           return "nordhive_ad_placement";
    if (f.includes("广告活动"))                         return "nordhive_ad_campaign";
    if (f.includes("成本管理"))                         return "nordhive_cost_mgmt";
    if (f.includes("库存报表"))                         return "nordhive_inventory";
  }

  if (f.includes("aba") || f.includes("search_compare")) return "aba_search_compare";

  // 单品归档：文件名以 ASIN 码开头（B0 + 10位字母数字）
  if (/^b0[a-z0-9]{8,}_/i.test(filename)) return "single_product_archive";

  if (f.endsWith(".jpeg") || f.endsWith(".jpg") || f.endsWith(".png")) {
    return "competitor_snapshot";
  }

  return "unknown";
}

/** 判断该文件类型是否可以解析（图片和未知类型跳过）*/
export function isParseableType(type: RealFileType): boolean {
  return type !== "competitor_snapshot" && type !== "unknown";
}
