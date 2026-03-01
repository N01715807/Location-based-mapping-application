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
  const land = (searchParams.get("land") || "").trim();

  const page = Math.max(1, toInt(searchParams.get("page"), 1));
  const pageSize = 30;
  const offset = (page - 1) * pageSize;

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

  if (land) {
    where.push(`JSON_UNQUOTE(JSON_EXTRACT(raw_attributes, '$.cLandLocationDisplay')) = ?`);
    params.push(land);
  }

  const whereSql = where.join("\n  AND ");
  const pool = getPool();

  const countSql = `
    SELECT COUNT(*) AS total
    FROM water_resources_source
    WHERE ${whereSql}
  `;
  const [[countRow]]: any = await pool.query(countSql, params);
  const total = Number(countRow?.total || 0);

  const dataSql = `
    SELECT
      source_objectid AS id,
      JSON_UNQUOTE(JSON_EXTRACT(raw_attributes, '$.WellName')) AS name,
      JSON_UNQUOTE(JSON_EXTRACT(raw_attributes, '$.cHoleNumber')) AS holeNumber,
      JSON_UNQUOTE(JSON_EXTRACT(raw_attributes, '$.cLandLocationDisplay')) AS landLocation,
      latitude,
      longitude
    FROM water_resources_source
    WHERE ${whereSql}
    ORDER BY source_objectid ASC
    LIMIT ? OFFSET ?
  `;

  const [rows]: any = await pool.query(dataSql, [...params, pageSize, offset]);

  return NextResponse.json({
    ok: true,
    page,
    pageSize,
    total,
    data: (rows || []).map((r: any) => ({
      id: r.id,
      name: r.name ?? null,
      holeNumber: r.holeNumber ?? null,
      landLocation: r.landLocation ?? null,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
    })),
  });
}