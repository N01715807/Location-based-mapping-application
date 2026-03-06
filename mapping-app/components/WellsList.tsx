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
          name: w.landLocation || w.name || `Well ${w.id}`,
          latitude: w.latitude,
          longitude: w.longitude,
        },
      })
    );
  }

  function getTitle(w: WellRow) {
    return w.landLocation || w.name || `Well ${w.id}`;
  }

  function getSubtitle(w: WellRow) {
    if (w.name && w.name !== w.landLocation) return w.name;
    return "Open details for more information";
  }

  return (
    <section className="wells-list-section">
      <div className="wells-list-toolbar">
        <div className="wells-list-filter">
          <label htmlFor="well-search">Search wells</label>
          <input
            id="well-search"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search by land location or well name"
          />
        </div>

        <div className="wells-list-filter">
          <label htmlFor="land-location-filter">Land location</label>
          <select
            id="land-location-filter"
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
        </div>

        <div className="wells-list-result-count">
          {loading ? "Loading wells..." : `${total} well${total === 1 ? "" : "s"} found`}
        </div>
      </div>

      {err && <div className="wells-list-error">{err}</div>}

      <div className="wells-list-results">
        {items.map((w) => (
          <div key={w.id} className="wells-list-item">
            <div className="wells-list-item-main">
              <div className="wells-list-item-title">{getTitle(w)}</div>
              <div className="wells-list-item-subtitle">{getSubtitle(w)}</div>
            </div>

            <div className="wells-list-item-actions">
              <button type="button" onClick={() => viewOnMap(w)}>
                View on map
              </button>
              <a href={`/wells/${w.id}`}>View details</a>
            </div>
          </div>
        ))}

        {items.length === 0 && !loading && <div className="wells-list-empty">No wells found.</div>}
      </div>

      <div className="wells-list-pagination">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Previous
        </button>

        <span>
          Page {page} of {totalPages}
        </span>

        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </section>
  );
}