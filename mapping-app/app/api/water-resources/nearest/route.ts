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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const lat = toNum(searchParams.get("lat"), NaN);
    const lng = toNum(searchParams.get("lng"), NaN);
    const limit = Math.max(1, Math.min(toInt(searchParams.get("limit"), 5), 20));

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ ok: false, error: "lat/lng required" }, { status: 400 });
    }

    // 先用 bbox 缩小候选范围（性能）
    const km = 300;
    const dLat = km / 111;
    const dLng = km / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));

    const minLat = lat - dLat;
    const maxLat = lat + dLat;
    const minLng = lng - dLng;
    const maxLng = lng + dLng;

    const pool = getPool();

    const sql = `
      SELECT
        id,
        name,
        type,
        latitude,
        longitude,
        is_available AS available,
        status,
        (6371 * 2 * ASIN(SQRT(
          POW(SIN(RADIANS(latitude - ?) / 2), 2) +
          COS(RADIANS(?)) * COS(RADIANS(latitude)) *
          POW(SIN(RADIANS(longitude - ?) / 2), 2)
        ))) AS distance_km
      FROM water_resources
      WHERE is_deleted = 0
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL
        AND latitude BETWEEN ? AND ?
        AND longitude BETWEEN ? AND ?
      ORDER BY distance_km ASC
      LIMIT ?
    `;

    const [rows]: any = await pool.query(sql, [
      lat,
      lat,
      lng,
      minLat,
      maxLat,
      minLng,
      maxLng,
      limit,
    ]);

    return NextResponse.json({ ok: true, mode: "wells", data: rows });
  } catch (e: any) {
    console.error("nearest error:", e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}