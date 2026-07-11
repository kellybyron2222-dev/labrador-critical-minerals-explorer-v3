# Labrador Critical Minerals Explorer — V3

Blended product: the **MapLibre multi-layer explorer** (local V1) plus **mission-control occurrence UX** (flagship deposits, KPIs, searchable list, status/group filters) from [labrador-critical-minerals](https://github.com/enesgrahovac/labrador-critical-minerals).

**Real public data only** — no demo/placeholder geography.

## Relationship to other versions

| Version | Path / repo | Role |
|---------|-------------|------|
| **A (V1)** | `../project` | Untouched baseline — keep as reference |
| **B** | [enesgrahovac/labrador-critical-minerals](https://github.com/enesgrahovac/labrador-critical-minerals) | Mission-control UX + featured enrichment reference |
| **V3 (this repo)** | `explorer-v3` | Active development — blend of A architecture + B UX |

Started as a clean copy of A. Blend work happens here only.

## Run

```bash
npm install
npm run dev
```

## Stack (inherited from A)

- Vite 5 + vanilla ES modules
- MapLibre GL JS
- Turf.js (occurrence density surfaces)
- Live NL GeoAtlas MODS + NRCan facilities / WMS

## Status

Scaffold only — same capabilities as A until blend phases land. See `BUILD_PLAN.md` and the version-blend proposal canvas for the V3 roadmap.
