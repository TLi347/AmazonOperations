"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/appStore";
import { MOCK_PRODUCTS } from "@/lib/mockData";

export default function AppInitializer({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    setProducts,
    setAlerts,
    setMetricsForProduct,
    setInventoryForProduct,
    setFilesForProduct,
  } = useAppStore();

  useEffect(() => {
    // ── 1. Immediate: load product list; metrics/alerts start empty until files are uploaded
    setProducts(MOCK_PRODUCTS);

    // ── 2. Async: try loading from DB; silently fall back if no DB
    (async () => {
      try {
        // Products (pass dummy productId — API ignores it for type=products)
        const prodRes  = await fetch("/api/data?productId=_&type=products");
        const prodData = await prodRes.json() as unknown;

        // { error: "no_db" } means DATABASE_URL not set → keep mock data
        if (
          !Array.isArray(prodData) ||
          (prodData as { error?: string }[]).length === 0
        ) return;

        const dbProducts = prodData as typeof MOCK_PRODUCTS;
        setProducts(dbProducts);

        // Per-product data
        await Promise.all(
          dbProducts.map(async (p) => {
            const [metricsRes, invRes, filesRes, alertsRes] = await Promise.all([
              fetch(`/api/data?productId=${p.id}&type=metrics`),
              fetch(`/api/data?productId=${p.id}&type=inventory`),
              fetch(`/api/data?productId=${p.id}&type=files`),
              fetch(`/api/data?productId=${p.id}&type=alerts`),
            ]);

            const [metrics, inventory, files, alerts] = await Promise.all([
              metricsRes.json() as Promise<unknown>,
              invRes.json()     as Promise<unknown>,
              filesRes.json()   as Promise<unknown>,
              alertsRes.json()  as Promise<unknown>,
            ]);

            if (metrics && typeof metrics === "object" && !("error" in (metrics as object))) {
              setMetricsForProduct(p.id, metrics as Parameters<typeof setMetricsForProduct>[1]);
            }
            if (Array.isArray(inventory)) {
              setInventoryForProduct(p.id, inventory as Parameters<typeof setInventoryForProduct>[1]);
            }
            if (Array.isArray(files)) {
              setFilesForProduct(p.id, files as Parameters<typeof setFilesForProduct>[1]);
            }
            if (Array.isArray(alerts)) {
              // Merge DB alerts with existing (setAlerts replaces all — use a simple approach)
              const currentAlerts = useAppStore.getState().alerts;
              const withoutProduct = currentAlerts.filter((a) => a.productId !== p.id);
              setAlerts([...withoutProduct, ...(alerts as typeof currentAlerts)]);
            }
          })
        );
      } catch {
        // Network error or parse error — keep mock data silently
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}
