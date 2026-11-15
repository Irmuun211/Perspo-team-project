// =============================================================================
// nasa.js — Fetch NASA POWER daily data and turn it into crop-relevant stats
// API docs: https://power.larc.nasa.gov/docs/services/api/temporal/daily/
// Parameters:
//   T2M_MAX / T2M_MIN  daily max / min air temperature at 2 m (°C)
//   PRECTOTCORR        bias-corrected precipitation (mm/day)
//   GWETTOP            surface soil wetness, 0 (dry) – 1 (saturated); MERRA-2 model
// =============================================================================

const NASA_TIMEOUT_MS = 30000;
const nasaCache = {};

function cacheKey(lat, lon) {
  // NASA POWER's grid is ~0.5° × 0.625°, so nearby clicks share a result
  return `${(Math.round(lat * 4) / 4).toFixed(2)},${(Math.round(lon * 4) / 4).toFixed(2)}`;
}

function readCache(key) {
  if (nasaCache[key]) return nasaCache[key];
  try {
    const raw = sessionStorage.getItem(`cropCopilotNasa_v2_${PERIOD.start}_${PERIOD.end}_${key}`);
    if (raw) return (nasaCache[key] = JSON.parse(raw));
  } catch (e) {}
  return null;
}

function writeCache(key, stats) {
  nasaCache[key] = stats;
  try {
    sessionStorage.setItem(`cropCopilotNasa_v2_${PERIOD.start}_${PERIOD.end}_${key}`, JSON.stringify(stats));
  } catch (e) {}
}

