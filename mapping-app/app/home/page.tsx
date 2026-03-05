import WaterResourcesMap from "@/components/WaterResourcesMap";
import WellsList from "@/components/WellsList";
import UsageLogModal from "@/components/UsageLogModal";

export default function DashboardPage() {
  return (
    <main className="page-container">

      <div className="header">
        <h1 className="header-title">
          <span>WATER</span> Resource Mapper
        </h1>
      </div>

      <div className="map-shell">
        <div className="map-card">
          <WaterResourcesMap />
          </div></div>

      <UsageLogModal />

      <div className="list-section">
        <WellsList />
      </div>

    </main>
  );
}