import { getPool } from "@/lib/db";

const BASE =
  "https://gis.wsask.ca/arcgiswa/rest/services/WellsSite/WaterWellsPublic/FeatureServer/0";

const SOURCE = "WSA";
const LAYER = "WellsSite/WaterWellsPublic:0";

const DEFAULT_BATCH_SIZE = 500;
const DEFAULT_CONCURRENCY = 2;
const RETRY_ONCE = true;

function chunk<T>(arr: T[], size: number): T[][] {
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
  return res;
}

async function mapLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: limit }).map(async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) break;
      await fn(items[idx]);
    }
  });
  await Promise.all(workers);
}

async function fetchJson(url: string) {
  const resp = await fetch(url, { cache: "no-store" });
  if (!resp.ok) throw new Error(`Fetch failed ${resp.status}: ${url}`);
  return resp.json();
}

export async function getAllObjectIds(): Promise<number[]> {
  const url = `${BASE}/query?where=1%3D1&returnIdsOnly=true&f=json`;
  const json: any = await fetchJson(url);
  const ids: number[] = json.objectIds || [];
  if (!ids.length) throw new Error("No objectIds returned");
  return ids;
}

export async function fetchFeaturesByIds(ids: number[]): Promise<any[]> {
  const url =
    `${BASE}/query?objectIds=${ids.join(",")}` +
    `&outFields=*&returnGeometry=true&outSR=4326&f=json`;
  const json: any = await fetchJson(url);
  return json.features || [];
}

export async function upsertFeatures(features: any[], jobStartedAt: Date) {
  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    for (const f of features) {
      const objectid = f?.attributes?.OBJECTID;
      if (objectid == null) continue;

      const attrs = f?.attributes || {};
      const geom = f?.geometry || null;

      const lat = geom?.y ?? null;
      const lng = geom?.x ?? null;

      await conn.execute(
        `INSERT INTO water_resources_source
          (source, source_layer, source_objectid,
           raw_attributes, raw_geometry,
           latitude, longitude,
           source_updated_at, last_seen_at,
           is_deleted, deleted_at)
         VALUES
          (?, ?, ?,
           CAST(? AS JSON), CAST(? AS JSON),
           ?, ?,
           NULL, ?,
           0, NULL)
         ON DUPLICATE KEY UPDATE
          raw_attributes = VALUES(raw_attributes),
          raw_geometry = VALUES(raw_geometry),
          latitude = VALUES(latitude),
          longitude = VALUES(longitude),
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
          lat,
          lng,
          jobStartedAt,
        ]
      );
    }
  } finally {
    conn.release();
  }
}

export async function markDeleted(jobStartedAt: Date): Promise<number> {
  const pool = getPool();
  const [r]: any = await pool.execute(
    `UPDATE water_resources_source
     SET is_deleted=1, deleted_at=NOW()
     WHERE source=? AND source_layer=? AND last_seen_at < ? AND is_deleted=0`,
    [SOURCE, LAYER, jobStartedAt]
  );
  return r.affectedRows || 0;
}

export async function getExistingActiveIds(): Promise<number[]> {
  const pool = getPool();
  const [rows]: any = await pool.query(
    `SELECT source_objectid
     FROM water_resources_source
     WHERE source=? AND source_layer=? AND is_deleted=0`,
    [SOURCE, LAYER]
  );
  return rows.map((x: any) => Number(x.source_objectid));
}

function setDiff(a: number[], b: number[]): number[] {
  const bs = new Set(b);
  return a.filter((x) => !bs.has(x));
}

export async function runSync(opts: {
  mode: "full" | "incremental";
  batchSize?: number;
  concurrency?: number;
}) {
  const batchSize = opts.batchSize ?? DEFAULT_BATCH_SIZE;
  const concurrency = opts.concurrency ?? DEFAULT_CONCURRENCY;

  const jobStartedAt = new Date();

  const latestIds = await getAllObjectIds();

  if (opts.mode === "incremental") {
    const existingIds = await getExistingActiveIds();
    const newIds = setDiff(latestIds, existingIds);

    const idChunks = chunk(newIds, batchSize);

    let fetched = 0;
    await mapLimit(idChunks, concurrency, async (oneChunk) => {
      const doOnce = async () => {
        const feats = await fetchFeaturesByIds(oneChunk);
        fetched += feats.length;
        await upsertFeatures(feats, jobStartedAt);
      };

      if (!RETRY_ONCE) return doOnce();
      try {
        await doOnce();
      } catch {
        await doOnce();
      }
    });

    return {
      mode: "incremental",
      jobStartedAt,
      total_latest_ids: latestIds.length,
      new_ids: newIds.length,
      fetched_features: fetched,
      upserted_source: fetched,
      marked_deleted: 0,
      batch_size: batchSize,
      concurrency,
      note: "Incremental only upserts NEW ids. Use full sync periodically for updates + deletion detection.",
    };
  }

  const idChunks = chunk(latestIds, batchSize);

  let fetched = 0;
  await mapLimit(idChunks, concurrency, async (oneChunk) => {
    const doOnce = async () => {
      const feats = await fetchFeaturesByIds(oneChunk);
      fetched += feats.length;
      await upsertFeatures(feats, jobStartedAt);
    };

    if (!RETRY_ONCE) return doOnce();
    try {
      await doOnce();
    } catch {
      await doOnce();
    }
  });

  const marked = await markDeleted(jobStartedAt);

  return {
    mode: "full",
    jobStartedAt,
    total_latest_ids: latestIds.length,
    fetched_features: fetched,
    upserted_source: fetched,
    marked_deleted: marked,
    batch_size: batchSize,
    concurrency,
  };
}