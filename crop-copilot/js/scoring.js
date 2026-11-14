// =============================================================================
// scoring.js — Compare a location's climate stats with each crop's needs
// Transparent, rule-based scoring (no black box) so farmers and agronomists
// can see exactly why a crop scored the way it did.
// =============================================================================

// 0 when value is at/better than `good`, 1 when at/worse than `bad`, linear between
function riskFraction(v, good, bad) {
  if (v === null || v === undefined) return 0;
  if (good > bad) { if (v >= good) return 0; if (v <= bad) return 1; return (good - v) / (good - bad); }
  if (v <= good) return 0; if (v >= bad) return 1; return (v - good) / (bad - good);
}

const WEIGHTS = { season: 45, heat: 30, water: 35, waterIrrigated: 8, soil: 10, soilIrrigated: 4 };

function scoreCrop(cropId, s, opts = {}) {
  const c = CROPS[cropId];
  const irrigated = !!opts.irrigated;
  const pens = [];

  // 1. Season length & warmth
  const fFF = riskFraction(s.ff, c.ff[0], c.ff[1]);
  const fGDD = riskFraction(s.gdd, c.gdd[0], c.gdd[1]);
  if (fFF >= fGDD) pens.push({ key: "r_ff", p: fFF * WEIGHTS.season, v: Math.round(s.ff), need: c.ff[0] });
  else pens.push({ key: "r_gdd", p: fGDD * WEIGHTS.season, v: Math.round(s.gdd), need: c.gdd[0] });

  // 2. Mid-summer heat at flowering (and warm nights for potato)
  const hd = s.heat[c.heat.t];
  pens.push({ key: "r_heat", p: riskFraction(hd, c.heat.ok, c.heat.bad) * WEIGHTS.heat, v: Math.round(hd), thr: c.heat.t });
  if (c.nights) pens.push({ key: "r_nights", p: riskFraction(s.hotNights, 3, 12) * 15, v: Math.round(s.hotNights) });

  // 3. Water
  const fRain = riskFraction(s.rain, c.rain[0], c.rain[1]);
  const rainKey = !irrigated && c.irrigable && fRain > 0.3 ? "r_irrig" : "r_rain";
  pens.push({ key: rainKey, p: fRain * (irrigated ? WEIGHTS.waterIrrigated : WEIGHTS.water), v: Math.round(s.rain), need: c.rain[0] });

  // 4. Dry spring topsoil at sowing (annual crops only)
  if (c.annual && s.maySoil !== null && s.maySoil !== undefined) {
    pens.push({ key: "r_soil", p: riskFraction(s.maySoil, 0.40, 0.20) * (irrigated ? WEIGHTS.soilIrrigated : WEIGHTS.soil), v: Math.round(s.maySoil * 100) });
  }

  // 5. Damaging frosts after sowing / before harvest
  if (c.lateW) pens.push({ key: "r_late", p: riskFraction(s.lateFrost, 0, 3) * c.lateW, v: +s.lateFrost.toFixed(1) });
  if (c.earlyW) pens.push({ key: "r_early", p: riskFraction(s.earlyFrost, 0, 3) * c.earlyW, v: +s.earlyFrost.toFixed(1) });

  const total = pens.reduce((a, b) => a + b.p, 0);
  const score = Math.max(0, Math.round(100 - total));
  const level = score >= 70 ? "good" : score >= 45 ? "risky" : "poor";
  const reasons = pens.filter((x) => x.p >= 5).sort((a, b) => b.p - a.p).slice(0, 2);
  return { id: cropId, score, level, reasons };
}

function scoreAllCrops(stats, opts) {
  const out = {};
  CROP_ORDER.forEach((id) => { out[id] = scoreCrop(id, stats.summary, opts); });
  return out;
}

// Strategy fit = mostly the average crop score, pulled down by the weakest crop
function rankStrategies(cropScores, priority) {
  const list = STRATEGY_ORDER.map((id) => {
    const st = STRATEGIES[id];
    const scores = st.crops.map((c) => cropScores[c].score);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const fit = Math.round(0.6 * avg + 0.4 * Math.min(...scores));
    const a = st.attrs;
    const pref = priority === "balanced" ? (a.soil + a.feed + a.income + a.water) / 4 : a[priority];
    return { id, fit, rank: fit + pref * 8, baseline: !!st.baseline };
  });
  const baseline = list.find((s) => s.baseline);
  const others = list.filter((s) => !s.baseline).sort((a, b) => b.rank - a.rank);
  return { baseline, top: others.slice(0, 3), all: [baseline, ...others] };
}

// True when no annual food/feed crop is at least "risky"
function isPastureOnly(cropScores) {
  return ["wheat", "barley", "oats", "potato", "pea", "buckwheat", "rapeseed"]
    .every((id) => cropScores[id].level === "poor");
}

// Biggest climate risk at this location, for the alert banner
function mainRisk(s) {
  const risks = [
    { type: "season", sev: riskFraction(s.ff, 100, 75) },
    { type: "heat", sev: riskFraction(s.heat[30], 4, 14) },
    { type: "drought", sev: Math.max(riskFraction(s.rain, 240, 140), riskFraction(s.maySoil ?? 0.5, 0.40, 0.20)) }
  ].sort((a, b) => b.sev - a.sev);
  return risks[0].sev >= 0.25 ? risks[0].type : "ok";
}
