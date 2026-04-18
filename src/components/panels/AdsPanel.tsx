"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher, swrOptions } from "@/lib/swr";
import { useAppStore, getCategoryKey } from "@/store/appStore";
import { Target, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PanelSkeleton } from "@/components/ui/panel-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { SearchScatterChart } from "@/components/charts/SearchScatterChart";

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

type View = "sop" | "campaign_3m" | "search_terms";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface AdsData {
  source:       string;
  snapshotDate: string;
  total:        number;
  rows:         AnyRow[];
}

interface SopAction {
  id:          string;
  asin:        string;
  categoryKey: string;
  priority:    "P0" | "P1" | "P2" | "P3";
  rule:        string;
  searchTerm?: string | null;
  matchType?:  string | null;
  campaignName?: string | null;
  suggestion:  string;
  detail:      Record<string, unknown>;
  snapshotDate: string;
}

interface SopData {
  snapshotDate: string | null;
  total:        number;
  actions:      SopAction[];
}

// ---------------------------------------------------------------------------
// 格式化工具
// ---------------------------------------------------------------------------

function pct(v: unknown): string {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isNaN(n) ? "—" : `${(n * 100).toFixed(1)}%`;
}
function cur(v: unknown): string {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isNaN(n) ? "—" : `$${n.toFixed(2)}`;
}
function num(v: unknown): string {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isNaN(n) ? "—" : n.toLocaleString();
}

// ---------------------------------------------------------------------------
// 优先级配置
// ---------------------------------------------------------------------------

const PRIORITY_CONFIG: Record<string, {
  label:    string;
  badge:    "destructive" | "default" | "secondary" | "outline";
  bg:       string;
  dot:      string;
}> = {
  P0: { label: "P0 止血",  badge: "destructive", bg: "bg-destructive/5 border-l-4 border-destructive", dot: "bg-destructive" },
  P1: { label: "P1 优化",  badge: "default",      bg: "bg-orange-50 border-l-4 border-orange-400 dark:bg-orange-950/20",     dot: "bg-orange-400" },
  P2: { label: "P2 调整",  badge: "secondary",    bg: "bg-yellow-50 border-l-4 border-yellow-400 dark:bg-yellow-950/20",    dot: "bg-yellow-400" },
  P3: { label: "P3 结构",  badge: "outline",      bg: "bg-muted/40 border-l-4 border-border",                               dot: "bg-muted-foreground" },
};

const RULE_LABELS: Record<string, string> = {
  "P0-A":    "高点击0转化",
  "P0-B":    "高花费0转化",
  "P0-C":    "超预算高ACoS",
  "P1-A":    "高ACoS降价",
  "P1-B":    "低CTR",
  "P1-C":    "精确词曝光不足",
  "P2-A":    "高效词扩量",
  "P2-B":    "同词自内竞价",
  "P2-C":    "定投高ACoS",
  "P2-D":    "词组曝光不足",
  "P2-E":    "活动持续高ACoS",
  "zombie":  "僵尸广告组",
  "cross_asin": "品类内竞争",
  "P3-A":    "广泛词沉淀精确",
  "P3-B":    "广告组词过多",
};

// ---------------------------------------------------------------------------
// SOP 行动详情展示
// ---------------------------------------------------------------------------

function DetailChip({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5">
      <span className="font-medium text-foreground/70">{label}</span>
      <span>{value}</span>
    </span>
  );
}

