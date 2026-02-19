import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export const runtime = "nodejs";

function num(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const minLat = num(searchParams.get("minLat"), -90);
  const maxLat = num(searchParams.get("maxLat"), 90);
  const minLng = num(searchParams.get("minLng"), -180);
  const maxLng = num(searchParams.get("maxLng"), 180);

  const limit = Math.min(num(searchParams.get("limit"), 2000), 5000);

  const pool = getPool();

  const [rows]: any = await pool.execute(
    `
    SELECT
      source_objectid AS id,
      JSON_UNQUOTE(JSON_EXTRACT(raw_attributes, '$.WellName')) AS name,
      latitude,
      longitude
    FROM water_resources_source
    WHERE is_deleted = 0
      AND latitude BETWEEN ? AND ?
      AND longitude BETWEEN ? AND ?
    LIMIT ?
    `,
    [minLat, maxLat, minLng, maxLng, limit]
  );

  return NextResponse.json({ ok: true, count: rows.length, data: rows });
}
