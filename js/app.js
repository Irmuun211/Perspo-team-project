// =============================================================================
// app.js — Map, state and rendering for the Mongolian Crop Co-Pilot
// =============================================================================

const state = {
  lang: "mn",
  location: null,          // { type: "region"|"point", id?, lat, lon }
  stats: null,
  cropScores: null,
  ranking: null,
  selectedStrategyId: null,
  priority: "balanced",
  irrigated: false,
  chartMetric: "ff",
  mapLayer: "street",
  theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
  loading: false,
  showAllCrops: false,
  loadToken: 0
};

let map, satelliteLayer, satelliteLabelsLayer, pointMarker = null;
let lightStreetLayer, accuracyCircle = null;
const regionMarkers = {};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
const T = () => TRANSLATIONS[state.lang];
const isPhone = () => window.innerWidth < 640;
const $ = (id) => document.getElementById(id);
function fmt(str, vars = {}) {
  return String(str).replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : `{${k}}`));
}
function fmtDate(doy) {
  const d = new Date(Date.UTC(2023, 0, 1) + (Math.round(doy) - 1) * 86400000);
  return fmt(T().dateFmt, { month: T().months[d.getUTCMonth()], day: d.getUTCDate() });
}
const num = (v, dec = 0) => (v === null || v === undefined ? "–" : Number(v).toFixed(dec));
const oneDec = (v) => (v < 10 ? num(v, 1) : num(v, 0));

function locationName() {
  const loc = state.location;
  if (!loc) return "";
  if (loc.type === "region") return T().regions[loc.id].fullName;
  const base = loc.mine ? T().myLocation : T().customPointName;
  const area = placeLabel(loc.place);
  return area ? `${base} · ${area}` : `${base} (${loc.lat.toFixed(2)}°N, ${loc.lon.toFixed(2)}°E)`;
}

// Short label under the blue pin: district/province name if known
function pointLabel() {
  const loc = state.location;
  if (loc && loc.mine) return T().myLocation;
  return (loc && (pickName(loc.place?.soum) || pickName(loc.place?.aimag))) || T().customPointName;
}

// Names come as { mn, en }; pick the current language
const pickName = (n) => (n ? n[state.lang] || n.mn || n.en || "" : "");
function placeLabel(place) {
  if (!place) return "";
  const soum = pickName(place.soum), aimag = pickName(place.aimag);
  return soum && aimag ? `${soum}, ${aimag}` : aimag || soum;
}

function nearestRegion(lat, lon) {
  let best = null, bestD = Infinity;
  for (const id of REGION_ORDER) {
    const r = REGIONS[id];
    const d = (r.lat - lat) ** 2 + ((r.lon - lon) * Math.cos((lat * Math.PI) / 180)) ** 2;
    if (d < bestD) { bestD = d; best = id; }
  }
  return best;
}

function insideMongolia(lat, lon) { return pointInRing(lat, lon, MONGOLIA_BORDER); }

function pointInRing(lat, lon, pts) {
  // Ray-casting point-in-polygon; pts are [lon, lat] pairs
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Returns the lake under a point, or null (Natural Earth outlines)
function lakeAt(lat, lon) {
  return MONGOLIA_LAKES.find((lake) => pointInRing(lat, lon, lake.ring)) || null;
}
// Backup province lookup (Natural Earth, coarse near borders)
function aimagAt(lat, lon) {
  const a = MONGOLIA_AIMAGS.find((x) => x.rings.some((r) => pointInRing(lat, lon, r)));
  if (!a) return null;
  return a.en === "Ulaanbaatar" ? { mn: "Улаанбаатар хот", en: "Ulaanbaatar City" }
                                : { mn: `${a.mn} аймаг`, en: `${a.en} Province` };
}

// ---------------------------------------------------------------------------
// Shared pipeline for map taps and "My location"
// ---------------------------------------------------------------------------
async function tryPlacePoint(lat, lon, opts = {}) {
  const t = T();
  if (!insideMongolia(lat, lon)) { showToast(opts.mine ? t.geoOutside : t.outsideMongolia, 5000); return; }
  if (!opts.mine && accuracyCircle) { map.removeLayer(accuracyCircle); accuracyCircle = null; }
  const token = ++clickToken;
  showToast(t.checkingWater, 8000);
  const place = await checkPlace(lat, lon);
  if (token !== clickToken) return;                    // a newer tap replaced this one
  if (place.blocked === "water") {
    showToast(fmt(t.lakeToast, { lake: pickName(place.feature) || t.unnamedWater }), 5000); return;
  }
  if (place.blocked === "built" && !opts.mine) {
    const where = pickName(place.feature) || pickName(place.soum) || t.unnamedBuilt;
    showToast(fmt(t.builtToast, { place: where }), 5500); return;
  }
  // Your own location is often a town: NASA's ~50 km data still describes the farmland around it
  if (place.blocked === "built" && opts.mine) showToast(t.geoBuiltNote, 6500); else hideToast();
  selectPoint(lat, lon, { place, mine: !!opts.mine });
}

// "My location" button
function locateMe() {
  const t = T();
  if (!navigator.geolocation) { showToast(t.geoUnsupported, 5000); return; }
  showToast(t.geoLocating, 15000);
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude: lat, longitude: lon, accuracy } = pos.coords;
      if (accuracyCircle) map.removeLayer(accuracyCircle);
      accuracyCircle = L.circle([lat, lon], { radius: accuracy, color: "#2563eb", weight: 1, fillOpacity: 0.08, interactive: false }).addTo(map);
      map.flyTo([lat, lon], Math.max(map.getZoom(), 9), { duration: 1 });
      tryPlacePoint(lat, lon, { mine: true });
    },
    (err) => showToast(err.code === 1 ? t.geoDenied : t.geoFailed, 6000),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
  );
}

function showToast(msg, ms = 3200) {
  const el = $("map-toast");
  el.textContent = msg;
  el.classList.remove("hidden-toast");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.add("hidden-toast"), ms);
}
function hideToast() { clearTimeout(showToast._t); $("map-toast").classList.add("hidden-toast"); }

