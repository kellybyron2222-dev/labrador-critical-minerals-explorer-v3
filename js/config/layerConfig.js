/** Module 2: GeoJSON and WMS layer configuration */

import { facilityIconDataUri } from '../modules/facilityIcons.js';

// This project is Labrador/NL-scoped, so national feeds are visually clipped
// to this region (the underlying data/query is untouched - only what's
// requested/rendered on screen is limited). See BUILD_PLAN.md.
const NL_LABRADOR_PROVINCE_NAME = 'Newfoundland and Labrador';

const NRCAN_REST_BASE = 'https://maps-cartes.services.geo.ca/server_serveur/rest/services/NRCan';
const CRITICAL_MINERALS_FIELDS =
  'PropertyNameEN,OperatorOwnersEN,ProvincesEN,CommoditiesEN,DevelopmentStageEN,ActivityStatusEN,OperationGroupEN,Website';

const GEOATLAS_REST_BASE = 'https://dnrmaps.gov.nl.ca/arcgis/rest/services/GeoAtlas';

// GeoAtlas/Map_Layers/MapServer/3 = "Mineral Occurrences (MODS)". Field names
// are the raw MS-Access column names from the source database - note COMNAME
// is actually the *primary commodity* (e.g. "Gold", "Copper"), not a place
// name; DEPNAME is the human-readable deposit/occurrence name. maxRecordCount
// is 1000, and Labrador alone is ~3,173 features, so LayerManager paginates
// via resultOffset/resultRecordCount until a short page is returned.
const MODS_FIELDS =
  'NMINO,DEPNAME,COMNAME,COMMODS,STATUS,DEPDESC,OREMIN,GANGUE,WORKING,DDH,TRENCH,ADIT,NTS';

// Colors keyed on COMNAME (primary commodity), curated from the actual
// frequency distribution of Labrador MODS records (queried 2026-07-06 against
// the full 3,173-feature Labrador set, primary + secondary commodity fields).
// Li/REE/graphite share a hue family with the matching NRCan prospectivity
// WMS layers (wms-lithium/wms-ree/wms-graphite) so occurrences visually
// connect back to the endowment layers that predict them.
const MODS_COMMODITY_COLORS = {
  'Iron': '#ef4444',
  'Copper': '#f97316',
  'Nickel': '#22c55e',
  'Zinc': '#0ea5e9',
  'Lead': '#6366f1',
  'Manganese': '#ec4899',
  'Uranium': '#84cc16',
  'Titanium': '#38bdf8',
  'Molybdenum': '#14b8a6',
  'Gold': '#eab308',
  'Silver': '#cbd5e1',
  'Cobalt': '#2563eb',
  'Vanadium': '#f43f5e',
  'Fluorine': '#22d3ee',
  'Graphite': '#4b5563',
  'Lithium': '#00ff88',
  'Rare Earth Elements': '#7c3aed',
  'Yttrium': '#c084fc',
  'Zirconium': '#fb923c',
  'Beryl': '#5eead4',
  'Beryllium': '#5eead4',
  'Kyanite': '#3b82f6',
  'Labradorite': '#a78bfa',
  'Pyrite': '#78716c',
  'Pyrrhotite': '#a8a29e',
  'Niobium': '#0891b2',
  'Platinum': '#94a3b8',
  'Chromium': '#65a30d',
  'Palladium': '#e879f9',
  'Thorium': '#fb7185'
};
const MODS_DEFAULT_COLOR = '#9ca3af';

// Development-stage size ramp - larger circle = more advanced/economically
// proven (mirrors the maturity grammar used for the facilities icon layer).
const MODS_STATUS_RADIUS = {
  'Producer': 9,
  'Past Producer (Dormant)': 8,
  'Past Producer (Exhausted)': 8,
  'Developed Prospect': 7,
  'Prospect': 6,
  'Showing': 5,
  'Indication': 4.5
};
const MODS_DEFAULT_RADIUS = 4.5;

