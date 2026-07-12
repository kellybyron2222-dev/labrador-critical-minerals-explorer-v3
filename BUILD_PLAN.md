# Labrador Critical Minerals Explorer — Master Build Plan (V3)

> **This tree is V3** (`explorer-v3`). Active development tree for the Labrador
> Critical Minerals Explorer. Do not edit the archived V1 baseline at
> `../project` for V3 work.
>
> **Authoritative layers are baked** under `public/data/` for fast cold loads
> (IndexedDB + live ArcGIS REST/WMS as fallback). Demo/static featured-deposit
> GeoJSON is not used.
>
> **Living document.** This is BOTH the master plan and the granular, step-by-step
> checklist for the project. Review and update it as we move along — tick boxes,
> flip status markers, and add notes in place.
> **Product / GTM / freemium arc:** see [`PRODUCT_PLAN.md`](./PRODUCT_PLAN.md).
> Last updated: 2026-07-12 — **Phase 3 complete** (3.1–3.4 + polish);
> **next = Phase 4.1 geophysics**

**Status marker key:** `[x]` done · `[~]` in progress · `[ ]` not started · `[!]` blocked/needs decision
Layer catalog status: `✅ done/in app` · `🟢 verified available` · `⬜ to confirm/wire` · `🔒 blocked`

---

## Where we are (2026-07-12)

**Phase 0** ✅ · **Phase 1** ✅ (MODS, endowment, facilities honesty **1.1g**,
bedrock mutual exclusion **1.4**) · **Phase 2** ✅ (2.1–2.3 + **2.1c** expiry
bands + **2.4** hard exclusions) · **Pre–Phase 3 close-out** ✅ ·
**Phase 3** ✅ (3.1–3.4 incl. nearest-infra distances) ·
**Phase 4** not started · **Phase 5** lite pulled forward; full provenance /
shareable URL remain.

| Area | Status |
|---|---|
| Live MODS + critical preset (iron excluded) + surfaces (opt-in) | ✅ |
| Facilities + 8 NRCan WMS (6 prospectivity + national bedrock/surficial) | ✅ |
| Facilities midstream honesty (1.1g; off-island popup) | ✅ (2026-07-12) |
| Provincial bedrock (GeoAtlas 1:1M) + mutual exclusion vs national GSC (1.4) | ✅ |
| Provincial surficial (GeoAtlas regional /12) | ✅ |
| Magmatic Ni + CD/MVT zinc prospectivity (baked WMS; 12-mo) | ✅ |
| Endowment sidebar subgroups (Bedrock / Surficial / Prospectivity) | ✅ |
| Map-staked claims + expiry bands (2.1c) + mineral tenure | ✅ |
| Nunatsiavut + ATRIS land claims (Rights; default OFF) | ✅ |
| Protected & conserved (CPCAD) + land use + Hard exclusions (2.4) | ✅ |
| Tenure↔CPCAD de-overlap (parks only on CPCAD; tenure 69 rights polys) | ✅ |
| Status filters, search, list/detail, bottom KPI + Settings | ✅ |
| Soft-launch Phase 5 lite (About data, GeoJSON export, legend collapse) | ✅ |
| Bake registry + monthly auto-refresh → PR (§6.2) | ✅ (27 registry entries) |
| GitHub repo + Pages hosting + CI validate/Vitest | ✅ |
| Infrastructure (roads, power, communities, facilities + nearest distances) | ✅ Phase 3 (3.1–3.4) |
| Geophysics MVP slice (1VD/aeromag + gravity; survey footprints) | [ ] Phase **4.1** (**Must**) ← **next** |
| Geochemistry / ice-flow / grade filters | [ ] Phase 4.2 (post-MVP) |
| Provenance panel, shareable URL | [ ] Phase 5 remainder |
| Optional later: detailed surficial, faults/contacts, LiDAR, aerial, EO | [ ] see §5 “Optional later” |
| Optional later: historical claims, quarries, cancelled rights | [ ] Phase 2.1b |
| Nearest-infra distances (3.4) | ✅ (2026-07-12) |
| Post-MVP backlog (drillholes, live claims API, ESG habitats, …) | [ ] see **§5.2** |

**Public app:** https://kellybyron2222-dev.github.io/labrador-critical-minerals-explorer-v3/  
**Repo:** https://github.com/kellybyron2222-dev/labrador-critical-minerals-explorer-v3

### Recommended next steps (build sequence)

> **MVP gate:** ship Must items before calling the product “MVP complete.”
> Pre–Phase 3 Must/Should close-out is done. Phase **4.2** geochemistry and
> §5.2 stay post-MVP. Full triage → **§5.2**.

1. **Must — Phase 4.1** — Labrador geophysics MVP slice: regional **1VD /
   aeromag** + **gravity** (GeoAtlas), opacity + legend; add **survey /
   assessment footprints** if readily available so blank ≠ unexplored.
   (Geochemistry 4.2 stays post-MVP.)
2. **Phase 5 remainder** — full provenance panel, shareable URL, measure tools.
3. **Then Phase 4.2** — geochemistry / grade filters / ice-flow (beyond MVP).
4. **§5.2 Post-MVP backlog** — drillholes, live claims API, ESG habitats,
   viability score, spatial query engine, etc.

> ✅ Pre–Phase 3 close-out (2026-07-12): **1.1g** facilities honesty · **1.4**
> bedrock mutual exclusion · **2.1c** claim expiry bands · soft-launch Phase 5
> lite (About data, GeoJSON export, legend collapse). **2.4** hard exclusions
> already complete.

Optional follow-ups on geology / imagery: detailed surficial (MapServer/11),
1:1M faults/contacts, SE Labrador bedrock, LiDAR / aerial / EO — see
**§5 Optional later**. Data refreshes: monthly GHA `refresh-data.yml`
skips until each dataset’s `nextDue` (3 / 6 / 12 mo); or
`FORCE_REFRESH=1 npm run refresh:data` / Actions **workflow_dispatch**.

---

## Purpose & Goal

**Purpose.** Build a single, open, trustworthy map that answers the questions a
real person faces when looking at mineral exploration and infrastructure
development in Labrador — *what is in the ground, who has already found or claimed
it, what legal and land constraints apply, and what infrastructure exists to
develop it* — by integrating the many scattered public datasets into one
coherent, well-documented view.

**Goal.** Deliver an open-source, Labrador-focused geospatial database and map
application that:
1. Aggregates authoritative public data layers (geoscience, occurrences, mineral
   rights, Indigenous lands, protected areas, infrastructure, base context) into
   one place.
2. Is free, transparent about data provenance, and reuses existing government
   services rather than recreating them.
3. Is organized around the mineral value chain and encodes project/deposit
   maturity so the map tells a story, not just a pile of dots.
4. Grows iteratively and stays organized via this plan — every layer added
   follows a repeatable, documented process.

**Motivation.** Built for fun and learning, but scoped to be a genuinely useful
tool that fills a real gap: no free product offers this regionally-deep,
integrated, open view of Labrador.

---

## 1. Vision

An **open-source, Labrador-focused data hub** that brings together *every layer a
person needs to consider for mineral exploration and infrastructure development*
into one integrated map — the thing the paid global platforms (Project Blue,
Benchmark, S&P) don't offer for a single region, and that no government portal
offers in one place.

**Guiding principles**
- **Open & free** — no paywalls; consume public/open data.
- **Reuse, don't recreate** — pull from existing authoritative REST/WMS/WFS
  services rather than building/scraping our own databases.
- **Regionally deep** — Labrador-specific data at higher resolution than the
  national/global tools bother with.
- **Value-chain framing** — geological endowment → occurrences/activity →
  rights & constraints → infrastructure. Encode *maturity* where relevant.
- **Provenance-first** — every layer tagged with source, update cadence, license.
  (This is what a real open database owes its users; also prevents the earlier
  "mystery demo data" problem.)

**Scope:** Labrador (Newfoundland & Labrador). Some national feeds (NRCan) are
Canada-wide but cover Labrador; filter to Labrador where it helps focus.

---

## 2. Tech stack & architecture (current)

- **Build/dev:** Vite 5
- **Map engine:** MapLibre GL JS
- **Language:** vanilla ES modules, no framework
- **Data (production path):** baked assets under `public/data/` (GeoJSON +
  Mercator-corrected WMS PNGs) → browser IndexedDB where configured → live
  ArcGIS REST / WMS only as fallback. See §6.1 / §6.2.
- **Refresh:** `scripts/data-refresh-registry.json` + `npm run refresh:data`;
  monthly GHA `.github/workflows/refresh-data.yml` (skips until `nextDue`;
  opens PR on change — no auto-merge)

**Module layout**
```
main.js                     app entry
js/app.js                   orchestrator (wires modules, popups, legend, filters)
js/config/mapConfig.js      map init constants (center, zoom, basemaps)
js/config/layerConfig.js    layer + WMS definitions (dataUrl/imageUrl, cache, style,
                            group + optional subgroup for endowment categories)
js/config/modsFilters.js    MODS status buckets + combined filter helpers (F4/F5)
js/modules/MapBase.js       MapLibre init, controls, HUD, basemap switching
js/modules/LayerManager.js  resolveLayerData (cache→bake→live), WMS imageUrl/live
js/modules/layerCache.js    IndexedDB cache for baked GeoJSON (cacheKey/version)
js/modules/LegendPanel.js   dynamic per-layer legend cards (map overlay)
js/modules/MobileChrome.js  ≤768px: Layers drawer + collapsed Legend toggle
js/modules/OccurrenceBrowser.js  status chips + search + list/detail
js/modules/KpiBar.js            bottom multi-layer KPI HUD
js/modules/KpiEngine.js         viewport metric compute
js/modules/UserPrefs.js         localStorage preferences
js/modules/SettingsPanel.js     Settings modal (collapsible sections; KPI first)
js/config/kpiCatalog.js         KPI metric catalog + defaults
js/modules/SurfaceInterpolation.js  per-mineral occurrence-density surfaces
js/modules/wmsReprojection.js  equirectangular→Mercator (live WMS fallback)
js/modules/facilityIcons.js    value-chain SVG icons (lazy via styleimagemissing)
scripts/fetch-*.js          bake scripts (bedrock, surficial, claims, tenure,
                            nunatsiavut, atris, cpcad, landuse, mods, facilities, wms)
scripts/refresh-data.js     registry orchestrator (nextDue skip + hash cacheVersion bump)
scripts/validate-data.js    CI bake integrity (contentHash / cacheVersion / floors)
scripts/data-refresh-registry.json
scripts/lib/bakeMeta.js, png.js, esriPolygons.js
js/modules/PopupBuilder.js  safe popup HTML builders
js/modules/htmlEscape.js    shared HTML/URL escaping
js/config/mineralLands.js   Labrador clip + claims/tenure palettes (shared bake/app)
js/config/indigenousLands.js Nunatsiavut + ATRIS constants / legend helpers
js/config/protectedAreas.js CPCAD + Land_Use kinds / legend helpers (Phase 2.3)
public/data/*               baked GeoJSON + WMS PNGs + *.meta.json
css/style.css               light sidebar + map overlay + mobile drawer
.github/workflows/deploy-pages.yml   GitHub Pages CI deploy
.github/workflows/refresh-data.yml   monthly data refresh → PR
```

**Capabilities already built (the hard plumbing is done):**
- Modular map base + basemap switching (Positron / Dark / Streets)
- **Bake-first** layer loading; IndexedDB; live REST/WMS fallback; **lazy**
  vector load-on-demand for heavy polygon layers (`lazy: true`)
- WMS: prefer baked Mercator PNG (`imageUrl`); live GetMap + client reproject
  only if bake missing
- Dynamic legends (vector / icon / WMS ArcGIS JSON multi-column / image fallback)
  with click-to-enlarge; **desktop** top-left; **mobile** behind Legend button
- Data-driven collapsible sidebar layer groups (`LAYER_GROUPS` + `group` metadata)
- **Light** sidebar chrome; **mobile map-first** (`MobileChrome`: off-canvas
  Layers drawer closed by default; Legend collapsed by default)
- Occurrence browser: status chips; search; list/detail; bottom KPI is a
  separate multi-layer HUD (`KpiBar`); list collapsed by default on narrow screens
- Value-chain icon system with maturity draw-ordering (`symbol-sort-key`)
- Popups + hover interactivity
- Public host via GitHub Pages; monthly baked-data refresh workflow

---

## 3. Current state (snapshot)

**Live layers (all cold-load from bake; live API = fallback)**
- ✅ **Critical Mineral Facilities** — baked NL&L subset
  (`critical-minerals-nl.geojson`, ~13 pts) + IndexedDB; value-chain icons,
  maturity-ordered. Live 4-sublayer merge remains fallback. Default ON.
  Refresh **3 mo**.
- ✅ **Mineral Occurrences (MODS)** — baked Labrador GeoJSON
  (`mods-labrador.geojson`, ~3,175 pts) + IndexedDB; zoom-scaled circles.
  Commodity picker (critical preset default; **iron excluded**); legend
  checklist; occurrence-density surfaces **off by default** (opt-in via
  legend toggle — skips Turf on cold start). Occurrence browser ANDs status
  + search. Default ON. Refresh **3 mo**.
- ✅ **Geoscience WMS** (NRCan): six national prospectivity models (Lithium,
  Rare Earth Elements, Graphite, Magmatic nickel, CD zinc, MVT zinc) + Bedrock
  **(national)** + Surficial **(national)** — baked `wms-*-nll.png`
  (Mercator-corrected NL&L bbox). Default OFF, lazy. Refresh **12 mo**.
- ✅ **Bedrock Geology (NL 1:1M)** — baked `geoatlas-bedrock-1m.geojson`
  (~3,510 polys, ~18 MB) + IndexedDB + lazy; RGB fills; ArcGIS legend;
  unit popups. Default OFF. Refresh **6 mo**.
