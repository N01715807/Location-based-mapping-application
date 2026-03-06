"use client";

import Link from "next/link";
import { GoogleMap, Marker, InfoWindow, useLoadScript } from "@react-google-maps/api";
import { useCallback, useEffect, useRef, useState } from "react";

type WellPoint = {
  id: number | string;
  name?: string | null;
  latitude: number | string;
  longitude: number | string;
  available?: boolean | number | null;
  status?: string | null;
  distance_km?: number | null;
  hole_number?: string | null;
  land_location?: string | null;
  borehole_depth?: number | null;
  water_level?: number | null;
  pumping_rate?: number | null;
  recommended_pumping_rate?: number | null;
};

function normalizeAvailable(p: { available?: any; status?: any }): boolean | null {
  if (p.available === true || p.available === 1) return true;
  if (p.available === false || p.available === 0) return false;

  const s = String(p.status || "").toLowerCase().trim();
  if (!s) return null;
  if (["active", "available", "open", "in service", "operational"].includes(s)) return true;
  if (["inactive", "unavailable", "closed", "out of service", "abandoned"].includes(s)) return false;

  return null;
}

const SASKATOON_CENTER = { lat: 52.1332, lng: -106.67 };
const DEFAULT_ZOOM = 13;
const DEFAULT_RADIUS_KM = 10;

function inSaskatchewan(lat: number, lng: number) {
  return lat >= 49.0 && lat <= 60.0 && lng >= -110.0 && lng <= -101.0;
}

async function getBrowserLocation(): Promise<{ lat: number; lng: number } | null> {
  if (typeof window === "undefined") return null;
  if (!navigator.geolocation) return null;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60_000 }
    );
  });
}

export default function WaterResourcesMap() {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
  });

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [wells, setWells] = useState<WellPoint[]>([]);
  const [selected, setSelected] = useState<WellPoint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string>("");
  const [resetting, setResetting] = useState(false);

  const fetchNearbyWells = useCallback(async (anchor: { lat: number; lng: number }) => {
    setError(null);
    setHint("");

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const params = new URLSearchParams({
      lat: String(anchor.lat),
      lng: String(anchor.lng),
      radiusKm: String(DEFAULT_RADIUS_KM),
    });

    const res = await fetch(`/api/water-resources/nearest?${params.toString()}`, {
      cache: "no-store",
      signal: abortRef.current.signal,
    });

    if (!res.ok) throw new Error(`API ${res.status}`);

    const json = await res.json();
    const data = Array.isArray(json?.data) ? (json.data as WellPoint[]) : [];

    setWells(data);
    setSelected(null);

  }, []);

  const resetToNearby = useCallback(async () => {
    try {
      setResetting(true);
      setError(null);
      setHint("");

      const loc = await getBrowserLocation();
      const anchor = loc && inSaskatchewan(loc.lat, loc.lng) ? loc : SASKATOON_CENTER;

      const map = mapRef.current;
      if (map) {
        map.panTo(anchor);
        map.setZoom(DEFAULT_ZOOM);
      }

      await fetchNearbyWells(anchor);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setError(String(e?.message || e));
    } finally {
      setResetting(false);
    }
  }, [fetchNearbyWells]);

  const onLoad = useCallback(
    async (map: google.maps.Map) => {
      mapRef.current = map;

      map.setCenter(SASKATOON_CENTER);
      map.setZoom(DEFAULT_ZOOM);

      await resetToNearby();
    },
    [resetToNearby]
  );

  useEffect(() => {
    function onFocus(e: Event) {
      const ce = e as CustomEvent<any>;
      const d = ce.detail || {};
      const lat = Number(d.latitude);
      const lng = Number(d.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const p: WellPoint = {
        id: d.id ?? "focus",
        name: d.name ?? "Selected",
        latitude: lat,
        longitude: lng,
        available: d.available ?? null,
        status: d.status ?? null,
        distance_km: d.distance_km ?? null,
        hole_number: d.hole_number ?? null,
        land_location: d.land_location ?? null,
        borehole_depth: d.borehole_depth ?? null,
        water_level: d.water_level ?? null,
        pumping_rate: d.pumping_rate ?? null,
        recommended_pumping_rate: d.recommended_pumping_rate ?? null,
      };

      wrapperRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

      setWells([p]);
      setSelected(p);

      const map = mapRef.current;
      if (map) {
        map.panTo({ lat, lng });
        map.setZoom(14);
      }
    }

    window.addEventListener("well:focus", onFocus as any);
    return () => {
      window.removeEventListener("well:focus", onFocus as any);
      abortRef.current?.abort();
    };
  }, []);

  if (loadError) return <div>Map load failed.</div>;
  if (!isLoaded) return <div>Loading...</div>;

  return (
    <div ref={wrapperRef} className="map-inner">
      <button
        type="button"
        onClick={resetToNearby}
        disabled={resetting}
        className="reset-btn"
        aria-label="Reset map"
        title="Reset"
      >
        <img className="reset-img reset-img--normal" src="/reset.png" alt="" aria-hidden="true" />
        <img className="reset-img reset-img--hover" src="/reset-hover.png" alt="" aria-hidden="true" />
        <img className="reset-img reset-img--down" src="/reset-down.png" alt="" aria-hidden="true" />
      </button>

      {hint && <div className="map-hint">{hint}</div>}
      {error && <div className="map-error">{error}</div>}

      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "80vh" }}
        onLoad={onLoad}
        options={{
          mapTypeId: "hybrid",
          clickableIcons: false,
          streetViewControl: false,
          mapTypeControl: false,
          gestureHandling: "greedy",
          draggable: true,
          scrollwheel: true,
          zoomControl: true,
        }}
      >
        {wells.map((w) => (
          <Marker
            key={String(w.id)}
            position={{ lat: Number(w.latitude), lng: Number(w.longitude) }}
            onClick={() => setSelected(w)}
            icon={{
              url: "/marker-available.png",
              scaledSize: new google.maps.Size(36, 36),
            }}
          />
        ))}

        {selected && (
          <InfoWindow
            position={{ lat: Number(selected.latitude), lng: Number(selected.longitude) }}
            onCloseClick={() => setSelected(null)}
          >
            <div>
              <strong>{selected.name || "Unknown"}</strong>

              {selected.land_location && <div>Land: {selected.land_location}</div>}
              {selected.hole_number && <div>Hole: {selected.hole_number}</div>}

              <div>
                <span>Status: </span>
                {(() => {
                  const a = normalizeAvailable(selected);
                  if (a === true) return "Available";
                  if (a === false) return "Unavailable";
                  return "-";
                })()}
              </div>

              {typeof selected.distance_km === "number" && (
                <div>Distance: {selected.distance_km.toFixed(2)} km</div>
              )}

              {typeof selected.borehole_depth === "number" && (
                <div>Depth: {selected.borehole_depth} ft</div>
              )}

              {typeof selected.water_level === "number" && (
                <div>Water level: {selected.water_level}</div>
              )}

              {typeof selected.pumping_rate === "number" && (
                <div>Pumping rate: {selected.pumping_rate}</div>
              )}

              {typeof selected.recommended_pumping_rate === "number" && (
                <div>Recommended pumping rate: {selected.recommended_pumping_rate}</div>
              )}

              <div>
                <div>Lat: {Number(selected.latitude).toFixed(6)}</div>
                <div>Lng: {Number(selected.longitude).toFixed(6)}</div>
              </div>

              <div style={{ marginTop: "10px" }}>
                <Link href={`/wells/${selected.id}`}>Detail</Link>
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}