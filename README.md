# Perspo-Field-Shift
# Монголын Тариалангийн Туслах — Mongolian Crop Co-Pilot

NASA Space Apps Challenge 2026 · **Field Shift: Adapting Farms with NASA Data**

A farmer-centred decision-support web app. Tap anywhere in Mongolia and it pulls
20 years (2006–2025) of NASA POWER daily climate data for that spot. It then scores
10 crops and ranks 8 crop-rotation strategies against the farmer's priorities.
The app opens in Mongolian, with a switch to English.

## Run it

- **Locally:** double-click `index.html`, or run `python -m http.server` in this folder and open http://localhost:8000.
- **Free hosting (GitHub Pages):** push this folder to a GitHub repo, then open Settings → Pages → Deploy from branch `main` / root.

You need an internet connection for NASA POWER, the map tiles, Tailwind and Leaflet.
There's no API key and no server.

## Files

| File | What it holds |
|---|---|
| `index.html` | Page layout |
| `css/styles.css` | Custom styles (Tailwind handles the rest) |
| `js/i18n.js` | **All Mongolian and English text.** Edit wording here |
| `js/data.js` | Regions and coordinates, crop requirements, rotation strategies |
| `js/nasa.js` | NASA POWER fetch and per-year climate statistics |
| `js/scoring.js` | Crop and strategy scoring rules |
| `js/app.js` | Map, user interaction and rendering |
| `js/mongolia-border.js` | Simplified border used for the "inside Mongolia?" check (Natural Earth) |

## Method

1. **Data:** NASA POWER daily point API, parameters `T2M_MAX`, `T2M_MIN`, `PRECTOTCORR` and `GWETTOP` (soil wetness from the MERRA-2 model), on a grid of roughly 0.5° × 0.625°.
2. **Per-year indicators:**
   - frost-free days (last spring and first autumn day with Tmin ≤ 0°C)
   - growing degree-days (base 5°C, May–Sep)
   - heat days ≥ 27, 28, 30, 33 and 35°C during flowering (Jun 15–Aug 15)
   - warm nights ≥ 18°C
   - May–Sep rainfall
   - May topsoil wetness
   - damaging frosts (≤ −2°C) after sowing and before harvest
3. **Scoring:** the 2016–2025 averages are compared with each crop's needs (`CROPS` in `data.js`) using transparent linear penalties. Each crop is rated good, risky or poor, and the app shows the reasons.
4. **Strategies:** a strategy's fit is 0.6 × the average crop score plus 0.4 × the weakest crop's score. The ranking then adds the farmer's chosen priority (soil, feed, income, water). The current practice (continuous wheat) is always shown.
5. **Trends:** 2021–2025 compared with 2006–2015.
6. **Fallback:** if NASA POWER can't be reached, the app uses *approximate* built-in values and labels them clearly.

## Limitations (stated in the app)

- About 50 km resolution: it can't capture the microclimate of an individual field.
- The crop thresholds are literature-based starting points and need checking by Mongolian agronomists.
- Soil type, markets, seed supply and disease history aren't modelled. These are listed as "information gaps" for each strategy.
- The fallback values are rough estimates, not measurements.

## Sources

- NASA POWER — https://power.larc.nasa.gov
- FAO GIEWS Country Brief: Mongolia (2025)
- Myagmarsuren & Begz (2024), legume–cereal rotation, PMAS 64(3)
- Miyasaka et al. (2021), wheat and rapeseed soil water in Mongolia, *Agriculture* 11(9)
- USDA NRCS, 'Sholty' yellow-flowered alfalfa release brochure
- ADB fodder sector handbooks (via Devdiscourse summary)
- Mongolian Journal of Agricultural Sciences, buckwheat variety trials
- Wheat, potato and canola heat thresholds: Frontiers in Environmental Science (2017), American Journal of Potato Research (2015), DPIRD canola heat trial

> This tool supports, and does not replace, farmer judgment and local agronomic advice.
