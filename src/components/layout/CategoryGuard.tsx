"use client";

import { useAppStore, getCategoryKey } from "@/store/appStore";

/** Renders children only when a category (not overview/chat) is active. */
export default function CategoryGuard({ children }: { children: React.ReactNode }) {
  const { activeNav } = useAppStore();
  if (!getCategoryKey(activeNav)) return null;
  return <>{children}</>;
}
