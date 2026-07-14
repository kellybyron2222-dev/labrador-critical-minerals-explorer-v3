# Labrador Critical Minerals Explorer

Open, Labrador-focused map for critical-minerals exploration and siting: geology,
occurrences (MODS), mineral rights, land constraints, infrastructure, and
geophysics (aeromag / 1VD) — built on public government data.

**Live app:** https://kellybyron2222-dev.github.io/labrador-critical-minerals-explorer-v3/

## What’s in the app today

- **Geological endowment** — provincial bedrock & surficial (GeoAtlas), national
  GSC context WMS, NRCan commodity prospectivity models
- **Occurrences & activity** — Labrador MODS (~3k points), commodity picker,
  status filters, search/list, optional density surfaces
- **Rights & constraints** — map-staked claims (expiry bands), mineral tenure,
  Nunatsiavut, ATRIS, CPCAD, land use; **Hard exclusions** preset (parks +
  protected water supplies only)
- **Infrastructure** — roads (highway/collector + resource access), rail,
  HV transmission (Nalcor + CanVec; no distribution), ports, airports, power
  generation, communities & municipal boundaries; NRCan mines / processing /
  advanced exploration / development (default off); curated Labrador inventory
  audited vs CFS/Wikipedia airports (16) + harbours (10) + communities (21);
  one Infrastructure legend; MODS popup shows nearest road / transmission /
  port distances
- **UX** — collapsible layer groups, first-visit welcome, Settings (KPI / About /
  multi-format export ZIP / waitlist / feedback / share link), Plausible
  analytics, mobile map-first chrome, bake-first data + monthly refresh CI
- **Signals (Phase 4.1)** — regional aeromag + detailed-survey 1VD, radiometrics
  (eU / eTh / K), NRCan Canada 2 km Bouguer gravity, airborne survey footprints
  (full index; filter by survey type + digital availability; popup → NL detail
  page); raster opacity, grayscale mode, mutual exclusion.

**Stage A engineering gate met.** Stage B0 soft-launch eng (welcome, capture,
analytics, shareable views, multi-layer export) is in the app. Next: Stage B
outreach (NLPA) + configure Formspree IDs in `.env`.

## Soft-launch config

Copy `.env.example` → `.env` and set:

- `VITE_FORMSPREE_WAITLIST` — Formspree form id for “Stay updated”
- `VITE_FORMSPREE_FEEDBACK` — Formspree form id for feedback
- `VITE_PLAUSIBLE_DOMAIN` — defaults to the GitHub Pages host

Privacy-light analytics via Plausible (no fingerprinting). Export packages are
WGS 84 / EPSG:4326 (CRS84 lon-lat); see Settings → About / Export.

## Docs

| Doc | Role |
|-----|------|
| [`BUILD_PLAN.md`](./BUILD_PLAN.md) | Engineering checklist (layers, phases, data pipeline) |
| [`PRODUCT_PLAN.md`](./PRODUCT_PLAN.md) | Product arc: free Labrador MVP → marketing → premium → national |

## Run

```bash
npm install
npm run dev
```

Other useful scripts:

```bash
npm test                 # Vitest
npm run validate:data    # Bake integrity vs registry
npm run refresh:data     # Registry-driven data refresh (respects nextDue)
```

## Stack

- Vite 5 + vanilla ES modules
- MapLibre GL JS
- Turf.js (occurrence density surfaces)
- Baked GeoJSON / WMS under `public/data/` → IndexedDB → live ArcGIS REST/WMS fallback
- GitHub Actions: Pages deploy + monthly data refresh PRs

## Data principles

- **Open & free** — authoritative public sources (NL GeoAtlas, NRCan, CIRNAC/ISC)
- **Bake-first** — fast cold loads; live services as fallback
- **Labrador-deep** — mainland clip for rights layers; regionally useful detail
- **Provenance-aware** — Settings → About data; full registry panel still on the Phase 5 remainder list

## Status

Phases **0–4.1** complete; **Stage B0** soft-launch UX (welcome, Plausible,
waitlist/feedback hooks, shareable URL, multi-layer export ZIP) shipped.
**Next:** Stage B outreach + Formspree credentials. Phase **4.2** geochem stays
post-MVP. See [`BUILD_PLAN.md`](./BUILD_PLAN.md) for the live checklist.