- ✅ **Surficial Geology (NL regional)** — baked
  `geoatlas-surficial-regional.geojson` (~15,016 polys, ~9.5 MB) + IndexedDB
  + lazy; genetic classes (`GENETIC1MA` / `GENETIC250`); RGB fills; ArcGIS
  legend; unit popups. Default OFF. Refresh **6 mo**.
- ✅ **Map-staked Claims (Labrador)** — baked
  `geoatlas-claims-labrador.geojson` (~975 polys, ~0.6 MB) + IndexedDB + lazy;
  STATUS fill colors; Rights group. Default OFF. Refresh **3 mo**.
- ✅ **Mineral Tenure (Labrador)** — baked
  `geoatlas-tenure-labrador.geojson` (~69 polys, mineral-rights types only;
  parks excluded → CPCAD) + IndexedDB + lazy; TYPEDESC fill colors; Rights
  group. Default OFF. Refresh **3 mo**.
- ✅ **Nunatsiavut (LISA)** — baked `inuit-nunatsiavut.geojson` (1 poly) +
  IndexedDB + lazy; dashed teal context outline; Rights. Default OFF.
  Refresh **12 mo**.
- ✅ **ATRIS land claims (Labrador)** — baked `atris-claims-labrador.geojson`
  (4 polys: Innu, NunatuKavut, LIA Quebec claim, Naskapi) + IndexedDB + lazy;
  dashed purple context outlines; Rights. Default OFF. Refresh **12 mo**.
  Legend: per-claim checklist (All on/off) + plain-language descriptions so
  overlapping assertions can be toggled independently.
- ✅ **Protected & conserved areas (CPCAD)** — baked
  `geoatlas-cpcad-labrador.geojson` (12 polys: Torngat, Mealy Mtns, provincial
  parks, ecological reserves, Gilbert Bay MPA) from GeoAtlas `Land_Use/4` +
  IndexedDB + lazy; TYPE_E fills; Rights. Default OFF. Refresh **12 mo**.
- ✅ **Land use constraints** — baked `geoatlas-landuse-labrador.geojson`
  (131 polys: Plan 2020, specified materials, water supplies, planning areas;
  wind reserve empty in Labrador clip) from GeoAtlas `Land_Use` 0/1/5/7/8 +
  IndexedDB + lazy; per-kind legend checklist; Rights. Default OFF.
  Refresh **12 mo**. Skipped LIL/LISA (2.2) and municipal (Phase 3).

**UX shell (2026-07-11 / 2026-07-12)**
- ✅ Light left sidebar (layers + basemap + occurrence search/status/list)
- ✅ Geological Endowment subgroups: Bedrock / Surficial / Prospectivity
- ✅ Rights & Constraints group (claims, tenure, Nunatsiavut, ATRIS, CPCAD,
  land use)
- ✅ Bottom KPI strip (viewport-aware; multi-layer; Settings-customizable)
- ✅ Settings shell (map gear + sidebar): collapsible **KPI bar** subcategory
  (default minimized); KPI-bar gear deep-links with section expanded;
  localStorage prefs; ready for more Settings sections later
- ✅ Legend cards on the map (top-left desktop; collapsible on phone)
- ✅ Mobile: **Layers** drawer + **Legend** toggle (map fills viewport)
- ✅ Deployed to GitHub Pages
- ✅ Data refresh: registry (18 entries) + monthly GHA → PR (operator: §6.2)

**Removed (2026-07-06) — were hand-authored demo/synthetic data:**
- ❌ Mineral Deposits (demo) → replaced by MODS (✅ 2026-07-06, see Phase 1.1)
- ❌ Infrastructure (demo) → replace with NRCan/GeoAtlas transport & power
- ❌ Mining Tenures (demo) → replaced by GeoAtlas Mineral Lands (✅ 2026-07-12, Phase 2.1)
- See `TODO (real data)` note in `js/config/layerConfig.js`.

**Out of scope (by design):** featured-deposits demo JSON, commodity-group
taxonomy overlays, iron in the critical preset, static occurrences.geojson,
heavy dual-rail “mission control” chrome.

---

## 4. Data-source catalog

Organized by the question each layer answers. **Verified** = REST directory / service
confirmed reachable and queryable (GeoJSON or WMS). Endpoints are base URLs;
append `/query?where=1=1&outFields=*&f=geojson` (REST) or WMS params as needed.

### KEY DISCOVERY — NL Geoscience Atlas public REST directory
`https://dnrmaps.gov.nl.ca/arcgis/rest/services/GeoAtlas`
Same consumption pattern as our existing NRCan layers. Services include:
`Bedrock_Geology_All`, `Surficial_Geology_All`, `Geochemistry_All`,
`Geophysics_Labrador`, `Geophysics_Newfoundland`, `Map_Layers` (Mineral
Occurrences/MODS), `Mineral_Lands` (claims/tenure/quarries), `Land_Use`,
`Indexes` (NTS/UTM grids), `Topographic`, `TopographyGreyBase_DEM`.

### 1. What's in the ground? — geological endowment
| Layer | Source | Endpoint / service | Status |
|---|---|---|---|
| Bedrock geology (provincial, 1:1M) | NL GeoAtlas | `GeoAtlas/Bedrock_Geology_All/MapServer/23` → baked `public/data/geoatlas-bedrock-1m.geojson` | ✅ in app (lazy; IndexedDB; refresh every 6 mo) |
| Surficial geology (provincial, regional) | NL GeoAtlas | `GeoAtlas/Surficial_Geology_All/MapServer/12` → baked `public/data/geoatlas-surficial-regional.geojson` | ✅ in app (lazy; IndexedDB; refresh every 6 mo) |
| Surficial geology (provincial, detailed) | NL GeoAtlas | `GeoAtlas/Surficial_Geology_All/MapServer/11` (~97k polys; incomplete N Labrador) | ⬜ optional later |
| Li / REE / graphite / magmatic Ni / CD+MVT zinc prospectivity | NRCan WMS | baked `public/data/wms-{lithium,ree,graphite,nickel,zincCd,zincMvt}-nll.png` | ✅ in app (12-mo refresh) |
| Bedrock / surficial (national WMS) | NRCan WMS | baked `public/data/wms-{bedrock,surficial}-nll.png` | ✅ in app (context; 12-mo refresh) |

### 2. Has anyone found something here? — occurrences & activity
| Layer | Source | Endpoint / service | Status |
|---|---|---|---|
| **Mineral Occurrences (MODS)** — ~3,175 pts (Labrador) | NL GeoAtlas | baked `public/data/mods-labrador.geojson` | ✅ in app (IndexedDB; refresh every 3 mo) |
| Critical mineral facilities | NRCan | baked `public/data/critical-minerals-nl.geojson` (NL&L subset) | ✅ in app (IndexedDB; refresh every 3 mo) |
| Producing mines / metallurgical works | NRCan Map 900A | `NRCan/900A_and_top_100_en/MapServer` | 🟢 verified |
| Drill core / assessment reports (GEOFILE) | NL GeoAtlas | `GeoAtlas/Map_Layers` (GEOFILE links) | ⬜ to confirm |

### 3. What do the subsurface signals say? — geophysics & geochemistry
| Layer | Source | Endpoint / service | Status |
|---|---|---|---|
| Labrador geophysics (aeromag / radiometric / gravity) | NL GeoAtlas | `GeoAtlas/Geophysics_Labrador` | 🟢 verified |
| Lake-sediment & till geochemistry | NL GeoAtlas | `GeoAtlas/Geochemistry_All` | 🟢 verified |
| Ore geochemistry (CMiO) | CMMI (USGS/GSC/GA) | `services.ga.gov.au/gis/critical-minerals/wfs` (+ `/wms`) | 🟢 verified |

### 4. Can I legally work here? — mineral rights
| Layer | Source | Endpoint / service | Status |
|---|---|---|---|
| Map-staked claims (Labrador) | NL GeoAtlas | `Mineral_Lands/MapServer/0` → baked `geoatlas-claims-labrador.geojson` | ✅ in app (lazy; IndexedDB; refresh every 3 mo) |
| Mineral tenure (Labrador) | NL GeoAtlas | `Mineral_Lands/MapServer/5` → baked `geoatlas-tenure-labrador.geojson` (69 mineral-rights polys; parks excluded → CPCAD) | ✅ in app (lazy; IndexedDB; refresh every 3 mo) |
| Historical claims / cancelled / notices / quarries | NL GeoAtlas | `GeoAtlas/Mineral_Lands` (layers 2–4, 6–11) | ⬜ optional later (2.1b) |

### 5. Who else has rights / what's constrained? — permitting reality
| Layer | Source | Endpoint / service | Status |
|---|---|---|---|
| Nunatsiavut (Labrador Inuit Settlement Area) | SAC-ISC Inuit Regions | `Donnees_Ouvertes-Open_Data/Region_inuite_Inuit_Region/MapServer/0` → baked `inuit-nunatsiavut.geojson` | ✅ in app (lazy; default OFF; 12-mo) |
| ATRIS comprehensive land claims (Labrador subset) | ATRIS | `ATRIS_E_PC/MapServer/2` → baked `atris-claims-labrador.geojson` | ✅ in app (lazy; default OFF; 12-mo) |
| Labrador Inuit / Innu settlement area shapefiles + park boundaries | labradorgeolab.ca | dataset ZIPs (Torngat, Mealy Mtns) | 🟢 verified (download; parks covered via CPCAD bake — ZIPs unused) |
| Land use / Crown land zoning | NL GeoAtlas | `GeoAtlas/Land_Use` → baked `geoatlas-landuse-labrador.geojson` (layers 0/1/5/7/8) | ✅ in app (lazy; default OFF; 12-mo) |
| Protected & conserved areas (national) | CPCAD via GeoAtlas | `Land_Use/MapServer/4` → baked `geoatlas-cpcad-labrador.geojson` | ✅ in app (lazy; default OFF; 12-mo) |
| Caribou habitat / wildlife (permitting driver) | NL / ECCC | TBD | ⬜ later |

### 6. Can I physically develop it? — infrastructure
| Layer | Source | Endpoint / service | Status |
|---|---|---|---|
| Roads (Trans-Labrador, forest access) | NL GeoAtlas NRN + resource roads | `Map_Layers/12` + `/14` → baked | ✅ in app (lazy; 6 mo) |
| Transmission lines (Churchill Falls, Muskrat Falls) | Nalcor + CanVec via GeoAtlas | `Map_Layers/15` + `/16` → baked | ✅ in app (lazy; 6 mo) |
| Railways (iron-ore lines) | GeoAtlas NRN Railroad class | `Map_Layers/12` ROADCLASS=Railroad → baked | ✅ in app (lazy; 6 mo) |
| Ports / airstrips / generation / communities | Curated Labrador points | `infra-*-labrador.geojson` | ✅ in app (lazy; 12 mo) |
| Municipal boundaries | NL GeoAtlas | `Land_Use/6` → baked | ✅ in app (lazy; 12 mo) |

### 7. Base context
| Layer | Source | Endpoint / service | Status |
|---|---|---|---|
| DEM / hillshade | NL GeoAtlas | `GeoAtlas/TopographyGreyBase_DEM` | 🟢 verified |
| Hydrography (rivers/lakes) | National Hydro Network | NRCan open data | ⬜ to wire |
| NTS map-sheet & UTM grid | NL GeoAtlas | `GeoAtlas/Indexes` | 🟢 verified |

---

## 5. Granular build checklist

> Work top to bottom. Each layer follows the **Add-a-Layer Playbook** (Section 6).
> Keep this section honest — it is the single source of truth for "what's next."

### Phase 0 — Foundation & scaffolding  ✅ COMPLETE
- [x] Vite + MapLibre GL project scaffold
- [x] Resolve dev-environment issues (Node/npm, SSL `--use-system-ca`, dev scripts)
- [x] Modular architecture: `MapBase`, `LayerManager`, `LegendPanel`, config split
- [x] Basemap switching (Positron / Dark / Streets)
- [x] Async GeoJSON loader (`fetchGeoJSON`)
- [x] Merged multi-endpoint GeoJSON fetch (`fetchMergedGeoJSON`)
- [x] WMS image-source support with client-side Mercator reprojection
- [x] WMS lazy-load + reprojected-image caching + loading indicator
- [x] Dynamic legend panel (vector swatch / line / fill / icon / WMS image)
- [x] Value-chain SVG icon system (lazy via `styleimagemissing`, basemap-switch safe)
- [x] Maturity encoding on facilities (`symbol-sort-key`)
- [x] Critical Mineral Facilities layer (NRCan) — now baked NL&L GeoJSON + IndexedDB
      (`fetch:facilities`); live 4-sublayer merge = fallback
- [x] 5 NRCan geoscience WMS layers (Li / REE / graphite / bedrock / surficial) —
      baked Mercator PNGs (`fetch:wms`); live GetMap = fallback
      *(extended 2026-07-12 with magmatic Ni + CD/MVT zinc → 8 WMS bakes)*
- [x] Popup + hover interactivity framework
- [x] Remove demo data (deposits / infrastructure / tenures) + document TODO
- [x] Reframe sidebar around the mineral value chain
- [x] Author this master build plan
- [x] Bake-first data pipeline + monthly refresh registry/GHA (2026-07-11)
- [x] Mobile map-first chrome — `MobileChrome.js` Layers drawer + Legend toggle
      (2026-07-11)

### Phase 1 — Endowment & occurrences  ✅ COMPLETE
**1.0 — Layer-grouping refactor (do first; unblocks a growing sidebar)** ✅ COMPLETE
- [x] Add `group` metadata to each `LAYER_CONFIG` / `WMS_CONFIG` entry
      (groups: Endowment, Occurrences, Rights, Infrastructure, Signals, Base)
- [x] Refactor sidebar in `index.html` into collapsible group sections
- [x] Update `app.js` to render/bind toggles per group (data-driven, not hardcoded)
- [x] Add collapsible-section CSS (expand/collapse, counts)
- [x] Regression test: existing facilities + WMS layers still toggle & legend correctly

