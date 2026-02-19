import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export const runtime = "nodejs";

function toNum(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toInt(v: string | null, fallback: number) {
  const n = Math.floor(toNum(v, fallback));
  return Number.isFinite(n) ? n : fallback;
}

function toSafeLimit(v: string | null, fallback = 2000, max = 5000) {
  const n = Math.floor(toNum(v, fallback));
  return Math.max(1, Math.min(n, max));
}

function cellSizeByZoom(z: number) {
  if (z <= 6) return 0.8;
  if (z <= 8) return 0.3;
  if (z <= 10) return 0.12;
  if (z <= 12) return 0.05;
  return 0.01;
}

function normalizeMinMax(a: number, b: number): [number, number] {
  return a <= b ? [a, b] : [b, a];
}

const NOT_DECOMMISSIONED_WHERE = `
  AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(raw_attributes, '$.cDecommisioned')), '0') <> '1'
  AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(raw_attributes, '$.dDateDecommisioned')), 'null') IN ('null', '', '1900.01.01')
`;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  let minLat = toNum(searchParams.get("minLat"), -90);
  let maxLat = toNum(searchParams.get("maxLat"), 90);
  let minLng = toNum(searchParams.get("minLng"), -180);
  let maxLng = toNum(searchParams.get("maxLng"), 180);

  [minLat, maxLat] = normalizeMinMax(minLat, maxLat);
  [minLng, maxLng] = normalizeMinMax(minLng, maxLng);

  const zoom = toInt(searchParams.get("zoom"), 0);

  const limit =
    zoom < 13
      ? toSafeLimit(searchParams.get("limit"), 200, 1200)
      : toSafeLimit(searchParams.get("limit"), 600, 1500);

  const pool = getPool();

  if (zoom < 13) {
    const cell = cellSizeByZoom(zoom);

    const sql = `
      SELECT
        (FLOOR(latitude / ?) * ?) AS lat_cell,
        (FLOOR(longitude / ?) * ?) AS lng_cell,
        AVG(latitude)  AS lat,
        AVG(longitude) AS lng,
        COUNT(*)       AS count
      FROM water_resources_source
      WHERE is_deleted = 0
        AND latitude BETWEEN ? AND ?
        AND longitude BETWEEN ? AND ?
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL
        ${NOT_DECOMMISSIONED_WHERE}
      GROUP BY lat_cell, lng_cell
      LIMIT ${limit}
    `;

    const params = [cell, cell, cell, cell, minLat, maxLat, minLng, maxLng];

    const [rows]: any = await pool.query(sql, params);

    return NextResponse.json({
      ok: true,
      mode: "cluster",
      zoom,
      cell,
      count: rows.length,
      data: rows.map((r: any) => ({
        lat: Number(r.lat),
        lng: Number(r.lng),
        count: Number(r.count),
      })),
    });
  }

  const sql = `
    SELECT
      source_objectid AS id,
      JSON_UNQUOTE(JSON_EXTRACT(raw_attributes, '$.WellName')) AS name,
      latitude,
      longitude
    FROM water_resources_source
    WHERE is_deleted = 0
      AND latitude BETWEEN ? AND ?
      AND longitude BETWEEN ? AND ?
      AND latitude IS NOT NULL
      AND longitude IS NOT NULL
      ${NOT_DECOMMISSIONED_WHERE}
    LIMIT ${limit}
  `;

  const params = [minLat, maxLat, minLng, maxLng];

  const [rows]: any = await pool.query(sql, params);

  return NextResponse.json({
    ok: true,
    mode: "wells",
    zoom,
    count: rows.length,
    data: rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      status: null,
    })),
  });
}
