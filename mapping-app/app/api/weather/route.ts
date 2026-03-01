import { NextResponse } from "next/server";

export const runtime = "nodejs";

function toNum(v: string | null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function sum(arr: any[]) {
  return (arr || []).reduce((a, b) => a + (Number.isFinite(Number(b)) ? Number(b) : 0), 0);
}
function max(arr: any[]) {
  let m = -Infinity;
  for (const v of arr || []) {
    const n = Number(v);
    if (Number.isFinite(n) && n > m) m = n;
  }
  return m === -Infinity ? null : m;
}
function min(arr: any[]) {
  let m = Infinity;
  for (const v of arr || []) {
    const n = Number(v);
    if (Number.isFinite(n) && n < m) m = n;
  }
  return m === Infinity ? null : m;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = toNum(searchParams.get("lat"));
  const lng = toNum(searchParams.get("lng"));

  if (lat == null || lng == null) {
    return NextResponse.json({ ok: false, error: "Bad lat/lng" }, { status: 400 });
  }

  const hourlyVars = [
    "temperature_2m",
    "relative_humidity_2m",
    "precipitation",
    "precipitation_probability",
    "wind_speed_10m",
    "wind_gusts_10m",
    "wind_direction_10m",
    "et0_fao_evapotranspiration",
    "vapour_pressure_deficit",
  ].join(",");

  const dailyVars = [
    "temperature_2m_max",
    "temperature_2m_min",
    "precipitation_sum",
    "precipitation_probability_max",
    "wind_speed_10m_max",
    "wind_gusts_10m_max",
    "et0_fao_evapotranspiration_sum",
  ].join(",");

  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${encodeURIComponent(String(lat))}` +
    `&longitude=${encodeURIComponent(String(lng))}` +
    `&current_weather=true` +
    `&hourly=${encodeURIComponent(hourlyVars)}` +
    `&daily=${encodeURIComponent(dailyVars)}` +
    `&forecast_days=7` +
    `&forecast_hours=48` +
    `&timezone=auto`;

  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) return NextResponse.json({ ok: false, error: `Upstream ${r.status}` }, { status: 502 });

  const json: any = await r.json();
  const hourly = json.hourly || {};
  const t: string[] = hourly.time || [];
  const idx24 = Math.min(24, t.length);

  const temp24 = (hourly.temperature_2m || []).slice(0, idx24);
  const precip24 = (hourly.precipitation || []).slice(0, idx24);
  const pop24 = (hourly.precipitation_probability || []).slice(0, idx24);
  const wind24 = (hourly.wind_speed_10m || []).slice(0, idx24);
  const gust24 = (hourly.wind_gusts_10m || []).slice(0, idx24);
  const et024 = (hourly.et0_fao_evapotranspiration || []).slice(0, idx24);
  const vpd24 = (hourly.vapour_pressure_deficit || []).slice(0, idx24);

  const hourly24 = Array.from({ length: idx24 }).map((_, i) => ({
    time: t[i],
    temperature_2m: hourly.temperature_2m?.[i] ?? null,
    relative_humidity_2m: hourly.relative_humidity_2m?.[i] ?? null,
    precipitation: hourly.precipitation?.[i] ?? null,
    precipitation_probability: hourly.precipitation_probability?.[i] ?? null,
    wind_speed_10m: hourly.wind_speed_10m?.[i] ?? null,
    wind_gusts_10m: hourly.wind_gusts_10m?.[i] ?? null,
    wind_direction_10m: hourly.wind_direction_10m?.[i] ?? null,
    et0_fao_evapotranspiration: hourly.et0_fao_evapotranspiration?.[i] ?? null,
    vapour_pressure_deficit: hourly.vapour_pressure_deficit?.[i] ?? null,
  }));

  return NextResponse.json({
    ok: true,
    lat,
    lng,
    current: json.current_weather ?? null,
    hourly_units: json.hourly_units ?? null,
    daily: json.daily ?? null,
    daily_units: json.daily_units ?? null,
    summary: {
      next24h: {
        temperature_min: min(temp24),
        temperature_max: max(temp24),
        precipitation_sum: sum(precip24),
        precipitation_probability_max: max(pop24),
        wind_speed_max: max(wind24),
        wind_gusts_max: max(gust24),
        et0_sum: sum(et024),
        vpd_max: max(vpd24),
      },
    },
    hourly24,
  });
}