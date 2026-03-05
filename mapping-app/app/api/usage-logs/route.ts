import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";

function toInt(v: string | null, fallback: number) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? n : fallback;
}
function toNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: Request) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const waterResourceId = toInt(searchParams.get("waterResourceId"), NaN as any);
  const limit = Math.max(1, Math.min(toInt(searchParams.get("limit"), 50), 200));

  if (!Number.isFinite(waterResourceId)) {
    return NextResponse.json({ ok: false, error: "waterResourceId required" }, { status: 400 });
  }

  const pool = getPool();
  const [rows]: any = await pool.query(
    `SELECT id, water_resource_id, used_at, field_name, amount, note
     FROM usage_logs
     WHERE is_deleted = 0 AND water_resource_id = ?
     ORDER BY used_at DESC
     LIMIT ?`,
    [waterResourceId, limit]
  );

  return NextResponse.json({ ok: true, data: rows || [] });
}

export async function POST(req: Request) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Bad JSON" }, { status: 400 });

  const waterResourceId = toNum(body.waterResourceId);
  const fieldName = String(body.fieldName || "").trim();
  const amount = toNum(body.amount);
  const note = String(body.note || "").trim();

  if (!waterResourceId) return NextResponse.json({ ok: false, error: "waterResourceId required" }, { status: 400 });
  if (!fieldName) return NextResponse.json({ ok: false, error: "fieldName required" }, { status: 400 });
  if (amount == null || amount <= 0) return NextResponse.json({ ok: false, error: "amount must be > 0" }, { status: 400 });

  const pool = getPool();
  const [r]: any = await pool.execute(
    `INSERT INTO usage_logs (water_resource_id, used_at, field_name, amount, note)
     VALUES (?, NOW(), ?, ?, ?)`,
    [waterResourceId, fieldName, amount, note || null]
  );

  return NextResponse.json({ ok: true, id: r.insertId });
}