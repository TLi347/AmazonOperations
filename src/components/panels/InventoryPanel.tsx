"use client";

import { useEffect, useState } from "react";
import { useAppStore, getCategoryKey } from "@/store/appStore";
import { AlertTriangle, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PanelSkeleton } from "@/components/ui/panel-skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface InventoryData {
  snapshotDate: string;
  total:        number;
  rows:         AnyRow[];
}

function getStockLevel(row: AnyRow): "critical" | "warning" | "ok" {
  const days = row.daysOfSupply ?? row.days_of_supply ?? row.inventoryDays ?? null;
  if (days == null) return "ok";
  if (days <= 30) return "critical";
  if (days <= 45) return "warning";
  return "ok";
}

const STOCK_BADGE: Record<string, { variant: "destructive" | "outline"; className: string; label: string }> = {
  critical: { variant: "destructive", className: "",                                                    label: "危险" },
  warning:  { variant: "outline",     className: "bg-amber-100 text-amber-800 border-amber-200",       label: "注意" },
  ok:       { variant: "outline",     className: "bg-emerald-100 text-emerald-800 border-emerald-200", label: "健康" },
};

const STOCK_TEXT: Record<string, string> = {
  critical: "text-destructive",
  warning:  "text-amber-600",
  ok:       "text-emerald-600",
};

export default function InventoryPanel() {
  const { activeNav } = useAppStore();
  const activeCategoryKey = getCategoryKey(activeNav);
  const [data, setData]       = useState<InventoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (activeCategoryKey) params.set("categoryKey", activeCategoryKey);
    fetch(`/api/features/inventory?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error as string); return; }
        setData(d as InventoryData);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [activeCategoryKey]);

  return (
    <div className="h-full overflow-y-auto p-6 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            {activeCategoryKey ? `${activeCategoryKey} 库存管理` : "库存管理"}
          </h1>
          {data && (
            <p className="text-xs mt-0.5 text-muted-foreground">
              快照：{data.snapshotDate} · {data.total} 条记录
            </p>
          )}
        </div>
        <Package size={20} className="text-muted-foreground" />
      </div>

      {loading && <PanelSkeleton />}

      {!loading && error && (
        <div className="flex items-center justify-center h-full p-8">
          <Card className="max-w-sm">
            <CardContent className="text-center space-y-3 py-8">
              <Package size={40} className="mx-auto text-muted-foreground/50" />
              <h3 className="font-semibold text-foreground">暂无数据</h3>
              <p className="text-sm text-muted-foreground">
                上传库存报表后，库存健康状况将自动分析
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {!loading && data && data.rows.length === 0 && (
        <div className="flex items-center justify-center h-full p-8">
          <Card className="max-w-sm">
            <CardContent className="text-center space-y-3 py-8">
              <Package size={40} className="mx-auto text-muted-foreground/50" />
              <h3 className="font-semibold text-foreground">暂无数据</h3>
              <p className="text-sm text-muted-foreground">
                上传库存报表后，库存健康状况将自动分析
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {!loading && data && data.rows.length > 0 && (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted">
                {[
                  "ASIN / SKU", "可售数量", "在途数量", "可售天数",
                  "日均销量", "建议补货", "状态",
                ].map((h) => (
                  <TableHead key={h} className="text-xs text-muted-foreground font-semibold">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row, i) => {
                const level = getStockLevel(row);
                const badgeStyle = STOCK_BADGE[level];
                const textClass = STOCK_TEXT[level];
                const sku   = row.asin ?? row.sku ?? row.fnsku ?? `row-${i}`;
                const avail = row.availableQty ?? row.available_qty ?? row.availableUnits ?? "—";
                const inbound = row.inboundQty ?? row.inbound_qty ?? row.inboundUnits ?? "—";
                const days  = row.daysOfSupply ?? row.days_of_supply ?? row.inventoryDays ?? "—";
                const daily = row.dailySales ?? row.daily_sales ?? row.avgDailySales ?? "—";
                const restock = row.restockQty ?? row.restock_qty ?? row.suggestedRestock ?? "—";
                return (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{sku}</TableCell>
                    <TableCell className="font-mono text-sm font-medium">
                      {typeof avail === "number" ? avail.toLocaleString() : avail}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {typeof inbound === "number" ? inbound.toLocaleString() : inbound}
                    </TableCell>
                    <TableCell>
                      {typeof days === "number" ? (
                        <div className="flex items-center gap-2">
                          <Progress
                            value={Math.min((days / 90) * 100, 100)}
                            className={cn(
                              "h-2 w-16",
                              days < 30 ? "[&>div]:bg-destructive" :
                              days < 45 ? "[&>div]:bg-amber-500" :
                              "[&>div]:bg-emerald-500"
                            )}
                          />
                          <span className={cn("font-mono text-xs font-semibold", textClass)}>
                            {days}天
                          </span>
                        </div>
                      ) : (
                        <span className="font-mono text-sm text-muted-foreground">{days}</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {typeof daily === "number" ? daily.toFixed(1) : daily}
                    </TableCell>
                    <TableCell className="font-mono text-sm font-medium">
                      {typeof restock === "number" ? restock.toLocaleString() : restock}
                    </TableCell>
                    <TableCell>
                      <Badge variant={badgeStyle.variant} className={badgeStyle.className}>
                        {badgeStyle.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
