// =============================================================================
// data.js — Regions, crop requirements and rotation strategies
// Language-specific text lives in i18n.js. This file holds numbers only.
// =============================================================================

// Analysis periods (NASA POWER daily data)
const PERIOD = {
  start: 2006,
  end: 2025,          // last complete year
  recentFrom: 2016,   // "last 10 years" used for scoring
  earlyTo: 2015,      // 2006–2015 baseline for trends
  last5From: 2021     // last 5 years for trend comparison
};

// -----------------------------------------------------------------------------
// Featured regions. Coordinates point at farmland, not the province centre.
// `fallback` = APPROXIMATE climate values used only if NASA POWER is offline.
// They are rough estimates, not measured values — the UI labels them as such.
//   lastSpring / firstFall = day of year of last spring / first autumn frost
// -----------------------------------------------------------------------------
const REGIONS = {
  selenge:  { lat: 50.0,  lon: 106.2, style: "amber",
              fallback: { lastSpring: 152, firstFall: 258, gdd: 1300, heat30: 6,  rain: 270, maySoil: 0.45, lateFrost: 0.5, earlyFrost: 0.4 } },
  darkhan:  { lat: 49.47, lon: 105.97, style: "amber",
              fallback: { lastSpring: 150, firstFall: 261, gdd: 1400, heat30: 8,  rain: 260, maySoil: 0.42, lateFrost: 0.4, earlyFrost: 0.3 } },
  khovsgol: { lat: 49.62, lon: 101.99, style: "sky",   // Tarialan sum — ~74% of the province's arable land
              fallback: { lastSpring: 160, firstFall: 246, gdd: 980,  heat30: 2,  rain: 280, maySoil: 0.55, lateFrost: 1.2, earlyFrost: 1.0 } },
  bulgan:   { lat: 48.81, lon: 103.53, style: "sky",
              fallback: { lastSpring: 157, firstFall: 253, gdd: 1100, heat30: 3,  rain: 260, maySoil: 0.48, lateFrost: 0.9, earlyFrost: 0.7 } },
  tov:      { lat: 48.47, lon: 106.25, style: "red",   // Bornuur area (potato & grain)
              fallback: { lastSpring: 154, firstFall: 255, gdd: 1200, heat30: 5,  rain: 230, maySoil: 0.38, lateFrost: 0.7, earlyFrost: 0.5 } },
  khentii:  { lat: 48.3,  lon: 110.5, style: "red",
              fallback: { lastSpring: 153, firstFall: 254, gdd: 1250, heat30: 7,  rain: 230, maySoil: 0.33, lateFrost: 0.7, earlyFrost: 0.5 } },
  uvs:      { lat: 49.98, lon: 92.07, style: "red",    // Ulaangom — irrigated farming, sea buckthorn
              fallback: { lastSpring: 147, firstFall: 263, gdd: 1550, heat30: 14, rain: 120, maySoil: 0.22, lateFrost: 0.5, earlyFrost: 0.4 } }
};
const REGION_ORDER = ["selenge", "darkhan", "khovsgol", "bulgan", "tov", "khentii", "uvs"];
// Wide screens: zoom 6 keeps the central pins from overlapping; phones use 5
const MAP_HOME = { center: [48.6, 102.8], zoom: window.innerWidth >= 900 ? 6 : 5 };

