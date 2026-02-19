import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export const runtime = "nodejs";

function toNum(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toSafeLimit(v: string | null, fallback = 2000) {
  const n = Math.floor(toNum(v, fallback));
  return Math.max(1, Math.min(n, 5000));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const minLat = toNum(searchParams.get("minLat"), -90);
  const maxLat = toNum(searchParams.get("maxLat"), 90);
  const minLng = toNum(searchParams.get("minLng"), -180);
  const maxLng = toNum(searchParams.get("maxLng"), 180);

  const limit = toSafeLimit(searchParams.get("limit"), 2000);

  const pool = getPool();

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
    LIMIT ${limit}
  `;

  const [rows]: any = await pool.execute(sql, [minLat, maxLat, minLng, maxLng]);

  return NextResponse.json({ ok: true, count: rows.length, data: rows });
}
