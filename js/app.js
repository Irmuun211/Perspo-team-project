// =============================================================================
// app.js — Map, state and rendering for Agricola (Mongolian Crop Co-Pilot)
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
  season: null,              // climate chart: null = whole year, or winter/spring/summer/autumn
  mapLayer: "street",
  theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
  loading: false,
  showAllCrops: false,
  currentCrop: "wheat",       // what the farmer grows now (baseline)
  loadToken: 0
};

let map, satelliteLayer, borderLayer;
let streetLayer, accuracyCircle = null;
let nasaOverlay = null, activeNasaLayer = null;
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

// "My location" button
function locateMe() {
  const t = T();
  if (!navigator.geolocation) { showToast(t.geoUnsupported, 5000); return; }
  showToast(t.geoLocating, 15000);
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude: lat, longitude: lon, accuracy } = pos.coords;
      if (accuracyCircle) map.removeLayer(accuracyCircle);
      accuracyCircle = L.circle([lat, lon], { radius: accuracy, color: accentColour(), weight: 1, fillOpacity: 0.08, interactive: false }).addTo(map);
      map.flyTo([lat, lon], Math.max(map.getZoom(), 9), { duration: 0.8 });
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
// Shared pipeline for map taps, search results and "My location".
// The pin glides to the new point straight away; the map checks (water,
// buildings, place name) and the NASA download start at the same moment.
// ---------------------------------------------------------------------------
async function tryPlacePoint(lat, lon, opts = {}) {
  const t = T();
  if (!insideMongolia(lat, lon)) { showToast(opts.mine ? t.geoOutside : t.outsideMongolia, 5000); return; }
  if (!opts.mine && accuracyCircle) { map.removeLayer(accuracyCircle); accuracyCircle = null; }
  const token = ++clickToken;
  const prev = selPin ? selPin.getLatLng() : null;
  pending = { lat, lon };
  infoHidden = false;
  movePin(lat, lon);
  renderInfoCard();
  hideToast();
  const nasa = fetchNasaPower(lat, lon).then((s) => ({ s }), (e) => ({ e }));   // download in parallel
  const place = await checkPlace(lat, lon);
  if (token !== clickToken) return;                    // a newer tap replaced this one
  pending = null;
  const goBack = () => { if (prev) movePin(prev.lat, prev.lng); renderInfoCard(); };
  if (place.blocked === "water") {
    showToast(fmt(t.lakeToast, { lake: pickName(place.feature) || t.unnamedWater }), 5000); goBack(); return;
  }
  if (place.blocked === "built" && !opts.mine && !opts.search) {
    const where = pickName(place.feature) || pickName(place.soum) || t.unnamedBuilt;
    showToast(fmt(t.builtToast, { place: where }), 5500); goBack(); return;
  }
  // Your own location is often a town: NASA's ~50 km data still describes the farmland around it
  if (place.blocked === "built" && opts.mine) showToast(t.geoBuiltNote, 6500);
  else if (place.blocked === "built" && opts.search) showToast(fmt(t.searchBuiltNote, { place: opts.search }), 6500);
  selectPoint(lat, lon, { place, mine: !!opts.mine, nasa });
}

// ---------------------------------------------------------------------------
// Map
// ---------------------------------------------------------------------------
const accentColour = () => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#1F4F9C";
const accent2Colour = () => getComputedStyle(document.documentElement).getPropertyValue("--accent-2").trim() || "#FF7A1A";

function initMap() {
  map = L.map("mongolia-map", { center: MAP_HOME.center, zoom: MAP_HOME.zoom, zoomControl: false, scrollWheelZoom: false });
  if (!isPhone()) {
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.control.scale({ position: "bottomleft", imperial: false }).addTo(map);
  }
  // Free Esri maps: no API key, and they work however the app is opened
  streetLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    { attribution: "Tiles &copy; Esri", maxZoom: 18 });
  satelliteLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics", maxZoom: 18 });
  borderLayer = L.polygon(MONGOLIA_BORDER.map(([lon, lat]) => [lat, lon]),
    { color: accentColour(), weight: 2, dashArray: "6 5", fill: false, interactive: false }).addTo(map);

  ["map-left-controls", "map-search", "info-card", "nasa-legend"].forEach((id) => {
    L.DomEvent.disableClickPropagation($(id));
    L.DomEvent.disableScrollPropagation($(id));
  });
  initSearch();

  REGION_ORDER.forEach((id) => {
    const r = REGIONS[id];
    const m = L.marker([r.lat, r.lon], { icon: regionIcon(id) }).addTo(map);
    m.on("click", (e) => { L.DomEvent.stopPropagation(e); selectRegion(id, false); });
    regionMarkers[id] = m;
  });

  map.on("click", (e) => tryPlacePoint(e.latlng.lat, e.latlng.lng));
  map.on("move zoomend resize", positionInfoCard);
  map.on("mousemove", (e) => setToolCoords(e.latlng.lat, e.latlng.lng));
  map.on("mouseout", () => { if (state.location) setToolCoords(state.location.lat, state.location.lon); });

  let lastPhone = isPhone(), resizeT;
  window.addEventListener("resize", () => {
    map && map.invalidateSize();
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      if (state.stats && !state.loading) renderClimate(false);
      if (isPhone() !== lastPhone) { lastPhone = isPhone(); refreshMarkers(); if (state.stats && !state.loading) renderAll(); }
      positionInfoCard();
    }, 200);
  });
}

function setToolCoords(lat, lon) {
  $("tool-coords").textContent = `${lat.toFixed(3)}°N  ${lon.toFixed(3)}°E`;
}

function regionIcon(id) {
  const label = isPhone() ? "" : T().regions[id].shortName;
  const html = `<div class="reg-pin">
      <svg width="20" height="26" viewBox="0 0 38 50"><path d="M19 1C9.06 1 1 9.06 1 19c0 13 18 30 18 30s18-17 18-30C37 9.06 28.94 1 19 1z" style="fill:var(--accent-2)" stroke="#fff" stroke-width="3"/><circle cx="19" cy="19" r="6" fill="#fff"/></svg>
      ${label ? `<span class="pin-label">${label}</span>` : ""}</div>`;
  return L.divIcon({ html, className: "custom-google-marker", iconSize: [0, 0], iconAnchor: [0, 0] });
}
function refreshMarkers() { REGION_ORDER.forEach((id) => regionMarkers[id].setIcon(regionIcon(id))); }

