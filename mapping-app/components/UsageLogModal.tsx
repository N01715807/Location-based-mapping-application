"use client";

import { useEffect, useRef, useState } from "react";

type Well = {
  id: number;
  name: string | null;
  holeNumber: string | null;
  landLocation: string | null;
};

export default function UsageLogModal() {
  const [open, setOpen] = useState(false);

  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [land, setLand] = useState("");
  const [page, setPage] = useState(1);

  const [lands, setLands] = useState<Array<{ landLocation: string; count: number }>>([]);
  const [wells, setWells] = useState<Well[]>([]);
  const [total, setTotal] = useState(0);

  const [pickId, setPickId] = useState<string>("");

  const [fieldName, setFieldName] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const [loadingWells, setLoadingWells] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const debounceRef = useRef<any>(null);

  function onSearchInput(v: string) {
    setQInput(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      setLand("");
      setQ(v.trim());
    }, 300);
  }

  async function loadFacetsAndWells(nextPage: number, nextQ: string, nextLand: string) {
    setLoadingWells(true);
    setErr(null);

    try {
      const facetsParams = new URLSearchParams();
      if (nextQ) facetsParams.set("q", nextQ);

      const fRes = await fetch(`/api/wells/facets?${facetsParams.toString()}`, { cache: "no-store" });
      const fJson = await fRes.json();
      if (fRes.ok && fJson?.ok) setLands(fJson.lands || []);

      const listParams = new URLSearchParams({
        page: String(nextPage),
      });
      if (nextQ) listParams.set("q", nextQ);
      if (nextLand) listParams.set("land", nextLand);

      const res = await fetch(`/api/wells?${listParams.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || `API ${res.status}`);

      setWells(json.data || []);
      setTotal(Number(json.total || 0));
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoadingWells(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    loadFacetsAndWells(1, q, land);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    loadFacetsAndWells(page, q, land);
  }, [q, land, page, open]);

  async function save() {
    try {
      setSaving(true);
      setErr(null);
      setMsg(null);

      const wid = Number(pickId);
      if (!Number.isFinite(wid)) throw new Error("Please select a well.");
      if (!fieldName.trim()) throw new Error("Field is required.");
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Amount must be > 0.");

      const res = await fetch("/api/usage-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          waterResourceId: wid,
          fieldName: fieldName.trim(),
          amount: amt,
          note: note.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || `API ${res.status}`);

      setMsg(`Saved. Log ID = ${json.id}`);
      setFieldName("");
      setAmount("");
      setNote("");
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  if (!open) return <button onClick={() => setOpen(true)}>Usage Log</button>;

  const totalPages = Math.max(1, Math.ceil(total / 30));

  return (
    <div>
      <button onClick={() => setOpen(false)}>Close</button>

      <h2>Usage Log</h2>

      <h3>Select well (search + filter)</h3>

      <div>
        <div>Search by name:</div>
        <input
          value={qInput}
          onChange={(e) => onSearchInput(e.target.value)}
          placeholder="Type well name..."
        />
      </div>

      <div>
        <div>Filter by land location:</div>
        <select
          value={land}
          onChange={(e) => {
            setPage(1);
            setLand(e.target.value);
          }}
        >
          <option value="">All</option>
          {lands.map((x) => (
            <option key={x.landLocation} value={x.landLocation}>
              {x.landLocation} ({x.count})
            </option>
          ))}
        </select>
      </div>

      <div>
        <div>Results:</div>
        {loadingWells ? (
          <div>Loading wells...</div>
        ) : (
          <select value={pickId} onChange={(e) => setPickId(e.target.value)}>
            <option value="">Select a well...</option>
            {wells.map((w) => (
              <option key={String(w.id)} value={String(w.id)}>
                {(w.name || `Well ${w.id}`) +
                  " | Hole: " +
                  (w.holeNumber || "-") +
                  " | Land: " +
                  (w.landLocation || "-")}
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          Prev
        </button>
        <span>
          Page {page} / {totalPages} (total {total})
        </span>
        <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
          Next
        </button>
      </div>

      <h3>Log</h3>

      <div>
        <div>Field *</div>
        <input value={fieldName} onChange={(e) => setFieldName(e.target.value)} />
      </div>

      <div>
        <div>Amount *</div>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>

      <div>
        <div>Note</div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={5} />
      </div>

      {err && <div>{err}</div>}
      {msg && <div>{msg}</div>}

      <button disabled={saving} onClick={save}>
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
}