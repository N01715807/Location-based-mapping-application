"use client";

import { GoogleMap, Marker, useLoadScript } from "@react-google-maps/api";
import { useEffect, useState } from "react";

export default function WaterResourcesMap() {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
  });

  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/water-resources")
      .then(res => res.json())
      .then(json => setData(json.data));
  }, []);

  if (!isLoaded) return <div>Loading...</div>;

  return (
    <GoogleMap
      center={{ lat: 52.1332, lng: -106.67 }}   // Saskatoon
      zoom={12}
      mapContainerStyle={{ width: "100%", height: "80vh" }}
    >
      {data.map((r) => (
        <Marker
          key={r.id}
          position={{
            lat: Number(r.latitude),
            lng: Number(r.longitude),
          }}
        />
      ))}
    </GoogleMap>
  );
}
