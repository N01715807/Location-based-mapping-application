import WaterResourcesMap from "@/components/WaterResourcesMap";
import WellsList from "@/components/WellsList";

export default function DashboardPage() {
  return (
    <main style={{ padding: 16 }}>
      <h1>Water Resources Map</h1>
      <WaterResourcesMap />
      <WellsList />
    </main>
  );
}