"use client";

import { GoogleMap, Marker, InfoWindow, useLoadScript } from "@react-google-maps/api";
import { useCallback, useEffect, useRef, useState } from "react";

type WellPoint = {
  id: number | string;
  name?: string | null;
  latitude: number;
  longitude: number;
  available?: boolean | number | null;
  status?: string | null;
};

type ClusterPoint = {
  lat: number;
  lng: number;
  count: number;
};

type ApiOk =
  | { ok: true; mode: "cluster"; zoom: number; data: ClusterPoint[] }
  | { ok: true; mode: "wells"; zoom: number; data: WellPoint[] };

type ApiErr = { ok: false; error?: string };

function isApiOk(x: any): x is ApiOk {
  return x && x.ok === true && (x.mode === "cluster" || x.mode === "wells") && Array.isArray(x.data);
}

function normalizeAvailable(p: { available?: any; status?: any }): boolean | null {
  if (p.available === true || p.available === 1) return true;
  if (p.available === false || p.available === 0) return false;

  const s = String(p.status || "").toLowerCase().trim();
  if (!s) return null;
  if (["active", "available", "open", "in service", "operational"].includes(s)) return true;
  if (["inactive", "unavailable", "closed", "out of service", "abandoned"].includes(s)) return false;

  return null;
}

function limitByZoom(z: number) {
  if (z < 13) return 120;
  if (z < 14) return 350;
  return 800;
}

function makeQueryKey(
  bounds: google.maps.LatLngBounds,
  zoom: number,
  limit: number,
  modeHint: "cluster" | "wells"
) {
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  const q = (n: number) => n.toFixed(2);
  return [modeHint, zoom, limit, q(sw.lat()), q(sw.lng()), q(ne.lat()), q(ne.lng())].join("|");
}

const CACHE_MS = 30_000;
const IDLE_DEBOUNCE_MS = 350;

const MAX_CLUSTER_MARKERS = 60;
const MAX_WELL_MARKERS = 300;