// Curated subset for the legend card in "All commodities" mode (full palette
// above has ~30 entries; this covers what shows up with meaningful frequency
// in Labrador, keeping the enlarged-legend list readable).
const MODS_LEGEND_COMMODITIES = [
  'Iron', 'Copper', 'Nickel', 'Zinc', 'Lead', 'Manganese', 'Uranium',
  'Gold', 'Graphite', 'Lithium', 'Rare Earth Elements', 'Labradorite',
  'Pyrite', 'Pyrrhotite'
];

// Canada's official Critical Minerals List (34 minerals, most recently
// updated June 2024 - see canada.ca/critical-minerals), filtered down to the
// commodities that actually appear (primary or secondary) in Labrador MODS
// records, sorted by combined occurrence count (queried 2026-07-06).
// Deliberately EXCLUDES three commodities that are technically on the
// official list but where MODS occurrence records don't carry the
// grade/purity qualifier the list specifies: "Iron" (official list item is
// "high-purity iron ore" specifically), "Phosphorus" and "Silicon metal"
// (1 Labrador MODS record each, no purity data). Those remain available
// individually as "Other notable commodities" below.
// Name mapping vs. the official list: Fluorine here = Fluorspar; Platinum +
// Palladium here = Platinum Group Metals (only 2 of 6 PGMs appear in MODS).
const MODS_CRITICAL_MINERALS_PRESET = [
  'Copper', 'Nickel', 'Uranium', 'Cobalt', 'Manganese', 'Titanium', 'Zinc',
  'Molybdenum', 'Rare Earth Elements', 'Fluorine', 'Niobium', 'Graphite',
  'Vanadium', 'Platinum', 'Chromium', 'Palladium'
];

// High-count or exploration-notable commodities that aren't on Canada's
// official critical minerals list, offered as individual picker options
// alongside the preset (see MODS_CRITICAL_MINERALS_PRESET comment above for
// why "Iron" specifically lives here instead of the preset).
const MODS_OTHER_NOTABLE_COMMODITIES = [
  'Iron', 'Gold', 'Silver', 'Lead', 'Zirconium', 'Yttrium', 'Pyrite',
  'Pyrrhotite', 'Thorium', 'Labradorite'
];

const MODS_PICKER_PRESET_CRITICAL = 'preset:critical';
const MODS_PICKER_ALL = 'all';

/** Sidebar dropdown structure for the MODS commodity picker (see app.js). */
const MODS_COMMODITY_PICKER = {
  defaultValue: MODS_PICKER_PRESET_CRITICAL,
  groups: [
    {
      label: 'Presets',
      options: [
        { value: MODS_PICKER_PRESET_CRITICAL, label: "Critical Minerals (Canada's official list)" },
        { value: MODS_PICKER_ALL, label: 'All commodities' }
      ]
    },
    {
      label: 'Critical minerals',
      options: MODS_CRITICAL_MINERALS_PRESET.map((c) => ({ value: c, label: c }))
    },
    {
      label: 'Other notable commodities',
      options: MODS_OTHER_NOTABLE_COMMODITIES.map((c) => ({ value: c, label: c }))
    }
  ]
};

/**
 * Resolves a picker value to the concrete commodity list it represents (or
 * `null` for "All", meaning "no filter"). Single source of truth for both
 * the MapLibre filter expression below and the plain-JS filtering the
 * occurrence-density surface needs (SurfaceInterpolation runs in JS on the
 * raw loaded features, not through a MapLibre expression).
 */
export function resolveMODSCommodities(value) {
  if (value === MODS_PICKER_ALL) return null;
  return value === MODS_PICKER_PRESET_CRITICAL ? MODS_CRITICAL_MINERALS_PRESET : [value];
}

/**
 * MapLibre filter expression for the MODS circle layer given a picker value.
 * Matches against `commodityList` (see LayerManager.loadLayer), a normalized
 * array combining each feature's primary (COMNAME) and secondary (COMMODS)
 * commodities, so e.g. selecting "Nickel" also surfaces occurrences where
 * nickel is a secondary/associated commodity, not just the primary one.
 */
