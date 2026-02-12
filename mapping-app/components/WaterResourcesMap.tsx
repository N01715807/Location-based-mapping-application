"use client";

import { GoogleMap, Marker, InfoWindow, useLoadScript } from "@react-google-maps/api";
import { useEffect, useState } from "react";

export default function WaterResourcesMap() {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
  });

  const [data, setData] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => {
    fetch("/api/water-resources")
      .then(res => res.json())
      .then(json => setData(json.data));
  }, []);

  if (!isLoaded) return <div>Loading...</div>;

  return (
    <GoogleMap
      center={{ lat: 52.9, lng: -106.0 }} 
      zoom={6}
      mapContainerStyle={{ width: "100%", height: "80vh" }}
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
            <strong>{selected.name}</strong>
            <p>Type: {selected.type}</p>
            <p>Status: {selected.status}</p>
          </div>
          </InfoWindow>
        )}
    </GoogleMap>
  );
}
