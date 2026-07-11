# Labrador Critical Minerals Explorer — Master Build Plan (V3)

> **This tree is V3** (`explorer-v3`). Copied from the untouched V1 baseline at
> `../project`. Do not edit `../project` for V3 work.
>
> **Merger policy (revised 2026-07-11):** keep A’s MapLibre live-data hub.
> Cherry-pick only UX pieces F1–F5 from B (KPI, search, list/detail, status
> filters) — see Cursor canvas `revised-merger-guide.canvas.tsx`. No featured
> deposits, no B commodity groups, no iron-in-critical, no static GeoJSON.
>
> **Living document.** This is BOTH the master plan and the granular, step-by-step
> checklist for the project. Review and update it as we move along — tick boxes,
> flip status markers, and add notes in place.
> Last updated: 2026-07-11 (evening) — §6.2 operator guide for auto-refresh;
> baked MODS/facilities/WMS; monthly GHA with nextDue skip

**Status marker key:** `[x]` done · `[~]` in progress · `[ ]` not started · `[!]` blocked/needs decision
Layer catalog status: `✅ done/in app` · `🟢 verified available` · `⬜ to confirm/wire` · `🔒 blocked`

---

## Where we are (2026-07-11)

**Phase 0** ✅ complete · **Phase 1** [~] — MODS + occurrence UX + provincial
bedrock done; provincial surficial (1.3) still open · **Phases 2–4** not started ·
**Phase 5** partially pulled forward (occurrence browser UX + public host).

| Area | Status |
|---|---|
| Live MODS + critical preset (iron excluded) + surfaces | ✅ |
| Facilities + 5 NRCan WMS | ✅ |
| Provincial bedrock (GeoAtlas 1:1M, baked + IndexedDB + 6-mo auto-refresh) | ✅ (2026-07-11) |
| MODS + facilities + 5 NRCan WMS baked (IndexedDB / static PNG; monthly GHA) | ✅ (2026-07-11) |
| Status filters, search, list/detail, bottom KPI | ✅ (2026-07-11) |
| Light sidebar chrome; legends top-left | ✅ |
| GitHub repo + Pages hosting | ✅ |
| Provincial surficial (GeoAtlas) | [ ] Phase 1.3 |
| Mineral claims / tenure | [ ] Phase 2.1 |
| Indigenous lands / protected areas | [ ] Phase 2.2 / 2.3 |
| Infrastructure, geophysics, geochemistry | [ ] Phases 3–4 |
| Provenance panel, shareable URL, export | [ ] Phase 5 remainder |

**Public app:** https://kellybyron2222-dev.github.io/labrador-critical-minerals-explorer-v3/  
**Repo:** https://github.com/kellybyron2222-dev/labrador-critical-minerals-explorer-v3

### Recommended next steps (build sequence)

1. **Phase 1.3 — Provincial surficial geology** (`GeoAtlas/Surficial_Geology_All`)  
   Same playbook as 1.2 (inspect → lazy vector or WMS → legend + popup); closes Phase 1 exit criteria.
2. **Phase 2.1 — Mineral claims & tenure** (`GeoAtlas/Mineral_Lands`)  
   Turns the viewer into a siting tool (claims polygons, holder, status).
3. **Phase 2.2 — Indigenous lands** (Nunatsiavut / ATRIS)  
   High-priority permitting context; recommend default ON once styled as context.
4. **Then** Phase 2.3 protected/land use → Phase 3 infrastructure → Phase 4 signals → remaining Phase 5 polish.

Optional follow-ups on bedrock: SE Labrador detailed polygons (MapServer/16), 1:1M
faults/contacts (MapServer/1). Data refreshes: monthly GHA `refresh-data.yml`
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
- **Data:** GeoJSON via ArcGIS REST `f=geojson` queries; raster via WMS `GetMap`
  (reprojected client-side to Web Mercator)

