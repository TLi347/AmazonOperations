"use client";

import { useEffect, useState } from "react";
import { useAppStore, getCategoryKey } from "@/store/appStore";
import { AlertTriangle, BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PanelSkeleton } from "@/components/ui/panel-skeleton";
import { Button } from "@/components/ui/button";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";

type Window = "today" | "yesterday" | "w7" | "w14" | "d30";

interface AsinRow {
  asin:        string;
  gmv:         number;
  orders:      number;
  units:       number;
  ad_spend:    number;
  ad_sales:    number;
  ad_orders:   number;
  impressions: number;
  clicks:      number;
  sessions:    number;
  acos:        number | null;
  tacos:       number | null;
  ctr:         number | null;
  cvr:         number | null;
  cpc:         number | null;
  roas:        number | null;
}

interface KPIData {
  period:      string;
  window:      string;
  categoryKey: string;
  total:       AsinRow;
  byAsin:      AsinRow[];
}

function pct(v: number | null): string {
  return v != null ? `${(v * 100).toFixed(1)}%` : "—";
}
function cur(v: number): string {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function num(v: number): string {
  return v.toLocaleString("en-US");
}

const WINDOWS: { id: Window; label: string }[] = [
  { id: "today",     label: "今天"   },
  { id: "yesterday", label: "昨天"   },
  { id: "w7",        label: "近7天"  },
  { id: "w14",       label: "近14天" },
  { id: "d30",       label: "近30天" },
];

export default function KPIPanel() {
  const { activeNav } = useAppStore();
  const activeCategoryKey = getCategoryKey(activeNav);
  const [window, setWindow]   = useState<Window>("w7");
  const [data, setData]       = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ window });
    if (activeCategoryKey) params.set("categoryKey", activeCategoryKey);
    fetch(`/api/features/kpi?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error as string); return; }
        setData(d as KPIData);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [activeCategoryKey, window]);

  return (
    <div className="h-full overflow-y-auto p-6 bg-background">
      {/* Header + window switcher */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            {activeCategoryKey ? `${activeCategoryKey} KPI` : "全品类 KPI"}
          </h1>
          {data && <p className="text-xs mt-0.5 text-muted-foreground">{data.period}</p>}
        </div>
        <div className="flex gap-1">
          {WINDOWS.map(({ id, label }) => (
            <Button
              key={id}
              size="xs"
              variant={window === id ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setWindow(id)}
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
              <BarChart3 size={40} className="mx-auto text-muted-foreground/50" />
              <h3 className="font-semibold text-foreground">暂无数据</h3>
              <p className="text-sm text-muted-foreground">
                上传产品报表后，KPI 汇总将自动计算
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {!loading && data && (
        <>
          {/* Total summary row */}
          <Card className="bg-foreground text-background mb-6 ring-0">
            <CardContent className="grid grid-cols-6 gap-4">
              {[
                { label: "GMV",    value: cur(data.total.gmv)                                        },
                { label: "订单量",  value: num(data.total.orders)                                    },
                { label: "广告花费", value: cur(data.total.ad_spend)                                 },
                { label: "ACoS",   value: pct(data.total.acos), warn: (data.total.acos ?? 0) > 0.5  },
                { label: "CTR",    value: pct(data.total.ctr)                                        },
                { label: "ROAS",   value: data.total.roas != null ? data.total.roas.toFixed(2) : "—" },
              ].map(({ label, value, warn }) => (
                <div key={label}>
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  <p className={`text-lg font-bold font-mono ${warn ? "text-red-300" : ""}`}>{value}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Per-ASIN table */}
          {data.byAsin.length === 0 ? (
            <p className="text-center text-sm py-10 text-muted-foreground">无 ASIN 数据</p>
          ) : (
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted">
                    {["ASIN", "GMV", "订单", "广告花费", "ACoS", "TACoS", "CTR", "CVR", "CPC", "ROAS"].map((h) => (
                      <TableHead key={h} className="text-xs text-muted-foreground font-semibold">
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byAsin.map((row) => (
                    <TableRow key={row.asin}>
                      <TableCell className="font-mono text-xs">{row.asin}</TableCell>
                      <TableCell className="font-mono text-sm font-medium">{cur(row.gmv)}</TableCell>
                      <TableCell className="font-mono text-sm">{num(row.orders)}</TableCell>
                      <TableCell className="font-mono text-sm">{cur(row.ad_spend)}</TableCell>
                      <TableCell className={`font-mono text-sm font-medium ${row.acos != null && row.acos > 0.5 ? "text-destructive" : ""}`}>
                        {pct(row.acos)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{pct(row.tacos)}</TableCell>
                      <TableCell className="font-mono text-sm">{pct(row.ctr)}</TableCell>
                      <TableCell className="font-mono text-sm">{pct(row.cvr)}</TableCell>
                      <TableCell className="font-mono text-sm">{row.cpc != null ? `$${row.cpc}` : "—"}</TableCell>
                      <TableCell className="font-mono text-sm">{row.roas != null ? row.roas.toFixed(2) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
