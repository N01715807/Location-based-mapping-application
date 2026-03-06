import WaterResourcesMap from "@/components/WaterResourcesMap";
import LoginModal from "@/components/LoginModal";
import WellsList from "@/components/WellsList";
import UsageLogModal from "@/components/UsageLogModal";
import Footer from "@/components/Footer";

export default function DashboardPage() {
  return (
    <main className="page-container">
      <div className="header">
        <h1 className="header-title">
          <span>WATER</span> Resource Mapper
        </h1>

        <LoginModal />
      </div>

      <div className="map-shell">
        <div className="map-card">
          <WaterResourcesMap />
        </div>
      </div>

      <section className="usage-log-section">
        <div className="usage-log-inner">
          <UsageLogModal />
        </div>
      </section>

      <div className="list-section">
        <WellsList />
      </div>

      <div className="map-helper-fixed">
        <img
          src="/marker-available.png"
          alt="Available water resource marker"
          className="map-helper-icon"
        />
        <div className="map-helper-text">
          Explore nearby water wells on the map, or search the list below to find a specific well.
        </div>
      </div>

      <Footer />
    </main>
  );
}