async function fetchNasaPower(lat, lon) {
  const key = cacheKey(lat, lon);
  const cached = readCache(key);
  if (cached) return cached;

  const url =
    "https://power.larc.nasa.gov/api/temporal/daily/point" +
    "?parameters=T2M_MAX,T2M_MIN,PRECTOTCORR,GWETTOP&community=AG" +
    `&latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
    `&start=${PERIOD.start}0101&end=${PERIOD.end}1231&format=JSON`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NASA_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`NASA POWER HTTP ${res.status}`);
    const json = await res.json();
    const p = json?.properties?.parameter;
    if (!p || !p.T2M_MAX || !p.T2M_MIN || !p.PRECTOTCORR) throw new Error("Unexpected NASA POWER response");
    const elevation = json?.geometry?.coordinates?.[2];
    const stats = computeStats(p, elevation);
    if (!stats.years.length) throw new Error("No complete years in NASA POWER response");
    stats.isLive = true;
    writeCache(key, stats);
    return stats;
  } finally {
    clearTimeout(timer);
  }
}

// ---- helpers ---------------------------------------------------------------
function dayOfYear(y, m, d) {
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000) + 1;
}
function mean(arr) {
  const v = arr.filter((x) => x !== null && x !== undefined && !Number.isNaN(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
const HEAT_THRESHOLDS = [27, 28, 30, 33, 35];
const valid = (v) => typeof v === "number" && v > -900;

// ---- per-year statistics ---------------------------------------------------
function computeStats(p, elevation) {
  const byYear = {};
  for (const date of Object.keys(p.T2M_MAX)) {
    const y = +date.slice(0, 4), m = +date.slice(4, 6), d = +date.slice(6, 8);
    (byYear[y] = byYear[y] || []).push({
      m, d, doy: dayOfYear(y, m, d),
      tmax: p.T2M_MAX[date], tmin: p.T2M_MIN[date],
      rain: p.PRECTOTCORR[date], soil: p.GWETTOP ? p.GWETTOP[date] : -999
    });
  }

  // Monthly climate (recent 10 years): mean temperature, mean max/min, total rain
  const mAcc = Array.from({ length: 12 }, () => ({ t: [], tmax: [], tmin: [], rain: 0, yrs: new Set() }));
  for (const y of Object.keys(byYear).map(Number)) {
    if (y < PERIOD.recentFrom) continue;
    for (const x of byYear[y]) {
      const a = mAcc[x.m - 1];
      if (valid(x.tmax) && valid(x.tmin)) { a.t.push((x.tmax + x.tmin) / 2); a.tmax.push(x.tmax); a.tmin.push(x.tmin); }
      if (valid(x.rain)) { a.rain += x.rain; a.yrs.add(y); }
    }
  }
  const monthly = mAcc.map((a) => ({
    t: mean(a.t), tmax: mean(a.tmax), tmin: mean(a.tmin),
    rain: a.yrs.size ? a.rain / a.yrs.size : null
  }));

  const years = [];
  for (const y of Object.keys(byYear).map(Number).sort()) {
    const days = byYear[y];
    const season = days.filter((x) => x.m >= 5 && x.m <= 9);
    const missing = season.filter((x) => !valid(x.tmax) || !valid(x.tmin)).length;
    if (season.length < 150 || missing > 20) continue; // skip incomplete years

    const JUL15 = dayOfYear(y, 7, 15);
    let lastSpring = 0, firstFall = 366;
    for (const x of days) {
      if (!valid(x.tmin) || x.tmin > 0) continue;
      if (x.doy <= JUL15) lastSpring = Math.max(lastSpring, x.doy);
      else if (x.doy < firstFall) firstFall = x.doy;
    }

    let gdd = 0, rain = 0, hotNights = 0, lateFrost = 0, earlyFrost = 0;
    const heat = Object.fromEntries(HEAT_THRESHOLDS.map((t) => [t, 0]));
    const maySoil = [];
    const flowerFrom = dayOfYear(y, 6, 15), flowerTo = dayOfYear(y, 8, 15);
    const lateFrom = dayOfYear(y, 5, 25), lateTo = dayOfYear(y, 6, 20);
    const earlyFrom = dayOfYear(y, 8, 15), earlyTo = dayOfYear(y, 9, 10);

    for (const x of season) {
      if (valid(x.tmax) && valid(x.tmin)) {
        gdd += Math.max(0, (x.tmax + x.tmin) / 2 - 5);
        if (x.doy >= flowerFrom && x.doy <= flowerTo) {
          HEAT_THRESHOLDS.forEach((t) => { if (x.tmax >= t) heat[t]++; });
          if (x.tmin >= 18) hotNights++;
        }
        if (x.tmin <= -2 && x.doy >= lateFrom && x.doy <= lateTo) lateFrost++;
        if (x.tmin <= -2 && x.doy >= earlyFrom && x.doy <= earlyTo) earlyFrost++;
      }
      if (valid(x.rain)) rain += x.rain;
      if (x.m === 5 && valid(x.soil) && x.soil >= 0 && x.soil <= 1) maySoil.push(x.soil);
    }

    years.push({
      year: y, lastSpring, firstFall, ff: firstFall - lastSpring - 1,
      gdd: Math.round(gdd), heat, hotNights, rain: Math.round(rain),
      maySoil: mean(maySoil), lateFrost, earlyFrost
    });
  }
  const out = summarize(years, elevation);
  out.monthly = monthly;
  return out;
}

function summarizePeriod(years) {
  const pick = (f) => mean(years.map(f));
  return {
    ff: pick((y) => y.ff), lastSpring: pick((y) => y.lastSpring), firstFall: pick((y) => y.firstFall),
    gdd: pick((y) => y.gdd), rain: pick((y) => y.rain), maySoil: pick((y) => y.maySoil),
    hotNights: pick((y) => y.hotNights), lateFrost: pick((y) => y.lateFrost), earlyFrost: pick((y) => y.earlyFrost),
    heat: Object.fromEntries(HEAT_THRESHOLDS.map((t) => [t, pick((y) => y.heat[t])]))
  };
}

function summarize(years, elevation) {
  const recent = years.filter((y) => y.year >= PERIOD.recentFrom);
  const early = years.filter((y) => y.year <= PERIOD.earlyTo);
  const last5 = years.filter((y) => y.year >= PERIOD.last5From);
  const summary = summarizePeriod(recent.length ? recent : years);
  let trend = null;
  if (early.length >= 5 && last5.length >= 3) {
    const e = summarizePeriod(early), l = summarizePeriod(last5);
    trend = {
      ff: l.ff - e.ff, heat30: l.heat[30] - e.heat[30],
      rain: l.rain - e.rain,
      maySoil: l.maySoil !== null && e.maySoil !== null ? l.maySoil - e.maySoil : null
    };
  }
  return { years, summary, trend, elevation: elevation ?? null, isLive: false };
}

// ---- approximate offline fallback -----------------------------------------
function fallbackStats(regionId) {
  const f = REGIONS[regionId].fallback;
  const h30 = f.heat30;
  return {
    years: [],
    summary: {
      ff: f.firstFall - f.lastSpring - 1, lastSpring: f.lastSpring, firstFall: f.firstFall,
      gdd: f.gdd, rain: f.rain, maySoil: f.maySoil, hotNights: 0,
      lateFrost: f.lateFrost, earlyFrost: f.earlyFrost,
      // derive other thresholds from the ≥30°C count (rough ratios)
      heat: { 27: h30 * 2.2 + 3, 28: h30 * 1.7 + 2, 30: h30, 33: h30 * 0.35, 35: h30 * 0.12 }
    },
    trend: null, elevation: null, isLive: false, fallbackRegion: regionId,
    monthly: approxMonthly(f)
  };
}

// Rough monthly climate for the offline fallback: a seasonal temperature curve
// set from growing degree days, and growing-season rain spread the usual way
// (most rain falls in June–August in Mongolia).
function approxMonthly(f) {
  const july = f.gdd / 153 + 5 + 5, jan = july - 38;
  const mid = (july + jan) / 2, amp = (july - jan) / 2;
  const share = [0.01, 0.01, 0.02, 0.04, 0.09, 0.19, 0.27, 0.24, 0.11, 0.04, 0.02, 0.01];
  const total = f.rain / 0.9;
  return share.map((s, i) => {
    const t = mid + amp * Math.cos((2 * Math.PI * (i - 6)) / 12);
    return { t, tmax: t + 7, tmin: t - 7, rain: total * s };
  });
}