**1.1 — MODS mineral occurrences (highest-value first layer)** ✅ COMPLETE (2026-07-06)
- [x] Open `GeoAtlas/Map_Layers/MapServer` — identify the Mineral Occurrences sublayer ID
      → sublayer **3**, "Mineral Occurrences (MODS)"
- [x] Confirm `supportedQueryFormats` includes geoJSON; list fields; geometry type; `maxRecordCount`
      → geoJSON supported (note: `f=geojson` was blocked when probed via the
      agent's fetch tool, which turned out to be a tool-side WAF/UA quirk —
      confirmed working fine via `curl` and will work fine from the browser);
      point geometry; `maxRecordCount=1000`; key fields `NMINO, DEPNAME,
      COMNAME, COMMODS, STATUS, DEPDESC, OREMIN, GANGUE, WORKING, DDH,
      TRENCH, ADIT, NTS`. **Quirk:** `COMNAME` is actually the *primary
      commodity* (e.g. "Gold"), not a place name — `DEPNAME` is the
      human-readable deposit/occurrence name.
- [x] Get total feature count (`returnCountOnly=true`); decide if pagination (`resultOffset`/`resultRecordCount`) loop is needed
      → 7,740 province-wide; **3,173** with `REGION='Labrador'`; pagination required (4 pages of 1000)
- [x] Confirm CRS; request `outSR=4326` (or geojson default) to avoid reprojection
      → default `f=geojson` output is already WGS84 lon/lat; no `outSR` override needed
- [x] Add `layerConfig` entry (query URL, `outFields`, source/layer ids, group=Occurrences)
- [x] Extend `LayerManager` if pagination needed (fetch-all helper)
      → `fetchPaginatedGeoJSON()`, loops until a short page is returned; validated live (4 pages, 3,173 features, 0 missing geometry)
- [x] Style: color by primary commodity (`COMNAME`); graduated radius by status (Producer > Past Producer > Developed Prospect > Prospect > Showing > Indication)
- [x] Performance: ~~MapLibre clustering~~ ~~heatmap → circle crossfade~~
      **revised again 2026-07-06 (Phase 1.1b)** — numbered cluster bubbles hid
      data at regional zoom; the heatmap fix that followed solved that but the
      user ultimately wanted circles-only at every zoom (no density blending),
      so the heatmap was dropped entirely too. Circles now render at all zoom
      levels via a single zoom-scaled radius expression (small-but-visible at
      the ~300km regional view, full size once zoomed into a district) — see
      Phase 1.1b below for the commodity-picker + filtering work done at the
      same time.
- [x] Popup: name (DEPNAME/COMNAME fallback), commodity, status, deposit type, ore minerals, work history, NTS sheet, MODS record link
      (note: no tonnage/grade field in this REST layer — link-out covers that gap)
- [x] Legend entry (curated 14-commodity color list; click-to-enlarge for the full set)
- [x] Sidebar toggle + wiring + hover cursor (data-driven, no `index.html` changes needed — Phase 1.0 groups handle it)
- [x] Test: dev server loads modules cleanly (200 on all changed files); pagination logic validated against the live endpoint outside the app; basemap-switch source teardown bug found + fixed (`ensureSource()` now called from `refreshLayers()`, benefits all vector layers, not just MODS)
- [x] Update catalog status → ✅ ; check this block off

**1.1b — Commodity-scoped MODS visualization** ✅ COMPLETE (2026-07-06)

Follow-up to the 1.1 visualization revisions above: instead of a single
generic "all commodities at once" view, add a sidebar dropdown that scopes
the MODS layer to one commodity (or a curated preset) at a time, so a
geologist can ask "where's the nickel" and get an uncluttered answer rather
than reading tea leaves out of ~30 overlapping colors.

- [x] Quantify commodity frequency for the full Labrador MODS dataset (all
      3,173 features, not the earlier 1000-record sample) — queried both
      `COMNAME` (primary, via `outStatistics`/`groupByFieldsForStatistics`)
      and `COMMODS` (secondary, free-text comma list) directly against the
      live service. Findings: Copper/Iron/Pyrite/Nickel/Uranium dominate as
      primary commodities, but several critical minerals (Cobalt, Manganese,
      Zinc, Platinum, Palladium, Chromium...) show up mostly or entirely as
      *secondary* commodities (e.g. Cobalt: 3 primary vs. 172 secondary
      mentions) — a primary-only filter would have badly undercounted them.
      Also found source-data quirks (case inconsistency like "cobalt" vs.
      "Cobalt", a stray "Platinum(?)") that needed normalizing.
- [x] Decisions (user-selected): single commodity picker (not per-commodity
      sidebar toggles); defaults to a critical-minerals preset; includes
      secondary commodities in filtering; heatmap dropped entirely (not just
      for an "all commodities" mode) in favor of always-circles, zoom-scaled.
- [x] `commodityList` derived per-feature in `LayerManager.loadLayer`
      (normalized, deduped array combining `COMNAME` + split `COMMODS`) —
      confirmed (via a standalone `geojson-vt` test) that array-valued
      properties survive MapLibre's internal GeoJSON tiling intact, so filter
      expressions can do `['in', 'Nickel', ['get', 'commodityList']]` against
      it directly rather than a fragile substring match on raw `COMMODS` text.
- [x] `MODS_CRITICAL_MINERALS_PRESET` in `layerConfig.js`: cross-referenced
      Canada's official 34-mineral Critical Minerals List (updated June 2024,
      canada.ca) against what actually appears in Labrador MODS records.
      Deliberately excludes "Iron", "Phosphorus", "Silicon metal" — each is
      only officially critical in a specific high-purity/refined form that
      MODS occurrence records don't verify (e.g. the list item is
      specifically "high-purity iron ore", not iron ore generally); these
      remain individually selectable under "Other notable commodities."
- [x] Sidebar commodity picker: a grouped `<select>` (Presets / Critical
      minerals / Other notable commodities) rendered under the MODS layer row
      (`app.js` `buildCommodityPicker`, generic — driven by a
      `commodityPicker` config block, so any future layer can reuse it).
- [x] Picker wired to `LayerManager.setLayerFilter()` (MapLibre `setFilter`)
      + `setPaintProperty()` (recolors to a flat commodity color when a single
      commodity is picked, vs. the multi-color primary-commodity match used
      for "All" / the critical-minerals preset) — both remembered on the
      layer's state and reapplied in `refreshLayers()` so a basemap switch
      doesn't silently reset the selection back to unfiltered/default-colored.
- [x] Legend rebuilds per selection (`buildMODSLegendItems` +
      `modsCommodityPickerLabel`) — title and swatches reflect whatever the
      picker currently shows, not a static full list.
- [x] Popup now lists the full `commodityList` (not just primary `COMNAME`)
      when an occurrence has more than one commodity, so it's clear why e.g.
      a Copper-primary occurrence matched a "Nickel" filter.
      *(Refined 2026-07-11 in Phase 1.1d: popup split into "Primary commodity"
      and "Also reported" rows.)*
