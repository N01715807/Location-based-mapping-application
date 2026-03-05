import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";

function toId(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function toNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function PUT(req: Request, ctx: { params: Promise<{ logId: string }> }) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { logId } = await ctx.params;
  const id = toId(logId);
  if (!id) return NextResponse.json({ ok: false, error: "Bad logId" }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Bad JSON" }, { status: 400 });

  const fieldName = String(body.fieldName || "").trim();
  const amount = toNum(body.amount);
  const note = String(body.note || "").trim();

  if (!fieldName) return NextResponse.json({ ok: false, error: "fieldName required" }, { status: 400 });
  if (amount == null || amount <= 0) return NextResponse.json({ ok: false, error: "amount must be > 0" }, { status: 400 });

  const pool = getPool();
  const [r]: any = await pool.execute(
    `UPDATE usage_logs
     SET field_name=?, amount=?, note=?
     WHERE id=? AND is_deleted=0`,
    [fieldName, amount, note || null, id]
  );

  if ((r.affectedRows || 0) === 0) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, ctx: { params: Promise<{ logId: string }> }) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { logId } = await ctx.params;
  const id = toId(logId);
  if (!id) return NextResponse.json({ ok: false, error: "Bad logId" }, { status: 400 });

  const pool = getPool();
  const [r]: any = await pool.execute(
    `UPDATE usage_logs
     SET is_deleted=1, deleted_at=NOW()
     WHERE id=? AND is_deleted=0`,
    [id]
  );

  if ((r.affectedRows || 0) === 0) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}