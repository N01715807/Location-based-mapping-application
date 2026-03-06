import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export const runtime = "nodejs";

function toNum(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const lat = toNum(searchParams.get("lat"), NaN);
    const lng = toNum(searchParams.get("lng"), NaN);
    const radiusKm = Math.max(1, Math.min(toNum(searchParams.get("radiusKm"), 20), 100));

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json(
        { ok: false, error: "lat/lng required" },
        { status: 400 }
      );
    }

    const dLat = radiusKm / 111;
    const dLng = radiusKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));

    const minLat = lat - dLat;
    const maxLat = lat + dLat;
    const minLng = lng - dLng;
    const maxLng = lng + dLng;

    const pool = getPool();

    const sql = `
      SELECT *
      FROM (
        SELECT
          source_objectid AS id,

          COALESCE(
            NULLIF(JSON_UNQUOTE(JSON_EXTRACT(raw_attributes, '$.WellName')), ''),
            NULLIF(JSON_UNQUOTE(JSON_EXTRACT(raw_attributes, '$.cLandLocationDisplay')), ''),
            NULLIF(JSON_UNQUOTE(JSON_EXTRACT(raw_attributes, '$.cHoleNumber')), ''),
            CONCAT('Well #', source_objectid)
          ) AS name,

          JSON_UNQUOTE(JSON_EXTRACT(raw_attributes, '$.cHoleNumber')) AS hole_number,
          JSON_UNQUOTE(JSON_EXTRACT(raw_attributes, '$.cLandLocationDisplay')) AS land_location,

          CAST(JSON_UNQUOTE(JSON_EXTRACT(raw_attributes, '$.nBoreHoleDepthInFeet')) AS DECIMAL(12,2)) AS borehole_depth,
          CAST(JSON_UNQUOTE(JSON_EXTRACT(raw_attributes, '$.nWaterLevel')) AS DECIMAL(12,2)) AS water_level,
          CAST(JSON_UNQUOTE(JSON_EXTRACT(raw_attributes, '$.nPumpingRate')) AS DECIMAL(12,2)) AS pumping_rate,
          CAST(JSON_UNQUOTE(JSON_EXTRACT(raw_attributes, '$.nRecommendedPumpingRate')) AS DECIMAL(12,2)) AS recommended_pumping_rate,

          CAST(JSON_UNQUOTE(JSON_EXTRACT(raw_geometry, '$.y')) AS DECIMAL(10,7)) AS latitude,
          CAST(JSON_UNQUOTE(JSON_EXTRACT(raw_geometry, '$.x')) AS DECIMAL(10,7)) AS longitude,

          (
            6371 * 2 * ASIN(SQRT(
              POW(SIN(RADIANS(CAST(JSON_UNQUOTE(JSON_EXTRACT(raw_geometry, '$.y')) AS DECIMAL(10,7)) - ?) / 2), 2) +
              COS(RADIANS(?)) *
              COS(RADIANS(CAST(JSON_UNQUOTE(JSON_EXTRACT(raw_geometry, '$.y')) AS DECIMAL(10,7)))) *
              POW(SIN(RADIANS(CAST(JSON_UNQUOTE(JSON_EXTRACT(raw_geometry, '$.x')) AS DECIMAL(10,7)) - ?) / 2), 2)
            ))
          ) AS distance_km

        FROM water_resources_source
        WHERE is_deleted = 0
          AND JSON_EXTRACT(raw_geometry, '$.x') IS NOT NULL
          AND JSON_EXTRACT(raw_geometry, '$.y') IS NOT NULL
          AND CAST(JSON_UNQUOTE(JSON_EXTRACT(raw_geometry, '$.y')) AS DECIMAL(10,7)) BETWEEN ? AND ?
          AND CAST(JSON_UNQUOTE(JSON_EXTRACT(raw_geometry, '$.x')) AS DECIMAL(10,7)) BETWEEN ? AND ?
          AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(raw_attributes, '$.cDecommisioned')), '0') <> '1'
          AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(raw_attributes, '$.dDateDecommisioned')), '') IN ('', 'null', '1900.01.01')
          AND (
            COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(raw_attributes, '$.nRecommendedPumpingRate')) AS DECIMAL(12,2)), 0) > 0
            OR COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(raw_attributes, '$.nPumpingRate')) AS DECIMAL(12,2)), 0) > 0
            OR COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(raw_attributes, '$.nWaterLevel')) AS DECIMAL(12,2)), 0) > 0
            OR COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(raw_attributes, '$.nBoreHoleDepthInFeet')) AS DECIMAL(12,2)), 0) > 0
          )
      ) t
      WHERE t.distance_km <= ?
      ORDER BY t.distance_km ASC
    `;

    const [rows]: any = await pool.query(sql, [
      lat,
      lat,
      lng,
      minLat,
      maxLat,
      minLng,
      maxLng,
      radiusKm,
    ]);

    return NextResponse.json({
      ok: true,
      mode: "wells",
      radiusKm,
      count: rows.length,
      data: rows.map((r: any) => ({
        id: Number(r.id),
        name: r.name ?? null,
        hole_number: r.hole_number ?? null,
        land_location: r.land_location ?? null,
        borehole_depth: r.borehole_depth != null ? Number(r.borehole_depth) : null,
        water_level: r.water_level != null ? Number(r.water_level) : null,
        pumping_rate: r.pumping_rate != null ? Number(r.pumping_rate) : null,
        recommended_pumping_rate:
          r.recommended_pumping_rate != null ? Number(r.recommended_pumping_rate) : null,
        latitude: r.latitude != null ? Number(r.latitude) : null,
        longitude: r.longitude != null ? Number(r.longitude) : null,
        distance_km: r.distance_km != null ? Number(r.distance_km) : null,
        available: true,
        status: "useful",
      })),
    });
  } catch (e: any) {
    console.error("nearest error:", e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}