// ---- The selection pin: one pin that glides to every new choice -------------
let selPin = null, pinAnim = null;
function selPinIcon(drop) {
  return L.divIcon({ className: "custom-google-marker", iconSize: [0, 0], iconAnchor: [0, 0],
    html: `<div class="sel-pin ${drop ? "drop" : ""}"><span class="ring"></span>
      <svg width="30" height="40" viewBox="0 0 38 50"><path d="M19 1C9.06 1 1 9.06 1 19c0 13 18 30 18 30s18-17 18-30C37 9.06 28.94 1 19 1z" style="fill:var(--accent)" stroke="#fff" stroke-width="2.5"/><circle cx="19" cy="19" r="6.5" fill="#fff"/></svg></div>` });
}
function movePin(lat, lon) {
  const to = L.latLng(lat, lon);
  setToolCoords(lat, lon);
  if (!selPin) {
    selPin = L.marker(to, { icon: selPinIcon(true), zIndexOffset: 2000, interactive: false }).addTo(map);
    positionInfoCard();
    return;
  }
  cancelAnimationFrame(pinAnim);
  const from = selPin.getLatLng();
  const a = map.latLngToContainerPoint(from), b = map.latLngToContainerPoint(to);
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const dur = REDUCED_MOTION ? 0 : Math.min(650, 260 + dist * 0.6);
  const t0 = performance.now();
  $("info-card").classList.add("track");
  const step = (now) => {
    const k = dur ? Math.min(1, (now - t0) / dur) : 1;
    const e = 1 - Math.pow(1 - k, 3);                                    // ease-out
    selPin.setLatLng([from.lat + (to.lat - from.lat) * e, from.lng + (to.lng - from.lng) * e]);
    positionInfoCard();
    if (k < 1) pinAnim = requestAnimationFrame(step);
  };
  pinAnim = requestAnimationFrame(step);
}

// ---- Info card next to the pin ---------------------------------------------------
let pending = null, infoHidden = false, cardShownAt = 0;
function renderInfoCard() {
  const card = $("info-card"), t = T();
  if (infoHidden || (!pending && !state.location)) { card.classList.remove("show", "track"); return; }
  const loading = (txt) => `<p class="ic-loading"><span class="spin"></span>${txt}</p>`;
  let title, rows = "", body = "";
  if (pending) {
    title = `${pending.lat.toFixed(3)}°N, ${pending.lon.toFixed(3)}°E`;
    body = loading(t.infoChecking);
  } else {
    const loc = state.location, s = state.stats;
    const area = loc.type === "point" ? placeLabel(loc.place) : "";
    title = loc.type === "region" ? t.regions[loc.id].fullName : loc.mine ? t.myLocation : area || t.customPointName;
    const row = (k, v) => `<dt>${k}</dt><dd>${v}</dd>`;
    rows = row(t.popupCoordLabel.replace(":", ""), `${loc.lat.toFixed(2)}°N, ${loc.lon.toFixed(2)}°E`);
    if (loc.mine && area) rows += row(t.popupAreaLabel.replace(":", ""), area);
    if (loc.type === "region") rows += row("", t.regions[loc.id].zoneTag);
    if (s && !state.loading && s.elevation) rows += row(t.popupElevLabel.replace(":", ""), `${Math.round(s.elevation)} m`);
    if (state.loading || !state.cropScores) body = loading(t.infoCalculating);
    else {
      const best = CROP_ORDER.map((id) => state.cropScores[id]).sort((a, b) => b.score - a.score).slice(0, 3);
      body = `<div class="ic-crops"><p class="kicker" style="font-size:10px">${t.infoTopCrops}</p><ul>${best.map((c) =>
        `<li><i class="crop-mark" style="background:${CROPS[c.id].color};color:${CROPS[c.id].color}"></i><span>${t.crops[c.id].name}</span><b style="color:${LEVEL_STYLE[c.level].color}">${c.score}</b></li>`).join("")}</ul></div>`;
    }
  }
  const wasShown = card.classList.contains("show");
  card.innerHTML = `<div class="ic-inner">
      <div class="ic-head"><p class="ic-title">${title}</p>
        <button class="ic-close" onclick="closeInfoCard()" aria-label="${t.infoClose}"><svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" stroke-width="1.6"><path d="M1 1l8 8M9 1L1 9"/></svg></button></div>
      ${rows ? `<dl class="ic-rows">${rows}</dl>` : ""}${body}</div>`;
  positionInfoCard();
  if (!wasShown) {
    card.classList.remove("track");
    void card.offsetWidth;
    card.classList.add("show");
    cardShownAt = performance.now();
    setTimeout(() => card.classList.add("track"), 460);
  } else if (!REDUCED_MOTION) {
    card.firstElementChild.animate([{ opacity: 0.35, filter: "blur(2px)" }, { opacity: 1, filter: "blur(0)" }], { duration: 320, easing: "ease-out" });
  }
}
function closeInfoCard() { infoHidden = true; renderInfoCard(); }

function positionInfoCard() {
  const card = $("info-card");
  if (!selPin || !map) return;
  const p = map.latLngToContainerPoint(selPin.getLatLng());
  const size = map.getSize(), cw = card.offsetWidth || 264, ch = card.offsetHeight || 150;
  if (isPhone()) {                                // phones: docked along the bottom of the map
    card.style.setProperty("--x", "10px");
    card.style.setProperty("--y", `${Math.round(size.y - ch - 10)}px`);
    card.style.setProperty("--ox", "bottom");
    return;
  }
  let x = p.x + 24, y = p.y - 24 - ch / 2, origin = "left";
  if (x + cw > size.x - 10) { x = p.x - 24 - cw; origin = "right"; }
  if (x < 10) {                                   // narrow screens: above or below the pin
    x = Math.max(10, Math.min(size.x - cw - 10, p.x - cw / 2));
    y = p.y + 12 + ch < size.y - 10 ? p.y + 12 : p.y - 50 - ch;
    origin = "center";
  }
  const top = 70;                                   // stay below the search bar
  y = Math.max(top, Math.min(size.y - ch - 10, y));
  card.style.setProperty("--x", `${Math.round(x)}px`);
  card.style.setProperty("--y", `${Math.round(y)}px`);
  card.style.setProperty("--ox", origin);
}

function setMapLayer(mode) {
  state.mapLayer = mode;
  [streetLayer, satelliteLayer].forEach((l) => map.removeLayer(l));
  (mode === "satellite" ? satelliteLayer : streetLayer).addTo(map);
  $("btn-layer-street").classList.toggle("on", mode === "street");
  $("btn-layer-satellite").classList.toggle("on", mode === "satellite");
}

function resetMapOverview() { map.flyTo(MAP_HOME.center, MAP_HOME.zoom, { duration: 0.8 }); }

// ---------------------------------------------------------------------------
// Selecting a location
// ---------------------------------------------------------------------------
function selectRegion(id, fly = true) {
  clickToken++;
  pending = null; infoHidden = false;
  if (accuracyCircle) { map.removeLayer(accuracyCircle); accuracyCircle = null; }
  const r = REGIONS[id];
  state.location = { type: "region", id, lat: r.lat, lon: r.lon };
  if (fly) map.flyTo([r.lat, r.lon], 7, { duration: 0.8 });
  movePin(r.lat, r.lon);
  loadLocation();
}

function selectPoint(lat, lon, extra = {}) {
  state.location = { type: "point", lat, lon, place: extra.place || null, mine: !!extra.mine };
  loadLocation(extra.nasa);
}

