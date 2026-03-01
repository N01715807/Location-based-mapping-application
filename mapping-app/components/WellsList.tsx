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

  // debounce search input -> q
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

  // 拉 facets（只跟 q 有关）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/wells/facets?${facetsQS}`, { cache: "no-store" });
        const json = await res.json();
        if (!cancelled && json?.ok) setLands(json.lands || []);
      } catch {
        // facets 失败不阻塞主列表
        if (!cancelled) setLands([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [facetsQS]);

  // 拉列表（q/land/page）
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

  return (
    <section style={{ marginTop: 14 }}>
      <h2 style={{ margin: "12px 0" }}>Find a well</h2>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          placeholder="Search by WellName..."
          style={{ padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 8, width: 260 }}
        />

        <select
          value={land}
          onChange={(e) => {
            setPage(1);
            setLand(e.target.value);
          }}
          style={{ padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 8, minWidth: 340 }}
        >
          <option value="">All land locations</option>
          {lands.map((x) => (
            <option key={x.landLocation} value={x.landLocation}>
              {x.landLocation} ({x.count})
            </option>
          ))}
        </select>

        <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.8 }}>
          {loading ? "Loading..." : `${total} results`}
        </div>
      </div>

      {err && <div style={{ marginTop: 8, color: "crimson" }}>{err}</div>}

      <div style={{ marginTop: 10, border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
        {items.map((w) => (
          <div
            key={w.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 12,
              padding: "10px 12px",
              borderTop: "1px solid #f1f5f9",
              alignItems: "center",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {w.name || `Well ${w.id}`}
              </div>
              <div style={{ marginTop: 4, fontSize: 12, opacity: 0.8 }}>
                Hole: {w.holeNumber || "-"} · Land: {w.landLocation || "-"}
              </div>
            </div>

            <a
              href={`/wells/${w.id}`}
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid #cbd5e1",
                background: "white",
                textDecoration: "none",
              }}
            >
              Details
            </a>
          </div>
        ))}

        {items.length === 0 && !loading && <div style={{ padding: 12, opacity: 0.7 }}>No results.</div>}
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 10, alignItems: "center" }}>
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", background: "white" }}
        >
          Prev
        </button>

        <div style={{ fontSize: 12, opacity: 0.8 }}>
          Page {page} / {totalPages}
        </div>

        <button
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", background: "white" }}
        >
          Next
        </button>
      </div>
    </section>
  );
}