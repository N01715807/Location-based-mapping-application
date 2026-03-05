"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type WellRow = {
  id: number;
  name: string | null;
  holeNumber: string | null;
  landLocation: string | null;
  latitude: number;
  longitude: number;
};

type FacetRow = { landLocation: string; count: number };

export default function WellsList() {
  const pageSize = 30;

  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [land, setLand] = useState("");
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<WellRow[]>([]);
  const [total, setTotal] = useState(0);
  const [lands, setLands] = useState<FacetRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      setQ(qInput.trim());
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [qInput]);

  const listQS = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", String(page));
    if (q) p.set("q", q);
    if (land) p.set("land", land);
    return p.toString();
  }, [page, q, land]);

  const facetsQS = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    return p.toString();
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/wells/facets?${facetsQS}`, { cache: "no-store" });
        const json = await res.json();
        if (!cancelled && json?.ok) setLands(json.lands || []);
      } catch {
        if (!cancelled) setLands([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [facetsQS]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const res = await fetch(`/api/wells?${listQS}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json?.ok) throw new Error(json?.error || `API ${res.status}`);

        if (cancelled) return;

        setItems(json.data || []);
        setTotal(Number(json.total || 0));
      } catch (e: any) {
        if (!cancelled) setErr(String(e?.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listQS]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function viewOnMap(w: WellRow) {
    window.dispatchEvent(
      new CustomEvent("well:focus", {
        detail: {
          id: w.id,
          name: w.name || `Well ${w.id}`,
          latitude: w.latitude,
          longitude: w.longitude,
        },
      })
    );
  }

  return (
    <section>
      <h2>Find a well</h2>

      <div>
        <label>
          Search:
          <input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search by WellName..." />
        </label>

        <label>
          Land location:
          <select
            value={land}
            onChange={(e) => {
              setPage(1);
              setLand(e.target.value);
            }}
          >
            <option value="">All land locations</option>
            {lands.map((x) => (
              <option key={x.landLocation} value={x.landLocation}>
                {x.landLocation} ({x.count})
              </option>
            ))}
          </select>
        </label>

        <div>{loading ? "Loading..." : `${total} results`}</div>
      </div>

      {err && <div>{err}</div>}

      <div>
        {items.map((w) => (
          <div key={w.id}>
            <div>
              <div>{w.name || `Well ${w.id}`}</div>
              <div>
                Hole: {w.holeNumber || "-"} · Land: {w.landLocation || "-"}
              </div>
            </div>

            <div>
              <button type="button" onClick={() => viewOnMap(w)}>
                View
              </button>{" "}
              <a href={`/wells/${w.id}`}>Details</a>
            </div>

            <hr />
          </div>
        ))}

        {items.length === 0 && !loading && <div>No results.</div>}
      </div>

      <div>
        <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          Prev
        </button>

        <span>
          Page {page} / {totalPages}
        </span>

        <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
          Next
        </button>
      </div>
    </section>
  );
}