// ---------------------------------------------------------------------------
// What is under a tap? Two OpenStreetMap services, asked in parallel:
//   • Overpass  → is it water or built-up land? We download the real outlines
//                 of buildings / towns / ponds near the tap and test the point
//                 ourselves (many have no name, so a simple lookup misses them).
//   • Nominatim → the official OSM address: district (дүүрэг / сум) and
//                 province (аймаг / хот).
// If either service is down, rough Natural Earth outlines are the backup.
// ---------------------------------------------------------------------------
let clickToken = 0;
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
const PLACE_TIMEOUT_MS = 8000;
const BUILT_LANDUSE = "residential|industrial|commercial|retail|construction|military|railway|garages|cemetery|brownfield";
const BUILT_RE = new RegExp(`^(${BUILT_LANDUSE})$`);
const osmNames = (t) => ({ mn: t["name:mn"] || t.name || t["name:en"] || "", en: t["name:en"] || t.int_name || t.name || "" });
const hasName = (t) => !!(t.name || t["name:en"] || t["name:mn"]);

async function fetchJson(url, opts = {}, ms = PLACE_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url.split("?")[0]}`);
    return await res.json();
  } finally { clearTimeout(timer); }
}

// Point-in-polygon on Overpass "out geom" results. Counting edge crossings over
// every segment works for closed ways and for multipolygon relations alike.
function geomContains(lat, lon, el) {
  const lines = el.type === "way" ? [el.geometry] : (el.members || []).map((m) => m.geometry);
  let inside = false;
  for (const g of lines) {
    if (!g) continue;
    for (let i = 1; i < g.length; i++) {
      const a = g[i - 1], b = g[i];
      if ((a.lat > lat) !== (b.lat > lat) && lon < ((b.lon - a.lon) * (lat - a.lat)) / (b.lat - a.lat) + a.lon) inside = !inside;
    }
  }
  return inside;
}

async function landCheck(lat, lon) {
  const ll = `${lat.toFixed(6)},${lon.toFixed(6)}`;
  const q = `[out:json][timeout:12];` +
    // named areas that contain the point (big lakes, named towns, airports…)
    `is_in(${ll})->.a;(area.a["natural"="water"];area.a["water"];area.a["landuse"="reservoir"];` +
    `area.a["landuse"~"^(${BUILT_LANDUSE})$"];area.a["aeroway"="aerodrome"];area.a["building"];);out tags;` +
    // outlines near the point, tested in the browser (works for unnamed ones too)
    `(way(around:40,${ll})["building"];rel(around:40,${ll})["building"];` +
    `way(around:60,${ll})["natural"="water"];way(around:60,${ll})["landuse"="reservoir"];` +
    `way(around:600,${ll})["landuse"~"^(${BUILT_LANDUSE})$"];rel(around:600,${ll})["landuse"~"^(${BUILT_LANDUSE})$"];` +
    `way(around:300,${ll})["aeroway"="aerodrome"];);out geom;`;
  const json = await fetchJson(OVERPASS_URL, {
    method: "POST", body: "data=" + encodeURIComponent(q),
    headers: { "Content-Type": "application/x-www-form-urlencoded" }
  });
  let water = null, built = null;
  for (const el of json.elements || []) {
    const t = el.tags || {};
    const hit = el.type === "area" || geomContains(lat, lon, el);
    if (!hit) continue;
    if (t.natural === "water" || t.water || t.landuse === "reservoir") water = water || t;
    else if (t.building || BUILT_RE.test(t.landuse || "") || t.aeroway === "aerodrome") {
      // prefer a named feature (e.g. the town) for the message
      if (!built || (!hasName(built) && hasName(t))) built = t;
    }
  }
  if (water) return { blocked: "water", feature: hasName(water) ? osmNames(water) : null };
  if (built) return { blocked: "built", feature: hasName(built) ? osmNames(built) : null };
  return { blocked: null, feature: null };
}

// Nominatim asks for at most 1 request per second
let lastNominatim = 0;
async function reverseGeocode(lat, lon) {
  const wait = lastNominatim + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatim = Date.now();
  const lang = state.lang;
  const url = `${NOMINATIM_URL}?format=jsonv2&lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}` +
              `&zoom=12&addressdetails=1&accept-language=${lang === "mn" ? "mn,en" : "en,mn"}`;
  const json = await fetchJson(url);
  const a = json.address || {};
  // Ulaanbaatar: city_district = дүүрэг, city = Улаанбаатар; countryside: county = сум, state = аймаг
  const big = a.state || a.province || a.city || a.region;
  const small = a.city_district || a.county || a.district || a.municipality;
  const wrap = (v) => (v ? { [lang]: v } : null);
  return { aimag: wrap(big), soum: small && small !== big ? wrap(small) : null };
}

async function checkPlace(lat, lon) {
  const [land, names] = await Promise.allSettled([landCheck(lat, lon), reverseGeocode(lat, lon)]);
  const out = { blocked: null, feature: null, aimag: null, soum: null, source: "osm" };
  if (land.status === "fulfilled") Object.assign(out, land.value);
  else {
    console.warn("OpenStreetMap (Overpass) unavailable, using rough lake outlines:", land.reason);
    const lake = lakeAt(lat, lon);
    if (lake) { out.blocked = "water"; out.feature = { mn: lake.mn, en: lake.en }; }
    out.source = "naturalearth";
  }
  if (names.status === "fulfilled") { out.aimag = names.value.aimag; out.soum = names.value.soum; }
  else console.warn("OpenStreetMap (Nominatim) unavailable, using rough province outlines:", names.reason);
  if (!out.aimag) out.aimag = aimagAt(lat, lon);
  console.debug("[place check]", lat.toFixed(5), lon.toFixed(5), out);
  return out;
}

// ---------------------------------------------------------------------------
// Map
// ---------------------------------------------------------------------------
function initMap() {
  map = L.map("mongolia-map", { center: MAP_HOME.center, zoom: MAP_HOME.zoom, zoomControl: false, scrollWheelZoom: false });
  if (!isPhone()) {
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.control.scale({ position: "bottomright", imperial: false }).addTo(map);
  }

  // Free Esri basemaps (no API key needed)
  const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/";
  const esriAttr = "Tiles &copy; Esri — Esri, HERE, Garmin, OpenStreetMap contributors";
  lightStreetLayer = L.tileLayer(ESRI + "World_Street_Map/MapServer/tile/{z}/{y}/{x}", { attribution: esriAttr, maxZoom: 18 });
  satelliteLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { attribution: "Tiles &copy; Esri — Esri, Maxar, Earthstar Geographics", maxZoom: 18 });
  satelliteLabelsLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", { maxZoom: 18 });
  // Mongolia outline
  L.polygon(MONGOLIA_BORDER.map(([lon, lat]) => [lat, lon]),
    { color: "#15803d", weight: 2, dashArray: "6 4", fill: false, interactive: false }).addTo(map);

  L.DomEvent.disableClickPropagation($("map-type-control"));
  L.DomEvent.disableClickPropagation($("btn-locate"));
  L.DomEvent.disableClickPropagation($("map-quick-pills"));

  REGION_ORDER.forEach((id) => {
    const r = REGIONS[id];
    const m = L.marker([r.lat, r.lon], { icon: pinIcon(T().regions[id].shortName, false, "red") }).addTo(map);
    m.on("click", (e) => { L.DomEvent.stopPropagation(e); selectRegion(id); });
    regionMarkers[id] = m;
  });

  map.on("click", (e) => tryPlacePoint(e.latlng.lat, e.latlng.lng));

  // Re-layout when the screen size changes (rotate phone, resize window)
  let lastPhone = isPhone(), resizeT;
  window.addEventListener("resize", () => {
    map && map.invalidateSize();
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      if (state.stats && !state.loading) renderChart();
      if (isPhone() !== lastPhone) { lastPhone = isPhone(); refreshMarkers(); if (state.stats && !state.loading) renderAll(); }
    }, 200);
  });
}

function pinIcon(label, active, kind) {
  if (!active && isPhone()) label = "";   // avoid overlapping labels on small screens
  const color = kind === "blue" ? "#2563eb" : active ? "#15803d" : "#ea4335";
  const labelStyle = active
    ? (kind === "blue" ? "bg-blue-700 text-white border-blue-600 font-bold shadow-lg" : "bg-forest-800 text-white border-forest-700 font-bold shadow-lg")
    : "bg-white/95 text-slate-800 border-slate-200 font-semibold shadow-md";
  const html = `
    <div style="transform: translate(-50%, -44px);">
      <div class="relative flex flex-col items-center cursor-pointer transition-transform duration-200 ${active ? "scale-110" : "hover:scale-105"}">
        ${active ? `<div class="pin-pulse ${kind === "blue" ? "blue" : ""}"></div>` : ""}
        <svg width="34" height="42" viewBox="0 0 38 46" fill="none" class="drop-shadow-md">
          <path d="M19 1C9.06 1 1 9.06 1 19C1 31.5 19 45 19 45C19 45 37 31.5 37 19C37 9.06 28.94 1 19 1Z" fill="${color}" stroke="white" stroke-width="2.5"/>
          <circle cx="19" cy="18.5" r="6.5" fill="white"/>
        </svg>
        ${label ? `<span class="mt-0.5 px-2.5 py-0.5 rounded-full text-[11px] whitespace-nowrap border ${labelStyle}">${label}</span>` : ""}
      </div>
    </div>`;
  return L.divIcon({ html, className: "custom-google-marker", iconSize: [0, 0], iconAnchor: [0, 0], popupAnchor: [0, -46] });
}

function refreshMarkers() {
  const loc = state.location;
  REGION_ORDER.forEach((id) => {
    const active = loc && loc.type === "region" && loc.id === id;
    regionMarkers[id].setIcon(pinIcon(T().regions[id].shortName, active, "red"));
    regionMarkers[id].setZIndexOffset(active ? 1000 : 0);
  });
  if (pointMarker) pointMarker.setIcon(pinIcon(pointLabel(), true, "blue"));
}

function setMapLayer(mode) {
  state.mapLayer = mode;
  // Same detailed street map in light and dark mode
  [lightStreetLayer, satelliteLayer, satelliteLabelsLayer].forEach((l) => map.removeLayer(l));
  if (mode === "satellite") { satelliteLayer.addTo(map); satelliteLabelsLayer.addTo(map); }
  else lightStreetLayer.addTo(map);
  const on = "px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-900 bg-white transition-colors flex items-center gap-1.5";
  const off = "px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-500 hover:text-slate-900 bg-slate-50/70 transition-colors flex items-center gap-1.5";
  $("btn-layer-street").className = (mode === "street" ? on : off) + " border-r border-slate-200";
  $("btn-layer-satellite").className = mode === "satellite" ? on : off;
}

function resetMapOverview() {
  map.flyTo(MAP_HOME.center, MAP_HOME.zoom, { duration: 1.1 });
  map.closePopup();
}

function popupHtml() {
  const t = T(), loc = state.location, s = state.stats;
  const title = loc.type === "region" ? t.regions[loc.id].fullName : (loc.mine ? t.myLocation : t.customPointName);
  const area = loc.type === "point" && placeLabel(loc.place)
    ? `<p class="text-xs text-slate-500"><strong class="text-slate-700">${t.popupAreaLabel}</strong> ${placeLabel(loc.place)}</p>` : "";
  const tag = loc.type === "region" ? t.regions[loc.id].zoneTag : "";
  const elev = s && s.elevation ? `<p class="text-xs text-slate-500"><strong class="text-slate-700">${t.popupElevLabel}</strong> ${Math.round(s.elevation)} m</p>` : "";
  const near = loc.type === "point" ? `<p class="text-xs text-slate-500"><strong class="text-slate-700">${t.popupNearestLabel}</strong> ${t.regions[nearestRegion(loc.lat, loc.lon)].shortName}</p>` : "";
  let top = `<p class="text-[11px] text-slate-400">${t.loadingShort}</p>`;
  if (state.cropScores && !state.loading) {
    const best = CROP_ORDER.map((id) => state.cropScores[id]).sort((a, b) => b.score - a.score).slice(0, 3);
    top = `<p class="text-[11px] text-slate-600 pt-1 border-t border-slate-100">🌱 ${best.map((c) => `${t.crops[c.id].name} <b>${c.score}</b>`).join(" · ")}</p>`;
  }
  return `
    <div class="min-w-[220px] space-y-1">
      <div class="flex items-center justify-between gap-2">
        <span class="font-extrabold text-slate-900 text-sm">${title}</span>
        ${tag ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-forest-50 text-forest-800 border border-forest-200">${tag}</span>` : ""}
      </div>
      <p class="text-xs text-slate-500"><strong class="text-slate-700">${t.popupCoordLabel}</strong> ${loc.lat.toFixed(2)}°N, ${loc.lon.toFixed(2)}°E</p>
      ${area}${elev}${near}${top}
    </div>`;
}

function updatePopup() {
  const loc = state.location;
  if (!loc) return;
  const marker = loc.type === "region" ? regionMarkers[loc.id] : pointMarker;
  if (!marker) return;
  if (!marker.getPopup()) marker.bindPopup(popupHtml(), { autoPan: false, maxWidth: 260 });
  else marker.setPopupContent(popupHtml());
  if (!isPhone()) marker.openPopup();
}

// ---------------------------------------------------------------------------
// Selecting a location
// ---------------------------------------------------------------------------
function selectRegion(id, fly = true) {
  clickToken++;
  if (accuracyCircle) { map.removeLayer(accuracyCircle); accuracyCircle = null; }
  const r = REGIONS[id];
  if (pointMarker) { map.removeLayer(pointMarker); pointMarker = null; }
  state.location = { type: "region", id, lat: r.lat, lon: r.lon };
  if (fly) map.flyTo([r.lat, r.lon], 7, { duration: 1.1 });
  loadLocation();
}

function selectPoint(lat, lon, extra = {}) {
  map.closePopup();
  if (pointMarker) map.removeLayer(pointMarker);
  state.location = { type: "point", lat, lon, place: extra.place || null, mine: !!extra.mine };
  pointMarker = L.marker([lat, lon], { icon: pinIcon(pointLabel(), true, "blue"), zIndexOffset: 2000 }).addTo(map);
  loadLocation();
}

async function loadLocation() {
  const token = ++state.loadToken;
  const loc = state.location;
  state.loading = true;
  refreshMarkers();
  renderLoading();
  updatePopup();

  let stats;
  try {
    stats = await fetchNasaPower(loc.lat, loc.lon);
  } catch (err) {
    console.warn("NASA POWER unavailable, using approximate fallback:", err);
    const regionId = loc.type === "region" ? loc.id : nearestRegion(loc.lat, loc.lon);
    stats = fallbackStats(regionId);
  }
  if (token !== state.loadToken) return; // a newer click replaced this one

  state.stats = stats;
  state.loading = false;
  recompute(true);
  renderAll();
  updatePopup();
}

function recompute(resetSelection = false) {
  if (!state.stats) return;
  state.cropScores = scoreAllCrops(state.stats, { irrigated: state.irrigated });
  state.ranking = rankStrategies(state.cropScores, state.priority);
  const shown = [state.ranking.baseline, ...state.ranking.top].map((s) => s.id);
  if (resetSelection || !shown.includes(state.selectedStrategyId)) state.selectedStrategyId = state.ranking.top[0].id;
}

// ---------------------------------------------------------------------------
// Farmer inputs & language
// ---------------------------------------------------------------------------
function setPriority(p) { state.priority = p; recompute(true); renderControls(); renderStrategies(); renderTable(); }
function setIrrigation(on) { state.irrigated = on; recompute(); renderCrops(); renderStrategies(); renderTable(); updatePopup(); }
function selectStrategy(id) {
  state.selectedStrategyId = id; renderStrategies(); renderTable();
  if (isPhone()) $("strategy-detail-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}
function setChartMetric(m) { state.chartMetric = m; renderChart(); }

function setLanguage(lang) {
  state.lang = lang;
  document.documentElement.lang = lang;
  const on = "px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-bold transition-all duration-200 flex items-center gap-1.5 bg-white text-forest-900 shadow";
  const off = "px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center gap-1.5 text-emerald-200 hover:text-white";
  $("btn-lang-mn").className = lang === "mn" ? on : off;
  $("btn-lang-en").className = lang === "en" ? on : off;
  refreshMarkers();
  if (state.loading) renderLoading();
  else if (state.stats) renderAll();
  else { applyStaticText(); renderPills(); }
  if (state.location) updatePopup();
}

// ---- Dark mode -------------------------------------------------------------
function setTheme(theme) {
  state.theme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
  try { localStorage.setItem("cropCopilotTheme", theme); } catch (e) { /* storage unavailable */ }
  $("btn-theme").textContent = theme === "dark" ? "☀️" : "🌙";
  $("btn-theme").setAttribute("aria-label", theme === "dark" ? "Light mode" : "Dark mode");
  if (map) setMapLayer(state.mapLayer);
}
function toggleTheme() { setTheme(state.theme === "dark" ? "light" : "dark"); }

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function applyStaticText() {
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = T()[el.dataset.i18n]; });
  document.title = `${TRANSLATIONS.mn.appTitle} | ${TRANSLATIONS.en.appTitle}`;
}

function renderPills() {
  const t = T(), loc = state.location;
  const pill = (id, extra) => {
    const active = loc && loc.type === "region" && loc.id === id;
    const cls = active
      ? "bg-forest-700 text-white border-forest-600 font-bold"
      : "bg-white/95 text-slate-700 hover:bg-white border-slate-200 font-semibold";
    return `<button onclick="selectRegion('${id}')" class="${extra} px-3 py-1.5 rounded-full text-xs shadow-md transition-all border whitespace-nowrap ${cls}">📍 ${t.regions[id].shortName}</button>`;
  };
  const overview = (extra) => `<button onclick="resetMapOverview()" class="${extra} px-2.5 py-1.5 rounded-full text-xs font-medium shadow-md bg-slate-800/90 text-white hover:bg-slate-900 border border-slate-700 whitespace-nowrap">🇲🇳 ${t.btnOverview}</button>`;
  $("map-quick-pills").innerHTML = REGION_ORDER.map((id) => pill(id, "")).join("") + overview("");
  $("map-quick-pills-mobile").innerHTML = REGION_ORDER.map((id) => pill(id, "shrink-0 shadow-sm")).join("") + overview("shrink-0 shadow-sm");
  // Phones: "See results" button under the map once a place has loaded
  const btn = $("btn-see-results");
  if (state.stats && !state.loading && state.location) { btn.textContent = `↓ ${t.seeResults}`; btn.classList.remove("hidden"); }
  else btn.classList.add("hidden");
}

function scrollToResults() { $("alert-banner").scrollIntoView({ behavior: "smooth", block: "start" }); }

function renderStatus() {
  const t = T();
  const badge = $("nasa-status-badge"), dot = $("nasa-status-dot"), txt = $("nasa-status-text");
  const base = "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ";
  if (state.loading) {
    badge.className = base + "bg-slate-100 text-slate-700 border-slate-200";
    dot.className = "w-2 h-2 rounded-full bg-amber-500 animate-ping";
    txt.textContent = t.statusLoading;
  } else if (state.stats && state.stats.isLive) {
    badge.className = base + "bg-emerald-50 text-emerald-800 border-emerald-200";
    dot.className = "w-2 h-2 rounded-full bg-emerald-500 animate-pulse";
    txt.textContent = t.statusLive;
  } else {
    badge.className = base + "bg-amber-50 text-amber-800 border-amber-200";
    dot.className = "w-2 h-2 rounded-full bg-amber-500";
    txt.textContent = t.statusFallback;
  }
}

function renderLoading() {
  applyStaticText();
  renderPills();
  renderStatus();
  $("ui-active-location").textContent = locationName();
  const t = T();
  setAlertStyle("loading");
  $("alert-icon").textContent = "⏳";
  $("alert-title").textContent = t.statusLoading;
  $("alert-tag").textContent = locationName();
  $("alert-desc").textContent = "";
  $("alert-note").textContent = "";
  renderMetrics();
}

function renderAll() {
  applyStaticText();
  renderPills();
  renderStatus();
  $("ui-active-location").textContent = locationName();
  renderAlert();
  renderMetrics();
  renderChart();
  renderCrops();
  renderControls();
  renderStrategies();
  renderTable();
}

// ---- Alert banner ----------------------------------------------------------
const ALERT_STYLES = {
  loading: { banner: "border-slate-300 bg-slate-50", icon: "bg-slate-100 text-slate-600", title: "text-slate-900", tag: "bg-slate-200 text-slate-700", desc: "text-slate-700", emoji: "⏳" },
  season:  { banner: "border-sky-600 bg-sky-50", icon: "bg-sky-100 text-sky-700", title: "text-sky-950", tag: "bg-sky-200/70 text-sky-900", desc: "text-sky-900/90", emoji: "❄️" },
  heat:    { banner: "border-red-500 bg-red-50", icon: "bg-red-100 text-red-700", title: "text-red-950", tag: "bg-red-200/70 text-red-900", desc: "text-red-900/90", emoji: "🌡️" },
  drought: { banner: "border-amber-500 bg-amber-50", icon: "bg-amber-100 text-amber-700", title: "text-amber-950", tag: "bg-amber-200/70 text-amber-900", desc: "text-amber-900/90", emoji: "🏜️" },
  ok:      { banner: "border-emerald-500 bg-emerald-50", icon: "bg-emerald-100 text-emerald-700", title: "text-emerald-950", tag: "bg-emerald-200/70 text-emerald-900", desc: "text-emerald-900/90", emoji: "✅" }
};
function setAlertStyle(type) {
  const st = ALERT_STYLES[type];
  $("alert-banner").className = `rounded-2xl border-l-4 p-4 sm:p-5 shadow-sm transition-all duration-300 ${st.banner}`;
  $("alert-icon").className = `p-2 rounded-xl shrink-0 mt-0.5 text-xl leading-none w-10 h-10 flex items-center justify-center ${st.icon}`;
  $("alert-title").className = `font-extrabold text-sm sm:text-base ${st.title}`;
  $("alert-tag").className = `text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${st.tag}`;
  $("alert-desc").className = `text-xs sm:text-sm leading-relaxed ${st.desc}`;
  $("alert-icon").textContent = st.emoji;
}

function renderAlert() {
  const t = T(), s = state.stats.summary, tr = state.stats.trend;
  const type = mainRisk(s);
  setAlertStyle(type);
  const noSoil = s.maySoil === null || s.maySoil === undefined;
  const textKey = type === "drought" && noSoil ? "droughtNoSoil" : type;
  const trendTxt = tr && tr.heat30 > 0.5 ? fmt(t.alert.trendMore, { d: oneDec(tr.heat30) }) : "";
  const vars = {
    ff: num(s.ff), start: fmtDate(s.lastSpring + 1), end: fmtDate(s.firstFall - 1),
    heat: oneDec(s.heat[30]), rain: num(s.rain),
    soil: num(s.maySoil !== null && s.maySoil !== undefined ? s.maySoil * 100 : null),
    trend: trendTxt
  };
  $("alert-title").textContent = t.alert[textKey].title;
  $("alert-desc").textContent = fmt(t.alert[textKey].desc, vars);
  const loc = state.location;
  $("alert-tag").textContent = loc.type === "region"
    ? `${t.regions[loc.id].shortName} • ${t.regions[loc.id].zoneTag}`
    : placeLabel(loc.place) || `${loc.lat.toFixed(2)}°N, ${loc.lon.toFixed(2)}°E`;
  $("alert-note").textContent = state.stats.isLive ? "" :
    fmt(t.fallbackNote, { region: t.regions[state.stats.fallbackRegion].fullName });
}

// ---- Metric cards -----------------------------------------------------------
function trendChip(delta, threshold, higherIsBetter, unit, dec = 0) {
  const t = T();
  if (delta === null || delta === undefined) return `<span class="text-slate-400">${t.trendNA}</span>`;
  const sign = delta > 0 ? "+" : "";
  let cls = "bg-slate-100 text-slate-600", arrow = "→";
  if (Math.abs(delta) >= threshold) {
    const better = (delta > 0) === higherIsBetter;
    cls = better ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700";
    arrow = delta > 0 ? "▲" : "▼";
  }
  return `<span class="font-bold px-1.5 py-0.5 rounded ${cls}">${arrow} ${sign}${num(delta, dec)}${unit}</span> <span class="text-slate-400">${t.trendVs}</span>`;
}

function renderMetrics() {
  const t = T();
  const loading = state.loading || !state.stats;
  const s = loading ? null : state.stats.summary;
  const tr = loading ? null : state.stats.trend;
  const noSoil = s && (s.maySoil === null || s.maySoil === undefined);
  const cards = [
    { label: t.m_ff_label, value: s ? num(s.ff) : "00", unit: t.unitDays, icon: "❄️", tone: "sky",
      note: s ? fmt(t.m_ff_note, { start: fmtDate(s.lastSpring + 1), end: fmtDate(s.firstFall - 1) }) : "",
      trend: s ? trendChip(tr && tr.ff, 2, true, "") : "", src: "T2M_MIN" },
    { label: t.m_heat_label, value: s ? oneDec(s.heat[30]) : "00", unit: t.unitDays, icon: "🌡️", tone: "orange",
      note: t.m_heat_note, trend: s ? trendChip(tr && tr.heat30, 0.5, false, "", 1) : "", src: "T2M_MAX" },
    { label: t.m_rain_label, value: s ? num(s.rain) : "000", unit: t.unitMm, icon: "🌧️", tone: "blue",
      note: t.m_rain_note, trend: s ? trendChip(tr && tr.rain, 10, true, "") : "", src: "PRECTOTCORR" },
    { label: t.m_soil_label, value: s ? (noSoil ? "–" : num(s.maySoil * 100)) : "00",
      unit: noSoil ? "" : "/100", icon: "💧", tone: "emerald",
      note: noSoil ? t.m_soil_na : t.m_soil_note,
      trend: s ? trendChip(tr && tr.maySoil !== null && tr.maySoil !== undefined ? tr.maySoil * 100 : null, 2, true, "") : "", src: "GWETTOP" }
  ];
  const toneCls = { sky: "bg-sky-50 text-sky-700 border-sky-100", orange: "bg-orange-50 text-orange-700 border-orange-100", blue: "bg-blue-50 text-blue-700 border-blue-100", emerald: "bg-emerald-50 text-emerald-700 border-emerald-100" };
  $("metric-cards").innerHTML = cards.map((c) => `
    <div class="bg-white rounded-2xl p-3.5 sm:p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col min-w-0">
      <div class="flex items-start justify-between gap-2">
        <div>
          <p class="text-[11px] sm:text-sm font-semibold text-slate-500 leading-tight">${c.label}</p>
          <div class="mt-1.5 sm:mt-2 flex items-baseline gap-1">
            <span class="text-2xl sm:text-4xl font-extrabold text-slate-900 ${loading ? "skeleton" : ""}">${c.value}</span>
            <span class="text-xs sm:text-base font-bold text-slate-400">${c.unit}</span>
          </div>
        </div>
        <div class="w-8 h-8 sm:w-11 sm:h-11 shrink-0 rounded-xl flex items-center justify-center border text-base sm:text-xl ${toneCls[c.tone]}">${c.icon}</div>
      </div>
      <p class="mt-2 text-[11px] text-slate-500 min-h-[16px]">${c.note}</p>
      <p class="mt-1 text-[11px] min-h-[20px]">${c.trend}</p>
      <div class="mt-auto pt-2 sm:pt-3 border-t border-slate-100 text-[10px] truncate">
        <span class="font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">NASA POWER • ${c.src}</span>
      </div>
    </div>`).join("");
}

// ---- Year-by-year chart -------------------------------------------------------
const CHART_METRICS = {
  ff:   { get: (y) => y.ff,   labelKey: "m_ff_label",   color: "#0284c7", unitKey: "unitDays" },
  heat: { get: (y) => y.heat[30], labelKey: "m_heat_label", color: "#dc2626", unitKey: "unitDays" },
  rain: { get: (y) => y.rain, labelKey: "m_rain_label", color: "#2563eb", unitKey: "unitMm" },
  soil: { get: (y) => (y.maySoil === null ? null : Math.round(y.maySoil * 100)), labelKey: "m_soil_label", color: "#059669", unit: "/100" }
};

function renderChart() {
  const t = T();
  $("chart-tabs").innerHTML = Object.keys(CHART_METRICS).map((k) => {
    const active = state.chartMetric === k;
    return `<button onclick="setChartMetric('${k}')" class="shrink-0 whitespace-nowrap px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${active ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}">${t[CHART_METRICS[k].labelKey]}</button>`;
  }).join("");

  const years = state.stats && !state.loading ? state.stats.years : [];
  if (!years.length) {
    $("year-chart").innerHTML = `<p class="text-xs text-slate-500 py-6 text-center">${state.loading ? t.statusLoading : t.chartNoData}</p>`;
    return;
  }
  const m = CHART_METRICS[state.chartMetric];
  const unit = m.unit || t[m.unitKey];
  const vals = years.map((y) => ({ year: y.year, v: m.get(y) })).filter((d) => d.v !== null);
  if (!vals.length) {
    $("year-chart").innerHTML = `<p class="text-xs text-slate-500 py-6 text-center">${t.chartNoData}</p>`;
    return;
  }
  const W = Math.max(300, Math.min(900, $("year-chart").clientWidth || 720)), H = isPhone() ? 190 : 210;
  const padL = 34, padB = 26, padT = 14, padR = 6;
  const max = Math.max(1, ...vals.map((d) => d.v)) * 1.12;
  const bw = (W - padL - padR) / vals.length;
  const y = (v) => padT + (H - padT - padB) * (1 - v / max);
  const avg = vals.reduce((a, d) => a + d.v, 0) / vals.length;
  const ticks = [0, max / 2, max].map((v) => Math.round(v));

  const bars = vals.map((d, i) => {
    const x = padL + i * bw + bw * 0.15, h = H - padB - y(d.v);
    const recent = d.year >= PERIOD.recentFrom;
    return `<g class="chart-bar"><title>${d.year}: ${Math.round(d.v)} ${unit}</title>
      <rect x="${x}" y="${y(d.v)}" width="${bw * 0.7}" height="${Math.max(0, h)}" rx="2" fill="${m.color}" opacity="${recent ? 0.95 : 0.45}"/>
      ${i % Math.max(1, Math.ceil(30 / bw)) === 0 ? `<text x="${x + bw * 0.35}" y="${H - 8}" font-size="10" text-anchor="middle" fill="#64748b">${String(d.year).slice(2)}'</text>` : ""}</g>`;
  }).join("");
  const grid = ticks.map((v) => `<line x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}" class="chart-grid" stroke="#e2e8f0"/><text x="${padL - 6}" y="${y(v) + 3}" font-size="10" text-anchor="end" fill="#94a3b8">${v}</text>`).join("");
  $("year-chart").innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" width="100%" class="block h-auto" role="img" aria-label="${t[m.labelKey]}">
      ${grid}${bars}
      <line x1="${padL}" x2="${W - padR}" y1="${y(avg)}" y2="${y(avg)}" class="chart-avg" stroke="#0f172a" stroke-dasharray="4 3" stroke-width="1"/>
      <text x="${W - padR}" y="${y(avg) - 4}" font-size="10" class="chart-avg-text" text-anchor="end" fill="#0f172a">${t.chartAvg} ${Math.round(avg)} ${unit}</text>
    </svg>`;
}

// ---- Crop suitability grid -----------------------------------------------------
const LEVEL_STYLE = {
  good:  { ring: "#16a34a", chip: "bg-emerald-50 text-emerald-800 border-emerald-200", dot: "🟢" },
  risky: { ring: "#f59e0b", chip: "bg-amber-50 text-amber-800 border-amber-200", dot: "🟡" },
  poor:  { ring: "#dc2626", chip: "bg-red-50 text-red-800 border-red-200", dot: "🔴" }
};
function levelLabel(level) { const t = T(); return level === "good" ? t.levelGood : level === "risky" ? t.levelRisky : t.levelPoor; }
function reasonText(r) { return fmt(T().reasons[r.key], r); }

function renderCrops() {
  const t = T();
  if (!state.cropScores || state.loading) { $("crop-grid").innerHTML = ""; $("btn-more-crops").classList.add("hidden"); return; }
  const sorted = CROP_ORDER.map((id) => state.cropScores[id]).sort((a, b) => b.score - a.score);
  const limit = isPhone() && !state.showAllCrops ? 5 : sorted.length;
  const more = $("btn-more-crops");
  more.textContent = state.showAllCrops ? `▲ ${t.showFewerCrops}` : `▼ ${fmt(t.showAllCrops, { n: sorted.length })}`;
  more.classList.toggle("hidden", !isPhone());
  $("crop-grid").innerHTML = sorted.slice(0, limit).map((c) => {
    const st = LEVEL_STYLE[c.level], ct = t.crops[c.id];
    const reasons = c.reasons.length ? c.reasons.map(reasonText) : [t.reasons.r_fine];
    return `
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5 sm:p-4 flex flex-col gap-2 sm:gap-2.5" title="${t.bestConditions} ${ct.best}">
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0">
            <p class="font-bold text-slate-900 text-sm truncate">${CROPS[c.id].emoji} ${ct.name}</p>
            <p class="text-[11px] text-slate-500 truncate">${ct.role}</p>
          </div>
          <div class="score-ring w-11 h-11 shrink-0" style="--p:${c.score};--c:${st.ring}"><span class="text-xs font-extrabold text-slate-800">${c.score}</span></div>
        </div>
        <span class="self-start text-[11px] font-bold px-2 py-0.5 rounded-full border ${st.chip}">${st.dot} ${levelLabel(c.level)}</span>
        <ul class="text-[11px] text-slate-600 space-y-1 list-disc pl-4">${reasons.map((r) => `<li>${r}</li>`).join("")}</ul>
        <p class="hidden sm:block mt-auto pt-2 border-t border-slate-100 text-[10px] text-slate-400 leading-snug">${ct.best}</p>
      </div>`;
  }).join("");
  const pasture = $("pasture-note");
  if (isPastureOnly(state.cropScores)) {
    pasture.textContent = "🐑 " + t.pastureNote;
    pasture.classList.remove("hidden");
  } else {
    pasture.classList.add("hidden");
  }
}

function toggleAllCrops() { state.showAllCrops = !state.showAllCrops; renderCrops(); }

// ---- Farmer priority controls ----------------------------------------------------
function renderControls() {
  const t = T();
  $("priority-buttons").innerHTML = Object.keys(t.priorities).map((p) => {
    const active = state.priority === p;
    return `<button onclick="setPriority('${p}')" class="px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${active ? "bg-forest-700 text-white border-forest-700" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}">${t.priorities[p]}</button>`;
  }).join("");
  $("irrigation-toggle").checked = state.irrigated;
}

// ---- Strategy cards, detail panel and table -------------------------------------------
function fitBar(fit) {
  const color = fit >= 70 ? "bg-emerald-500" : fit >= 45 ? "bg-amber-500" : "bg-red-500";
  return `<div class="flex items-center gap-2"><div class="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden"><div class="h-full ${color}" style="width:${fit}%"></div></div><span class="text-xs font-extrabold text-slate-800 w-8 text-right">${fit}</span></div>`;
}
function attrChips(id) {
  const t = T(), a = STRATEGIES[id].attrs;
  const colors = ["bg-red-50 text-red-700 border-red-200", "bg-slate-100 text-slate-700 border-slate-200", "bg-emerald-50 text-emerald-800 border-emerald-200", "bg-emerald-100 text-emerald-900 border-emerald-300"];
  return ["soil", "feed", "income", "water"].map((k) =>
    `<span class="text-[10px] font-semibold px-2 py-0.5 rounded-md border ${colors[a[k]]}">${t.attrLabels[k]}: ${t.attrLevels[a[k]]}</span>`).join("");
}

function renderStrategies() {
  const t = T();
  if (!state.ranking || state.loading) { $("strategy-cards-grid").innerHTML = ""; $("strategy-detail-panel").innerHTML = ""; return; }
  const shown = [state.ranking.baseline, ...state.ranking.top];
  const bestId = state.ranking.top[0].id;

  $("strategy-cards-grid").innerHTML = shown.map((s, i) => {
    const st = t.strategies[s.id];
    const selected = s.id === state.selectedStrategyId;
    const badge = s.baseline
      ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">${t.currentBadge}</span>`
      : s.id === bestId
        ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">⭐ ${t.recommendedBadge}</span>`
        : `<span class="text-[10px] font-medium text-slate-400">${t.clickToInspect}</span>`;
    return `
      <div onclick="selectStrategy('${s.id}')" class="shrink-0 w-[82%] sm:w-auto snap-start cursor-pointer rounded-2xl border p-4 shadow-sm transition-all duration-200 flex flex-col gap-3 ${selected ? "border-forest-600 ring-2 ring-forest-600/20 bg-forest-50/40" : "border-slate-200 bg-white hover:border-forest-300"}">
        <div class="flex items-center justify-between gap-2">
          <span class="inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-extrabold ${selected ? "bg-forest-700 text-white" : "bg-slate-100 text-slate-700"}">${s.baseline ? "0" : i}</span>
          ${badge}
        </div>
        <div>
          <h4 class="font-bold text-slate-900 text-sm">${st.name}</h4>
          <p class="text-sm font-extrabold text-forest-700 mt-0.5">${st.crops}</p>
        </div>
        <div><p class="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">${t.fitLabel}</p>${fitBar(s.fit)}</div>
        <div class="flex flex-wrap gap-1">${attrChips(s.id)}</div>
      </div>`;
  }).join("");

  // Detail panel
  const sel = state.ranking.all.find((s) => s.id === state.selectedStrategyId) || shown[0];
  const st = t.strategies[sel.id];
  const here = STRATEGIES[sel.id].crops.map((cid) => {
    const c = state.cropScores[cid];
    const why = c.reasons.length ? reasonText(c.reasons[0]) : t.reasons.r_fine;
    return `<li><b>${LEVEL_STYLE[c.level].dot} ${t.crops[cid].name} — ${c.score}/100:</b> ${why}</li>`;
  }).join("");
  const box = (cls, titleCls, icon, title, body) =>
    `<div class="${cls} border rounded-xl p-4"><p class="text-xs font-extrabold uppercase tracking-wide mb-1 ${titleCls}">${icon} ${title}</p><p class="text-xs sm:text-sm leading-relaxed">${body}</p></div>`;

  $("strategy-detail-panel").innerHTML = `
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div>
          <span class="text-xs font-bold uppercase tracking-wider text-forest-700">${st.name}</span>
          <h4 class="text-lg sm:text-xl font-extrabold text-slate-900 mt-0.5">${st.crops}</h4>
        </div>
        <div class="flex items-center gap-2">
          <span class="px-3 py-1 rounded-full text-xs font-bold bg-forest-50 text-forest-800 border border-forest-200">📍 ${locationName()}</span>
          <span class="px-3 py-1 rounded-full text-xs font-extrabold bg-slate-900 text-white">${t.fitLabel}: ${sel.fit}/100</span>
        </div>
      </div>
      <div class="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
        <p class="text-xs font-extrabold text-slate-800 mb-1.5">🛰️ ${t.hereLabel}</p>
        <ul class="text-xs sm:text-sm text-slate-700 space-y-1">${here}</ul>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        ${box("bg-emerald-50/70 border-emerald-200/80 text-emerald-950", "text-emerald-900", "✅", t.benefitLabel, st.benefit)}
        ${box("bg-amber-50/70 border-amber-200/80 text-amber-950", "text-amber-900", "⚠️", t.catchLabel, st.catch)}
        ${box("bg-sky-50/70 border-sky-200/80 text-sky-950", "text-sky-900", "📚", t.evidenceLabel, st.evidence)}
        ${box("bg-violet-50/70 border-violet-200/80 text-violet-950", "text-violet-900", "🔍", t.gapsLabel, st.gaps)}
      </div>
    </div>`;
}

