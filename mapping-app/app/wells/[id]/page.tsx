import { getPool } from "@/lib/db";
import WellWeatherCard from "@/components/WellWeatherCard";

export const runtime = "nodejs";

type KV = { label: string; key: string; unit?: string };

function isMeaningful(v: any) {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return false;
    if (s.toLowerCase() === "none" || s.toLowerCase() === "null") return false;
    return true;
  }
  if (typeof v === "number") {
    return v !== 0 && Number.isFinite(v);
  }
  return true;
}

function pickMeaningful(attrs: any, fields: KV[]) {
  const out: Array<{ label: string; value: any; unit?: string }> = [];
  for (const f of fields) {
    const v = attrs?.[f.key];
    if (isMeaningful(v)) out.push({ label: f.label, value: v, unit: f.unit });
  }
  return out;
}

export default async function WellDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = await params;
  const id = Number(idStr);

  if (!Number.isFinite(id)) return <main>Invalid well id</main>;

  const pool = getPool();

  const sql = `
    SELECT
      source_objectid AS id,
      JSON_UNQUOTE(JSON_EXTRACT(raw_attributes, '$.WellName')) AS name,
      JSON_UNQUOTE(JSON_EXTRACT(raw_attributes, '$.cHoleNumber')) AS holeNumber,
      JSON_UNQUOTE(JSON_EXTRACT(raw_attributes, '$.cLandLocationDisplay')) AS landLocation,
      latitude,
      longitude,
      raw_attributes
    FROM water_resources_source
    WHERE is_deleted = 0 AND source_objectid = ?
    LIMIT 1
  `;

  const [rows]: any = await pool.query(sql, [id]);
  const r = rows?.[0];
  if (!r) return <main>Not found</main>;

  const attrs = r.raw_attributes ?? {};
  const lat = Number(r.latitude);
  const lng = Number(r.longitude);

  const overviewFields: KV[] = [
    { key: "dCompleted", label: "Completed date" },
    { key: "cwelluse", label: "Well use / type" },
    { key: "cwateruse", label: "Water use" },
    { key: "cinstmethd", label: "Installation method" },
    { key: "cDrillerName", label: "Driller" },
    { key: "nelevation", label: "Elevation", unit: "ft" }, 
    { key: "cUtmZone", label: "UTM zone" },
    { key: "nUtmEasting", label: "UTM easting" },
    { key: "nUtmNorthing", label: "UTM northing" },
  ];

  const hydroFields: KV[] = [
    { key: "nBoreHoleDepthInFeet", label: "Borehole depth", unit: "ft" },
    { key: "nBitDiameter", label: "Bit diameter" },
    { key: "nWaterLevel", label: "Water level" },
    { key: "ndrawdown", label: "Drawdown" },
    { key: "nduration", label: "Duration" },
    { key: "nPumpingRate", label: "Pumping rate" },
    { key: "nRecommendedPumpingRate", label: "Recommended pumping rate" },
    { key: "nFlowingHead", label: "Flowing head" },
    { key: "nTemperature", label: "Water temperature" },
  ];

  const overview = pickMeaningful(attrs, overviewFields);
  const hydro = pickMeaningful(attrs, hydroFields);

  return (
    <main>
      <h1>{r.name || `Well ${r.id}`}</h1>

      <h2>Basic info</h2>
      <table>
        <tbody>
          <tr><td>ID</td><td>{r.id}</td></tr>
          <tr><td>Hole number</td><td>{r.holeNumber || "-"}</td></tr>
          <tr><td>Land location</td><td>{r.landLocation || "-"}</td></tr>
          <tr><td>Latitude</td><td>{Number.isFinite(lat) ? lat : "-"}</td></tr>
          <tr><td>Longitude</td><td>{Number.isFinite(lng) ? lng : "-"}</td></tr>
        </tbody>
      </table>

      <h2>Well details (only meaningful values)</h2>
      {overview.length === 0 ? (
        <div>No additional details available.</div>
      ) : (
        <table>
          <tbody>
            {overview.map((x) => (
              <tr key={x.label}>
                <td>{x.label}</td>
                <td>{String(x.value)}{x.unit ? ` ${x.unit}` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Hydrology / physical (only meaningful values)</h2>
      {hydro.length === 0 ? (
        <div>No hydrology measurements recorded for this well.</div>
      ) : (
        <table>
          <tbody>
            {hydro.map((x) => (
              <tr key={x.label}>
                <td>{x.label}</td>
                <td>{String(x.value)}{x.unit ? ` ${x.unit}` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {Number.isFinite(lat) && Number.isFinite(lng) && <WellWeatherCard lat={lat} lng={lng} />}
    </main>
  );
}