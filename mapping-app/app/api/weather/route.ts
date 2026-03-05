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
function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
function drynessLevel(score: number) {
  if (score >= 80) return "EXTREME";
  if (score >= 60) return "HIGH";
  if (score >= 35) return "MED";
  return "LOW";
}
function buildAdvice(score: number, p48: number, windMax24: number) {
  const lvl = drynessLevel(score);
  const rainSoon = p48 >= 5;
  const windy = windMax24 >= 35;

  if (lvl === "EXTREME") {
    if (rainSoon) return "Very dry risk, but rain is likely within 48h. Consider delaying non-urgent irrigation.";
    return windy ? "Very dry risk. High wind expected: avoid sprinkler during peak wind hours." : "Very dry risk. Plan irrigation within 48h if possible.";
  }
  if (lvl === "HIGH") {
    if (rainSoon) return "Dry week ahead, but rain is likely within 48h. Consider delaying irrigation.";
    return windy ? "Dry week ahead. High wind expected: avoid sprinkler during peak wind hours." : "Dry week ahead. Consider irrigation scheduling soon.";
  }
  if (lvl === "MED") {
    if (rainSoon) return "Moderate dryness. Rain likely within 48h; irrigation may be unnecessary.";
    return "Moderate dryness. Monitor soil moisture and forecast.";
  }
  return "Low dryness risk. Normal monitoring.";
}

export async function GET(req: Request) {
  try {
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
    const daily = json.daily || {};

    const t: string[] = hourly.time || [];
    const idx24 = Math.min(24, t.length);
    const idx48 = Math.min(48, t.length);

    const temp24 = (hourly.temperature_2m || []).slice(0, idx24);
    const precip24 = (hourly.precipitation || []).slice(0, idx24);
    const pop24 = (hourly.precipitation_probability || []).slice(0, idx24);
    const wind24 = (hourly.wind_speed_10m || []).slice(0, idx24);
    const gust24 = (hourly.wind_gusts_10m || []).slice(0, idx24);
    const et024 = (hourly.et0_fao_evapotranspiration || []).slice(0, idx24);
    const vpd24 = (hourly.vapour_pressure_deficit || []).slice(0, idx24);

    const precip48 = (hourly.precipitation || []).slice(0, idx48);

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

    const p7_mm = sum(daily.precipitation_sum || []);
    const et0_7d_mm = sum(daily.et0_fao_evapotranspiration_sum || []);
    const water_deficit_7d_mm = Math.max(0, (Number(et0_7d_mm) || 0) - (Number(p7_mm) || 0));

    const windMax7 = max(daily.wind_speed_10m_max || []) ?? 0;
    const tMax7 = max(daily.temperature_2m_max || []) ?? 0;

    const score_raw =
      clamp((water_deficit_7d_mm / 35) * 70, 0, 70) +
      clamp((tMax7 - 20) * 1.5, 0, 20) +
      clamp((windMax7 - 20) * 0.5, 0, 10);

    const dryness_score = Math.round(clamp(score_raw, 0, 100));
    const dryness_level = drynessLevel(dryness_score);

    const p48_mm = sum(precip48);
    const wind_max_24 = max(wind24) ?? 0;

    const advice = buildAdvice(dryness_score, p48_mm, wind_max_24);

    return NextResponse.json({
      ok: true,
      lat,
      lng,
      meta: {
        fetched_at: new Date().toISOString(),
        source_url: url,
        timezone: json.timezone ?? null,
      },
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
      agro: {
        p7_mm,
        et0_7d_mm,
        water_deficit_7d_mm,
        dryness_score,
        dryness_level,
        next48h_precip_mm: p48_mm,
        advice,
      },
      hourly24,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}