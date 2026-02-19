"use client";

import {
  GoogleMap,
  Marker,
  InfoWindow,
  useLoadScript,
  MarkerClusterer,
} from "@react-google-maps/api";
import { useCallback, useEffect, useRef, useState } from "react";

type WaterPoint = {
  id?: number | string;
  source?: string;
  source_objectid?: number | string;

  name?: string | null;
  latitude: number | string;
  longitude: number | string;

  available?: boolean | number | null;
  status?: string | null;
};

function makeKey(p: WaterPoint) {
  if (p.id != null) return String(p.id);
  if (p.source && p.source_objectid != null)
    return `${p.source}:${p.source_objectid}`;
  return `${p.latitude}:${p.longitude}`;
}

function normalizeAvailable(p: WaterPoint): boolean | null {
  if (p.available === true || p.available === 1) return true;
  if (p.available === false || p.available === 0) return false;

  const s = (p.status || "").toLowerCase().trim();
  if (!s) return null;
  if (["active", "available", "open", "in service", "operational"].includes(s))
    return true;
  if (
    ["inactive", "unavailable", "closed", "out of service", "abandoned"].includes(
      s
    )
  )
    return false;

  return null;
}

export default function WaterResourcesMap() {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [data, setData] = useState<WaterPoint[]>([]);
  const [selected, setSelected] = useState<WaterPoint | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchByBounds = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;

    const bounds = map.getBounds();
    if (!bounds) return;

    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();

    const params = new URLSearchParams({
      minLat: String(sw.lat()),
      maxLat: String(ne.lat()),
      minLng: String(sw.lng()),
      maxLng: String(ne.lng()),
      limit: "2000",
    });

    try {
      setError(null);
      const res = await fetch(`/api/water-resources?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const json = await res.json();
      setData(Array.isArray(json?.data) ? json.data : []);
    } catch (e: any) {
      setError(String(e?.message || e));
    }
  }, []);

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
    }, 250);
  }, [fetchByBounds]);

  useEffect(() => {
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  if (loadError) return <div>Map load failed.</div>;
  if (!isLoaded) return <div>Loading...</div>;

  const validPoints = data.filter((r) => {
    const lat = Number(r.latitude);
    const lng = Number(r.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng);
  });

  return (
    <div style={{ width: "100%" }}>
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
        }}
      >
        <MarkerClusterer>
          {(clusterer) => (
            <>
              {validPoints.map((r) => (
                <Marker
                  key={makeKey(r)}
                  clusterer={clusterer as any}
                  position={{
                    lat: Number(r.latitude),
                    lng: Number(r.longitude),
                  }}
                  onClick={() => setSelected(r)}
                />
              ))}
            </>
          )}
        </MarkerClusterer>

        {selected && (
          <InfoWindow
            position={{
              lat: Number(selected.latitude),
              lng: Number(selected.longitude),
            }}
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