**Module layout**
```
main.js                     app entry
js/app.js                   orchestrator (wires modules, popups, legend, filters)
js/config/mapConfig.js      map init constants (center, zoom, basemaps)
js/config/layerConfig.js    layer + WMS definitions (data sources, styling, legends)
js/config/modsFilters.js    MODS status buckets + combined filter helpers (F4/F5)
js/modules/MapBase.js       MapLibre init, controls, HUD, basemap switching
js/modules/LayerManager.js  async GeoJSON + WMS loading, visibility, refresh
js/modules/LegendPanel.js   dynamic per-layer legend cards (map, top-left)
js/modules/OccurrenceBrowser.js  KPI + search + status chips + list/detail (sidebar)
js/modules/SurfaceInterpolation.js  per-mineral, per-cluster occurrence-density surfaces
js/modules/wmsReprojection.js  equirectangular→Mercator canvas reprojection
js/modules/facilityIcons.js    value-chain SVG icons (lazy via styleimagemissing)
css/style.css               light sidebar + map overlay styling
.github/workflows/deploy-pages.yml  GitHub Pages CI deploy
```

**Capabilities already built (the hard plumbing is done):**
- Modular map base + basemap switching (Positron / Dark / Streets)
- Async layer loading; merged multi-endpoint GeoJSON fetch; **lazy vector**
  load-on-demand for heavy polygon layers (`lazy: true`)
- WMS image layers with client-side reprojection + lazy load + caching (NL&L bbox)
- Dynamic legends (vector / icon / WMS ArcGIS JSON multi-column / image fallback)
  with click-to-enlarge; pinned to the map's **top-left**
- Data-driven collapsible sidebar layer groups (`LAYER_GROUPS` + `group` metadata)
- **Light** sidebar chrome (white panel, shared type scale, toggle switches,
  segmented basemap, active-layer accent) — occurrence browser lives here too
- Occurrence browser (cherry-pick F1–F5): bottom KPI strip; status multi-select;
  free-text search; minimizable list + detail; map selection sync — live MODS only
- Value-chain icon system with maturity draw-ordering (`symbol-sort-key`)
- Popups + hover interactivity
- Public host via GitHub Pages (Actions build on push to `master`)

---

## 3. Current state (snapshot)

**Live layers**
- ✅ **Critical Mineral Facilities (National)** — NRCan vector feed, rendered as
  value-chain icons (exploration → advanced processing → mine → processing),
  maturity-ordered. Default ON.
- ✅ **Mineral Occurrences (MODS)** — NL GeoAtlas vector feed, ~3,175 Labrador
  points, paginated fetch, always rendered as zoom-scaled circles (no
  clustering/heatmap). Sidebar commodity picker scopes the view to one
  commodity or a critical-minerals preset (default; **iron excluded**).
  **Legend checklist** (multi-commodity views) toggles which primary minerals
  show circles; **Show occurrence density surfaces** master toggle adds
  per-mineral localized isoband shading (primary-only; default first 3
  minerals on). Single sidebar mineral pick still searches primary + secondary
  via `commodityList`. **Occurrence browser** ANDs status buckets + free-text
  search with the commodity filter; list/detail sync with map selection.
  Default ON.
- ✅ **Geoscience WMS feeds** (NRCan): Lithium, REE, Graphite prospectivity;
  Bedrock geology **(national)**; Surficial geology. Default OFF, lazy-loaded.
- ✅ **Bedrock Geology (NL 1:1M)** — GeoAtlas `Bedrock_Geology_All/MapServer/23`,
  ~3,510 polygons, lazy-loaded vector fill colored from source RGB; ArcGIS
  legend (~153 classes); unit popups. Default OFF. Drawn under MODS/facilities.

**UX shell (2026-07-11)**
- ✅ Light left sidebar (layers + basemap + occurrence search/status/list)
- ✅ Bottom KPI strip (filtered / scoped counts + status bits)
- ✅ Legend cards top-left on the map
- ✅ Deployed to GitHub Pages

**Removed (2026-07-06) — were hand-authored demo/synthetic data:**
- ❌ Mineral Deposits (demo) → replaced by MODS (✅ 2026-07-06, see Phase 1.1)
- ❌ Infrastructure (demo) → replace with NRCan/GeoAtlas transport & power
- ❌ Mining Tenures (demo) → replace with GeoAtlas Mineral Lands
- See `TODO (real data)` note in `js/config/layerConfig.js`.