export default function WaterResourcesMap() {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKeyRef = useRef<string>("");

  const cacheRef = useRef<Map<string, { ts: number; mode: "cluster" | "wells"; data: any[] }>>(
    new Map()
  );

  const abortRef = useRef<AbortController | null>(null);

  const [mode, setMode] = useState<"cluster" | "wells">("cluster");
  const [clusters, setClusters] = useState<ClusterPoint[]>([]);
  const [wells, setWells] = useState<WellPoint[]>([]);
  const [selected, setSelected] = useState<WellPoint | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string>("");

  const clearAll = useCallback(() => {
    setClusters([]);
    setWells([]);
    setSelected(null);
  }, []);

  const fetchByBounds = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;

    const bounds = map.getBounds();
    const zoom = map.getZoom() ?? 0;
    if (!bounds) return;

    if (zoom < 6) {
      lastKeyRef.current = "";
      clearAll();
      setHint("Zoom in to see data.");
      return;
    }

    const modeHint: "cluster" | "wells" = zoom < 13 ? "cluster" : "wells";
    const apiLimit = limitByZoom(zoom);

    setHint("");

    const key = makeQueryKey(bounds, zoom, apiLimit, modeHint);
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;

    const now = Date.now();
    const cached = cacheRef.current.get(key);

    if (cached && now - cached.ts < CACHE_MS) {
      setMode(cached.mode);
      if (cached.mode === "cluster") {
        setClusters(cached.data as ClusterPoint[]);
        setWells([]);
        setSelected(null);
      } else {
        setWells(cached.data as WellPoint[]);
        setClusters([]);
      }
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();

    const params = new URLSearchParams({
      minLat: String(sw.lat()),
      maxLat: String(ne.lat()),
      minLng: String(sw.lng()),
      maxLng: String(ne.lng()),
      zoom: String(zoom),
      limit: String(apiLimit),
    });

    try {
      setError(null);

      const res = await fetch(`/api/water-resources?${params.toString()}`, {
        cache: "no-store",
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error(`API ${res.status}`);

      const raw: unknown = await res.json();
      if (!isApiOk(raw)) {
        const msg = (raw as any)?.error || "Bad API response";
        throw new Error(msg);
      }

      const json = raw;

      if (json.mode === "cluster") {
        const valid = json.data
          .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng) && c.count > 0)
          .sort((a, b) => b.count - a.count)
          .slice(0, Math.min(apiLimit, MAX_CLUSTER_MARKERS));

        cacheRef.current.set(key, { ts: now, mode: "cluster", data: valid });

        setMode("cluster");
        setClusters(valid);
        setWells([]);
        setSelected(null);

        if (valid.length === 0) setHint("No results in this area.");
      } else {
        const valid = json.data
          .filter(
            (w) => Number.isFinite(Number(w.latitude)) && Number.isFinite(Number(w.longitude))
          )
          .slice(0, Math.min(apiLimit, MAX_WELL_MARKERS));

        cacheRef.current.set(key, { ts: now, mode: "wells", data: valid });

        setMode("wells");
        setWells(valid);
        setClusters([]);

        if (valid.length === 0) setHint("No wells in this area.");
      }
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setError(String(e?.message || e));
    }
  }, [clearAll]);

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      fetchByBounds();
    },
    [fetchByBounds]
  );

  const onIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      fetchByBounds();
    }, IDLE_DEBOUNCE_MS);
  }, [fetchByBounds]);

  useEffect(() => {
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      abortRef.current?.abort();
    };
  }, []);

  if (loadError) return <div>Map load failed.</div>;
  if (!isLoaded) return <div>Loading...</div>;

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", gap: 12, marginBottom: 8, fontSize: 12, opacity: 0.85 }}>
        <div>
          mode: <b>{mode}</b>
        </div>
        <div>
          clusters: <b>{clusters.length}</b>
        </div>
        <div>
          wells: <b>{wells.length}</b>
        </div>
      </div>

      {hint && <div style={{ marginBottom: 8, opacity: 0.8 }}>{hint}</div>}
      {error && <div style={{ marginBottom: 8, color: "crimson" }}>{error}</div>}

      <GoogleMap
        center={{ lat: 52.9, lng: -106.0 }}
        zoom={6}
        mapContainerStyle={{ width: "100%", height: "80vh" }}
        onLoad={onLoad}
        onIdle={onIdle}
        options={{
          clickableIcons: false,
          streetViewControl: false,
          mapTypeControl: false,
          gestureHandling: "greedy",
          styles: [
            { featureType: "poi", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] },
          ],
        }}
      >
        {mode === "cluster" &&
          wells.length === 0 &&
          clusters.map((c) => (
            <Marker
              key={`c-${c.lat.toFixed(5)}-${c.lng.toFixed(5)}`}
              position={{ lat: c.lat, lng: c.lng }}
              label={{ text: String(c.count) }}
              onClick={() => {}}
            />
          ))}

        {mode === "wells" &&
          clusters.length === 0 &&
          wells.map((w) => (
            <Marker
              key={String(w.id)}
              position={{ lat: Number(w.latitude), lng: Number(w.longitude) }}
              onClick={() => setSelected(w)}
            />
          ))}

        {selected && mode === "wells" && (
          <InfoWindow
            position={{ lat: Number(selected.latitude), lng: Number(selected.longitude) }}
            onCloseClick={() => setSelected(null)}
          >
            <div style={{ maxWidth: 260 }}>
              <strong>{selected.name || "Unknown"}</strong>
              <div style={{ marginTop: 6 }}>
                <span style={{ fontWeight: 600 }}>Status: </span>
                {(() => {
                  const a = normalizeAvailable(selected);
                  if (a === true) return "Available";
                  if (a === false) return "Unavailable";
                  return "-";
                })()}
              </div>
              <div style={{ marginTop: 6, fontSize: 12 }}>
                <div>Lat: {Number(selected.latitude).toFixed(6)}</div>
                <div>Lng: {Number(selected.longitude).toFixed(6)}</div>
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}