export function buildMODSCommodityFilter(value) {
  const commodities = resolveMODSCommodities(value);
  if (!commodities) return null;
  if (commodities.length === 1) {
    return ['in', commodities[0], ['get', 'commodityList']];
  }
  return ['any', ...commodities.map((c) => ['in', c, ['get', 'commodityList']])];
}

/** Plain-JS predicate matching `buildMODSCommodityFilter` above, for filtering raw features before interpolation (SurfaceInterpolation can't evaluate MapLibre expressions). */
export function featureMatchesMODSCommodity(feature, value) {
  const commodities = resolveMODSCommodities(value);
  if (!commodities) return true;
  const featureCommodities = feature.properties.commodityList || [];
  return commodities.some((c) => featureCommodities.includes(c));
}

/** True when the occurrence's primary commodity (`primaryCommodity` / COMNAME) is `commodity`. */
export function featureBelongsToCommodity(feature, commodity) {
  const primary = feature.properties?.primaryCommodity || feature.properties?.COMNAME;
  return primary === commodity;
}

/**
 * MapLibre filter combining the sidebar picker scope with the legend's
 * per-mineral checkboxes. Unchecked minerals hide both circles and surfaces.
 *
 * @param {string} pickerValue
 * @param {string[]} enabledCommodities
 * @param {{ primaryOnly?: boolean }} [options] - legend checklist uses primary
 *   commodity only; single sidebar mineral pick uses commodityList (primary +
 *   secondary) for broader search.
 */
export function buildMODSEnabledCommodityFilter(pickerValue, enabledCommodities, options = {}) {
  if (!enabledCommodities?.length) {
    return ['in', ['get', 'NMINO'], ['literal', []]];
  }

  const primaryOnly = options.primaryOnly !== false;
  const primaryField = 'primaryCommodity';

  const enabledFilter = primaryOnly
    ? enabledCommodities.length === 1
      ? ['==', ['get', primaryField], enabledCommodities[0]]
      : ['in', ['get', primaryField], ['literal', enabledCommodities]]
    : enabledCommodities.length === 1
      ? ['in', enabledCommodities[0], ['get', 'commodityList']]
      : ['any', ...enabledCommodities.map((c) => ['in', c, ['get', 'commodityList']])];

  const pickerFilter = buildMODSCommodityFilter(pickerValue);
  if (!pickerFilter) return enabledFilter;
  return ['all', pickerFilter, enabledFilter];
}

/**
 * MapLibre `circle-color` paint value for a picker value. "All" and the
 * critical-minerals preset keep the primary-commodity match expression (so
 * different minerals stay visually distinguishable within the filtered set);
 * a single-commodity selection uses one flat color, since the filter above
 * already guarantees every visible point matches that commodity (whether as
 * its primary or secondary commodity) - using the primary-commodity match
 * there would mis-color points where the selected commodity is secondary.
 */
export function buildMODSColorExpression(value) {
  if (value === MODS_PICKER_ALL || value === MODS_PICKER_PRESET_CRITICAL) {
    return [
      'match',
      ['get', 'primaryCommodity'],
      ...Object.entries(MODS_COMMODITY_COLORS).flat(),
      MODS_DEFAULT_COLOR
    ];
  }
  return MODS_COMMODITY_COLORS[value] || MODS_DEFAULT_COLOR;
}

// Fallback hue for surface polygons whose `commodity` property is missing
// from MODS_COMMODITY_COLORS (should be rare after normalizeCommodityName).
const MODS_SURFACE_DEFAULT_COLOR = '#f97316';

/** How many minerals get density surfaces enabled by default in multi-commodity views. */
export const MODS_SURFACE_DEFAULT_COUNT = 3;

/**
 * Data-driven fill/line color for occurrence-density surfaces - each polygon
 * is tagged with `commodity` in SurfaceInterpolation, so multi-mineral
 * overlays stay distinguishable without a flat blended color.
 */
export function buildMODSSurfaceColorExpression() {
  return [
    'match',
    ['get', 'commodity'],
    ...Object.entries(MODS_COMMODITY_COLORS).flat(),
    MODS_SURFACE_DEFAULT_COLOR
  ];
}