**Explicitly not in V3 (revised merger guide):** featured-deposits JSON, B
commodity-group taxonomy, iron-in-critical default, static occurrences.geojson,
full mission-control dual-rail chrome.

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
| Surficial geology (provincial) | NL GeoAtlas | `GeoAtlas/Surficial_Geology_All` | 🟢 verified |
| Li / REE / graphite prospectivity | NRCan WMS | baked `public/data/wms-{lithium,ree,graphite}-nll.png` | ✅ in app (12-mo refresh) |
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
| Map-staked claims (real-time), tenure, historical claims, notices gazetted | NL GeoAtlas | `GeoAtlas/Mineral_Lands` | 🟢 verified |
| Quarry permits / leases | NL GeoAtlas | `GeoAtlas/Mineral_Lands` | 🟢 verified |

### 5. Who else has rights / what's constrained? — permitting reality
| Layer | Source | Endpoint / service | Status |
|---|---|---|---|
| Labrador Inuit Settlement Area (Nunatsiavut) | SAC-ISC / open.canada.ca | `geo.sac-isc.gc.ca/.../Region_inuite_Inuit_Region/MapServer/0` | 🟢 verified (GeoJSON) |
| Comprehensive land claims (incl. Innu of Labrador) | ATRIS | `geo.sac-isc.gc.ca/.../ATRIS_PRD/ATRIS_E_PC/MapServer/2` | 🟢 verified (GeoJSON) |
| Labrador Inuit / Innu settlement area shapefiles + park boundaries | labradorgeolab.ca | dataset ZIPs (Torngat, Mealy Mtns) | 🟢 verified (download) |
| Land use / Crown land zoning | NL GeoAtlas | `GeoAtlas/Land_Use` | 🟢 verified |
| Protected & conserved areas (national) | CPCAD (ECCC) | open.canada.ca | ⬜ to add |
| Caribou habitat / wildlife (permitting driver) | NL / ECCC | TBD | ⬜ later |

