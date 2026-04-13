"use client";

import { useEffect, useState } from "react";
import { useAppStore, getCategoryKey } from "@/store/appStore";
import { AlertTriangle, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PanelSkeleton } from "@/components/ui/panel-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";

type Source = "campaign_3m" | "search_terms";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface AdsData {
  source:       string;
  snapshotDate: string;
  total:        number;
  rows:         AnyRow[];
}

function pct(v: unknown): string {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isNaN(n) ? "—" : `${(n * 100).toFixed(1)}%`;
}
function cur(v: unknown): string {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isNaN(n) ? "—" : `$${n.toFixed(2)}`;
}

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

export default function AdsPanel() {
  const { activeNav } = useAppStore();
  const activeCategoryKey = getCategoryKey(activeNav);
  const [source, setSource]   = useState<Source>("campaign_3m");
  const [data, setData]       = useState<AdsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setData(null);
    const params = new URLSearchParams({ source });
    if (activeCategoryKey) params.set("categoryKey", activeCategoryKey);
    fetch(`/api/features/ads?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error as string); return; }
        setData(d as AdsData);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [activeCategoryKey, source]);

  return (
    <div className="h-full overflow-y-auto p-6 bg-background">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            {activeCategoryKey ? `${activeCategoryKey} 广告监控` : "广告监控"}
          </h1>
          {data && (
            <p className="text-xs mt-0.5 text-muted-foreground">
              快照：{data.snapshotDate} · {data.total} 条记录
            </p>
          )}
        </div>
        <div className="flex gap-1">
          {([
            { id: "campaign_3m",  label: "广告活动重构" },
            { id: "search_terms", label: "搜索词重构" },
          ] as const).map(({ id, label }) => (
            <Button
              key={id}
              size="xs"
              variant={source === id ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setSource(id)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {loading && <PanelSkeleton />}

      {!loading && error && (
        <div className="flex items-center justify-center h-full p-8">
          <Card className="max-w-sm">
            <CardContent className="text-center space-y-3 py-8">
              <Target size={40} className="mx-auto text-muted-foreground/50" />
              <h3 className="font-semibold text-foreground">暂无数据</h3>
              <p className="text-sm text-muted-foreground">
                上传搜索词或广告活动报表后，优化建议将自动生成
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {!loading && data && (
        source === "campaign_3m"
          ? <CampaignTable    rows={data.rows} />
          : <SearchTermsTable rows={data.rows} />
      )}
    </div>
  );
}
