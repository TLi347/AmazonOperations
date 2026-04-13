import AppInitializer  from "@/components/layout/AppInitializer";
import ProductRail     from "@/components/layout/ProductRail";
import FunctionPanel   from "@/components/layout/FunctionPanel";
import MainPanel       from "@/components/layout/MainPanel";
import ContextPanel    from "@/components/layout/ContextPanel";
import CategoryGuard   from "@/components/layout/CategoryGuard";
import { Toaster }     from "@/components/ui/sonner";

export default function AppPage() {
  return (
    <AppInitializer>
      <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#f5f6f8" }}>
        {/* Left sidebar — always visible */}
        <ProductRail />

        {/* Function tabs — only when a category is active */}
        <CategoryGuard>
          <FunctionPanel />
        </CategoryGuard>

        {/* Main content area */}
        <MainPanel />

        {/* Right context panel — always visible, collapsible */}
        <ContextPanel />
      </div>
      <Toaster position="top-right" richColors />
    </AppInitializer>
  );
}