// -----------------------------------------------------------------------------
// Crop requirements used by scoring.js. Pairs are [good, bad] — values at or
// better than `good` cost nothing, values at or worse than `bad` cost the full
// penalty, linear in between. These are starting points for agronomist review.
//   ff     frost-free days          gdd   growing degree-days (base 5°C, May–Sep)
//   heat   { t: threshold °C, ok/bad: days per year ≥ t between Jun 15–Aug 15 }
//   rain   May–Sep rainfall (mm)    irrigable: usually grown with irrigation
//   lateW / earlyW  weight of damaging frost (≤ −2°C) after sowing / before harvest
//   annual: false → perennial, spring soil wetness doesn't matter much
// -----------------------------------------------------------------------------
const CROPS = {
  wheat:        { emoji: "🌾", ff: [90, 70],  gdd: [1100, 850], heat: { t: 30, ok: 3, bad: 12 }, rain: [220, 130], irrigable: false, lateW: 3,  earlyW: 8,  annual: true },
  barley:       { emoji: "🌾", ff: [75, 60],  gdd: [900, 700],  heat: { t: 30, ok: 5, bad: 14 }, rain: [170, 100], irrigable: false, lateW: 3,  earlyW: 3,  annual: true },
  oats:         { emoji: "🌾", ff: [80, 65],  gdd: [950, 750],  heat: { t: 28, ok: 5, bad: 16 }, rain: [230, 140], irrigable: false, lateW: 3,  earlyW: 6,  annual: true },
  potato:       { emoji: "🥔", ff: [95, 80],  gdd: [950, 750],  heat: { t: 28, ok: 8, bad: 22 }, rain: [280, 160], irrigable: true,  lateW: 15, earlyW: 6,  annual: true, nights: true },
  rapeseed:     { emoji: "🌼", ff: [85, 70],  gdd: [1000, 800], heat: { t: 27, ok: 6, bad: 18 }, rain: [240, 150], irrigable: false, lateW: 6,  earlyW: 6,  annual: true },
  pea:          { emoji: "🫛", ff: [80, 65],  gdd: [900, 700],  heat: { t: 28, ok: 6, bad: 16 }, rain: [200, 120], irrigable: false, lateW: 4,  earlyW: 3,  annual: true },
  buckwheat:    { emoji: "🌸", ff: [95, 80],  gdd: [950, 750],  heat: { t: 30, ok: 4, bad: 12 }, rain: [190, 110], irrigable: false, lateW: 15, earlyW: 15, annual: true },
  alfalfa:      { emoji: "🌿", ff: [60, 40],  gdd: [700, 500],  heat: { t: 33, ok: 6, bad: 20 }, rain: [230, 130], irrigable: false, lateW: 0,  earlyW: 0,  annual: false },
  seabuckthorn: { emoji: "🍊", ff: [80, 60],  gdd: [900, 650],  heat: { t: 35, ok: 5, bad: 20 }, rain: [160, 80],  irrigable: true,  lateW: 4,  earlyW: 0,  annual: false },
  vegetables:   { emoji: "🥕", ff: [95, 80],  gdd: [950, 750],  heat: { t: 28, ok: 8, bad: 22 }, rain: [280, 160], irrigable: true,  lateW: 12, earlyW: 8,  annual: true }
};
const CROP_ORDER = ["wheat", "barley", "oats", "potato", "rapeseed", "pea", "buckwheat", "alfalfa", "seabuckthorn", "vegetables"];

// -----------------------------------------------------------------------------
// Rotation strategies. `crops` are scored together; `attrs` (0–3) drive the
// farmer-priority ranking: soil health, livestock feed, income, water saving.
// -----------------------------------------------------------------------------
const STRATEGIES = {
  baseline:        { crops: ["wheat"],                     attrs: { soil: 0, feed: 0, income: 2, water: 1 }, baseline: true },
  soil_protector:  { crops: ["wheat", "rapeseed"],         attrs: { soil: 2, feed: 1, income: 3, water: 0 } },
  livestock_saver: { crops: ["wheat", "alfalfa"],          attrs: { soil: 3, feed: 3, income: 1, water: 1 } },
  legume_boost:    { crops: ["wheat", "pea", "barley"],    attrs: { soil: 3, feed: 1, income: 2, water: 2 } },
  short_season:    { crops: ["barley", "oats", "pea"],     attrs: { soil: 2, feed: 3, income: 1, water: 2 } },
  potato_cash:     { crops: ["potato", "barley"],          attrs: { soil: 1, feed: 1, income: 3, water: 0 } },
  low_input:       { crops: ["wheat", "buckwheat"],        attrs: { soil: 2, feed: 0, income: 2, water: 2 } },
  shelterbelt:     { crops: ["seabuckthorn", "barley"],    attrs: { soil: 3, feed: 1, income: 3, water: 1 } }
};
const STRATEGY_ORDER = ["baseline", "soil_protector", "livestock_saver", "legume_boost", "short_season", "potato_cash", "low_input", "shelterbelt"];