function SopActionCard({ action }: { action: SopAction }) {
  const cfg = PRIORITY_CONFIG[action.priority] ?? PRIORITY_CONFIG.P3;
  const d = action.detail;

  const asinShort = action.asin.slice(-5);
  const competingAsins = Array.isArray(d.competingAsins)
    ? (d.competingAsins as string[]).map(a => `…${a.slice(-5)}`).join(" / ")
    : null;

  return (
    <div className={`rounded-md p-3 space-y-2 ${cfg.bg}`}>
      {/* 头部 */}
      <div className="flex items-start gap-2 flex-wrap">
        <Badge variant={cfg.badge} className="text-[10px] shrink-0">
          {cfg.label}
        </Badge>
        <Badge variant="outline" className="text-[10px] shrink-0 font-mono">
          {RULE_LABELS[action.rule] ?? action.rule}
        </Badge>
        <span className="text-[11px] font-mono text-muted-foreground shrink-0">
          …{asinShort}
          {competingAsins && ` / ${competingAsins}`}
        </span>
        {action.matchType && (
          <Badge variant="secondary" className="text-[10px] shrink-0">
            {action.matchType}
          </Badge>
        )}
      </div>

      {/* 搜索词或广告活动 */}
      {action.searchTerm && (
        <p className="text-xs font-medium text-foreground/90 truncate" title={action.searchTerm}>
          {action.searchTerm}
        </p>
      )}
      {!action.searchTerm && action.campaignName && (
        <p className="text-xs font-medium text-foreground/80 truncate" title={action.campaignName}>
          {action.campaignName}
        </p>
      )}

      {/* 关键指标 chips */}
      <div className="flex flex-wrap gap-1">
        {typeof d.clicks      === "number" && <DetailChip label="点击" value={num(d.clicks)} />}
        {typeof d.impressions === "number" && <DetailChip label="曝光" value={num(d.impressions)} />}
        {typeof d.orders      === "number" && <DetailChip label="成交" value={String(d.orders)} />}
        {typeof d.spend       === "number" && <DetailChip label="花费" value={cur(d.spend)} />}
        {typeof d.acos        === "number" && <DetailChip label="ACoS" value={`${d.acos}%`} />}
        {typeof d.ctr         === "number" && <DetailChip label="CTR"  value={`${d.ctr.toFixed(2)}%`} />}
        {typeof d.cvr         === "number" && <DetailChip label="CVR"  value={`${d.cvr.toFixed(1)}%`} />}
        {typeof d.dailySpend  === "number" && <DetailChip label="日均花费" value={cur(d.dailySpend)} />}
        {typeof d.dailyBudget === "number" && <DetailChip label="日预算" value={cur(d.dailyBudget)} />}
        {d.runningDays != null && typeof d.runningDays === "number" && <DetailChip label="运行" value={`${d.runningDays}天`} />}
        {typeof d.uniqueTermCount === "number" && <DetailChip label="去重词数" value={String(d.uniqueTermCount)} />}
        {typeof d.totalSpend  === "number" && <DetailChip label="3月花费" value={cur(d.totalSpend)} />}
      </div>

      {/* 建议 */}
      <p className="text-xs text-foreground/80 leading-relaxed">{action.suggestion}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SOP 行动清单面板
// ---------------------------------------------------------------------------

function SopPanel({ categoryKey }: { categoryKey: string | null }) {
  const url = categoryKey
    ? `/api/features/sop?categoryKey=${categoryKey}`
    : "/api/features/sop";
  const { data, error, isLoading } = useSWR<SopData & { error?: string }>(url, fetcher, swrOptions);

  const [filterPriority, setFilterPriority] = useState<string>("all");

  if (isLoading) return <PanelSkeleton />;

  if (error || data?.error || !data) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <Card className="max-w-sm">
          <CardContent className="text-center space-y-3 py-8">
            <Target size={40} className="mx-auto text-muted-foreground/50" />
            <h3 className="font-semibold text-foreground">暂无行动清单</h3>
            <p className="text-sm text-muted-foreground">
              上传搜索词重构或广告活动重构报表后，SOP 行动清单将自动生成
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const allActions = data.actions ?? [];
  const filtered = filterPriority === "all"
    ? allActions
    : allActions.filter(a => a.priority === filterPriority);

  // 按优先级分组
  const groups = ["P0", "P1", "P2", "P3"] as const;
  const grouped = groups.reduce((acc, p) => {
    acc[p] = filtered.filter(a => a.priority === p);
    return acc;
  }, {} as Record<string, SopAction[]>);

  const priorityCounts: Record<string, number> = {};
  for (const a of allActions) {
    priorityCounts[a.priority] = (priorityCounts[a.priority] ?? 0) + 1;
  }

  return (
    <div className="space-y-4">
      {/* 汇总 + 过滤 */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-muted-foreground">
          快照：{data.snapshotDate} · 共 {data.total} 条行动项
        </p>
        <div className="flex gap-1 flex-wrap">
          {["all", "P0", "P1", "P2", "P3"].map(p => {
            const cnt = p === "all" ? data.total : (priorityCounts[p] ?? 0);
            return (
              <Button
                key={p}
                size="xs"
                variant={filterPriority === p ? "default" : "outline"}
                className="rounded-full text-[11px] h-6 px-2"
                onClick={() => setFilterPriority(p)}
              >
                {p === "all" ? "全部" : p}
                {cnt > 0 && (
                  <span className="ml-1 rounded-full bg-background/20 px-1 text-[10px]">
                    {cnt}
                  </span>
                )}
              </Button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-center text-muted-foreground py-8">该优先级暂无行动项</p>
      )}

      {/* 分组展示 */}
      {groups.map(priority => {
        const items = grouped[priority];
        if (!items || items.length === 0) return null;
        const cfg = PRIORITY_CONFIG[priority];
        return (
          <div key={priority} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              <h3 className="text-sm font-semibold text-foreground">
                {cfg.label}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {items.length} 条
                </span>
              </h3>
            </div>
            <div className="space-y-2 pl-4">
              {items.map(action => (
                <SopActionCard key={action.id} action={action} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 原有广告数据表格
// ---------------------------------------------------------------------------

function CampaignTable({ rows }: { rows: AnyRow[] }) {
  if (rows.length === 0) return (
    <p className="text-sm text-center py-6 text-muted-foreground">暂无广告活动数据</p>
  );
  const cols = ["campaignName", "spend", "sales", "acos", "impressions", "clicks", "orders", "budget"];
  const labels: Record<string, string> = {
    campaignName: "活动名称", spend: "花费", sales: "销售额",
    acos: "ACoS", impressions: "曝光", clicks: "点击", orders: "订单", budget: "预算",
  };
  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted">
            {cols.map((c) => (
              <TableHead key={c} className="text-xs text-muted-foreground font-semibold">
                {labels[c] ?? c}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => {
            const acosVal = typeof row.acos === "number" ? row.acos : parseFloat(String(row.acos));
            const highAcos = !isNaN(acosVal) && acosVal > 0.6;
            return (
              <TableRow key={i}>
                <TableCell
                  className="max-w-[200px] truncate text-xs"
                  title={String(row.campaignName ?? row.campaign_name ?? "")}
                >
                  {row.campaignName ?? row.campaign_name ?? "—"}
                </TableCell>
                <TableCell className="font-mono text-xs">{cur(row.spend)}</TableCell>
                <TableCell className="font-mono text-xs">{cur(row.sales ?? row.ad_sales)}</TableCell>
                <TableCell className={`font-mono text-xs font-medium ${highAcos ? "text-destructive" : ""}`}>
                  {pct(row.acos)}
                </TableCell>
                <TableCell className="font-mono text-xs">{(row.impressions ?? 0).toLocaleString()}</TableCell>
                <TableCell className="font-mono text-xs">{(row.clicks ?? 0).toLocaleString()}</TableCell>
                <TableCell className="font-mono text-xs">{row.orders ?? row.ad_orders ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{row.budget != null ? cur(row.budget) : "—"}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

function SearchTermsTable({ rows }: { rows: AnyRow[] }) {
  if (rows.length === 0) return (
    <p className="text-sm text-center py-6 text-muted-foreground">暂无搜索词数据</p>
  );
  const cols = ["searchTerm", "matchType", "spend", "sales", "acos", "clicks", "orders", "cvr"];
  const labels: Record<string, string> = {
    searchTerm: "搜索词", matchType: "匹配类型", spend: "花费", sales: "销售额",
    acos: "ACoS", clicks: "点击", orders: "订单", cvr: "CVR",
  };
  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted">
            {cols.map((c) => (
              <TableHead key={c} className="text-xs text-muted-foreground font-semibold">
                {labels[c] ?? c}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => {
            const acosVal = typeof row.acos === "number" ? row.acos : parseFloat(String(row.acos));
            const highAcos = !isNaN(acosVal) && acosVal > 0.8;
            return (
              <TableRow key={i}>
                <TableCell className="text-xs max-w-[200px] truncate">
                  {row.searchTerm ?? row.search_term ?? "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  <Badge variant="secondary" className="text-[10px]">
                    {row.matchType ?? row.match_type ?? "—"}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">{cur(row.spend)}</TableCell>
                <TableCell className="font-mono text-xs">{cur(row.sales ?? row.ad_sales)}</TableCell>
                <TableCell className={`font-mono text-xs font-medium ${highAcos ? "text-destructive" : ""}`}>
                  {pct(row.acos)}
                </TableCell>
                <TableCell className="font-mono text-xs">{(row.clicks ?? 0).toLocaleString()}</TableCell>
                <TableCell className="font-mono text-xs">{row.orders ?? row.ad_orders ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{pct(row.cvr ?? row.conversion_rate)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 主组件
// ---------------------------------------------------------------------------

export default function AdsPanel() {
  const { activeNav } = useAppStore();
  const activeCategoryKey = getCategoryKey(activeNav);
  const [view, setView] = useState<View>("sop");

  const adsUrl = activeCategoryKey
    ? `/api/features/ads?source=${view !== "sop" ? view : "campaign_3m"}&categoryKey=${activeCategoryKey}`
    : `/api/features/ads?source=${view !== "sop" ? view : "campaign_3m"}`;
  const { data: adsData, isLoading: adsLoading } = useSWR<AdsData & { error?: string }>(
    view !== "sop" ? adsUrl : null,
    fetcher, swrOptions,
  );

  const { data: scatterRaw } = useSWR<{ data?: Array<{
    term: string; clicks: number; cvr: number; acos: number | null; spend: number; orders: number;
  }> }>("/api/features/search-scatter", fetcher, swrOptions);
  const scatterData = scatterRaw?.data ?? null;

  const viewTabs: { id: View; label: string }[] = [
    { id: "sop",          label: "行动清单" },
    { id: "campaign_3m",  label: "广告活动" },
    { id: "search_terms", label: "搜索词" },
  ];

  return (
    <div className="h-full overflow-y-auto p-6 bg-background">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-muted-foreground" />
          <h1 className="text-lg font-semibold text-foreground">
            {activeCategoryKey ? `${activeCategoryKey} 广告优化` : "广告优化"}
          </h1>
        </div>
        <div className="flex gap-1">
          {viewTabs.map(({ id, label }) => (
            <Button
              key={id}
              size="xs"
              variant={view === id ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setView(id)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* 散点图（搜索词视图时显示） */}
      {view === "search_terms" && scatterData && scatterData.length > 0 && (
        <div className="mb-6">
          <SearchScatterChart data={scatterData} />
        </div>
      )}

      {/* 内容区 */}
      {view === "sop" && (
        <SopPanel categoryKey={activeCategoryKey} />
      )}

      {view !== "sop" && (
        <>
          {adsLoading && <PanelSkeleton />}
          {!adsLoading && adsData && (
            <>
              <p className="text-xs text-muted-foreground mb-3">
                快照：{adsData.snapshotDate} · {adsData.total} 条记录
              </p>
              {view === "campaign_3m"
                ? <CampaignTable    rows={adsData.rows} />
                : <SearchTermsTable rows={adsData.rows} />
              }
            </>
          )}
        </>
      )}
    </div>
  );
}