async function loadLocation(prefetched) {
  const token = ++state.loadToken;
  const loc = state.location;
  state.loading = true;
  renderLoading();

  const res = prefetched ? await prefetched
    : await fetchNasaPower(loc.lat, loc.lon).then((s) => ({ s }), (e) => ({ e }));
  let stats = res.s;
  if (!stats) {
    console.warn("NASA POWER unavailable, using approximate fallback:", res.e);
    stats = fallbackStats(loc.type === "region" ? loc.id : nearestRegion(loc.lat, loc.lon));
  }
  if (token !== state.loadToken) return; // a newer click replaced this one

  state.stats = stats;
  state.loading = false;
  recompute(true);
  renderAll(true);
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
function setPriority(p) { state.priority = p; recompute(true); renderControls(); renderRotations(); }
function setIrrigation(on) { state.irrigated = on; recompute(); renderCrops(); renderRotations(); renderInfoCard(); }
function selectStrategy(id, scroll = true) {
  state.selectedStrategyId = id;
  renderRotations();
  if (scroll) $("strategy-detail-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}
// "What do you grow now?" → the baseline becomes that crop every year
function setCurrentCrop(crop) {
  state.currentCrop = crop;
  STRATEGIES.baseline.crops = [crop];
  Object.assign(STRATEGIES.baseline.attrs, BASELINE_ATTRS[crop]);
  if (!state.stats || state.loading) return;
  recompute();
  renderRotations();
}
function strategyCrops(id) {
  const t = T();
  if (id !== "baseline") return t.strategies[id].crops;
  const name = t.crops[state.currentCrop].name;
  return fmt(t.baselineCrops, { crop: name.charAt(0).toLowerCase() + name.slice(1) });
}

function setLanguage(lang) {
  state.lang = lang;
  document.documentElement.lang = lang;
  $("btn-lang-mn").classList.toggle("active", lang === "mn");
  $("btn-lang-en").classList.toggle("active", lang === "en");
  document.querySelector(".lang-switch").classList.toggle("en", lang === "en");
  refreshMarkers();
  if (state.loading) renderLoading();
  else if (state.stats) renderAll(false);
  else { applyStaticText(); renderPills(); }
  refreshPlaceNames();
}

// District/province names arrive in the language that was active when the point
// was tapped. After a language switch, ask for them again in the new language.
async function refreshPlaceNames() {
  const loc = state.location;
  if (!loc || loc.type !== "point" || !loc.place) return;
  const lang = state.lang, p = loc.place;
  if ((!p.aimag || p.aimag[lang]) && (!p.soum || p.soum[lang])) return;
  try {
    const n = await reverseGeocode(loc.lat, loc.lon);
    if (state.location !== loc) return;
    if (n.aimag && p.aimag) p.aimag[lang] = n.aimag[lang];
    if (n.soum && p.soum) p.soum[lang] = n.soum[lang];
    if (!state.loading && state.stats) renderAll(false);
  } catch (e) { /* keep the names we have */ }
}

// ---- Place search ----------------------------------------------------------
// Instant matches: featured regions + all aimags (built in, work offline).
// Then OpenStreetMap place search (Nominatim), limited to Mongolia.
let searchTimer = null, searchItems = [], searchSeq = 0;

function aimagCenters() {
  return MONGOLIA_AIMAGS.map((a) => {
    const ring = a.rings.reduce((big, r) => (r.length > big.length ? r : big), a.rings[0]);
    const lon = ring.reduce((s, p) => s + p[0], 0) / ring.length, lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    const ub = a.en === "Ulaanbaatar";
    return { lat, lon, mn: ub ? "Улаанбаатар хот" : `${a.mn} аймаг`, en: ub ? "Ulaanbaatar City" : `${a.en} Province` };
  });
}
const KIND = { region: { mn: "БҮС", en: "REGION" }, aimag: { mn: "АЙМАГ", en: "AIMAG" }, place: { mn: "ГАЗАР", en: "PLACE" }, coord: { mn: "КООРД", en: "COORD" } };

function localMatches(q) {
  const t = T(), ql = q.toLowerCase(), out = [];
  REGION_ORDER.forEach((id) => {
    const names = [TRANSLATIONS.mn.regions[id].fullName, TRANSLATIONS.en.regions[id].fullName];
    if (names.some((n) => n.toLowerCase().includes(ql)))
      out.push({ kind: "region", tag: "region", id, label: t.regions[id].fullName, sub: t.regions[id].zoneTag });
  });
  const featured = new Set(REGION_ORDER.flatMap((id) => [TRANSLATIONS.mn.regions[id].fullName, TRANSLATIONS.en.regions[id].fullName]));
  aimagCenters().forEach((a) => {
    if (featured.has(a.mn) || featured.has(a.en)) return;
    if ([a.mn, a.en].some((n) => n.toLowerCase().includes(ql)))
      out.push({ kind: "point", tag: "aimag", lat: a.lat, lon: a.lon, label: a[state.lang], name: a[state.lang], sub: "" });
  });
  const starts = (it) => (it.label.toLowerCase().startsWith(ql) ? 0 : 1);
  return out.sort((x, y) => starts(x) - starts(y)).slice(0, 6);
}

async function nominatimSearch(q) {
  const wait = lastNominatim + 1100 - Date.now();           // 1 request per second
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatim = Date.now();
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=mn&limit=6` +
              `&accept-language=${state.lang === "mn" ? "mn,en" : "en,mn"}&q=${encodeURIComponent(q)}`;
  const list = await fetchJson(url);
  return list.map((r) => {
    const parts = r.display_name.split(",").map((x) => x.trim());
    return { kind: "point", tag: "place", lat: +r.lat, lon: +r.lon, label: parts[0], name: parts[0], sub: parts.slice(1, 3).join(", ") };
  });
}

function setSearchOpen(open) { $("map-search").classList.toggle("open", open); }
function renderSearchResults(items, note) {
  searchItems = items;
  const ul = $("search-results");
  if (!items.length && !note) { setSearchOpen(false); return; }
  ul.innerHTML = items.map((it, i) =>
    `<li style="--i:${i}"><button onclick="pickSearchResult(${i})">
      <span class="r-kind">${KIND[it.tag][state.lang]}</span>
      <span style="min-width:0"><span class="r-name">${it.label}</span>${it.sub ? `<span class="r-sub">${it.sub}</span>` : ""}</span>
    </button></li>`).join("") + (note ? `<li style="--i:${items.length}" class="r-note">${note}</li>` : "");
  if (document.activeElement === $("search-input")) setSearchOpen(true);
}

function runSearch(q) {
  const t = T(), seq = ++searchSeq;
  q = q.trim();
  if (!q) { renderSearchResults([]); return; }
  const m = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)\s*$/);   // "48.5, 106.3"
  if (m) {
    const lat = +m[1], lon = +m[2];
    renderSearchResults([{ kind: "point", tag: "coord", lat, lon, label: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, name: `${lat.toFixed(2)}, ${lon.toFixed(2)}`, sub: "" }]);
    return;
  }
  const local = localMatches(q);
  renderSearchResults(local, q.length >= 3 ? t.searchLoading : "");
  if (q.length < 3) return;
  nominatimSearch(q).then((remote) => {
    if (seq !== searchSeq) return;
    const all = [...local, ...remote];
    renderSearchResults(all, all.length ? "" : t.searchNoResults);
  }).catch(() => {
    if (seq !== searchSeq) return;
    renderSearchResults(local, local.length ? "" : t.searchNoResults);
  });
}

function pickSearchResult(i) {
  const it = searchItems[i];
  if (!it) return;
  setSearchOpen(false);
  $("search-input").blur();
  if (it.kind === "region") { $("search-input").value = T().regions[it.id].fullName; selectRegion(it.id); return; }
  $("search-input").value = it.name;
  if (insideMongolia(it.lat, it.lon)) map.flyTo([it.lat, it.lon], Math.max(map.getZoom(), 9), { duration: 0.8 });
  tryPlacePoint(it.lat, it.lon, { search: it.name });
}

function initSearch() {
  const input = $("search-input"), box = $("map-search");
  input.addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => runSearch(input.value), 300); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); clearTimeout(searchTimer); if (searchItems.length) pickSearchResult(0); else runSearch(input.value); }
    if (e.key === "Escape") { setSearchOpen(false); input.blur(); }
  });
  input.addEventListener("focus", () => { box.classList.add("focus"); if (searchItems.length) setSearchOpen(true); });
  input.addEventListener("blur", () => setTimeout(() => { if (!box.contains(document.activeElement)) box.classList.remove("focus"); }, 150));
  document.addEventListener("pointerdown", (e) => { if (!box.contains(e.target)) { setSearchOpen(false); box.classList.remove("focus"); } });
}

// ---- NASA satellite layers (GIBS) ------------------------------------------
function gibsLayer(name, matrix, date, opacity) {
  const level = +matrix.split("Level")[1];
  return L.tileLayer(
    `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${name}/default/${date}/${matrix}/{z}/{y}/{x}.png`,
    { maxNativeZoom: level, maxZoom: 18, opacity, attribution: "NASA GIBS", zIndex: 5 });
}
function toggleNasaLayer(id) {
  if (nasaOverlay) { map.removeLayer(nasaOverlay); nasaOverlay = null; }
  activeNasaLayer = activeNasaLayer === id ? null : id;
  if (activeNasaLayer) addNasaLayer(id, 0);
  renderNasaLayerUI();
}
// Try each known GIBS layer name until one loads
function addNasaLayer(id, i) {
  const cfg = NASA_LAYERS[id], cand = cfg.candidates[i];
  if (!cand) { showToast(T().layerUnavailable, 5000); activeNasaLayer = null; renderNasaLayerUI(); return; }
  const layer = gibsLayer(cand[0], cand[1], cfg.date, cfg.opacity);
  let loaded = 0, errors = 0;
  layer.on("tileload", () => { loaded++; });
  layer.on("tileerror", () => {
    if (++errors === 3 && loaded === 0 && nasaOverlay === layer) { map.removeLayer(layer); nasaOverlay = null; addNasaLayer(id, i + 1); }
  });
  nasaOverlay = layer.addTo(map);
}
function renderNasaLayerUI() {
  const t = T();
  ["ndvi", "smap"].forEach((k) => $(`btn-ov-${k}`).classList.toggle("on", activeNasaLayer === k));
  const leg = $("nasa-legend");
  if (!activeNasaLayer) { leg.classList.add("hidden"); return; }
  const cfg = NASA_LAYERS[activeNasaLayer], nd = activeNasaLayer === "ndvi";
  const bar = nd ? "linear-gradient(90deg,#8c510a,#d8b365,#f6e8c3,#a6d96a,#1a9641)" : "linear-gradient(90deg,#a6611a,#dfc27d,#f5f5f5,#80cdc1,#2166ac)";
  leg.innerHTML = `<b>${t[nd ? "legendNdviTitle" : "legendSmapTitle"]}</b> · <span class="mono">${cfg.date.slice(0, 7)}</span>
    <div class="lg-grad" style="background:${bar}"></div>
    <div class="lg-ends"><span>${t[nd ? "legendNdviLow" : "legendSmapLow"]}</span><span>${t[nd ? "legendNdviHigh" : "legendSmapHigh"]}</span></div>`;
  leg.classList.remove("hidden");
}

// ---- Theme -----------------------------------------------------------------
function setTheme(theme) {
  state.theme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
  try { localStorage.setItem("cropCopilotTheme", theme); } catch (e) { /* storage unavailable */ }
  $("btn-theme").setAttribute("aria-label", theme === "dark" ? T().themeLight : T().themeDark);
  if (borderLayer) borderLayer.setStyle({ color: accentColour() });
  if (window.refreshStarColour) window.refreshStarColour();
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function applyStaticText() {
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = T()[el.dataset.i18n]; });
  $("search-input").placeholder = T().searchPlaceholder;
  if (map) renderNasaLayerUI();
  const a = document.querySelector("#tabbar .tab.active");
  if (a && window.moveTabHighlight) requestAnimationFrame(() => window.moveTabHighlight(a, false));
  $("btn-theme").setAttribute("aria-label", state.theme === "dark" ? T().themeLight : T().themeDark);
}

function renderPills() {
  const t = T(), loc = state.location;
  $("map-quick-pills").innerHTML = REGION_ORDER.map((id) => {
    const on = loc && loc.type === "region" && loc.id === id;
    return `<button onclick="selectRegion('${id}')" class="pill ${on ? "on" : ""}">${t.regions[id].shortName}</button>`;
  }).join("") + `<button onclick="resetMapOverview()" class="pill ghost">${t.btnOverview}</button>`;
}

function renderStatus() {
  const t = T(), dot = $("nasa-status-dot"), txt = $("nasa-status-text");
  if (state.loading) { dot.className = "loading"; txt.textContent = t.statusLoading; }
  else if (state.stats && state.stats.isLive) { dot.className = "live"; txt.textContent = t.statusLive; }
  else { dot.className = ""; txt.textContent = t.statusFallback; }
}

function renderPlace() {
  $("ui-active-location").textContent = locationName();
  const loc = state.location, t = T();
  if (!loc) return;
  $("side-place").textContent = loc.type === "region" ? t.regions[loc.id].fullName
    : (loc.mine ? t.myLocation + (placeLabel(loc.place) ? ` · ${placeLabel(loc.place)}` : "") : placeLabel(loc.place) || t.customPointName);
}

function renderLoading() {
  applyStaticText();
  renderPills();
  renderStatus();
  renderPlace();
  setAlertStyle("loading");
  $("alert-title").textContent = T().statusLoading;
  $("alert-desc").textContent = "";
  $("alert-note").textContent = "";
  renderMetrics();
  renderInfoCard();
}

function renderAll(animate) {
  applyStaticText();
  renderPills();
  renderStatus();
  renderPlace();
  renderAlert();
  renderMetrics();
  renderClimate(animate && state.tab === "map");
  renderCrops();
  renderControls();
  renderRotations();
  renderInfoCard();
}

// ---- Main risk (side panel) ---------------------------------------------------
const ALERT_COLOURS = { loading: "var(--border)", season: "#4A9EE8", heat: "var(--bad)", drought: "var(--warn)", ok: "var(--good)" };
function setAlertStyle(type) { $("alert-banner").style.setProperty("--alert", ALERT_COLOURS[type]); }

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
    soil: num(!noSoil ? s.maySoil * 100 : null), trend: trendTxt
  };
  $("alert-title").textContent = t.alert[textKey].title.replace(/^NASA[^:]*:\s*/, "");
  $("alert-desc").textContent = fmt(t.alert[textKey].desc, vars);
  $("alert-note").textContent = state.stats.isLive ? "" :
    fmt(t.fallbackNote, { region: t.regions[state.stats.fallbackRegion].fullName });
}

// ---- Metrics -------------------------------------------------------------------
function trendChip(delta, threshold, higherIsBetter, unit, dec = 0) {
  const t = T();
  if (delta === null || delta === undefined) return `<span class="muted">${t.trendNA}</span>`;
  const sign = delta > 0 ? "+" : "";
  let cls = "", arrow = "→";
  if (Math.abs(delta) >= threshold) { cls = (delta > 0) === higherIsBetter ? "good" : "bad"; arrow = delta > 0 ? "▲" : "▼"; }
  return `<span class="chip ${cls}">${arrow} ${sign}${num(delta, dec)}${unit}</span> <span class="muted">${t.trendVs}</span>`;
}

function renderMetrics() {
  const t = T();
  const loading = state.loading || !state.stats;
  const s = loading ? null : state.stats.summary;
  const tr = loading ? null : state.stats.trend;
  const noSoil = s && (s.maySoil === null || s.maySoil === undefined);
  const cards = [
    { label: t.m_ff_label, value: s ? num(s.ff) : "000", unit: t.unitDays,
      note: s ? fmt(t.m_ff_note, { start: fmtDate(s.lastSpring + 1), end: fmtDate(s.firstFall - 1) }) : "",
      trend: s ? trendChip(tr && tr.ff, 2, true, "") : "", src: "T2M_MIN" },
    { label: t.m_heat_label, value: s ? oneDec(s.heat[30]) : "00", unit: t.unitDays,
      note: t.m_heat_note, trend: s ? trendChip(tr && tr.heat30, 0.5, false, "", 1) : "", src: "T2M_MAX" },
    { label: t.m_rain_label, value: s ? num(s.rain) : "000", unit: t.unitMm,
      note: t.m_rain_note, trend: s ? trendChip(tr && tr.rain, 10, true, "") : "", src: "PRECTOTCORR" },
    { label: t.m_soil_label, value: s ? (noSoil ? "–" : num(s.maySoil * 100)) : "00", unit: noSoil ? "" : "/100",
      note: noSoil ? t.m_soil_na : t.m_soil_note,
      trend: s ? trendChip(tr && tr.maySoil !== null && tr.maySoil !== undefined ? tr.maySoil * 100 : null, 2, true, "") : "", src: "GWETTOP" }
  ];
  $("metric-cards").innerHTML = cards.map((c) => `
    <div class="metric">
      <p class="kicker">${c.label}</p>
      <p class="metric-value ${loading ? "skeleton" : ""}" data-count="${loading ? "" : c.value}">${c.value}<span class="metric-unit">${c.unit}</span></p>
      <p class="metric-note">${c.note}</p>
      <p class="metric-trend">${c.trend}</p>
      <p class="kicker metric-src">NASA POWER · ${c.src}</p>
    </div>`).join("");
  if (!loading && !REDUCED_MOTION) countUp();
}
// numbers count up from zero
function countUp() {
  document.querySelectorAll("#metric-cards .metric-value").forEach((el) => {
    const target = parseFloat(el.dataset.count);
    if (!isFinite(target)) return;
    const dec = String(el.dataset.count).includes(".") ? 1 : 0;
    const unit = el.querySelector(".metric-unit").outerHTML, t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 900), e = 1 - Math.pow(1 - k, 3);
      el.innerHTML = (target * e).toFixed(dec) + unit;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

// ---- Climate chart: monthly rain (bars) + average temperature (line) ----------
const SEASON_MONTHS = { winter: [11, 0, 1], spring: [2, 3, 4], summer: [5, 6, 7], autumn: [8, 9, 10] };
const seasonOf = (m) => Object.keys(SEASON_MONTHS).find((k) => SEASON_MONTHS[k].includes(m));
const DAYS_IN = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function setSeason(s) { state.season = state.season === s ? null : s; renderClimate(false); }

function monthlyData() {
  const st = state.stats;
  if (!st) return null;
  if (st.monthly && st.monthly.every((m) => m.t !== null)) return st.monthly;
  const loc = state.location;
  return approxMonthly(REGIONS[loc.type === "region" ? loc.id : nearestRegion(loc.lat, loc.lon)].fallback);
}

function renderClimate(animate) {
  const t = T(), box = $("climate-chart");
  const today = new Date(), tm = today.getMonth(), nowSeason = seasonOf(tm);
  $("season-tabs").innerHTML = [null, "winter", "spring", "summer", "autumn"].map((k) =>
    `<button onclick="setSeason(${k ? `'${k}'` : "null"})" class="${state.season === k ? "on" : ""} ${k === nowSeason ? "now" : ""}">${k ? t.seasons[k] : t.seasonYear}</button>`).join("");

  const data = state.loading ? null : monthlyData();
  if (!data) { box.innerHTML = `<p class="chart-empty">${t.statusLoading}</p>`; $("season-readout").textContent = ""; return; }
  const approx = !state.stats.isLive || !(state.stats.monthly && state.stats.monthly.every((m) => m.t !== null));

  // Readout above the chart
  if (state.season) {
    const ms = SEASON_MONTHS[state.season];
    const avgT = ms.reduce((a, m) => a + data[m].t, 0) / 3, rain = ms.reduce((a, m) => a + data[m].rain, 0);
    $("season-readout").innerHTML = fmt(t.seasonSummary, { season: `<b>${t.seasons[state.season]}</b>`, t: avgT.toFixed(1), rain: Math.round(rain) });
  } else {
    const dateStr = fmt(t.dateFmt, { month: t.months[tm], day: today.getDate() });
    $("season-readout").innerHTML = fmt(t.todaySummary, { date: `<b>${dateStr}</b>`, season: t.seasons[nowSeason],
      t: data[tm].t.toFixed(1), rain: Math.round(data[tm].rain) });
  }
  if (approx) $("season-readout").innerHTML += ` · <span style="color:var(--warn)">${t.chartApprox}</span>`;

  const W = Math.max(320, Math.min(1232, box.clientWidth || 900)), phone = W < 560;
  const H = phone ? 270 : 330;
  const padL = phone ? 34 : 46, padR = phone ? 34 : 46, padT = 30, padB = 30;
  const pw = W - padL - padR, ph = H - padT - padB, bw = pw / 12;
  const niceUp = (v, step) => Math.max(step, Math.ceil(v / step) * step);
  const rMax = niceUp(Math.max(...data.map((d) => d.rain)) * 1.1, 10);
  let tLo = Math.floor(Math.min(...data.map((d) => d.t)) / 5) * 5, tHi = Math.ceil(Math.max(...data.map((d) => d.t)) / 5) * 5;
  if (tHi - tLo < 10) tHi = tLo + 10;
  const yR = (v) => padT + ph * (1 - v / rMax);
  const yT = (v) => padT + ph * (1 - (v - tLo) / (tHi - tLo));
  const cx = (i) => padL + (i + 0.5) * bw;
  const monthLabel = (i) => (state.lang === "en" ? t.months[i] : t.calMonths[i]);
  const inSel = (i) => !state.season || SEASON_MONTHS[state.season].includes(i);

  // season bands (winter wraps around the year)
  const bandDefs = [["winter", 0, 2], ["spring", 2, 5], ["summer", 5, 8], ["autumn", 8, 11], ["winter", 11, 12]];
  const bands = bandDefs.map(([k, a, b], j) => {
    const on = state.season === k || (!state.season && k === nowSeason);
    const label = j === 4 ? "" : `<text x="${padL + ((a + b) / 2) * bw}" y="${padT - 12}" text-anchor="middle" class="c-season-label ${on ? "on" : ""}">${t.seasons[k]}</text>`;
    return `<rect x="${padL + a * bw}" y="${padT}" width="${(b - a) * bw}" height="${ph}" class="c-season ${on ? "on" : ""}" opacity="${j % 2 ? 1 : .55}"/>${label}`;
  }).join("");

  // grid + axes
  const rTicks = [0, rMax / 2, rMax];
  const tTicks = []; for (let v = tLo; v <= tHi; v += (tHi - tLo) > 30 ? 10 : 5) tTicks.push(v);
  const grid = tTicks.map((v) => `<line x1="${padL}" x2="${W - padR}" y1="${yT(v)}" y2="${yT(v)}" class="c-grid" opacity=".6"/>
      <text x="${W - padR + 6}" y="${yT(v) + 3}" class="c-axis">${v}°</text>`).join("") +
    rTicks.map((v) => `<text x="${padL - 6}" y="${yR(v) + 3}" text-anchor="end" class="c-axis">${Math.round(v)}</text>`).join("");
  const zero = tLo < 0 && tHi > 0 ? `<line x1="${padL}" x2="${W - padR}" y1="${yT(0)}" y2="${yT(0)}" class="c-zero"/>` : "";

  // bars
  const bars = data.map((d, i) => {
    const y = yR(d.rain), h = padT + ph - y;
    return `<rect class="c-bar ${inSel(i) ? "" : "dim"} ${i === tm && !state.season ? "hot" : ""}" style="--i:${i}" x="${cx(i) - bw * 0.28}" y="${y}" width="${bw * 0.56}" height="${Math.max(0, h)}" rx="1"/>`;
  }).join("");

  // smooth temperature line (Catmull-Rom → Bézier)
  const pts = data.map((d, i) => [cx(i), yT(d.t)]);
  let path = `M${pts[0][0]},${pts[0][1]}`, len = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    path += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    len += Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
  }
  len = Math.ceil(len * 1.08);
  const dots = pts.map((p, i) => `<circle class="c-dot" style="--i:${i}" cx="${p[0]}" cy="${p[1]}" r="${inSel(i) ? 3.5 : 2.5}" opacity="${inSel(i) ? 1 : .45}"/>`).join("");

  // today marker
  const tx = padL + (tm + (today.getDate() - 0.5) / DAYS_IN[tm]) * bw;
  const frac = (today.getDate() - 0.5) / DAYS_IN[tm], nxt = data[(tm + 1) % 12], prv = data[(tm + 11) % 12];
  const tNow = frac < 0.5 ? data[tm].t + (prv.t - data[tm].t) * (0.5 - frac) : data[tm].t + (nxt.t - data[tm].t) * (frac - 0.5);
  const todayG = `<g class="c-today-g"><line x1="${tx}" x2="${tx}" y1="${padT}" y2="${padT + ph}" class="c-today"/>
      <circle cx="${tx}" cy="${yT(tNow)}" r="5" class="c-today-dot"/>
      <text x="${tx + (tx > W - 110 ? -6 : 6)}" y="${padT + 12}" text-anchor="${tx > W - 110 ? "end" : "start"}" class="c-today-label">${t.chartToday}</text></g>`;

  const months = data.map((d, i) => `<text x="${cx(i)}" y="${H - 10}" text-anchor="middle" class="c-month ${inSel(i) ? "" : "dim"}">${monthLabel(i)}</text>`).join("");
  const hits = data.map((d, i) => `<rect class="c-hit" x="${padL + i * bw}" y="${padT}" width="${bw}" height="${ph}" data-m="${i}"/>`).join("");
  const axisTitles = phone ? "" : `<text x="${padL - 6}" y="${padT - 12}" text-anchor="end" class="c-axis-title">mm</text><text x="${W - padR + 6}" y="${padT - 12}" class="c-axis-title">°C</text>`;

  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="${animate && !REDUCED_MOTION ? "grow" : ""}" role="img" aria-label="${t.climateTitle}">
      ${bands}${grid}${zero}${bars}
      <path class="c-line" d="${path}" ${animate && !REDUCED_MOTION ? `style="stroke-dasharray:${len};stroke-dashoffset:${len}"` : ""}/>
      ${dots}${todayG}${months}${axisTitles}${hits}
    </svg><div class="chart-tip" id="chart-tip"></div>`;

  // hover tooltip
  const tip = $("chart-tip"), svg = box.querySelector("svg");
  svg.querySelectorAll(".c-hit").forEach((r) => {
    r.addEventListener("pointerenter", () => {
      const i = +r.dataset.m, d = data[i], sc = svg.getBoundingClientRect().width / W;
      tip.innerHTML = `<b>${t.months[i]}</b> · <span class="muted">${t.seasons[seasonOf(i)]}</span>
        <div class="tr"><span>${t.chartRain.replace(/ \(.*/, "")}</span><span>${Math.round(d.rain)} mm</span></div>
        <div class="tr"><span>${t.chartTemp.replace(/ \(.*/, "")}</span><span>${d.t.toFixed(1)}°C</span></div>
        ${d.tmax !== null ? `<div class="tr muted"><span>max / min</span><span>${d.tmax.toFixed(0)}° / ${d.tmin.toFixed(0)}°</span></div>` : ""}`;
      const left = cx(i) * sc + (i > 8 ? -tip.offsetWidth - 14 : 14);
      tip.style.left = `${Math.max(0, left)}px`;
      tip.style.top = `${padT * sc + 10}px`;
      tip.classList.add("on");
    });
    r.addEventListener("pointerleave", () => tip.classList.remove("on"));
  });
}

// ---- Crop suitability list ---------------------------------------------------------
const LEVEL_STYLE = { good: { color: "var(--good)" }, risky: { color: "var(--warn)" }, poor: { color: "var(--bad)" } };
function levelLabel(level) { const t = T(); return level === "good" ? t.levelGood : level === "risky" ? t.levelRisky : t.levelPoor; }
function reasonText(r) { return fmt(T().reasons[r.key], r); }
const cropMark = (id) => `<i class="crop-mark" style="background:${CROPS[id].color};color:${CROPS[id].color}"></i>`;

function renderCrops() {
  const t = T();
  if (!state.cropScores || state.loading) { $("crop-grid").innerHTML = ""; $("btn-more-crops").classList.add("hidden"); return; }
  const sorted = CROP_ORDER.map((id) => state.cropScores[id]).sort((a, b) => b.score - a.score);
  const limit = isPhone() && !state.showAllCrops ? 5 : sorted.length;
  const more = $("btn-more-crops");
  more.textContent = state.showAllCrops ? t.showFewerCrops : fmt(t.showAllCrops, { n: sorted.length });
  more.classList.toggle("hidden", !isPhone());
  $("crop-grid").innerHTML = sorted.slice(0, limit).map((c, i) => {
    const st = LEVEL_STYLE[c.level], ct = t.crops[c.id];
    const reasons = c.reasons.length ? c.reasons.map(reasonText) : [t.reasons.r_fine];
    return `
      <div class="crop-row" style="--i:${i}">
        <div class="crop-score" style="color:${st.color}">${c.score}</div>
        <div><p class="crop-name">${cropMark(c.id)}${ct.name}</p><p class="crop-role">${ct.role}</p></div>
        <div class="crop-level-col">
          <span class="level" style="color:${st.color}"><i style="background:${st.color}"></i>${levelLabel(c.level)}</span>
          <div class="bar"><span style="width:${c.score}%;background:${st.color};--i:${i}"></span></div>
        </div>
        <div class="crop-reasons-col">
          <ul class="crop-reasons">${reasons.map((r) => `<li>${r}</li>`).join("")}</ul>
          <p class="crop-best">${t.bestConditions} ${ct.best}</p>
        </div>
      </div>`;
  }).join("");
  const pasture = $("pasture-note");
  if (isPastureOnly(state.cropScores)) { pasture.textContent = t.pastureNote; pasture.classList.remove("hidden"); }
  else pasture.classList.add("hidden");
}
function toggleAllCrops() { state.showAllCrops = !state.showAllCrops; renderCrops(); }

// ---- Farmer controls -----------------------------------------------------------
function renderControls() {
  const t = T();
  $("priority-buttons").innerHTML = Object.keys(t.priorities).map((p) =>
    `<button onclick="setPriority('${p}')" class="${state.priority === p ? "on" : ""}">${t.priorities[p]}</button>`).join("");
  $("irrigation-toggle").checked = state.irrigated;
  $("current-crop").innerHTML = CURRENT_CROP_CHOICES.map((c) =>
    `<option value="${c}" ${c === state.currentCrop ? "selected" : ""}>${t.crops[c].name}</option>`).join("");
}

// ---- Rotations: current practice → better options, detail, table ------------------
const fitColor = (fit) => (fit >= 70 ? "var(--good)" : fit >= 45 ? "var(--warn)" : "var(--bad)");
const fitBar = (fit) => `<div class="bar"><span style="width:${fit}%;background:${fitColor(fit)}"></span></div>`;
function attrChips(id) {
  const t = T(), a = STRATEGIES[id].attrs;
  return `<div class="attr-list">${["soil", "feed", "income", "water"].map((k) => `<span>${t.attrLabels[k]}: <b>${t.attrLevels[a[k]]}</b></span>`).join("")}</div>`;
}
// Table texts carry a symbol for how good they are; show it as a small meter instead
const RATE = [["⭐", "r3"], ["✅", "r2"], ["➖", "r1"], ["⚠️", "rw"], ["⚠", "rw"], ["❌", "rx"]];
function rateCell(txt) {
  for (const [sym, cls] of RATE) if (txt.startsWith(sym))
    return `<span class="rate ${cls}"><i><b></b><b></b><b></b></i>${txt.slice(sym.length).replace(/^️/, "").trim()}</span>`;
  return txt;
}
const plainText = (txt) => txt.replace(/^[^\p{L}\p{N}]+/u, "");

function renderRotations() { renderCompare(); renderDetail(); renderTable(); }

function renderCompare() {
  const t = T(), box = $("compare");
  if (!state.ranking || state.loading) { box.innerHTML = ""; return; }
  const base = state.ranking.baseline, tops = state.ranking.top, bestId = tops[0].id;
  const sel = state.selectedStrategyId;
  box.innerHTML = `
    <div class="cur">
      <p class="kicker col-label">${t.youGrowNow}</p>
      <div class="cur-box ${sel === "baseline" ? "sel" : ""}" onclick="selectStrategy('baseline')" role="button" tabindex="0">
        <span class="tag" style="align-self:flex-start">${t.currentBadge}</span>
        <p class="strat-name">${t.strategies.baseline.name}</p>
        <p class="strat-crops">${strategyCrops("baseline")}</p>
        <div><p class="kicker">${t.fitLabel}</p><p class="strat-fit" style="color:${fitColor(base.fit)}">${base.fit}<span class="metric-unit">/100</span></p>${fitBar(base.fit)}</div>
        ${attrChips("baseline")}
      </div>
    </div>
    <div class="arrow-col" aria-hidden="true"><svg class="flow-arrow" viewBox="0 0 84 40"><path class="shaft" d="M4 20 H68"/><path class="head" d="M64 9 L82 20 L64 31 Z"/></svg></div>
    <div class="opts">
      <p class="kicker col-label">${t.betterOptions}</p>
      ${tops.map((s, i) => {
        const gain = s.fit - base.fit;
        return `<button class="opt ${s.id === sel ? "sel" : ""}" onclick="selectStrategy('${s.id}')">
          <span class="opt-num">${String(i + 1).padStart(2, "0")}</span>
          <span class="opt-name">${t.strategies[s.id].name}${s.id === bestId ? `<span class="tag best">${t.recommendedBadge}</span>` : ""}</span>
          <span class="opt-crops">${strategyCrops(s.id)}</span>
          <span class="opt-score"><span class="strat-fit" style="color:${fitColor(s.fit)}">${s.fit}</span><br>
            <span class="chip ${gain >= 3 ? "good" : gain <= -3 ? "bad" : ""}">${Math.abs(gain) < 3 ? t.switchSame : (gain > 0 ? fmt(t.switchGain, { d: gain }) : gain)}</span></span>
        </button>`;
      }).join("")}
    </div>`;
}

function renderDetail() {
  const t = T(), panel = $("strategy-detail-panel");
  if (!state.ranking || state.loading) { panel.innerHTML = ""; return; }
  const sel = state.ranking.all.find((s) => s.id === state.selectedStrategyId) || state.ranking.top[0];
  const st = t.strategies[sel.id];
  const here = STRATEGIES[sel.id].crops.map((cid) => {
    const c = state.cropScores[cid];
    const why = c.reasons.length ? reasonText(c.reasons[0]) : t.reasons.r_fine;
    return `<li>${cropMark(cid)}<b style="color:${LEVEL_STYLE[c.level].color};min-width:28px">${c.score}</b><span><b>${t.crops[cid].name}</b> — ${why}</span></li>`;
  }).join("");
  const cell = (colour, kicker, body) => `<div class="detail-cell"><p class="kicker"><i style="background:${colour}"></i>${kicker}</p><p>${body}</p></div>`;
  panel.innerHTML = `
    <div class="detail-head">
      <div>
        <p class="kicker">${st.name} · ${locationName()}</p>
        <h3 class="display-md">${strategyCrops(sel.id)}</h3>
      </div>
      <div style="text-align:right"><p class="kicker" style="justify-content:flex-end">${t.fitLabel}</p><p class="strat-fit" style="color:${fitColor(sel.fit)};font-size:52px">${sel.fit}<span class="metric-unit">/100</span></p></div>
    </div>
    ${fieldCalendar(sel.id)}
    <div style="margin-top:28px"><p class="kicker">${t.hereLabel}</p><ul class="here-list">${here}</ul></div>
    <div class="detail-grid">
      ${cell("var(--good)", t.benefitLabel, st.benefit)}
      ${cell("var(--warn)", t.catchLabel, st.catch)}
      ${cell("var(--accent)", t.evidenceLabel, st.evidence)}
      ${cell("var(--muted)", t.gapsLabel, st.gaps)}
    </div>`;
}

// ---- Field calendar: growing, bare and risky months for a strategy ----------
const MONTH_START = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335, 366];
function fieldCalendar(strategyId) {
  const t = T(), s = state.stats.summary;
  const crops = STRATEGIES[strategyId].crops;
  const covered = crops.includes("alfalfa");                 // perennial cover all year
  const sow = Math.max(s.lastSpring - 7, 125);               // cereals tolerate light frost; not before ~May 5
  const harvest = Math.min(s.firstFall + 5, 265);            // done by ~Sep 22 at the latest
  const hot = s.heat[30] >= 4, nowM = new Date().getMonth();
  let bareMonths = 0;
  const cells = MONTH_START.slice(0, 12).map((start, i) => {
    const end = MONTH_START[i + 1] - 1, m = i + 1;
    const grow = Math.max(0, Math.min(end, harvest) - Math.max(start, sow) + 1) >= 10;
    if (!grow && !covered) bareMonths++;
    const frost = (s.lastSpring >= start && s.lastSpring <= end) || (s.firstFall >= start && s.firstFall <= end);
    const heat = hot && grow && (m === 6 || m === 7);
    return `<div style="--i:${i}" class="${grow ? "grow" : covered ? "cover" : "bare"} ${i === nowM ? "now" : ""}" title="${t.months[i]}">${t.calMonths[i]}<div class="mark">${frost ? `<i class="m-frost"></i>` : ""}${heat ? `<i class="m-heat"></i>` : ""}</div></div>`;
  }).join("");
  const note = covered ? t.calCoverNote : strategyId === "shelterbelt" ? fmt(t.calShelterNote, { n: bareMonths }) : fmt(t.calBareNote, { n: bareMonths });
  return `
    <div style="margin-top:24px">
      <p class="kicker">${t.calTitle}</p>
      <div class="cal play">${cells}</div>
      <div class="cal-legend">
        <span><i style="background:var(--good)"></i>${t.calGrow}</span>
        <span><i style="background:color-mix(in srgb, var(--warn) 30%, var(--bg))"></i>${t.calBare}</span>
        ${covered ? `<span><i style="background:color-mix(in srgb, var(--good) 55%, #0E3B5C)"></i>${t.calCover}</span>` : ""}
        <span><i class="m-frost"></i>${t.calFrost}</span>${hot ? `<span><i class="m-heat"></i>${t.calHeat}</span>` : ""}
        <span><i style="outline:2px solid var(--accent-2);background:transparent"></i>${t.chartToday}</span>
      </div>
      <p class="body-text" style="margin-top:8px">${note}</p>
    </div>`;
}
function replayCalendar() {
  const c = document.querySelector("#strategy-detail-panel .cal");
  if (!c) return;
  c.classList.remove("play"); void c.offsetWidth; c.classList.add("play");
}

function renderTable() {
  const t = T();
  if (!state.ranking || state.loading) { $("strategy-table-body").innerHTML = ""; $("strategy-list-mobile").innerHTML = ""; return; }
  const sel = state.selectedStrategyId;
  $("strategy-list-mobile").innerHTML = state.ranking.all.map((s) => {
    const st = t.strategies[s.id];
    return `
      <div onclick="selectStrategy('${s.id}')" class="m-row ${s.id === sel ? "sel" : ""}">
        <div style="display:flex;justify-content:space-between;gap:8px"><b>${st.name}</b><b style="color:${fitColor(s.fit)}">${s.fit}</b></div>
        <p class="strat-crops">${strategyCrops(s.id)}</p>
        <p class="muted" style="font-size:12px;margin-top:4px">${t.thSoil}: ${plainText(st.tableSoil)} · ${t.thWater}: ${st.tableWater} · ${t.thFeed}: ${plainText(st.tableFeed)}</p>
      </div>`;
  }).join("");
  $("strategy-table-body").innerHTML = state.ranking.all.map((s, i) => {
    const st = t.strategies[s.id];
    return `
      <tr onclick="selectStrategy('${s.id}')" class="${s.id === sel ? "sel" : ""}" style="--i:${i}">
        <td>${String(i + 1).padStart(2, "0")}</td>
        <td><b>${st.name}</b></td>
        <td class="strat-crops">${strategyCrops(s.id)}</td>
        <td class="fit-cell" style="color:${fitColor(s.fit)}">${s.fit}</td>
        <td>${rateCell(st.tableSoil)}</td><td>${st.tableWater}</td><td>${rateCell(st.tableFeed)}</td>
      </tr>`;
  }).join("");
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------
const TAB_IDS = ["map", "crops", "rotations", "about"];
state.tab = "map";
function goTab(id, opts = {}) {
  if (id === "climate") id = "map";
  if (!TAB_IDS.includes(id)) id = "map";
  const changed = state.tab !== id || opts.instant;
  state.tab = id;
  document.querySelectorAll(".tab-panel").forEach((p) => {
    const on = p.dataset.panel === id;
    p.hidden = !on;
    if (on && changed) {
      p.querySelectorAll(".reveal").forEach((el, i) => el.style.setProperty("--i", i));
      p.classList.remove("enter"); void p.offsetWidth; p.classList.add("enter");
    }
  });
  document.querySelectorAll("#tabbar .tab").forEach((b) => {
    const on = b.dataset.tab === id;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", on);
    if (on && window.moveTabHighlight) window.moveTabHighlight(b, !opts.instant);
    if (on && b.parentElement.scrollWidth > b.parentElement.clientWidth) {
      const bar = b.parentElement;   // phones: keep the active tab visible in the scrolling bar
      bar.scrollTo({ left: b.offsetLeft - (bar.clientWidth - b.offsetWidth) / 2, behavior: opts.instant ? "auto" : "smooth" });
    }
  });
  if (id === "map" && map) setTimeout(() => { map.invalidateSize(); positionInfoCard(); }, 50);
  if (id === "map" && changed && state.stats && !state.loading) renderClimate(true);
  if (id === "crops" && changed && state.stats && !state.loading) renderCrops();
  if (id === "rotations" && changed) { renderTable(); replayCalendar(); }
  try { if (location.hash !== "#" + id) history.replaceState(null, "", "#" + id); } catch (e) { /* file:// */ }
  if (!opts.keepScroll) window.scrollTo({ top: 0, behavior: opts.instant ? "auto" : "smooth" });
}
function initTabs() {
  document.querySelectorAll("#tabbar .tab").forEach((b) => b.addEventListener("click", () => goTab(b.dataset.tab)));
  const fromHash = (location.hash || "").replace("#", "");
  goTab(fromHash || "map", { instant: true, keepScroll: true });
  window.addEventListener("hashchange", () => {
    const h = location.hash.replace("#", "");
    if (h && h !== state.tab) goTab(h);
  });
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
  initMap();
  initTabs();
  setTheme(state.theme);
  setMapLayer("street");
  setLanguage("mn");
  selectRegion("selenge", false);
});
