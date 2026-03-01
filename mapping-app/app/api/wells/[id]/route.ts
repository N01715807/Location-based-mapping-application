import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params; // ✅ 关键：await params
  const id = Number(idStr);

  if (!Number.isFinite(id)) {
    return NextResponse.json({ ok: false, error: "Bad id" }, { status: 400 });
  }

  const pool = getPool();

  const sql = `
    SELECT
      source_objectid AS id,
      JSON_UNQUOTE(JSON_EXTRACT(raw_attributes, '$.WellName')) AS name,
      JSON_UNQUOTE(JSON_EXTRACT(raw_attributes, '$.cHoleNumber')) AS holeNumber,
      JSON_UNQUOTE(JSON_EXTRACT(raw_attributes, '$.cLandLocationDisplay')) AS landLocation,
      latitude,
      longitude,
      JSON_PRETTY(raw_attributes) AS raw_attributes
    FROM water_resources_source
    WHERE is_deleted = 0 AND source_objectid = ?
    LIMIT 1
  `;

  const [rows]: any = await pool.query(sql, [id]);
  const r = rows?.[0];

  if (!r) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    data: {
      id: r.id,
      name: r.name ?? null,
      holeNumber: r.holeNumber ?? null,
      landLocation: r.landLocation ?? null,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      raw_attributes: r.raw_attributes,
    },
  });
}