### 6. Can I physically develop it? — infrastructure
| Layer | Source | Endpoint / service | Status |
|---|---|---|---|
| Roads (Trans-Labrador Hwy, forest access) | NL GeoAtlas (Nat'l Road Network) | `GeoAtlas` transportation | 🟢 verified |
| Transmission lines (Churchill Falls, Muskrat Falls) | Nalcor/NL Hydro + CanVec | `GeoAtlas` (Nalcor Transmission Line) | 🟢 verified |
| Railways (iron-ore lines), ports, airstrips | NRCan CanVec | CanVec distribution | ⬜ to wire |
| Communities / settlements | CanVec / StatCan | open data | ⬜ to wire |

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
- [x] Critical Mineral Facilities layer (NRCan, 4 sublayers merged) live
- [x] 5 NRCan geoscience WMS layers (Li / REE / graphite / bedrock / surficial) live
- [x] Popup + hover interactivity framework
- [x] Remove demo data (deposits / infrastructure / tenures) + document TODO
- [x] Reframe sidebar around the mineral value chain
- [x] Author this master build plan

### Phase 1 — Endowment & occurrences  [~]
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

**1.1e — Occurrence browser UX cherry-pick (F1–F5 from B)** ✅ COMPLETE (2026-07-11)

Per `revised-merger-guide.canvas.tsx`: add B’s list/search/status/KPI UX onto
A’s live MapLibre explorer **without** importing B datasets or group taxonomy.

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
- [x] Bottom KPI strip: filtered / commodity-scoped totals + status bits
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

**1.3 — Provincial surficial geology (GeoAtlas)**  ← **NEXT**
- [ ] Repeat 1.2 steps for `GeoAtlas/Surficial_Geology_All`

**Phase 1 exit criteria:** MODS + provincial bedrock/surficial live; sidebar grouped;
demo-deposit gap fully replaced by real endowment + occurrence data.
*(MODS + grouping + occurrence UX + provincial bedrock done; 1.3 remains for exit.)*

### Phase 2 — Rights & constraints (turns viewer into a siting tool)  [ ]
**2.1 — Mineral claims & tenure**
- [ ] Inventory `GeoAtlas/Mineral_Lands` sublayers (map-staked claims, tenure, historical, notices gazetted, quarries)
- [ ] Add active claims (polygons) — style by status; group=Rights
- [ ] Popup: licence #, holder, issue/expiry, status, GEOFILE assessment link
- [ ] Optional: historical claims + notices-gazetted as separate toggles
- [ ] Legend + wiring + test + status

**2.2 — Indigenous lands (high priority context)**
- [ ] Nunatsiavut / Labrador Inuit Settlement Area (SAC-ISC Inuit Regions REST → geojson)
- [ ] Innu / comprehensive land claims (ATRIS layer 2), filtered to Labrador
- [ ] Style: distinct hatch/outline, subdued fill; ensure it reads as context not data
- [ ] Popup: name, agreement/year
- [ ] Decide default visibility (recommend ON as permitting context)
- [ ] Legend + wiring + test + status

**2.3 — Protected areas & land use**
- [ ] Parks: Torngat & Mealy Mtns (labradorgeolab ZIPs → convert to GeoJSON, or CPCAD REST)
- [ ] CPCAD national protected/conserved areas (filter to Labrador)
- [ ] `GeoAtlas/Land_Use` zoning
- [ ] Style + legend + toggles + test + status

**Phase 2 exit criteria:** user can see, for any spot, whether they can legally
work and what land constraints apply.

### Phase 3 — Infrastructure ("can I develop it?")  [ ]
**3.1 — Transport**
- [ ] Roads (Trans-Labrador Hwy + forest access) — `GeoAtlas` transportation
- [ ] Railways (iron-ore lines) — CanVec
- [ ] Ports / marine access — CanVec
- [ ] Airstrips / airports (remote camp access) — CanVec
**3.2 — Power**
- [ ] Transmission lines (Nalcor + CanVec)
- [ ] Generation (Churchill Falls, Muskrat Falls; Gull Island potential)
**3.3 — Communities**
- [ ] Settlements / populated places — CanVec / StatCan
- [ ] Each sub-item: config + style + popup + legend + test + status

**Phase 3 exit criteria:** logistics/infrastructure overlay complete enough to
reason about development feasibility.

### Phase 4 — Signals (heavier data)  [ ]
**4.1 — Geophysics**
- [ ] `GeoAtlas/Geophysics_Labrador` — inventory (aeromag / radiometric / gravity)
- [ ] Likely raster → WMS image path + reprojection; per-survey toggles
- [ ] Opacity control; legend
**4.2 — Geochemistry**
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
- [ ] `GeoAtlas/Geochemistry_All` — lake sediment / till points
- [ ] CMiO ore geochemistry (CMMI WFS) — optional advanced layer
- [ ] Style (graduated by element concentration), perf handling, legend
- [ ] Concentration-surface interpolation (IDW/kriging) once points are wired

**Phase 4 exit criteria:** subsurface signal layers available for prospectivity work.

### Phase 5 — Cross-cutting features & polish  [~]
- [ ] **Data-source registry** — per-layer provenance, update cadence, license, last-checked date (drive an "About data" panel)
- [~] **Layer search / filter** — commodity picker + legend checklist done (1.1b/d);
      status + free-text over live MODS done (1.1e). Still open: filter by NTS sheet alone;
      cross-layer search beyond MODS
- [ ] **Attribution / license panel** — required by NL GeoAtlas / NRCan / SAC-ISC terms
- [~] **Feature search / geocode** — occurrence list + flyTo/select done (1.1e);
      still open: jump to claim / NTS sheet / place geocode
- [ ] **Measure & draw tools** (distance/area) — exploration utility
- [ ] **Shareable state** — URL encodes active layers + extent + filters
- [ ] **Export** — visible features to GeoJSON/CSV
- [ ] **Performance pass** — tile/vector strategy for dense polygon layers (claims, geology)
- [~] **Mobile/responsive** sidebar — basic breakpoints exist; occurrence list hidden
      on very narrow screens; needs a deliberate mobile pass
- [~] **README** + contribution/data-adding guide — README updated for V3/Pages;
      full contributor playbook still open
- [x] **Public hosting** — GitHub Pages via Actions (2026-07-11)

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
| **Mineral Occurrences (MODS)** | ✅ Baked GeoJSON + IndexedDB (`fetch:mods`) | **3 mo** | see `mods-labrador.meta.json` |
| **Critical Mineral Facilities** | ✅ Baked NL&L GeoJSON + IndexedDB (`fetch:facilities`) | **3 mo** | see `critical-minerals-nl.meta.json` |
| **Li / REE / Graphite / national bedrock / surficial** | ✅ Baked Mercator PNG (`fetch:wms`) | **12 mo** | see `wms-*-nll.meta.json` |
| **MODS density surface** | Client Turf from loaded MODS | n/a (derived) | — |

Registry: `scripts/data-refresh-registry.json` (8 entries). Manual bakes:
`npm run fetch:bedrock` · `fetch:mods` · `fetch:facilities` · `fetch:wms`.

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
| 3 months | MODS, Critical Mineral Facilities | +3 months from `generatedAt` |
| 6 months | Bedrock Geology (NL 1:1M) | +6 months |
| 12 months | Five NRCan WMS PNG bakes | +12 months |

**Optional / one-off**
- Force every dataset now: Actions → **Refresh data sources** → Run workflow →
  force = `true` (or locally `FORCE_REFRESH=1 npm run refresh:data`).
- Bake one dataset locally: `npm run fetch:mods` (etc.), commit
  `public/data/*` + any `cacheVersion` change.
- Confirm Actions is enabled on the GitHub repo; scheduled crons only run from
  the **default branch**.

---

## 7. Architecture notes & decisions

- **Consumption pattern:** every source above is ArcGIS REST (`f=geojson`) or
  WMS — both already supported by `LayerManager`. New layers are mostly config,
  not new plumbing.
- **Layer grouping refactor (Phase 1.0):** move from flat `LAYER_CONFIG` to
  thematic groups (Endowment / Occurrences / Rights / Infrastructure / Signals /
  Base) with collapsible sidebar sections. Blocks nothing else; do it first.
- **Provincial vs national geology:** prefer GeoAtlas (provincial, hi-res) for
  Labrador; keep NRCan WMS as national fallback/context.
- **Performance:** MODS is ~thousands of points — plan clustering or
  scale-dependent display (mirror GeoAtlas: labels/detail only at larger zoom).
  *Resolved differently in practice (Phase 1.1/1.1b):* neither clustering nor
  a heatmap survived user feedback — settled on always-visible circles with a
  zoom-scaled radius, plus a commodity picker to manage visual density
  instead of a zoom-based data reduction. *(Phase 1.1c/1.1d)* added back a
  density-style regional view via per-mineral, per-cluster interpolated
  surfaces (Turf.js DBSCAN + IDW potential + isobands + polygonSmooth) rather
  than a heatmap, crossfaded out as circles reach full size. Surfaces and
  legend checkboxes use primary commodity only; sidebar single-mineral search
  still matches secondary associations.
- **CRS:** GeoAtlas/ArcGIS services are often EPSG:3978 or 26720/26721 (UTM
  NAD27 for MODS) — request GeoJSON (WGS84 / `outSR=4326`) to avoid reprojection
  headaches; use WMS reprojection util only for raster.
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
  **6 mo**. Prefer monthly GHA that skips until `nextDue`. Optimize priority:
  MODS → facilities → WMS images → then Phase 1.3 surficial on full playbook.
- **2026-07-11 (evening)** — Bedrock performance + auto-refresh documented in
  plan: load order IndexedDB → baked GeoJSON → live GeoAtlas; registry
  (`scripts/data-refresh-registry.json`); `npm run refresh:data`; GHA
  `refresh-data.yml` cron **1 Jan & 1 Jul UTC** opens a PR on change and bumps
  `cacheVersion`. Meta: `cadenceMonths` / `nextDue` / `contentHash`. **Next:**
  Phase 1.3 provincial surficial.
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
