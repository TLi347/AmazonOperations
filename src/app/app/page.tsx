import AppInitializer from "@/components/layout/AppInitializer";
import ProductRail from "@/components/layout/ProductRail";
import FunctionPanel from "@/components/layout/FunctionPanel";
import MainPanel from "@/components/layout/MainPanel";

export default function AppPage() {
  return (
    <AppInitializer>
      <div className="flex" style={{ height: "100vh", overflow: "hidden" }}>
        <ProductRail />
        <FunctionPanel />
        <MainPanel />
      </div>
    </AppInitializer>
  );
}
