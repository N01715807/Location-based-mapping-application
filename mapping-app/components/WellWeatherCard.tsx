"use client";

import { useEffect, useState } from "react";

export default function WellWeatherCard({ lat, lng }: { lat: number; lng: number }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const res = await fetch(`/api/weather?lat=${lat}&lng=${lng}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json?.ok) throw new Error(json?.error || `API ${res.status}`);
        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) setErr(String(e?.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [lat, lng]);

  if (loading) return <div>Weather: Loading...</div>;
  if (err) return <div>Weather error: {err}</div>;
  if (!data) return <div>Weather: No data</div>;

  const uH = data.hourly_units || {};
  const uD = data.daily_units || {};
  const cur = data.current || {};
  const s = data.summary?.next24h || {};
  const daily = data.daily || {};
  const h24 = data.hourly24 || [];

  return (
    <div>
      <h2>Weather</h2>

      <h3>Current</h3>
      <table>
        <tbody>
          <tr><td>Time</td><td>{cur.time ?? "-"}</td></tr>
          <tr><td>Temperature</td><td>{cur.temperature ?? "-"} {uH.temperature_2m || "°C"}</td></tr>
          <tr><td>Wind</td><td>{cur.windspeed ?? "-"} {cur.windspeed_unit || uH.wind_speed_10m || ""}</td></tr>
          <tr><td>Wind direction</td><td>{cur.winddirection ?? "-"}°</td></tr>
          <tr><td>Weather code</td><td>{cur.weathercode ?? "-"}</td></tr>
        </tbody>
      </table>

      <h3>Next 24 hours (summary)</h3>
      <table>
        <tbody>
          <tr><td>Temp min</td><td>{s.temperature_min ?? "-"} {uH.temperature_2m || "°C"}</td></tr>
          <tr><td>Temp max</td><td>{s.temperature_max ?? "-"} {uH.temperature_2m || "°C"}</td></tr>
          <tr><td>Precip total</td><td>{s.precipitation_sum ?? "-"} {uH.precipitation || "mm"}</td></tr>
          <tr><td>Max precip probability</td><td>{s.precipitation_probability_max ?? "-"} {uH.precipitation_probability || "%"}</td></tr>
          <tr><td>Max wind</td><td>{s.wind_speed_max ?? "-"} {uH.wind_speed_10m || "km/h"}</td></tr>
          <tr><td>Max gust</td><td>{s.wind_gusts_max ?? "-"} {uH.wind_gusts_10m || "km/h"}</td></tr>
          <tr><td>ET₀ total</td><td>{s.et0_sum ?? "-"} {uH.et0_fao_evapotranspiration || "mm"}</td></tr>
          <tr><td>Max VPD</td><td>{s.vpd_max ?? "-"} {uH.vapour_pressure_deficit || "kPa"}</td></tr>
        </tbody>
      </table>

      <h3>Hourly (next 24h)</h3>
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Temp</th>
            <th>RH</th>
            <th>Precip</th>
            <th>PoP</th>
            <th>Wind</th>
            <th>Gust</th>
            <th>Dir</th>
            <th>ET₀</th>
            <th>VPD</th>
          </tr>
        </thead>
        <tbody>
          {h24.map((x: any) => (
            <tr key={x.time}>
              <td>{x.time}</td>
              <td>{x.temperature_2m ?? "-"} {uH.temperature_2m || ""}</td>
              <td>{x.relative_humidity_2m ?? "-"} {uH.relative_humidity_2m || "%"}</td>
              <td>{x.precipitation ?? "-"} {uH.precipitation || "mm"}</td>
              <td>{x.precipitation_probability ?? "-"} {uH.precipitation_probability || "%"}</td>
              <td>{x.wind_speed_10m ?? "-"} {uH.wind_speed_10m || "km/h"}</td>
              <td>{x.wind_gusts_10m ?? "-"} {uH.wind_gusts_10m || "km/h"}</td>
              <td>{x.wind_direction_10m ?? "-"}°</td>
              <td>{x.et0_fao_evapotranspiration ?? "-"} {uH.et0_fao_evapotranspiration || "mm"}</td>
              <td>{x.vapour_pressure_deficit ?? "-"} {uH.vapour_pressure_deficit || "kPa"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>7-day (daily)</h3>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Min temp</th>
            <th>Max temp</th>
            <th>Precip</th>
            <th>Max PoP</th>
            <th>Max wind</th>
            <th>Max gust</th>
            <th>ET₀</th>
          </tr>
        </thead>
        <tbody>
          {(daily.time || []).map((day: string, i: number) => (
            <tr key={day}>
              <td>{day}</td>
              <td>{daily.temperature_2m_min?.[i] ?? "-"} {uD.temperature_2m_min || "°C"}</td>
              <td>{daily.temperature_2m_max?.[i] ?? "-"} {uD.temperature_2m_max || "°C"}</td>
              <td>{daily.precipitation_sum?.[i] ?? "-"} {uD.precipitation_sum || "mm"}</td>
              <td>{daily.precipitation_probability_max?.[i] ?? "-"} {uD.precipitation_probability_max || "%"}</td>
              <td>{daily.wind_speed_10m_max?.[i] ?? "-"} {uD.wind_speed_10m_max || "km/h"}</td>
              <td>{daily.wind_gusts_10m_max?.[i] ?? "-"} {uD.wind_gusts_10m_max || "km/h"}</td>
              <td>{daily.et0_fao_evapotranspiration_sum?.[i] ?? "-"} {uD.et0_fao_evapotranspiration_sum || "mm"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}