- [x] Test: dev server serves all changed modules with 200; `node --check`
      syntax-validated the edited JS; no linter errors. **Caught a real bug
      this way that those checks alone missed:** a first-pass headless-browser
      smoke test (Playwright) found the MODS layer wasn't actually rendering
      at all in a real browser. Root cause was a MapLibre style-validation
      rule the earlier static checks (incl. an offline `createExpression`
      check against `@maplibre/maplibre-gl-style-spec`) didn't catch: a
      `["zoom"]` expression may only appear as the direct input to a
      top-level `interpolate`/`step`, not nested inside another expression
      (the original `circle-radius` was `['*', interpolate(zoom), match
      (status)]`) - `map.addLayer()` fails this validation silently (fires an
      error event, doesn't throw/abort init), so `mods-layer` just never got
      added and nothing else looked wrong. Fixed by moving the status
      `match` *inside* each zoom stop's output value instead
      (`buildMODSRadiusExpression()` in `layerConfig.js`) - interpolates the
      already-status-scaled radius across zoom, same visual result, passes
      validation. (Also hit and worked around an unrelated red herring while
      debugging: the GeoAtlas server's WAF returns HTTP 500 for any
      `User-Agent` containing the literal word "Headless" - confirmed via
      curl - which broke the *headless* Playwright run's data fetch until
      the test browser's UA was overridden to a normal Chrome string; real
      end-user browsers are unaffected by this.)

**1.1c — Occurrence-density interpolated surfaces** ✅ COMPLETE (2026-07-06)
      *(Refined in Phase 1.1d, 2026-07-11 — per-mineral, localized, primary-only.)*

Follow-up to 1.1b: the user asked to "draw outlines of regions of occurrences
to turn the dots into surfaces interpolated," explicitly using MODS'
qualitative occurrence data for now (see the quantitative-data note added to
Phase 4.2 below for the future concentration-based complement to this).

- [x] Evaluated available Labrador datasets for what they actually measure —
      confirmed MODS (`Map_Layers/MapServer/3`) is occurrence *presence* only
      (no assay/grade/tonnage field), while `GeoAtlas/Geochemistry_All`
      (lake-sediment/till samples) carries real ppm concentration values.
      Decision: interpolate what MODS actually has — occurrence density,
      optionally weighted by economic-maturity `STATUS` — rather than
      implying a false concentration/grade surface. This distinction is
      called out directly in the surface's legend note and in code comments
      (`SurfaceInterpolation.js`).
- [x] Chose an open-source, client-side approach: Turf.js (`@turf/turf`)
      `interpolate` (IDW, power=2) over an adaptive point grid (~40 cells
      along the longer bbox axis, clamped 6–35km), then `isobands` sliced at
      quantile breaks into 5 tiers. Rejected server-side/offline raster
      precomputation (GDAL/WhiteboxTools) for this pass — dataset is small
      enough (≤3,173 pts, recomputed per commodity-filtered subset) to stay
      interactive client-side with no build step.
- [x] New `js/modules/SurfaceInterpolation.js` — `computeOccurrenceSurface()`
      takes already commodity-filtered features, returns isoband polygons
      tagged with a `tier` (0 = lowest/background, hidden by design so what
      renders reads as contoured "blobs" hugging real clusters, not a giant
      low-opacity rectangle over the whole padded bbox).
- [x] `layerConfig.js`: new `surface` config block on `modsOccurrences`
      (source/layer ids, tier count, per-tier fill/line opacity ramps,
      `minTierToRender`), `resolveMODSSurfaceColor()` (single commodity's own
      color; neutral orange for "All"/critical-minerals preset), and
      `resolveMODSCommodities()`/`featureMatchesMODSCommodity()` — a plain-JS
      mirror of the MapLibre commodity filter so the surface (computed in JS,
      not through a MapLibre expression) always matches what the circles show.
- [x] `LayerManager.updateOccurrenceSurface()`/`setSurfaceVisibility()` — adds
      fill+line layers below the circle layer; opacity is a top-level
      `interpolate` on zoom (4→9) whose output is a `match` on `tier`, fading
      the surface out exactly as the circle layer (`buildMODSRadiusExpression`)
      reaches full size, so the handoff from "regional trend" to "precise
      points" is a genuine crossfade, not an abrupt cut. Surface state
      persisted and restored in `refreshLayers()` for basemap-switch survival,
      same pattern as the main point layer.
- [x] `app.js`: recomputes the surface (`updateMODSSurface`) every time the
      commodity picker changes, alongside the existing filter/color/legend
      updates; added a "Show occurrence density surface" checkbox inside the
      MODS legend card (`LegendPanel` gained generic `surfaceToggle` +
      `note` support) as an independent sub-toggle.
- [x] Test: headless-browser (Playwright) verification at regional (300km),
      mid, and district zoom; commodity-picker recoloring; surface toggle;
      and basemap-switch persistence. **Found and fixed a real, pre-existing
      bug this way** — see changelog entry below (`MapBase.switchBasemap`
      relied on an `style.load` event that MapLibre doesn't always fire).

**1.1d — Per-mineral localized surfaces & primary-commodity discipline** ✅ COMPLETE (2026-07-11)

Follow-up to 1.1c: user feedback that (a) toggling one mineral (e.g. Copper)
showed wrong-colored dots and surfaces bleeding into other-mineral districts,
(b) one regional surface per picker selection was misleading, and (c) hard
isoband edges + duplicate legend lists were confusing. Quantified the
underlying data issue: ~33% of Labrador MODS records have a secondary
`COMMODS` mineral distinct from primary `COMNAME` — one dot, one coordinate,
but multiple commodities in metadata.

**Design decision (mapping best practice):**
- **Dot color** = primary commodity (`primaryCommodity`, normalized from `COMNAME`)
- **Legend checklist + density surfaces** = primary commodity only (strict 1:1
  mineral → colored dots → surface geometry)
- **Sidebar single-mineral picker** = `commodityList` match (primary +
  secondary) for broader "find any mention" research; flat commodity color
- **Popup** = "Primary commodity" + "Also reported" (secondaries), not a single
  blended commodity string

- [x] `LayerManager.loadLayer` — per feature: `primaryCommodity`,
      `secondaryCommodities`, existing `commodityList` (unchanged for sidebar
      search)
- [x] `layerConfig.js` — `featureBelongsToCommodity()`,
      `buildMODSEnabledCommodityFilter(picker, enabled, { primaryOnly })`,
      `buildMODSSurfaceColorExpression()` (data-driven `match` on surface
      `commodity` tag), `resolveMODSLegendCommodities()`,
      `MODS_SURFACE_DEFAULT_COUNT` (3); removed flat `resolveMODSSurfaceColor()`
- [x] Refactored `SurfaceInterpolation.js`:
      - DBSCAN local clustering per mineral (`CLUSTER_MAX_DISTANCE_KM` ~30)
      - Non-normalized inverse-distance density grid per cluster (peaks at
        points, `MAX_INFLUENCE_KM` cutoff) — replaces flat normalized IDW
      - Tighter per-cluster bbox (`BBOX_PADDING_KM` 12, was 40 regionally)
      - `turf.polygonSmooth` on isoband rings + softer opacity/outline tiers
      - `computeCommoditySurface()` / `computeOccurrenceSurfaces()` orchestrator;
        `groupFeaturesByCommodity()` buckets by **primary only**
- [x] Unified MODS legend UI (replaces duplicate color list + surface list):
      - One checklist with color swatches per mineral in multi-commodity views
      - **All on** / **All off** bulk actions
      - Master **Show occurrence density surfaces** toggle (shading only)
      - Checking a mineral toggles **both** its circles and its surface eligibility
- [x] `app.js` — `enabledCommodities` state, lazy per-mineral surface cache,
      `applyMODSCommodityVisibility()`, picker reset defaults to first 3 minerals
- [x] `LayerManager.updateOccurrenceSurface()` — commodity-colored fill/line
      via expression + filter on enabled commodity list
- [x] `LegendPanel` + `css/style.css` — `commodityToggles` block styling

**1.1e — Occurrence browser UX** ✅ COMPLETE (2026-07-11)

Status filters, search, occurrence list/detail, and KPI strip on the MapLibre
live-data hub — without demo featured deposits or static enrichment GeoJSON.

- [x] Status model (`js/config/modsFilters.js`) — normalize live MODS `STATUS`
      into filter buckets (Producer, Past Producer, Developed Prospect,
      Prospect, Showing, Indication); Past Producer variants collapsed
- [x] Status multi-select chips ANDed with existing commodity picker / legend
      checklist; persist with `setLayerFilter` across basemap refresh
- [x] Free-text search over name, commodities, status, NMINO, type, NTS
      (client-side; MapLibre via NMINO allowlist)
- [x] Sidebar occurrence list (cap 300) + detail card (live MODS fields +
      MODS record link); click syncs map flyTo + popup; map click selects list
- [x] Minimizable list body (search + status chips stay visible)
- [x] Bottom KPI strip: viewport-aware multi-layer HUD (Settings-customizable;
      defaults: MODS in view + status bits + claims + tenure)
- [x] **Settings shell** (`SettingsPanel` + `UserPrefs`) — expandable
      subcategories; **KPI bar** section default **collapsed**; map/sidebar
      Settings opens shell minimized; KPI-bar gear opens Settings → KPI
      **expanded**; gear icons; prefs persist in `localStorage`
- [x] Light sidebar restyle to match clean white panel chrome; legends moved
      top-left; KPI bottom-center
- [x] GitHub repo + Pages deploy workflow (`deploy-pages.yml`)
- [x] Explicitly **not** shipped: featured deposits, NMINO commodity rebuild,
      group toggles, iron-in-critical, dual filter modes, mission-control rails

**1.2 — Provincial bedrock geology (GeoAtlas)** ✅ COMPLETE (2026-07-11)
- [x] Inspect `GeoAtlas/Bedrock_Geology_All` — sublayers; queryable-vector vs raster-only
      → Layer **23** "1:1 Million Bedrock Geology" chosen (full NL/Labrador,
      3,510 polygons, 153 classes, fields LABEL/LITHOLOGY/AGE/TECTONIC/
      REFERENCE + RGB). Layer 16 is SE-Labrador-only (deferred). Query +
      geoJSON supported; `maxRecordCount=1000` → paginate.
- [x] Decide render path: **vector fill** (lazy) — enables attribute popups;
      national NRCan bedrock WMS kept as context (relabeled)
- [x] Add config (`geoatlasBedrock` in `LAYER_CONFIG`: lazy, fill from RGB,
      opacity 0.5, group=Endowment, beforeLayerIds under MODS)
- [x] Legend via GeoAtlas ArcGIS legend JSON (layer 23) + enlarge panel
- [x] Toggle + lazy `loadLayerOnDemand` + popup (label/lithology/age/tectonic/reference)
- [x] Test path: syntax-check; live GeoJSON sample; basemap refresh restores
      loaded vectors via existing `refreshLayers`
- [x] Update catalog status → ✅ ; national WMS labeled "Bedrock Geology (national)"
- [x] Performance / load path (order: IndexedDB → baked file → live GeoAtlas):
      - Baked `public/data/geoatlas-bedrock-1m.geojson` (~18 MB, simplified
        `maxAllowableOffset=0.002`); meta in `geoatlas-bedrock-1m.meta.json`
      - Browser IndexedDB via `js/modules/layerCache.js` (`cacheKey` /
        `cacheVersion` on `LAYER_CONFIG.geoatlasBedrock`)
      - Live fallback: Esri JSON + `outSR=4326` (GeoAtlas `f=geojson&outSR`
        returns empty); parallel pages (`concurrency: 4`)
      - Manual bake: `npm run fetch:bedrock`
- [x] Auto-refresh (registry-driven; bedrock cadence **6 months**):
      - Registry: `scripts/data-refresh-registry.json` (bedrock + MODS +
        facilities + 5 WMS bakes)
      - Orchestrator: `npm run refresh:data` (skips until `nextDue`; hash
        compare; bumps `cacheVersion` when changed; writes
        `scripts/.refresh-result.json`)
      - GHA: `.github/workflows/refresh-data.yml` — cron `0 12 1 * *`
        (monthly) + `workflow_dispatch` (optional force); **opens a PR** on
        change (no auto-merge to `master`)
      - Meta fields: `cadenceMonths`, `nextDue`, `contentHash`

**1.3 — Provincial surficial geology (GeoAtlas)** ✅ COMPLETE (2026-07-12)
- [x] Inspect `GeoAtlas/Surficial_Geology_All` — chose layer **12**
      "Regional Surficial Geology" (full NL&L ~15,016 polys; genetic
      classes; SOURCE = GSNL + GSC). Layer **11** Detailed deferred
      (partial N Labrador coverage to ~56.7°N; ~97k polys) — see Optional later.
- [x] Render path: **vector fill** (lazy) — attribute popups; national NRCan
      surficial WMS kept as context (relabeled **Surficial Geology (national)**)
- [x] Config (`geoatlasSurficial`): lazy, RGB fills, Endowment group, draw
      above bedrock / under MODS
- [x] Legend via GeoAtlas ArcGIS legend JSON (layer 12) + enlarge panel
- [x] Toggle + lazy load + popup (GENETIC1MA / GENETIC250 / SOURCE / REFERENCE)
- [x] Bake + IndexedDB: `public/data/geoatlas-surficial-regional.geojson`
      (~9.5 MB); `npm run fetch:surficial`; live Esri JSON fallback
- [x] Registry entry cadence **6 mo**; monthly GHA already covers via `nextDue`
- [x] Catalog + checklist updated; Phase 1 exit criteria met

**1.3b — Remaining NRCan prospectivity + endowment subgroups** ✅ COMPLETE (2026-07-12)
- [x] Magmatic nickel, CD zinc, MVT zinc — baked WMS PNGs + registry (12-mo)
- [x] REE sidebar/legend renamed to **Rare Earth Elements**
- [x] Endowment sidebar subgroups: Bedrock / Surficial / Prospectivity
- [x] `fetch:wms` optional layer-key args for subset bakes

**Phase 1 exit criteria:** MODS + provincial bedrock/surficial live; sidebar grouped;
demo-deposit gap fully replaced by real endowment + occurrence data. ✅
*(Also: full published NRCan national prospectivity set of 6 models.)*

**1.1g — Facilities value-chain honesty** ✅ COMPLETE (2026-07-12) · **Must (MVP)**
> External review (2026-07-12): legend said “Producing — processing/refinery,”
> but Labrador has no active critical-mineral refinery (e.g. Voisey's Bay
> concentrate ships to Long Harbour, NL).

- [x] Audit: NL&L bake processing site is off-island (Long Harbour); Labrador
      mines remain primary producers
- [x] Relabel legend to **Producing — processing / midstream**; `legendNote`
      explains island midstream vs Labrador primary production
- [x] Popup: location note **Off-island (Newfoundland)** when lat &lt; 51.5°N
- [x] Icons unchanged; KPI facility counts unchanged

**1.4 — Geology scale-clash policy** ✅ COMPLETE (2026-07-12) · **Should**
> Provincial 1:1M bedrock and national GSC bedrock can disagree on boundaries
> and unit names when both are on. Full zoom-dependent cross-fade is post-MVP
> (§5.2).

- [x] Mutual exclusion: enabling provincial bedrock turns off national WMS
      (and reverse) via `enforceBedrockMutualExclusion` in `app.js`
- [x] Endowment group hint + status line explain one-at-a-time policy
- [x] Do **not** block on auto scale-dependent cross-fade

### Optional later — higher-res geology & remote sensing  [ ]

> Not required for Phase 1 exit. Revisit after Phase 2–3 core layers if the
> product needs district-scale overburden detail or imagery basemaps.

**Detailed / ancillary GeoAtlas surficial**
- [ ] **Detailed Surficial Geology** (`Surficial_Geology_All/MapServer/11`) —
      ~97k NTS polygons, finer LEGEND/DESCRIPTN/Geofile; **incomplete northern
      Labrador** (extent ~to 56.7°N). Candidate zoom-in layer where sheets exist;
      heavy bake — consider Labrador-clipped subset or tile strategy.
- [ ] Aggregate Potential / Samples / Eskers (MapServer/8–10) — infrastructure /
      borrow-source context
- [ ] Striations, landforms, Carbon-14 age dates (MapServer/0–6) — glacial history
- [ ] SE Labrador bedrock detail (`Bedrock_Geology_All/MapServer/16`); 1:1M
      faults/contacts (MapServer/1)

**LiDAR**
- [ ] Provincial / NRCan bare-earth DEM or hillshade from LiDAR where available
      for Labrador (camp/road siting, glacial landforms, drainage)
- [ ] Canopy / first-return derivatives only if they add exploration or access value
- [ ] Prefer static tiles or Contour/DEM already in GeoAtlas
      (`TopographyGreyBase_DEM`) before wiring raw point clouds

**Aerial flyover / orthophoto**
- [ ] High-res aerial orthomosaics (provincial or federal flight programs) as an
      optional imagery basemap or opacity overlay — useful for camp/access context
- [ ] Confirm license, coverage gaps over Labrador, and whether XYZ/WMTS exists
      (avoid shipping giant GeoTIFFs in-repo)

**Earth observation (satellite)**
- [ ] Optical: Sentinel-2 / Landsat true-color or false-color composites
      (seasonal snow-off windows) as basemap alternatives or swipe overlays
- [ ] Optional derived products later: snow cover, vegetation disturbance,
      iron-oxide / clay indices — only with clear provenance labels
- [ ] SAR (e.g. Sentinel-1) for all-weather structure/lineament context — Phase 4+
      research track, not a default endowment layer

### Phase 2 — Rights & constraints (turns viewer into a siting tool)  ✅ COMPLETE
**2.1 — Mineral claims & tenure** ✅ COMPLETE (2026-07-12)
- [x] Inventory `GeoAtlas/Mineral_Lands` sublayers
      → 12 layers. MVP: **0** Map Staked Claims (province ~4,617; Labrador
      clip **975**) + **5** Mineral Tenure (province ~388; Labrador clip
      originally **177**, then **69** after excluding parks → CPCAD).
      Deferred: Historical Claims (2, ~42k), Cancelled (3), Original
      Boundaries (1 polyline), Quarries (6–11 points). Notices Gazetted (4)
      empty (0). Labrador clip bbox
      `[-67.8, 51.5]–[-55.5, 60.6]` (south of Strait of Belle Isle — not the
      island-inclusive `NL_LABRADOR_BOUNDS`). `outSR=4326` + `f=json` works
      (Esri rings → GeoJSON). Claims STATUS (Labrador): Issued 956, Recorded
      15, other rare. Tenure TYPEDESC includes Mining Lease, Exempt Mineral
      Land, parks/reserves, Federal Land, LIL, etc. `FILENUM` = registry file
      # — no public deep-link found; popup shows value + GeoFiles search link.
- [x] Active claims (polygons) — style by STATUS; group=Rights
      (`geoatlasClaims`); bake `fetch:claims`; cadence **3 mo**
- [x] Mineral tenure — style by TYPEDESC; group=Rights (`geoatlasTenure`);
      bake `fetch:tenure`; cadence **3 mo**. Parks / protected TYPEDESC
      values excluded (live on CPCAD) so Torngat/Mealy/etc. are not duplicated
      (bake **69** mineral-rights polys after filter).
- [x] Popup: licence #, holder, issue/expiry, status, FILENUM + GeoFiles link
- [ ] Optional later (2.1b): historical claims + cancelled + quarries
- [x] **2.1c — Claim expiry / “vulnerable to lapsing” signals** ✅ (2026-07-12)
      Fill by expiry band (≤90 / ≤180 days; longer-dated keep STATUS colors);
      legend checklist filters bands; popup still shows raw EXPIRYDATE + STATUS.
      Bake cadence stays 3 mo (not live API).
- [x] Legend + wiring + test + status
      Shared palette/constants: `js/config/mineralLands.js`. LayerManager
      gains geometry envelope on `paginatedQuery` + `claimsStatus` /
      `tenureType` enrichment for live fallback.
- [x] **Load / cache / refresh (playbook §6 steps 8–9)** — verified 2026-07-12:
      - Baked `public/data/geoatlas-{claims,tenure}-labrador.geojson` +
        `*.meta.json` (`generatedAt`, `nextDue`, `cadenceMonths=3`,
        `contentHash`, feature counts 975 / 69 (tenure parks → CPCAD))
      - `LAYER_CONFIG`: `dataUrl` + `cacheKey` / `cacheVersion` (IndexedDB) +
        `lazy: true` + Labrador-clipped `paginatedQuery` live fallback
      - Registry entries → `fetch:claims` / `fetch:tenure`; monthly GHA skips
        until `nextDue` (2026-10-12); `refresh:data` bumps `cacheVersion` on
        content change
      - Broader inventory: **all 16** registry datasets match baked assets ↔
        meta ↔ `cacheKey`/`cacheVersion` ↔ npm fetch scripts (zero gaps)

**2.2 — Indigenous lands (high priority context)** ✅ COMPLETE (2026-07-12)
- [x] Nunatsiavut / Labrador Inuit Settlement Area
      → SAC-ISC `Donnees_Ouvertes-Open_Data/Region_inuite_Inuit_Region/0`
      (hyphen path). Filter `REGION='Nunatsiavut'` → 1 poly. Bake
      `fetch:nunatsiavut` → `inuit-nunatsiavut.geojson` (~0.17 MB). Cadence
      **12 mo**. Default **OFF**.
- [x] Innu / comprehensive land claims (ATRIS layer 2), Labrador subset
      → curated TAG_IDs: Innu of Labrador, NunatuKavut, Labrador Inuit Assn
      (Quebec claim), Naskapi Labrador claim. Bake `fetch:atris` →
      `atris-claims-labrador.geojson` (4 polys). Default **OFF**.
- [x] Style: low-opacity fill + dashed outline (context, not data)
- [x] Popup: name / agreement fields; combined with mineral claims popup
- [x] Default visibility OFF (user request)
- [x] Legend + wiring + test + status (`js/config/indigenousLands.js`)
- [x] ATRIS legend: per-claim on/off + descriptions (overlapping polygons);
      MapLibre filter on fill + outline by `TAG_ID`
- [x] Load / cache / refresh: same gold standard as 2.1 (IndexedDB → bake →
      live; registry 12-mo; meta `nextDue` 2027-07-12) — included in 16/16
      audit

**2.3 — Protected areas & land use** ✅ COMPLETE (2026-07-12)
- [x] Parks: Torngat & Mealy Mtns via GeoAtlas `Land_Use/4` CPCAD mirror
      (labradorgeolab ZIPs / federal CPCAD REST not used — GeoAtlas hosts CPCAD)
- [x] CPCAD national protected/conserved areas filtered to Labrador clip
      → bake `fetch:cpcad` → `geoatlas-cpcad-labrador.geojson` (12 polys).
      Cadence **12 mo**. Default **OFF**.
- [x] `GeoAtlas/Land_Use` zoning — merged bake of layers **0,1,5,7,8**
      (Plan 2020, specified materials, water supplies, planning areas, wind
      reserve). Skip 2/3 LIL/LISA (Phase 2.2) and 6 municipal (Phase 3).
      → `fetch:landuse` → `geoatlas-landuse-labrador.geojson` (131 polys).
      Cadence **12 mo**. Default **OFF**.
- [x] Style + legend + toggles + test + status (`js/config/protectedAreas.js`);
      land-use per-kind checklist; CPCAD by TYPE_E; popups; KPI opt-in metrics
- [x] §5.1.13 Labrador extents documented (`mineralLands.js` + Rights hint)

**Phase 2 exit criteria:** user can see, for any spot, whether they can legally
work and what land constraints apply. ✅ (2.1 + 2.2 + 2.3)

**2.4 — Hard exclusions (fatal-flaw) preset** ✅ COMPLETE (2026-07-12) · **Must (MVP)**
> Rights layers ship default OFF. One-click screen for **tier-1 blockers** only
> (likely undevelopable). Indigenous lands are **tier-2 process hurdles**
> (negotiation / consultation) — not painted as undevelopable. Claims/tenure
> are tier-3 competition.

- [x] One-click preset in Rights sidebar: **Hard exclusions**
      enables **CPCAD** + **land-use filtered to public water supplies**
- [x] Uniform dark-red mask (`#7f1d1d` @ 0.55) while active; clears on off;
      paint overrides survive basemap refresh
- [x] **Excluded by design:** Nunatsiavut, ATRIS, claims, tenure, planning
      areas, specified materials, wind reserve, Protected Areas Plan 2020
- [x] No first-visit auto-on — individual layer defaults stay OFF
- [x] Documented in Rights group hint text (hard exclusions vs consultation)
- [x] Do **not** block on caribou / salmon / SAR habitats (those → §5.2)
- Impl: `FATAL_FLAW_PRESET_LAYERS` = CPCAD + land-use;
  `FATAL_FLAW_LAND_USE_KINDS` = `publicWaterSupplies`;
  `applyFatalFlawPreset` / `ensureFatalFlawLandUseFilter` in `app.js`

### Phase 3 — Infrastructure ("can I develop it?")  ✅ COMPLETE (2026-07-12) · **Must (MVP)**
> External review Issue 11: without roads/rail/ports/power, remote wilderness
> looks as viable as ground next to a shipping lane. Completing 3.1–3.2 is the
> MVP finish line for purpose question #4.

**3.1 — Transport** ✅
- [x] Roads (Trans-Labrador Hwy + collectors) — GeoAtlas `Map_Layers/12` NRN
      (highway/arterial/collector; local streets omitted) → `geoatlas-roads-labrador`
- [x] Resource access / forest roads — `Map_Layers/14` → `geoatlas-resource-roads-labrador`
- [x] Railways (iron-ore / QNS&L) — `Map_Layers/12` ROADCLASS=Railroad → `geoatlas-rail-labrador`
- [x] Ports / marine access — curated Labrador points → `infra-ports-labrador`
      (10 harbours after 2026-07-12 coverage audit)
- [x] Airstrips / airports — curated → `infra-airports-labrador`
      (16 sites: all CFS public Labrador land strips + Voisey’s Bay private)
**3.2 — Power** ✅
- [x] Transmission lines — Nalcor `Map_Layers/15` + CanVec `/16` merged →
      `geoatlas-transmission-labrador` (**HV only** — no distribution; GeoAtlas
      Nalcor is generalized and may stop ~1 km short of plant footprints)
- [x] Generation — curated Churchill Falls, Muskrat Falls (operating) + Gull Island (potential);
      plant coords audited vs Wikipedia/GEM (townsite vs plant corrected)
**3.3 — Communities** ✅
- [x] Settlements — curated Labrador places → `infra-communities-labrador`
      (21 places after coverage audit vs Labrador-Grenfell / south-coast lists)
- [x] GeoAtlas `Land_Use/6` Municipal Boundaries → `geoatlas-municipal-labrador`
- [x] Each sub-item: config + style + popup + legend + bake + registry + test
**3.3b — Critical-mineral facilities under Infrastructure** ✅
- [x] Removed single Occurrences “Critical Mineral Facilities” toggle
- [x] Split NRCan bake into Infrastructure layers: mines, processing, advanced
      exploration, development (shared `critical-minerals-nl` bake + filters)
- [x] Early prospecting / showings remain on MODS (not in NRCan facilities)
**Phase 3 polish** ✅
- [x] SVG symbols for ports / airports / generation (type); per-type icon offsets
- [x] Unified Infrastructure legend (one card, default collapsed; items only for
      layers currently on)
- [x] Development KPIs in popups; curated vs source attributes labeled honestly
- [x] Data accuracy audit — no invented TX connectors; curated provenance clear

**Phase 3 exit criteria:** logistics/infrastructure overlay complete enough to
reason about development feasibility. ✅ (**MVP Must** 3.1–3.2 done; 3.3/3.3b
done; **3.4** done; **4.1** geophysics still required for full product MVP.)

**3.4 — Nearest-infrastructure distances** ✅ (2026-07-12) · **Should**
> Lite version of external “Logistical Viability Score.” Click a prospect →
> distance to nearest road, transmission, and deep-water port. Full scored
> model → §5.2.

- [x] MODS popup (map click + occurrence list) shows nearest road (highway or
      resource access), transmission, and port — straight-line km
- [x] Bake-backed cache (`infraDistance.js`); independent of layer toggles
- [x] Explicit “not a viability score” note; no composite score

### Phase 4 — Signals  [ ]
> **4.1 geophysics is Must for MVP** (2026-07-12 product decision): prospectors
> need subsurface structure under Labrador cover — surface polygons alone are
> not enough. **4.2 geochemistry** stays post-MVP / Stage C depth.

**4.1 — Geophysics** [ ] ← **Must (MVP)**
- [ ] Inventory `GeoAtlas/Geophysics_Labrador` (aeromag / radiometric / gravity)
- [ ] Ship MVP slice: regional **1VD / aeromag** + **gravity anomalies**
      (external review Issue 2) — WMS/image bake path + opacity + legend
- [ ] Per-product toggles in Signals group (default OFF; heavy rasters)
- [ ] **Survey / assessment footprints** (Issue 4) when a usable outline layer
      exists — blank map ≠ “no minerals”
- [ ] Bake + registry cadence; do not block MVP on every sub-survey product

**4.2 — Geochemistry** [ ] · **post-MVP**
> **Note (added 2026-07-06, updated 2026-07-11):** this is the *quantitative*
> complement to the qualitative MODS occurrence-density surfaces built in
> Phase 1.1c/1.1d. MODS has no assay/grade/tonnage field — it can only say
> "an occurrence exists here," not "how much." `GeoAtlas/Geochemistry_All`
> (lake-sediment/till samples) and CMiO carry real ppm/concentration values,
> so once wired they should get their own IDW/kriging-style concentration
> surface (reusing the `SurfaceInterpolation.js` per-cluster scaffolding
> where it fits, but interpolating a real measured value instead of an
> occurrence-presence/status weight) rather than being folded into the MODS
> surface. Don't conflate the two — label each surface honestly per its
> underlying data (see the MODS legend note for the pattern to follow).
- [ ] `GeoAtlas/Geochemistry_All` — lake sediment / till points (Issue 5)
- [ ] CMiO ore geochemistry (CMMI WFS) — optional advanced layer
- [ ] Style (graduated by element concentration), perf handling, legend
- [ ] **Grade threshold / top-percentile filter** (Issue 6) — only after real
      assay values exist; do not fake this on MODS
- [ ] Concentration-surface interpolation (IDW/kriging) once points are wired
- [ ] Ice-flow / glacial-transport vectors (Issue 5 companion) — see Optional
      later striations/landforms; full “trace up-ice” engine → §5.2

**Phase 4.1 exit (MVP):** at least 1VD/aeromag + gravity usable with legend/
opacity. **Phase 4.2 exit (post-MVP):** quantitative geochem surfaces.

### Phase 5 — Cross-cutting features & polish  [~]
> Soft-launch lite ✅ (2026-07-12): About data + GeoJSON export + legend
> card collapse. Full provenance registry / shareable URL / measure remain.

- [~] **Data-source registry** — Settings **About data** blurb done (lite);
      full per-layer provenance panel still open
- [~] **Layer search / filter** — commodity picker + legend checklist done (1.1b/d);
      status + free-text over live MODS done (1.1e). Still open: filter by NTS sheet alone;
      cross-layer search beyond MODS
- [ ] **Attribution / license panel** — required by NL GeoAtlas / NRCan / SAC-ISC terms
      (About data covers sources at a high level)
- [~] **Feature search / geocode** — occurrence list + flyTo/select done (1.1e);
      still open: jump to claim / NTS sheet / place geocode
- [ ] **Measure & draw tools** (distance/area) — exploration utility; feeds 3.4
      nearest-infra distances
- [ ] **Shareable state** — URL encodes active layers + extent + filters
      (later: include Settings / KPI prefs)
- [x] **Settings shell** — map + sidebar entry; collapsible sections; **KPI bar**
      + **About data** + **Export** (2026-07-12)
- [x] **Export** — visible / filtered MODS (+ claims if on) to **GeoJSON** ✅ soft-launch
      (Shapefile / KMZ → §5.2)
- [x] **Viewport status breakdown** — KPI `modsStatusBits` (default on; shortLabel
      clarified 2026-07-12)
- [x] **Desktop legend declutter** — new legend cards start collapsed when ≥2
      already open; title toggles body (2026-07-12)
- [ ] **Performance pass** — denser polygon layers (claims) may need further
      tiling/simplification beyond current bake + IndexedDB pattern
- [x] **Mobile/responsive** — map-first ≤768px: off-canvas **Layers** drawer
      (closed by default), **Legend** toggle (collapsed by default), occurrence
      list collapsed, KPI compact; MapLibre `resize` on layout change
      (`MobileChrome.js`, 2026-07-11)
- [x] **README** — product overview, run scripts, status, links to BUILD/PRODUCT
      plans (2026-07-12). Full contributor playbook still open (§6 + §6.2)
- [x] **Public hosting** — GitHub Pages via Actions (2026-07-11)
- [x] **Baked-data auto-refresh** — registry + monthly GHA → PR (§6.1 / §6.2)
- [x] **Audit harden (2026-07-12)** — popup XSS + `PopupBuilder`; load-failure UX;
      hash `cacheVersion` + GeoJSON `?v=`; KPI province filter + true polygon
      intersect; legend defs without mutating `LAYER_CONFIG`; skip IndexedDB for
      static bakes; MODS primary/secondary matrix in `modsFilters.js`; Settings
      focus trap + drawer `inert` + `prefers-reduced-motion`

### §5.1 Deferred audit follow-ups (schedule deliberately)

From the 2026-07-12 architecture audit — **do not block Phase 3**. Schedule as follows:

| # | Item | When | Why then |
|---|---|---|---|
| 8 | **CI `validate:data` + Vitest** on `modsFilters` / KPI helpers; assert bake `contentHash` + pagination counts | **Done (2026-07-12)** | `npm run validate:data` + Vitest; wired in deploy-pages + refresh-data |
| 11 | **LegendPanel label escaping** (`textContent` instead of `innerHTML` for ArcGIS labels) | **Done with #8** (2026-07-12) | `_buildItemsList` uses DOM/`textContent` |
| 16 | **Gate `window.app` behind `import.meta.env.DEV`** | **Done with #8** (2026-07-12) | `main.js` DEV-only assignment |
| 13 | **Document / unify Labrador extents** (MODS REGION vs claims bbox vs WMS `NL_LABRADOR_BOUNDS`) — at least Rights-group hint text | **Done with Phase 2.3** (2026-07-12) | Documented in `mineralLands.js` / `protectedAreas.js`; Rights hint notes mainland clip |
| 14 | **Refactor bedrock/surficial bake scripts** onto `esriPolygons.js` + `writeBakeOutputs`; registry `cadenceMonths` as single source of truth | **Before next geology re-bake** | Avoid three-way polygon helper drift; natural when editing bake pipeline |
| 9 | **MODS density surfaces → Web Worker** | **Phase 5 performance pass** (or sooner if field users report jank with surfaces on) | Opt-in feature; not on cold-start path; defer until surfaces see heavier use |

Checklist (mirror of table):
- [x] §5.1.8 — `npm run validate:data` in refresh + deploy CI; Vitest for filters/KPI
- [x] §5.1.11 — LegendPanel escape ArcGIS labels via DOM/`textContent`
- [x] §5.1.16 — `window.app` only in DEV builds
- [x] §5.1.13 — Canonical Labrador extent + UI hint (bundled with 2.3)
- [ ] §5.1.14 — Bedrock/surficial share bake libs; cadence from registry
- [ ] §5.1.9 — SurfaceInterpolation Web Worker + computing UI state

### §5.2 External review triage & post-MVP backlog  [ ]

> Consolidated 2026-07-12 from an external “world-class prospecting tool”
> critique. Mapped to our MVP purpose (*ground / found-claimed / constraints /
> infrastructure*). Do **not** let this list dilute Phase 3 exit criteria.

#### MVP triage (do / defer)

| Priority | External issues | Build-plan home | MVP-scoped fix |
|---|---|---|---|
| **Must** | 11 Infrastructure isolation | Phase **3.1–3.2** | Roads, rail, ports, transmission |
| **Must** | 2 Geophysics 1VD/gravity | Phase **4.1** | Public Labrador aeromag/1VD + gravity (+ footprints if available) |
| **Must** | 9 Hidden environmental/rights toggles | Phase **2.4** | Hard exclusions: CPCAD + water supplies (not Indigenous lands) |
| **Must** | 13 Misleading processing/refinery labels | Phase **1.1g** | Honest Labrador vs midstream labeling |
| **Should** | 8 Claim expiration signals | Phase **2.1c** | Expiry bands on baked claims (not live API) |
| **Should** | 1 Bedrock scale mismatch | Phase **1.4** | Mutual exclusion / zoom hint (not cross-fade) |
| **Should** | 14 Sidebar text dump | Phase **5** viewport breakdown | Extend KPI / status counts (search already exists) |
| **Should** | 15 Single-coded markers | Phase **5** symbology pass | Verify color×status dual coding + legend |
| **Should** | 16 Cluttered UI overlaps | Phase **5** desktop chrome | Accordion + pinned mini-legend |
| **Should** | 18 Data export | Phase **5** export | GeoJSON/CSV first |
| **Should** | 12 Economic viability (lite) | Phase **3.4** | Nearest road/power/port distances only |
| **Should** | 4 Survey / assessment outlines | Phase **4.1** (with Must geophysics) | Include when outlines exist; don’t block 1VD/gravity |
| **Can wait** | 5 Till/lake + ice-flow engine | Phase **4.2** + optional glacial | After MVP |
| **Can wait** | 6 Grade threshold slider | Phase **4.2** | Needs assay data; not MODS |
| **Can wait** | 3 Drillholes + core-library API | Post-MVP below | New data integration |
| **Can wait** | 7 Live Mineral Lands API | Post-MVP below | Conflicts with bake-first; 3-mo OK for MVP |
| **Can wait** | 10 Caribou / salmon / SAR | Post-MVP below | ESG depth |
| **Can wait** | 12 full viability score | Post-MVP below | Modeling product |
| **Can wait** | 17 Spatial query engine | Post-MVP below | After measure/buffer |
| **Can wait** | Full geology cross-fade; Shapefile/KMZ | Post-MVP below | Polish / formats |

#### Post-MVP running list (consider after project MVP)

Keep as a living idea backlog — promote into numbered phases only when
prioritized:

- [ ] **Historical drillholes + NL core-library / GEOFILE intercept links**
      (Issue 3) — collar map + one-click logs
- [ ] **Live claims registry API** (Issue 7) — vs shorter bake cadence; decide
      architecture (bake-first vs live)
- [ ] **Scale-dependent bedrock cross-fade** (Issue 1 full) — national ↔
      provincial auto switch
- [ ] **Ice-flow / glacial-transport tracing** (Issue 5 full) — vectorized
      ice-flow + up-ice anomaly tracing
- [ ] **ESG / permitting friction layers** (Issue 10) — caribou corridors,
      salmon watersheds, species-at-risk habitats (confirm open sources)
- [ ] **Logistical Viability Score** (Issue 12 full) — composite distance /
      access model
- [ ] **Proximity spatial query** (Issue 17) — e.g. “Cu showings within 20 km
      outside protected areas”
- [ ] **Export Shapefile / KMZ** (Issue 18 remainder) — after GeoJSON/CSV
- [ ] **Assessment-work / geophysical flight-line gap map** if not covered in 4.1
- [ ] Optional: 2.1b historical/cancelled claims + quarries; §5 Optional later
      geology / LiDAR / EO

---

## 6. Add-a-Layer Playbook (repeatable process)

Use for every new layer so the build stays consistent and documented.
1. **Inspect the service** — open the REST/WMS endpoint; note sublayer ID,
   geometry type, fields, `maxRecordCount`, CRS, query formats, license.
2. **Decide render path** — vector (GeoJSON `f=geojson`) if queryable; WMS image
   (+ reprojection util) if raster-only.
3. **Config** — add an entry to `layerConfig.js` (source, query URL, `outFields`,
   group, paint/layout, legend def, popup fields, default visibility).
4. **Fetch** — reuse `LayerManager` helpers; add pagination only if needed.
5. **Style** — color/size by the attribute that matters; keep it distinct from
   neighboring layers; respect the value-chain/maturity grammar.
6. **UI** — add sidebar toggle in its thematic group; wire toggle + legend + hover.
7. **Popup** — surface the fields a user actually needs; link back to source record.
8. **Optimize for load speed (required — do not ship live-only)** — we do **not**
   pull authoritative feeds on every browser session. Mirror the Bedrock (NL 1:1M)
   playbook unless the payload is trivially tiny *and* already baked:
   - **Vector:** bake clipped/simplified GeoJSON under `public/data/`; add
     `dataUrl` + IndexedDB (`cacheKey` / `cacheVersion`) via `layerCache.js`;
     keep live `paginatedQuery` / `sources` only as fallback; set `lazy: true`
     for heavy polygon/line layers; prune `outFields` and use
     `maxAllowableOffset` / `outSR=4326` where applicable.
   - **WMS / raster:** bake a static NL&L-bbox image (PNG/WebP) or tile set under
     `public/data/`; load as MapLibre `image` (or tiles) — do not rely on live
     GetMap + client reprojection for production toggles.
   - **Derived surfaces** (e.g. MODS density): no external bake required; keep
     client-side unless compute becomes a startup bottleneck.
   - Add `npm run fetch:<id>` (or extend an existing fetch script) and wire it
     through `scripts/data-refresh-registry.json`.
9. **Register auto-refresh cadence (required)** — every baked dataset must have
   an entry in `scripts/data-refresh-registry.json` with `cadenceMonths`,
   fetch script, output paths, and cache bump targets. Then update
   `.github/workflows/refresh-data.yml` so the scheduled check covers the new
   cadence (prefer a single frequent GHA that skips datasets whose `nextDue`
   has not passed — no browser polling). Record the chosen cadence in the
   catalog row / meta (`cadenceMonths`, `nextDue`). See **§6.1** for guidance.
10. **Test** — load, feature-count sanity, alignment vs basemap, pan/zoom perf,
    popups, basemap-switch survival, cold load from baked file (no live API).
11. **Document** — flip catalog status to ✅, tick the checklist item, note quirks
    (CRS, pagination, licensing, bake size, refresh cadence) here or inline.

### 6.1 Dataset load strategy & refresh cadence (live inventory)

**Gold standard:** IndexedDB → baked `public/data/*` → live API fallback. GHA
`.github/workflows/refresh-data.yml` runs **monthly** (`0 12 1 * *`) and
`npm run refresh:data` **skips** entries whose `nextDue` is still future.
Force all: Actions `workflow_dispatch` with force=true, or
`FORCE_REFRESH=1 npm run refresh:data`.

| Dataset | Load path | Cadence | nextDue (from meta) |
|---|---|---|---|
| **Bedrock Geology (NL 1:1M)** | ✅ Baked GeoJSON + IndexedDB + lazy | **6 mo** | see `geoatlas-bedrock-1m.meta.json` |
| **Surficial Geology (NL regional)** | ✅ Baked GeoJSON + IndexedDB + lazy | **6 mo** | see `geoatlas-surficial-regional.meta.json` |
| **Map-staked Claims (Labrador)** | ✅ Baked GeoJSON + IndexedDB + lazy (`fetch:claims`) | **3 mo** | see `geoatlas-claims-labrador.meta.json` |
| **Mineral Tenure (Labrador)** | ✅ Baked GeoJSON + IndexedDB + lazy (`fetch:tenure`; parks excluded) | **3 mo** | see `geoatlas-tenure-labrador.meta.json` |
| **Nunatsiavut (LISA)** | ✅ Baked GeoJSON + IndexedDB + lazy (`fetch:nunatsiavut`) | **12 mo** | see `inuit-nunatsiavut.meta.json` |
| **ATRIS Land Claims (Labrador)** | ✅ Baked GeoJSON + IndexedDB + lazy (`fetch:atris`) | **12 mo** | see `atris-claims-labrador.meta.json` |
| **Protected & Conserved (CPCAD)** | ✅ Baked GeoJSON + IndexedDB + lazy (`fetch:cpcad`) | **12 mo** | see `geoatlas-cpcad-labrador.meta.json` |
| **Land Use Constraints (Labrador)** | ✅ Baked GeoJSON + IndexedDB + lazy (`fetch:landuse`) | **12 mo** | see `geoatlas-landuse-labrador.meta.json` |
| **Mineral Occurrences (MODS)** | ✅ Baked GeoJSON + IndexedDB (`fetch:mods`) | **3 mo** | see `mods-labrador.meta.json` |
| **Critical Mineral Facilities** | ✅ Baked NL&L GeoJSON + IndexedDB (`fetch:facilities`) | **3 mo** | see `critical-minerals-nl.meta.json` |
| **Li / REE / Graphite / Ni / CD+MVT Zn / national bedrock / surficial** | ✅ Baked Mercator PNG (`fetch:wms`) | **12 mo** | see `wms-*-nll.meta.json` |
| **MODS density surface** | Client Turf from loaded MODS | n/a (derived) | — |

Registry: `scripts/data-refresh-registry.json` (27 entries). Manual bakes:
`npm run fetch:bedrock` · `fetch:surficial` · `fetch:claims` · `fetch:tenure` ·
`fetch:nunatsiavut` · `fetch:atris` · `fetch:cpcad` · `fetch:landuse` ·
`fetch:roads` · `fetch:rail` · `fetch:resource-roads` · `fetch:transmission` ·
`fetch:infra-sites` · `fetch:municipal` ·
`fetch:mods` · `fetch:facilities` · `fetch:wms`.

**Audit (2026-07-12):** every registry row has matching baked asset + meta
(`generatedAt` / `nextDue` / `cadenceMonths` / `contentHash`), npm fetch
script, and `cacheKey`/`cacheVersion` in `layerConfig.js`. Phase 2.1 claims +
tenure confirmed Labrador-clipped live fallback. No gaps found.

**When adding a layer:** playbook steps 8–9 are mandatory (bake + registry +
cadence). Prefer the same monthly GHA + `nextDue` skip over extra crons.

### 6.2 How data refresh works (operator guide)

**Runs mostly on its own.** You do **not** need to poll browsers or re-fetch
by hand on the cadence. After this workflow lives on the repo’s **default
branch** with Actions enabled:

1. **Monthly** (1st, 12:00 UTC) GitHub Actions runs `refresh-data.yml`.
2. `npm run refresh:data` checks each registry entry’s `meta.nextDue`.
3. Datasets that are **not due** are skipped (no network fetch).
4. Due datasets are re-baked; if the file hash / feature count changed, the
   Action **opens a pull request** (it does **not** auto-merge to `master`).
5. **Your only recurring job:** review and merge that PR when it appears.
   Pages deploy then picks up the new `public/data/*` (and any
   `cacheVersion` bumps in `layerConfig.js`).

| Cadence | Datasets | Typical next due after a bake |
|---|---|---|
| 3 months | MODS, Critical Mineral Facilities, Map-staked Claims, Mineral Tenure | +3 months from `generatedAt` |
| 6 months | Bedrock Geology (NL 1:1M), Surficial Geology (NL regional) | +6 months |
| 12 months | Eight NRCan WMS PNG bakes; Nunatsiavut; ATRIS; CPCAD; land use | +12 months |

**Optional / one-off**
- Force every dataset now: Actions → **Refresh data sources** → Run workflow →
  force = `true` (or locally `FORCE_REFRESH=1 npm run refresh:data`).
- Bake one dataset locally: `npm run fetch:mods` (etc.), commit
  `public/data/*` + any `cacheVersion` change.
- Confirm Actions is enabled on the GitHub repo; scheduled crons only run from
  the **default branch**.

---

## 7. Architecture notes & decisions

- **Bake-first consumption:** production loads baked `public/data/*` (GeoJSON /
  WMS PNG). Live ArcGIS REST / WMS remain as fallback only. New layers must
  follow playbook steps 8–9 (bake + registry cadence).
- **Layer grouping (Phase 1.0):** ✅ done — thematic groups (Endowment /
  Occurrences / Rights / Infrastructure / Signals / Base) with collapsible
  sidebar sections.
- **Provincial vs national geology:** prefer GeoAtlas (provincial, hi-res) for
  Labrador; keep NRCan WMS (baked PNG) as national fallback/context. Scale-clash
  policy (mutual exclusion / zoom hint) tracked as Phase **1.4**; full
  zoom-dependent cross-fade is post-MVP (§5.2).
- **MVP gate (2026-07-12, close-out):** Must for pre–Phase 3 = **2.4** hard
  exclusions ✅ + **1.1g** facilities honesty ✅. Should soft-launch = **2.1c**
  expiry ✅ + **1.4** bedrock exclusion ✅ + Phase 5 lite (About / export /
  legend collapse / KPI status bits) ✅. Phase **3.1–3.4** infrastructure ✅.
  Remaining Must for product MVP = Phase **4.1** geophysics.
- **Performance:** MODS ~3k points — always-visible circles with zoom-scaled
  radius + commodity picker (no clustering/heatmap). Density surfaces are
  optional (legend toggle; **default off** so cold start skips Turf). Heavy
  geology polygons use bake + IndexedDB + lazy toggle.
- **Mobile chrome:** ≤768px map-first — sidebar is an overlay drawer; legend is
  a separate collapsible control (`MobileChrome.js`).
- **CRS:** GeoAtlas/ArcGIS services are often EPSG:3978 or 26720/26721 (UTM
  NAD27 for MODS) — request GeoJSON (WGS84 / `outSR=4326`) to avoid reprojection
  headaches; WMS reprojection util only for live raster fallback (bakes are
  pre-corrected in `fetch:wms`).
- **Vector-first:** prefer queryable vector over WMS raster where a service
  offers both (crisp scaling, per-feature popups, legend control).

---

## 8. Open decisions / to confirm

- [ ] **Map default extent** — tune bounds/zoom to frame all of Labrador now
      that scope is explicit.
- [x] **App scope/branding** — keep Labrador focus (confirmed 2026-07-06).
- [ ] Confirm GeoAtlas sublayer IDs & queryability per service (some MapServer
      sublayers may be raster-only / not queryable as features).
- [ ] License/attribution requirements per source (NL GeoAtlas, NRCan, SAC-ISC,
      labradorgeolab) — capture in the data registry (Phase 5).
- [x] MODS symbology: color-by-commodity palette + status size ramp — finalized
      2026-07-06 (Phase 1.1b), including the commodity picker/filter scheme.

---

## 9. Reference links

- NL Geoscience Atlas REST: https://dnrmaps.gov.nl.ca/arcgis/rest/services/GeoAtlas
- NL Geoscience Atlas (app): https://geoatlas.gov.nl.ca
- MODS: https://www.gov.nl.ca/em/mines/geoscience/mods/
- NRCan Critical Minerals: https://maps-cartes.services.geo.ca/server_serveur/rest/services/NRCan/critical_minerals_en/MapServer
- NRCan Map 900A: https://maps-cartes.services.geo.ca/server_serveur/rest/services/NRCan/900A_and_top_100_en/MapServer
- CMMI / CMiO: https://criticalminerals.org  (WFS: https://services.ga.gov.au/gis/critical-minerals/wfs)
- Inuit Regions (Nunatsiavut): https://open.canada.ca/data/en/dataset/f242b881-75e3-40bb-a148-63410b4ce2af
- ATRIS land claims: https://geo.sac-isc.gc.ca/geomatics/rest/services/ATRIS_PRD/ATRIS_E_PC/MapServer/2
- Labrador GeoLab datasets: https://www.labradorgeolab.ca/datasets

---

## 10. Changelog

- **2026-07-12** — **Infrastructure coverage audit:** filled missing CFS Labrador
  land airports (Black Tickle, Charlottetown, St. Lewis, Voisey’s Bay private),
  Hopedale/Black Tickle harbours, and matching communities (incl. Red Bay).
  Inventories now 16 airports / 10 ports / 21 communities. **Next:** Phase **4.1**
  geophysics.
- **2026-07-12** — **Phase 3 close-out polish:** facilities split under
  Infrastructure (mines / processing / exploration / development); SVG site
  icons; unified Infrastructure legend; data accuracy audit (Churchill Falls /
  Gull Island coords fixed; no invented TX connectors; curated vs source
  attributes labeled). Phase **3 fully closed**. **Next:** Phase **4.1**
  geophysics.
- **2026-07-12** — **Phase 3.4** nearest-infra distances on MODS popups
  (road / transmission / port km; bake-cached; not a viability score).
- **2026-07-12** — **Phase 3 Infrastructure complete:** GeoAtlas roads (NRN
  highway/collector), resource access roads, rail, Nalcor+CanVec transmission;
  curated ports / airports / generation / communities; municipal boundaries
  (`Land_Use/6`). Bake-first + registry (27 entries); Infrastructure sidebar
  group live (default OFF).
- **2026-07-12** — Docs: README rewritten as standalone product overview
  (removed Enes / merger framing); BUILD_PLAN header + “Where we are”
  reconciled; package description cleaned.
- **2026-07-12** — **Pre–Phase 3 close-out:** **1.1g** facilities honesty
  (processing/midstream + off-island popup); **1.4** provincial↔national
  bedrock mutual exclusion; **2.1c** claim expiry bands + legend filters;
  Settings **About data** + **Export** GeoJSON; legend cards collapse when
  crowded; KPI status shortLabel clarified. **Next:** Phase 3.1 transport.
- **2026-07-12** — Phase **2.4** refined: **Hard exclusions** (not province-wide
  “restricted land”). Mask = CPCAD + public water supplies only. Nunatsiavut /
  ATRIS = consultation hurdles (normal Rights toggles). Claims/tenure /
  planning overlays stay out. UI label + Rights hint updated.
- **2026-07-12** — Phase **2.4** complete: **Fatal flaw / restricted land**
  preset in Rights sidebar. One click enables CPCAD + Nunatsiavut + ATRIS +
  land-use with uniform dark-red mask (`#7f1d1d` @ 0.55); off clears mask and
  hides those layers. Claims/tenure excluded. Paint overrides via
  `setPaintProperty` / `clearPaintOverrides` (survive basemap switch). Rights
  hint updated. **Next:** Phase 3.1 transport (+ 4.1 geophysics / 1.1g).
- **2026-07-12** — **Phase 4.1 geophysics promoted to MVP Must** (1VD/aeromag +
  gravity; survey footprints when available). 4.2 geochemistry remains
  post-MVP. Recommended sequence, §5.2 triage, and MVP gate notes updated.
  **Next:** Phase 3.1 transport, then 4.1 (or parallel once infra path is clear).
- **2026-07-12** — External (Gemini) critique triaged into **Must / Should /
  Post-MVP** and folded into the build sequence. New checklist homes: **1.1g**
  facilities honesty (Must), **1.4** geology scale-clash policy (Should),
  **2.1c** claim expiry bands (Should), **2.4** fatal-flaw preset (Must),
  **3.4** nearest-infra distances (Should), Phase 4/5 annotations, and **§5.2**
  triage table + post-MVP running list. Recommended next steps reordered:
  Phase 3.1–3.2 → 2.4 → 1.1g → Should polish → Phase 4+. **Next:** Phase 3.1
  transport (+ parallel Must 2.4 / 1.1g when convenient).
- **2026-07-12** — §5.1.8 / 11 / 16 CI gate: `npm run validate:data` (registry
  contentHash / cacheVersion / feature floors); Vitest for `modsFilters` +
  `KpiEngine` (21 tests); LegendPanel ArcGIS labels via `textContent`;
  `window.app` DEV-only; deploy-pages + refresh-data run validate/tests.
  Normalized all bake `meta.version` fields to content-hash prefixes.
  **Next:** Phase 3.1 transport.
- **2026-07-12** — De-overlap tenure vs CPCAD: mineral tenure bake/live
  excludes National/Provincial Park, Ecological Reserve, National Historic
  Park (`TENURE_WHERE`); parks only on Protected & conserved. Tenure bake
  177 → **69** mineral-rights polys; `cacheVersion` bumped. BUILD_PLAN
  reconciled: Phase 2 fully closed; **next** = §5.1.8 CI/Vitest gate, then
  Phase 3.1 transport.
- **2026-07-12** — Phase **2.3** complete: **Protected & conserved areas**
  (GeoAtlas `Land_Use/4` CPCAD mirror, 12 Labrador polys incl. Torngat /
  Mealy) + **Land use constraints** (merged layers 0/1/5/7/8, 131 polys).
  Bake-first; Rights group; **default OFF**; `fetch:cpcad` / `fetch:landuse`;
  registry **18** @ 12-mo. Shared `js/config/protectedAreas.js`; land-use
  per-kind legend checklist; CPCAD TYPE_E legend; popups; KPI opt-in.
  §5.1.13 Labrador extents documented. Phase **2 exit criteria met**.
  Skipped labradorgeolab ZIPs / federal CPCAD REST / LIL-LISA / municipal.
  **Next:** §5.1.8 CI/Vitest, then Phase 3.1 transport.
- **2026-07-12** — Audit harden pass: safe `PopupBuilder` + shared `htmlEscape`;
  layer/WMS load failures surface in sidebar footer and uncheck toggles;
  `cacheVersion` = content-hash prefix (bake + `refresh:data` + `layerConfig`);
  GeoJSON `?v=` cache bust; skip IndexedDB for static bakes + evict stale
  versions; KPI facilities respect province filter; polygon KPIs use true
  geometry intersect + “intersecting view” labels; legends no longer mutate
  `LAYER_CONFIG`; MODS primary/secondary matrix documented
  (`modsUsesPrimaryOnlyFilter`); Settings focus trap + `inert`; mobile drawer
  `inert`; `prefers-reduced-motion`. Deferred items → **§5.1**. **Next:** Phase 2.3.
- **2026-07-12** — Settings UX polish: **KPI bar** is a collapsible Settings
  subcategory (**default minimized**); map/sidebar Settings opens the shell
  collapsed; KPI-bar **gear** deep-links to Settings → KPI **expanded**. Ready
  for additional Settings sections. **Next:** Phase 2.3.
- **2026-07-12** — Customizable **multi-layer KPI bar** + **Settings** panel:
  viewport-aware counts (MODS / claims / tenure / facilities / ATRIS /
  Nunatsiavut / layers-on); pan/zoom refresh; prefs in `localStorage`;
  modules `KpiBar`, `KpiEngine`, `UserPrefs`, `SettingsPanel`. **Next:**
  Phase 2.3.
- **2026-07-12** — Bake/cache/refresh audit: **16/16** registry datasets OK
  (assets ↔ meta ↔ `cacheKey`/`cacheVersion` ↔ fetch scripts). Phase **2.1**
  claims/tenure reconfirmed against playbook gold standard (IndexedDB →
  bake → Labrador-clipped live fallback; 3-mo cadence; `nextDue` 2026-10-12).
  ATRIS legend UX: per-claim toggles + descriptions for overlapping polygons.
  BUILD_PLAN §2.1 / §2.2 / §6.1 updated. **Next:** Phase 2.3.
- **2026-07-12** — Phase 2.2 complete: **Nunatsiavut (LISA)** + **ATRIS
  Labrador land claims** (Innu, NunatuKavut, Labrador Inuit Assn Quebec claim,
  Naskapi Labrador). Bake-first; Rights group; **default OFF**; dashed
  context outlines; combined popups; registry **16** @ 12-mo. Corrected Inuit
  Regions URL hyphen path (`Donnees_Ouvertes-Open_Data`). **Next:** Phase 2.3
  protected areas / land use.
- **2026-07-12** — Phase 2.1 complete: **Map-staked Claims** + **Mineral Tenure**
  (GeoAtlas `Mineral_Lands` layers 0 + 5), Labrador-clipped bbox south of
  Strait of Belle Isle (~975 / ~177 polys). Bake-first
  `geoatlas-claims-labrador.geojson` / `geoatlas-tenure-labrador.geojson` +
  IndexedDB + lazy Rights toggles; STATUS / TYPEDESC fills; popups (licence,
  holder, dates; FILENUM + GeoFiles search). Shared
  `js/config/mineralLands.js`; `fetch:claims` / `fetch:tenure`; registry **14**
  entries @ **3 mo**. LayerManager: spatial envelope on `paginatedQuery`.
  Deferred: historical (~42k), quarries, cancelled, notices (empty).
  **Next:** Phase 2.2 Indigenous lands.
- **2026-07-12** — Session close-out: BUILD_PLAN reconciled for Phase 1
  complete (surficial + all 6 NRCan prospectivity models + endowment
  subgroups). Registry **12** entries. **Next:** Phase 2.1 mineral claims.
- **2026-07-12** — Added remaining NRCan national prospectivity WMS bakes:
  magmatic nickel, CD zinc, MVT zinc (`wms-{nickel,zincCd,zincMvt}-nll.png`,
  12-mo registry). Renamed REE sidebar/legend labels to **Rare Earth Elements**.
  `fetch:wms` accepts optional layer-key args to bake a subset.
- **2026-07-12** — Phase 1.3 complete: provincial **Surficial Geology (NL
  regional)** from GeoAtlas `Surficial_Geology_All/MapServer/12` (~15,016
  polys). Bake-first `geoatlas-surficial-regional.geojson` (~9.5 MB) +
  IndexedDB + lazy toggle; RGB fills; ArcGIS legend; genetic-unit popups;
  registry cadence **6 mo** (`fetch:surficial`). National NRCan surficial
  WMS relabeled **Surficial Geology (national)**. Phase 1 exit criteria met.
  Added **§5 Optional later** for detailed surficial (/11), LiDAR, aerial
  flyover/orthophoto, and earth-observation layers. **Next:** Phase 2.1
  mineral claims & tenure.
- **2026-07-11 (EOD)** — Build plan reconciled to end-of-day reality: bake-first
  data path + module layout (`layerCache`, `MobileChrome`, fetch/refresh
  scripts); §3 snapshot updated; Phase 0/5 mobile + refresh ticked; §7
  architecture notes rewritten (bake-first, surfaces default off); 1.3 called
  out to include playbook steps 8–9. **Next session:** Phase 1.3 provincial
  surficial.
- **2026-07-11 (evening)** — Mobile map-first chrome: sidebar is an off-canvas
  **Layers** drawer (closed by default); **Legend** is a separate button and
  starts collapsed so the map fills the phone screen. Escape / backdrop close;
  MapLibre `resize` on layout change.
- **2026-07-11 (evening)** — Added **§6.2 How data refresh works (operator
  guide)**: monthly GHA is automatic; merge the refresh PR when it appears;
  force / local bake options documented.
- **2026-07-11 (evening)** — Baked remaining live layers for cold-load speed:
  MODS (`mods-labrador.geojson`, ~3,175 pts), facilities NL subset
  (`critical-minerals-nl.geojson`, 13 pts), five NRCan WMS Mercator PNGs
  (`wms-*-nll.png`). Registry expanded to 8 entries; GHA cron **monthly**
  with `nextDue` skip (3 / 6 / 12 mo). Scripts: `fetch:mods`, `fetch:facilities`,
  `fetch:wms`. LayerManager prefers baked `imageUrl` for WMS.
- **2026-07-11 (evening)** — Dataset inventory + load/refresh guidance. Add-a-Layer
  Playbook now **requires** (8) bake/cache optimize and (9) registry + GHA
  cadence for every new layer. Added §6.1 table: MODS + facilities → bake @
  **3 mo**; five NRCan WMS → static NL&L images @ **12 mo**; bedrock stays
  **6 mo**. Prefer monthly GHA that skips until `nextDue`.
- **2026-07-11 (evening)** — Bedrock performance + auto-refresh: load order
  IndexedDB → baked GeoJSON → live GeoAtlas; registry; `npm run refresh:data`;
  GHA opens a PR on change and bumps `cacheVersion`. *(Cron later generalized
  to monthly with `nextDue` skip — see §6.2.)* **Next:** Phase 1.3 provincial
  surficial.
- **2026-07-11 (evening)** — Bedrock load path: baked
  `public/data/geoatlas-bedrock-1m.geojson` (~3,510 polys) + IndexedDB cache
  (`cacheKey`/`cacheVersion`) + parallel live GeoAtlas fallback
  (`npm run fetch:bedrock` to refresh). Loading label fixed to `(loading…)`.
  **Next:** Phase 1.3 provincial surficial.
- **2026-07-11 (evening)** — Phase 1.2 complete: provincial **Bedrock Geology
  (NL 1:1M)** from GeoAtlas MapServer/23. Lazy paginated GeoJSON (~3,510
  polygons), fill colors from source RGB, ArcGIS legend JSON (~153 classes),
  unit popups, drawn under MODS/facilities. NRCan bedrock WMS relabeled
  **Bedrock Geology (national)** and kept as optional context. New plumbing:
  `LAYER_CONFIG.geoatlasBedrock` (`lazy`, `enrichment: 'bedrockRgb'`,
  `beforeLayerIds`), `LayerManager.loadLayerOnDemand` /
  `getVectorLegendItems`, app lazy-toggle + bedrock click popup. **Next:**
  Phase 1.3 provincial surficial.
- **2026-07-11 (evening)** — Plan refresh + Phase 1.1e complete. Cherry-picked
  B UX (KPI, status filters, search, list/detail) onto A’s live MODS path per
  revised merger guide — no featured enrichment / group taxonomy / iron policy
  change. Light sidebar chrome; legends top-left; KPI bottom; occurrence list
  minimizable in sidebar. Published to GitHub
  (`kellybyron2222-dev/labrador-critical-minerals-explorer-v3`) with Pages
  deploy workflow. Key files: `modsFilters.js`, `OccurrenceBrowser.js`,
  `app.js`, `LayerManager.js` (`statusBucket`), `index.html`, `css/style.css`,
  `.github/workflows/deploy-pages.yml`. **Next:** Phase 1.2 provincial bedrock.
- **2026-07-11** — Phase 1.1d complete: per-mineral localized surfaces and
  primary-commodity discipline for MODS. Root cause of "Copper toggle shows
  wrong-colored dots / wrong surface extent" was a `commodityList` (primary +
  secondary) vs `COMNAME` (primary color) mismatch — ~1,057/~3,175 Labrador
  records (~33%) have distinct secondary minerals. **Legend checklist** now
  uses `primaryCommodity` for circle filter, surface input, and color match;
  **sidebar single-mineral pick** keeps `commodityList` for broader search.
  Surfaces refactored: DBSCAN per mineral → per-cluster non-normalized IDW
  density grid → influence cutoff → isobands → `polygonSmooth`; one merged
  GeoJSON source tagged with `commodity`, filtered by enabled set. UI
  simplified to **one mineral checklist** (All on/All off) plus master
  surface toggle; popup split into Primary / Also reported. Key files:
  `SurfaceInterpolation.js`, `layerConfig.js`, `app.js`, `LayerManager.js`,
  `LegendPanel.js`, `css/style.css`.
- **2026-07-06** — Phase 1.1c complete: MODS occurrence-density interpolated
  surfaces. New `js/modules/SurfaceInterpolation.js` uses open-source Turf.js
  (`@turf/turf`, added as a dependency) to turn the currently
  commodity-filtered MODS points into a smooth density surface — weighted
  IDW interpolation (`turf.interpolate`, power=2, over an adaptive ~40-cell
  grid sized to the filtered points' bbox) sliced into 5 quantile-based
  `isobands` tiers, with the lowest ("background") tier hidden so the result
  reads as contour "blobs" hugging real occurrence clusters rather than a
  giant low-opacity rectangle. Weighting uses each occurrence's economic
  maturity (`STATUS`: Producer > Past Producer > ... > Indication) so mature
  clusters read as "hotter" than equally dense but immature ones. Explicitly
  scoped to *occurrence density*, not concentration/grade — MODS has no
  assay/tonnage field to interpolate a true prospectivity surface from; see
  the new note added to Phase 4.2 above for where the quantitative
  (geochemistry ppm) version of this belongs later, and the surface's own
  legend note in-app for the same caveat surfaced to users. `layerConfig.js`
  gained a `surface` config block on `modsOccurrences` plus
  `resolveMODSSurfaceColor()`/`resolveMODSCommodities()`/
  `featureMatchesMODSCommodity()`; `LayerManager` gained
  `updateOccurrenceSurface()`/`setSurfaceVisibility()`/`getLoadedFeatures()`
  (fill+line layers under the circle layer, zoom-crossfaded opacity via a
  top-level `interpolate(zoom)` whose output is a `match(tier)` — same
  validation pattern as `buildMODSRadiusExpression` in 1.1b); `app.js`
  recomputes the surface whenever the commodity picker changes and wires a
  new "Show occurrence density surface" toggle inside the MODS legend card
  (`LegendPanel` gained generic `surfaceToggle`/`note` support).
  **Also fixed a real, pre-existing bug found while verifying this via
  headless-browser (Playwright) screenshots:** `MapBase.switchBasemap()`
  waited on a `style.load` event to know when it was safe to re-add runtime
  layers/sources after a basemap switch — but MapLibre's `setStyle()` diffs
  the incoming style against the current one by default and, when it can
  patch in place, never re-fires `style.load` (only repeated `styledata`
  events). This meant **every** runtime layer (MODS circles, facilities
  icons, and now the new surfaces) silently vanished on basemap switch and
  was never restored — not just a Phase 1.1c regression, this dropped the
  *entire* Occurrences group any time a user changed basemaps. Fixed by
  switching the wait to `once('idle', ...)`, which fires reliably once
  rendering settles regardless of whether MapLibre took the diff or
  full-reload path; verified via Playwright (commodity switch → toggle
  surface off/on → switch to Dark basemap → confirmed circles, surface, and
  facilities icons all present and correctly styled).
- **2026-07-06** — Phase 1.1b complete: commodity-scoped MODS visualization.
  Dropped the heatmap → circle crossfade entirely (per user decision) in
  favor of circles-only at every zoom, with `circle-radius` scaled by a zoom
  factor (small-but-visible at ~300km regional view, full size once zoomed
  into a district) — `addHeatmapCrossfadeLayer` removed from
  `LayerManager.js`, MODS now goes through the plain `addCirclePointLayer`
  path like any other point layer. Added a sidebar commodity picker
  (`app.js` `buildCommodityPicker`/`bindMODSCommodityPicker`, config-driven
  via a new `commodityPicker` block so it's reusable by future layers) that
  filters + recolors the layer at runtime via new generic
  `LayerManager.setLayerFilter()`/`setPaintProperty()` methods (both persist
  across basemap switches, reapplied in `refreshLayers()`). Filtering matches
  against a new `commodityList` property computed per-feature in
  `LayerManager.loadLayer()` — a normalized, deduped array combining primary
  (`COMNAME`) and secondary (comma-split `COMMODS`) commodities, confirmed via
  a standalone `geojson-vt` test to survive MapLibre's internal GeoJSON
  tiling as a real array (not stringified), so `['in', value,
  ['get','commodityList']]` filter expressions work directly against it.
  Default selection is `MODS_CRITICAL_MINERALS_PRESET` in `layerConfig.js`,
  built by cross-referencing Canada's official 34-mineral Critical Minerals
  List (canada.ca, updated June 2024) against Labrador MODS' actual commodity
  distribution (queried fresh against the full 3,173-feature dataset, both
  `COMNAME` via ArcGIS `outStatistics`/`groupBy` and free-text `COMMODS`) —
  see the Phase 1.1b checklist above for the full commodity-quantification
  findings and the rationale for excluding Iron/Phosphorus/Silicon metal from
  the preset despite being technically on the official list. Legend and
  popup (now lists all matched commodities, not just the primary one) both
  update live with the picker.
- **2026-07-06** — MODS follow-up fixes based on first look:
  1. *Regional visibility:* replaced cluster bubbles (which fully hid MODS
     data at the ~300km regional zoom) with a heatmap → circle crossfade —
     see revised note under Phase 1.1 above. `addClusteredPointLayer`
     removed from `LayerManager.js`, replaced by `addHeatmapCrossfadeLayer`.
  2. *No more numbered bubbles:* same fix as above — the heatmap gives a
     smooth density "trend" at distance with no discrete cluster counts;
     circles carry the commodity coloring once zoomed in past z9.
  3. *Popup/legend legibility:* popups and legend cards were on the app's
     dark theme, and the MODS record `<a>` link had no color override, so it
     fell back to the browser's default dark-blue link color on a dark
     background — unreadable. Gave popups + legend (card and enlarged modal)
     their own light card palette (`--card-light-*` in `style.css`) with an
     explicit legible link color/hover state, independent of the sidebar's
     dark theme.
- **2026-07-06** — Phase 1.1 complete: MODS mineral occurrences layer live
  (NL GeoAtlas `Map_Layers/MapServer/3`, filtered to `REGION='Labrador'`,
  3,173 points). Added `LayerManager.fetchPaginatedGeoJSON()` (4-page loop,
  validated against the live endpoint) and clustered-point rendering
  (`addClusteredPointLayer`, generalized `setLayerVisibility`). Styled by
  primary commodity (`COMNAME`, ~25-color curated palette, some hues shared
  with the matching Li/REE/graphite WMS layers) with a status-based radius
  ramp (Producer > Past Producer > Developed Prospect > Prospect > Showing >
  Indication). Popup surfaces commodity/status/deposit type/ore minerals/work
  history/NTS sheet plus a deep link to the province's MODS record lookup.
  Also fixed a latent basemap-switch bug: `refreshLayers()` was re-adding
  layers without re-adding their sources (which `map.setStyle()` tears down)
  — now handled by a shared `ensureSource()`, benefiting all vector layers.
  Replaces the removed demo "Mineral Deposits" layer with real data.
- **2026-07-06** — Sidebar UI redesign (3 passes, CSS-only unless noted):
  - *Pass A:* introduced a shared type scale (10–15px) and spacing scale
    (4/8/12/16px); flattened layer rows (removed per-row card borders/backgrounds
    in favor of quiet hover tints); removed glowing indicator swatches; quieted
    group headers and demoted hint/note text out of "callout box" styling.
  - *Pass B:* unified typography across all sidebar section headers (Map
    Controls / Basemap / layer groups now share one rule); converted the
    basemap picker into a true segmented control (one outer border vs. three
    separately-bordered buttons); tightened sidebar 280px→260px; added a
    consistent spacing scale + custom thin scrollbar.
  - *Pass C:* replaced native checkboxes with custom pill-style toggle
    switches (pure CSS, still fully accessible); swapped the CSS-border
    chevron for a crisp inline SVG (`app.js`); added a left accent bar +
    subtle tint on checked layer rows so "what's on" is scannable at a
    glance; relocated the "demo data removed" note out of the Occurrences
    layer card into a persistent `.data-status` line in the sidebar footer.
- **2026-07-06** — Phase 1.0 complete: data-driven collapsible sidebar groups
  (`LAYER_GROUPS`, `LAYER_GROUP_ORDER`, `group` metadata on all layers);
  NL&L WMS clip + facilities display filter; legend expand + ArcGIS JSON
  multi-column legends.
- **2026-07-06** — Removed demo data (deposits/infrastructure/tenures); reframed
  sidebar around value chain; added maturity encoding + facility icons; researched
  & verified Labrador data sources; authored master build plan; expanded plan into
  granular checklist + Add-a-Layer Playbook; added Purpose & Goal.
