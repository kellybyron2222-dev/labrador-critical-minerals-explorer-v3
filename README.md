# Labrador Critical Minerals Explorer — V3

A’s **MapLibre multi-layer explorer**, plus a small UX cherry-pick from
[labrador-critical-minerals](https://github.com/enesgrahovac/labrador-critical-minerals):
status filters, search, occurrence list/detail, and a KPI strip.

**No B datasets** — no featured deposits, no commodity groups, no static GeoJSON.
Live ArcGIS MODS remains the source of truth. Critical preset still excludes iron.

## Relationship to other versions

| Version | Path / repo | Role |
|---------|-------------|------|
| **A (V1)** | `../project` | Untouched baseline — keep as reference |
| **B** | [enesgrahovac/labrador-critical-minerals](https://github.com/enesgrahovac/labrador-critical-minerals) | UX reference only (list / search / status / KPIs) |
| **V3 (this repo)** | `explorer-v3` | Active development |

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

## Merger guide

[`revised-merger-guide.canvas.tsx`](C:/Users/byron/.cursor/projects/c-Developer-Critical-Minerals-explorer-v3/canvases/revised-merger-guide.canvas.tsx)