/** Color swatch for a commodity (legend surface toggles / UI). */
export function resolveMODSCommodityColor(commodity) {
  return MODS_COMMODITY_COLORS[commodity] || MODS_SURFACE_DEFAULT_COLOR;
}

/**
 * Commodity rows for the MODS legend checklist given the current picker value.
 * "All" uses the curated legend subset (not every rare COMNAME); presets and
 * single selections use resolveMODSCommodities.
 */
export function resolveMODSLegendCommodities(value) {
  if (value === MODS_PICKER_ALL) return [...MODS_LEGEND_COMMODITIES];
  const commodities = resolveMODSCommodities(value);
  return commodities ? [...commodities] : [...MODS_LEGEND_COMMODITIES];
}

/** @deprecated Use resolveMODSLegendCommodities */
export function resolveMODSSurfaceToggleCommodities(value) {
  return resolveMODSLegendCommodities(value);
}

/** Legend rows to show for the current picker selection. */
export function buildMODSLegendItems(value) {
  if (value === MODS_PICKER_ALL) {
    return MODS_LEGEND_COMMODITIES.map((c) => ({ label: c, color: MODS_COMMODITY_COLORS[c] }));
  }
  const commodities = value === MODS_PICKER_PRESET_CRITICAL ? MODS_CRITICAL_MINERALS_PRESET : [value];
  return commodities
    .filter((c) => MODS_COMMODITY_COLORS[c])
    .map((c) => ({ label: c, color: MODS_COMMODITY_COLORS[c] }));
}

/** Human-readable label for the legend title / current selection. */
export function modsCommodityPickerLabel(value) {
  if (value === MODS_PICKER_ALL) return 'All commodities';
  if (value === MODS_PICKER_PRESET_CRITICAL) return "Critical Minerals (Canada's official list)";
  return value;
}

/**
 * `circle-radius` for MODS: development-stage size ramp, scaled by zoom so
 * points shrink-but-stay-visible at the ~300km regional view and grow to
 * full size once zoomed into a district. MapLibre's style spec only allows a
 * `["zoom"]` expression as the direct input to a top-level `interpolate`/
 * `step` (nesting it inside e.g. `['*', interpolate(zoom), match(status)]`
 * fails validation and silently drops the whole layer) - so the status
 * match has to live *inside* each zoom stop's output instead.
 */
function buildMODSRadiusExpression() {
  const statusMatch = ['match', ['get', 'STATUS'], ...Object.entries(MODS_STATUS_RADIUS).flat(), MODS_DEFAULT_RADIUS];
  const zoomFactorStops = [
    [4, 0.35],
    [6, 0.55],
    [9, 1],
    [12, 1.3]
  ];

  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    ...zoomFactorStops.flatMap(([zoom, factor]) => [zoom, ['*', factor, statusMatch]])
  ];
}

// The dataset is split across 4 sub-layers (mines, processing facilities,
// advanced processing/exploration projects) - ~290 features total, well
// under this service's per-query record limit, so no pagination is needed.
const CRITICAL_MINERALS_SOURCES = [0, 1, 2, 3].map(
  (layerIndex) =>
    `${NRCAN_REST_BASE}/critical_minerals_en/MapServer/${layerIndex}/query` +
    `?where=1%3D1&outFields=${CRITICAL_MINERALS_FIELDS}&f=geojson`
);

/** Thematic sidebar groups — order defines display sequence in the UI. */
export const LAYER_GROUP_ORDER = [
  'endowment',
  'occurrences',
  'rights',
  'infrastructure',
  'signals',
  'base'
];

export const LAYER_GROUPS = {
  endowment: {
    title: 'Geological Endowment',
    hint: 'Prospectivity and geology layers from NRCan (NL&L view)',
    defaultExpanded: true
  },
  occurrences: {
    title: 'Occurrences & Activity',
    hint: 'MODS mineral occurrences, mines, facilities & advanced projects',
    defaultExpanded: true
  },
  rights: {
    title: 'Rights & Constraints',
    hint: 'Mineral tenure, Indigenous lands, protected areas',
    defaultExpanded: false
  },
  infrastructure: {
    title: 'Infrastructure',
    hint: 'Roads, rail, power, ports & communities',
    defaultExpanded: false
  },
  signals: {
    title: 'Geophysical & Geochemical Signals',
    hint: 'Subsurface survey and sample data',
    defaultExpanded: false
  },
  base: {
    title: 'Base Context',
    hint: 'Topography, hydrography & reference grids',
    defaultExpanded: false
  }
};