function renderTable() {
  const t = T();
  if (!state.ranking || state.loading) { $("strategy-table-body").innerHTML = ""; $("strategy-list-mobile").innerHTML = ""; return; }
  $("strategy-list-mobile").innerHTML = state.ranking.all.map((s) => {
    const st = t.strategies[s.id];
    const fitCls = s.fit >= 70 ? "bg-emerald-50 text-emerald-800 border-emerald-200" : s.fit >= 45 ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-red-50 text-red-800 border-red-200";
    return `
      <div onclick="selectStrategy('${s.id}')" class="px-4 py-3 ${s.id === state.selectedStrategyId ? "bg-forest-50/60" : ""}">
        <div class="flex items-center justify-between gap-2">
          <span class="font-bold text-sm text-slate-800">${st.name}</span>
          <span class="text-xs font-extrabold px-2 py-0.5 rounded-full border ${fitCls}">${s.fit}</span>
        </div>
        <p class="text-xs font-bold text-forest-700 mt-0.5">${st.crops}</p>
        <p class="text-[11px] text-slate-500 mt-1">${t.thSoil}: ${st.tableSoil} · ${t.thWater}: ${st.tableWater} · ${t.thFeed}: ${st.tableFeed}</p>
      </div>`;
  }).join("");
  $("strategy-table-body").innerHTML = state.ranking.all.map((s) => {
    const st = t.strategies[s.id];
    const selected = s.id === state.selectedStrategyId;
    const fitCls = s.fit >= 70 ? "text-emerald-700" : s.fit >= 45 ? "text-amber-700" : "text-red-700";
    return `
      <tr onclick="selectStrategy('${s.id}')" class="cursor-pointer transition-colors ${selected ? "bg-forest-50/60 font-medium" : "hover:bg-slate-50"}">
        <td class="px-4 py-3 whitespace-nowrap font-bold text-slate-800">${st.name}</td>
        <td class="px-4 py-3 whitespace-nowrap font-bold text-forest-700">${st.crops}</td>
        <td class="px-4 py-3 font-extrabold ${fitCls}">${s.fit}</td>
        <td class="px-4 py-3 text-slate-600">${st.tableSoil}</td>
        <td class="px-4 py-3 text-slate-600">${st.tableWater}</td>
        <td class="px-4 py-3 text-slate-600">${st.tableFeed}</td>
      </tr>`;
  }).join("");
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
  initMap();
  setTheme(state.theme);
  setLanguage("mn");
  selectRegion("selenge", false);
});
