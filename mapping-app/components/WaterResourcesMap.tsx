"use client";

import {
  GoogleMap,
  Marker,
  InfoWindow,
  useLoadScript,
} from "@react-google-maps/api";
import { useCallback, useRef, useState } from "react";

export default function WaterResourcesMap() {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
  });

  const mapRef = useRef<google.maps.Map | null>(null);

  const [data, setData] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);

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

    const res = await fetch(`/api/water-resources?${params.toString()}`);
    const json = await res.json();
    setData(json.data || []);
  }, []);

  const onIdle = useCallback(() => {
    fetchByBounds();
  }, [fetchByBounds]);

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    fetchByBounds();
  }, [fetchByBounds]);

  if (!isLoaded) return <div>Loading...</div>;

  return (
    <GoogleMap
      center={{ lat: 52.9, lng: -106.0 }}
      zoom={6}
      mapContainerStyle={{ width: "100%", height: "80vh" }}
      onLoad={onLoad}
      onIdle={onIdle}
    >
      {data.map((r) => (
        <Marker
          key={r.id}
          position={{
            lat: Number(r.latitude),
            lng: Number(r.longitude),
          }}
          onClick={() => setSelected(r)}
        />
      ))}

      {selected && (
        <InfoWindow
          position={{
            lat: Number(selected.latitude),
            lng: Number(selected.longitude),
          }}
          onCloseClick={() => setSelected(null)}
        >
          <div>
            <strong>{selected.name || "Unknown"}</strong>
            { }
            <p>Lat: {selected.latitude}</p>
            <p>Lng: {selected.longitude}</p>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
}