/*
 * TODO (real data): the original `deposits`, `infrastructure`, and `tenures`
 * layers were hand-authored demo/synthetic GeoJSON (perfectly rectangular
 * claim polygons, round-number coordinates, real deposit names plotted in the
 * wrong places, e.g. Schaft Creek). They were removed on 2026-07-06.
 * `deposits` has since been replaced by the real MODS occurrences layer below
 * (Phase 1.1, 2026-07-06). Still to replace with authoritative sources:
 *   - Mining tenures     -> GeoAtlas/Mineral_Lands (map-staked claims, tenure)
 *                          (Phase 2.1).
 *   - Infrastructure     -> NRCan/StatCan transmission, rail, road & port
 *                          open-data layers (Phase 3).
 *
 * The map is organized around the mineral value chain: geological endowment
 * (prospectivity/geology WMS feeds) -> occurrences (MODS) -> human activity
 * (the live NRCan critical-minerals facilities layer), encoded by
 * development maturity.
 */
export const LAYER_CONFIG = {
  geoatlasBedrock: {
    group: 'endowment',
    sidebarLabel: 'Bedrock Geology (NL 1:1M)',
    indicatorClass: 'geoatlasBedrock',
    source: 'geoatlas-bedrock-source',
    layer: 'geoatlas-bedrock-fill',
    outline: 'geoatlas-bedrock-outline',
    // Heavy polygon layer (~3,510 features) — fetch only when first toggled on.
    lazy: true,
    visible: false,
    enrichment: 'bedrockRgb',
    // Baked GeoJSON (npm run fetch:bedrock). IndexedDB keyed by cacheVersion.
    dataUrl: './data/geoatlas-bedrock-1m.geojson',
    cacheKey: 'geoatlas-bedrock-1m',
    // Bump when regenerating public/data/geoatlas-bedrock-1m.geojson
    cacheVersion: '2026-07-11',
    // Insert below MODS / surfaces / facilities so endowment stays under points.
    beforeLayerIds: [
      'mods-surface-fill',
      'mods-surface-outline',
      'mods-layer',
      'critical-minerals-layer'
    ],
    // Live GeoAtlas fallback if the static file is missing (dev / first clone).
    paginatedQuery: {
      url: `${GEOATLAS_REST_BASE}/Bedrock_Geology_All/MapServer/23/query`,
      where: '1=1',
      outFields: 'LABEL,LITHOLOGY,AGE,TECTONIC,REFERENCE,RED,GREEN,BLUE',
      // Required: without this, coords arrive in NF_GNL1_NAD27 meters and
      // polygons never appear on the MapLibre WGS84 basemap.
      outSR: 4326,
      // GeoAtlas returns empty FeatureCollection for f=geojson&outSR=4326;
      // f=json works — LayerManager converts Esri rings → GeoJSON.
      format: 'esrijson',
      // Degrees in outSR=4326; cuts transfer time ~10× vs full vertices.
      maxAllowableOffset: 0.002,
      pageSize: 200,
      concurrency: 4
    },
    paint: {
      fill: {
        'fill-color': ['get', 'fillColor'],
        'fill-opacity': 0.5,
        'fill-outline-color': 'rgba(30, 41, 59, 0.15)'
      },
      line: {
        'line-color': 'rgba(30, 41, 59, 0.35)',
        'line-width': 0.4,
        'line-opacity': 0.7
      }
    },
    legendTitle: 'Bedrock Geology (NL 1:1M)',
    legendShape: 'icon',
    legendNote: 'Provincial 1:1M bedrock units (NL GeoAtlas). Colors from source RGB.',
    // Same ArcGIS legend JSON pattern as NRCan WMS — ~153 classification rows.
    legendJsonUrl: `${GEOATLAS_REST_BASE}/Bedrock_Geology_All/MapServer/legend?f=json`,
    legendLayerId: 23
  },
  criticalMinerals: {
    group: 'occurrences',
    sidebarLabel: 'Critical Mineral Facilities',
    indicatorClass: 'criticalMinerals',
    source: 'critical-minerals-source',
    layer: 'critical-minerals-layer',
    // No `labels` key - ~290 national points would clutter the map; details
    // are shown via click popup instead (see bindInteractions in app.js).
    // Baked NL&L subset (npm run fetch:facilities). Live `sources` = fallback.
    dataUrl: './data/critical-minerals-nl.geojson',
    cacheKey: 'critical-minerals-nl',
    cacheVersion: '2026-07-11',
    sources: CRITICAL_MINERALS_SOURCES,
    visible: true,
    // Data stays national on live fallback - only what's drawn is
    // scoped to NL&L, since 'ProvincesEN' can list multiple provinces for
    // cross-boundary projects, hence a substring ('in') check rather than '=='.
    // Baked file is already NL-filtered; filter remains harmless.
    filter: ['in', NL_LABRADOR_PROVINCE_NAME, ['get', 'ProvincesEN']],
    icon: {
      field: 'OperationGroupEN',
      mapping: {
        'Mines and other primary producing sites': 'mine',
        'Processing': 'processing',
        'Advanced processing project': 'advancedProcessing',
        'Advanced exploration project': 'advancedExploration'
      },
      default: 'default',
      size: 0.75,
      // Maturity encoding: MapLibre draws higher symbol-sort-key values last
      // (on top), so operating sites sit above earlier-stage pipeline projects
      // where markers overlap - the eye is drawn to what's producing today.
      sortKey: {
        field: 'OperationGroupEN',
        mapping: {
          'Advanced exploration project': 1,
          'Advanced processing project': 2,
          'Mines and other primary producing sites': 3,
          'Processing': 4
        },
        default: 0
      }
    },
    legendTitle: 'Critical Mineral Value Chain',
    legendShape: 'icon',
    // Ordered upstream -> downstream / pipeline -> operating (maturity ladder).
    legend: [
      { label: 'Exploration — advanced project', icon: facilityIconDataUri('advancedExploration') },
      { label: 'Development — advanced processing', icon: facilityIconDataUri('advancedProcessing') },
      { label: 'Producing — mine / primary producer', icon: facilityIconDataUri('mine') },
      { label: 'Producing — processing / refinery', icon: facilityIconDataUri('processing') }
    ]
  },
  modsOccurrences: {
    group: 'occurrences',
    sidebarLabel: 'Mineral Occurrences (MODS)',
    indicatorClass: 'modsOccurrences',
    source: 'mods-source',
    layer: 'mods-layer',
    visible: true,
    // Baked Labrador GeoJSON (npm run fetch:mods). IndexedDB after first hit;
    // live paginatedQuery is fallback only.
    dataUrl: './data/mods-labrador.geojson',
    cacheKey: 'mods-labrador',
    cacheVersion: '2026-07-11',
    // ~3,173 Labrador points, always rendered as commodity-colored circles at
    // every zoom (no heatmap, no clustering - see BUILD_PLAN.md Phase 1.1b).
    // `commodityPicker` drives a sidebar dropdown (app.js) that sets a
    // MapLibre filter + circle-color override at runtime; defaults to the
    // critical-minerals preset so the map isn't overwhelming on first load.
    commodityPicker: MODS_COMMODITY_PICKER,
    paginatedQuery: {
      url: `${GEOATLAS_REST_BASE}/Map_Layers/MapServer/3/query`,
      where: "REGION='Labrador'",
      outFields: MODS_FIELDS
    },
    paint: {
      circle: {
        'circle-color': buildMODSColorExpression(MODS_COMMODITY_PICKER.defaultValue),
        // Status ramp (economic maturity) scaled by a zoom factor so points
        // shrink but stay visible at the ~300km regional view (zoom 4-6)
        // rather than disappearing, and grow toward full size once zoomed
        // into a district (zoom 9+). See buildMODSRadiusExpression() above.
        'circle-radius': buildMODSRadiusExpression(),
        'circle-stroke-width': 1,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.85
      }
    },
    legendTitle: `MODS — ${modsCommodityPickerLabel(MODS_COMMODITY_PICKER.defaultValue)}`,
    legendShape: 'circle',
    legend: buildMODSLegendItems(MODS_COMMODITY_PICKER.defaultValue),
    legendNote: 'Dot color = primary commodity. Check minerals to show circles; surface toggle adds localized density shading (primary-only). Sidebar single-mineral search also finds secondary associations.',
    // Occurrence-density "surface" (Phase 1.1c) - see SurfaceInterpolation.js.
    // Per-mineral, per-cluster isobands (Turf.js IDW + DBSCAN + polygonSmooth),
    // recomputed for enabled commodities when the picker or surface toggles
    // change. Deliberately qualitative: MODS has no grade/tonnage field.
    surface: {
      enabled: true,
      defaultVisible: true,
      source: 'mods-surface-source',
      fillLayer: 'mods-surface-fill',
      lineLayer: 'mods-surface-outline',
      // Lowest isoband tier is the "background" band - hide it so what
      // renders reads as contoured blobs hugging real clusters.
      minTierToRender: 1,
      tierCount: 5,
      // Softer outer tiers + thinner outlines so edges feel less "cut".
      // Fades out over the same band the circle layer fades *in* across
      // (zoom 6->9, see buildMODSRadiusExpression).
      fillOpacityByTier: [0, 0.08, 0.16, 0.28, 0.4],
      lineOpacityByTier: [0, 0.15, 0.25, 0.4, 0.55]
    }
  }
};

