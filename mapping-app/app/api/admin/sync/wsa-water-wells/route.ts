import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { runSync } from "@/lib/sync/wsaWaterWells";

export const runtime = "nodejs";

function isAdmin(req: Request) {

  const token = req.headers.get("x-admin-token");
  return token && token === process.env.ADMIN_SYNC_TOKEN;
}

export async function POST(req: Request) {
  if (!isAdmin(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const mode = body?.mode === "incremental" ? "incremental" : "full";

  const pool = getPool();
  const conn = await pool.getConnection();

  let jobId: number | null = null;

  try {
    const [r]: any = await conn.execute(
      "INSERT INTO sync_jobs (source, source_layer, status, started_at) VALUES ('WSA','WellsSite/WaterWellsPublic:0','running',NOW())"
    );
    jobId = r.insertId as number;

    const result = await runSync({ mode, batchSize: 500, concurrency: 2 });

    await conn.execute(
      "UPDATE sync_jobs SET status='success', finished_at=NOW(), stats_json=CAST(? AS JSON) WHERE id=?",
      [JSON.stringify(result), jobId]
    );

    return NextResponse.json({ ok: true, jobId, result });
  } catch (e: any) {
    const msg = String(e?.stack || e?.message || e);
    if (jobId) {
      await conn.execute(
        "UPDATE sync_jobs SET status='failed', finished_at=NOW(), error=? WHERE id=?",
        [msg, jobId]
      );
    }
    return NextResponse.json({ ok: false, jobId, error: msg }, { status: 500 });
  } finally {
    conn.release();
  }
}