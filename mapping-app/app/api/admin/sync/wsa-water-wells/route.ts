import mysql from "mysql2/promise";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const BASE =
  "https://gis.wsask.ca/arcgiswa/rest/services/WellsSite/WaterWellsPublic/FeatureServer/0";
const SOURCE = "WSA";
const LAYER = "WellsSite/WaterWellsPublic:0";

const BATCH_SIZE = 200; 
const LIMIT_IDS: number | null = null;

function chunk<T>(arr: T[], size: number): T[][] {
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
  return res;
}

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function GET() {
  const jobStartedAt = new Date();
  let jobId: number | null = null;

  const stats: any = {
    total_ids: 0,
    fetched_features: 0,
    upserted_source: 0,
    marked_deleted: 0,
    batch_size: BATCH_SIZE,
    limited_ids: LIMIT_IDS,
  };

  const pool = await mysql.createPool({
    host: env("MYSQL_HOST"),
    port: Number(process.env.MYSQL_PORT || 3306),
    user: env("MYSQL_USER"),
    password: process.env.MYSQL_PASSWORD || "",
    database: env("MYSQL_DATABASE"),
    connectionLimit: 5,
  });

  const conn = await pool.getConnection();

  try {

    const [r]: any = await conn.execute(
      "INSERT INTO sync_jobs (source, source_layer, status, started_at) VALUES (?, ?, 'running', NOW())",
      [SOURCE, LAYER]
    );
    jobId = r.insertId as number;

    const idsResp = await fetch(
      `${BASE}/query?where=1%3D1&returnIdsOnly=true&f=json`,
      { cache: "no-store" }
    );
    if (!idsResp.ok) throw new Error(`IDs request failed: ${idsResp.status}`);

    const idsJson: any = await idsResp.json();
    let ids: number[] = idsJson.objectIds || [];
    if (!ids.length) throw new Error("No objectIds returned");

    if (LIMIT_IDS && ids.length > LIMIT_IDS) ids = ids.slice(0, LIMIT_IDS);
    stats.total_ids = ids.length;

    // 3) batch fetch features + upsert into water_resources_source
    for (const batch of chunk(ids, BATCH_SIZE)) {
      const url =
        `${BASE}/query?objectIds=${batch.join(",")}` +
        `&outFields=*&returnGeometry=true&outSR=4326&f=json`;

      const resp = await fetch(url, { cache: "no-store" });
      if (!resp.ok) throw new Error(`Feature request failed: ${resp.status}`);

      const json: any = await resp.json();
      const feats: any[] = json.features || [];
      stats.fetched_features += feats.length;

      for (const f of feats) {
        const objectid = f?.attributes?.OBJECTID;
        if (objectid == null) continue;

        const attrs = f?.attributes || {};
        const geom = f?.geometry || null;

        await conn.execute(
          `INSERT INTO water_resources_source
            (source, source_layer, source_objectid,
             raw_attributes, raw_geometry,
             source_updated_at, last_seen_at,
             is_deleted, deleted_at)
           VALUES
            (?, ?, ?,
             CAST(? AS JSON), CAST(? AS JSON),
             NULL, ?,
             0, NULL)
           ON DUPLICATE KEY UPDATE
            raw_attributes = VALUES(raw_attributes),
            raw_geometry = VALUES(raw_geometry),
            source_updated_at = VALUES(source_updated_at),
            last_seen_at = VALUES(last_seen_at),
            is_deleted = 0,
            deleted_at = NULL`,
          [
            SOURCE,
            LAYER,
            objectid,
            JSON.stringify(attrs),
            JSON.stringify(geom),
            jobStartedAt,
          ]
        );

        stats.upserted_source++;
      }
    }

    const [delR]: any = await conn.execute(
      `UPDATE water_resources_source
       SET is_deleted = 1,
           deleted_at = NOW()
       WHERE source = ?
         AND source_layer = ?
         AND last_seen_at < ?
         AND is_deleted = 0`,
      [SOURCE, LAYER, jobStartedAt]
    );
    stats.marked_deleted = delR.affectedRows || 0;

    await conn.execute(
      "UPDATE sync_jobs SET status='success', finished_at=NOW(), stats_json=CAST(? AS JSON) WHERE id=?",
      [JSON.stringify(stats), jobId]
    );

    return NextResponse.json({ ok: true, jobId, stats });
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
    await pool.end();
  }
}