/**
 * NRCan WMS host. This ArcGIS WMS service only advertises CRS:84 / EPSG:4326 /
 * EPSG:3978 in its capabilities (no EPSG:3857), so these layers are fetched as
 * single georeferenced images (MapLibre `image` source) rather than an
 * EPSG:3857 XYZ tile grid, which this server rejects outright.
 */
export const WMS_BASE_URL = 'https://maps-cartes.services.geo.ca/server_serveur/services/NRCan';

function wmsLegendUrl(service, layer) {
  const params = new URLSearchParams({
    service: 'WMS',
    request: 'GetLegendGraphic',
    version: '1.3.0',
    format: 'image/png',
    layer
  });
  return `${WMS_BASE_URL}/${service}/MapServer/WMSServer?${params.toString()}`;
}

/**
 * ArcGIS REST `legend` resource - returns each legend row as real text
 * (`label`) plus a small swatch (`imageData`, base64 PNG), rather than one
 * big raster picture like GetLegendGraphic. Some of these classifications
 * run to 100+ rows (e.g. bedrock geology), which is illegible as a single
 * baked-in image but renders and wraps into CSS columns fine as real DOM
 * text. `legendLayerId` is the REST MapServer sub-layer id for the actual
 * thematic classification (NOT necessarily the same index as the WMS
 * `layers` param above - REST and WMS number sub-layers independently).
 */
