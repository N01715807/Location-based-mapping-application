import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export const runtime = "nodejs";

function toNum(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function normalizeMinMax(a: number, b: number): [number, number] {
  return a <= b ? [a, b] : [b, a];
}

const NOT_DECOMMISSIONED_COND = `
  COALESCE(JSON_UNQUOTE(JSON_EXTRACT(raw_attributes, '$.cDecommisioned')), '0') <> '1'
  AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(raw_attributes, '$.dDateDecommisioned')), 'null') IN ('null', '', '1900.01.01')
`;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const q = (searchParams.get("q") || "").trim();

  const hasBounds =
    searchParams.has("minLat") &&
    searchParams.has("maxLat") &&
    searchParams.has("minLng") &&
    searchParams.has("maxLng");

  let minLat = toNum(searchParams.get("minLat"), -90);
  let maxLat = toNum(searchParams.get("maxLat"), 90);
  let minLng = toNum(searchParams.get("minLng"), -180);
  let maxLng = toNum(searchParams.get("maxLng"), 180);

  [minLat, maxLat] = normalizeMinMax(minLat, maxLat);
  [minLng, maxLng] = normalizeMinMax(minLng, maxLng);

  const where: string[] = [];
  const params: any[] = [];

  where.push(`is_deleted = 0`);
  where.push(`latitude IS NOT NULL AND longitude IS NOT NULL`);
  where.push(`(${NOT_DECOMMISSIONED_COND})`);

  if (hasBounds) {
    where.push(`latitude BETWEEN ? AND ?`);
    where.push(`longitude BETWEEN ? AND ?`);
    params.push(minLat, maxLat, minLng, maxLng);
  }

  if (q) {
    where.push(`JSON_UNQUOTE(JSON_EXTRACT(raw_attributes, '$.WellName')) LIKE ?`);
    params.push(`%${q}%`);
  }

  const whereSql = where.join("\n  AND ");
  const pool = getPool();

  const sql = `
    SELECT
      JSON_UNQUOTE(JSON_EXTRACT(raw_attributes, '$.cLandLocationDisplay')) AS landLocation,
      COUNT(*) AS cnt
    FROM water_resources_source
    WHERE ${whereSql}
      AND JSON_UNQUOTE(JSON_EXTRACT(raw_attributes, '$.cLandLocationDisplay')) IS NOT NULL
      AND JSON_UNQUOTE(JSON_EXTRACT(raw_attributes, '$.cLandLocationDisplay')) <> ''
    GROUP BY landLocation
    ORDER BY cnt DESC
    LIMIT 50
  `;

  const [rows]: any = await pool.query(sql, params);

  return NextResponse.json({
    ok: true,
    lands: (rows || []).map((r: any) => ({
      landLocation: r.landLocation,
      count: Number(r.cnt),
    })),
  });
}