function arcgisLegendJsonUrl(service) {
  return `${NRCAN_REST_BASE}/${service}/MapServer/legend?f=json`;
}

// [west, south, east, north] in CRS:84 (lon/lat order).
// Kept for reference / possible future national-context layers - no longer
// used by WMS_CONFIG below now that this project is Labrador/NL-scoped.
export const CANADA_BOUNDS = [-141, 41, -52, 75];

// NL&L-only request/render window (with a small margin), replacing the old
// Canada-wide bbox for all WMS GetMap requests. This is purely a display/
// fetch-window change - the source services and data are untouched. Two
// compounding wins: (1) a far smaller image to fetch/reproject/serialize per
// toggle, and (2) since the same pixel width now covers ~1/5 the longitude
// span, effective resolution over Labrador goes up ~3x. Also drops the max
// latitude from 75 to 61, reducing Mercator stretch (and thus reprojection
// error) since NL&L doesn't reach anywhere near the old national cap.
export const NL_LABRADOR_BOUNDS = [-68, 46, -52, 61];

// Note: mines/processing facilities are served as a vector point layer
// (see `criticalMinerals` in LAYER_CONFIG above) rather than a WMS image -
// point symbols in a raster overlay don't rescale with zoom the way vector
// circles do, and it would duplicate the Data Layers section.
export const WMS_CONFIG = {
  lithium: {
    group: 'endowment',
    indicatorClass: 'wms-lithium',
    label: 'Lithium Prospectivity',
    service: 'pegmatite_lithium_en',
    layers: '0',
    bounds: NL_LABRADOR_BOUNDS,
    opacity: 0.65,
    visible: false,
    // Baked Mercator-corrected NL&L image (npm run fetch:wms). Live GetMap = fallback.
    imageUrl: './data/wms-lithium-nll.png',
    cacheKey: 'wms-lithium-nll',
    cacheVersion: '2026-07-11',
    legendUrl: wmsLegendUrl('pegmatite_lithium_en', '0'),
    legendJsonUrl: arcgisLegendJsonUrl('pegmatite_lithium_en'),
    legendLayerId: 0
  },
  ree: {
    group: 'endowment',
    indicatorClass: 'wms-ree',
    label: 'REE Prospectivity',
    service: 'carbonatite_ree_en',
    layers: '0',
    bounds: NL_LABRADOR_BOUNDS,
    opacity: 0.65,
    visible: false,
    imageUrl: './data/wms-ree-nll.png',
    cacheKey: 'wms-ree-nll',
    cacheVersion: '2026-07-11',
    legendUrl: wmsLegendUrl('carbonatite_ree_en', '0'),
    legendJsonUrl: arcgisLegendJsonUrl('carbonatite_ree_en'),
    legendLayerId: 0
  },
  graphite: {
    group: 'endowment',
    indicatorClass: 'wms-graphite',
    label: 'Graphite Prospectivity',
    service: 'graphite_prospectivity_en',
    layers: '0',
    bounds: NL_LABRADOR_BOUNDS,
    opacity: 0.65,
    visible: false,
    imageUrl: './data/wms-graphite-nll.png',
    cacheKey: 'wms-graphite-nll',
    cacheVersion: '2026-07-11',
    legendUrl: wmsLegendUrl('graphite_prospectivity_en', '0'),
    legendJsonUrl: arcgisLegendJsonUrl('graphite_prospectivity_en'),
    legendLayerId: 0
  },
  bedrock: {
    group: 'endowment',
    indicatorClass: 'wms-bedrock',
    label: 'Bedrock Geology (national)',
    service: 'gsc_bedrock_geology_en',
    layers: '0',
    bounds: NL_LABRADOR_BOUNDS,
    opacity: 0.55,
    visible: false,
    imageUrl: './data/wms-bedrock-nll.png',
    cacheKey: 'wms-bedrock-nll',
    cacheVersion: '2026-07-11',
    legendUrl: wmsLegendUrl('gsc_bedrock_geology_en', '0'),
    legendJsonUrl: arcgisLegendJsonUrl('gsc_bedrock_geology_en'),
    // REST sub-layer 1 = "Bedrock geology" (the 149-class thematic layer);
    // sub-layer 0 = "Map index" (just the source-map footprint key).
    legendLayerId: 1
  },
  surficial: {
    group: 'endowment',
    indicatorClass: 'wms-surficial',
    label: 'Surficial Geology',
    service: 'gsc_surficial_geology_en',
    layers: '1',
    bounds: NL_LABRADOR_BOUNDS,
    opacity: 0.55,
    visible: false,
    imageUrl: './data/wms-surficial-nll.png',
    cacheKey: 'wms-surficial-nll',
    cacheVersion: '2026-07-11',
    legendUrl: wmsLegendUrl('gsc_surficial_geology_en', '1'),
    legendJsonUrl: arcgisLegendJsonUrl('gsc_surficial_geology_en'),
    // REST sub-layer 3 = "Surficial geology category" (the thematic classes);
    // 0/2 are footprint/boundary reference layers, not the fill classification.
    legendLayerId: 3
  }
};
