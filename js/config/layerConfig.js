/** Module 2: GeoJSON and WMS layer configuration */

import { facilityIconDataUri } from '../modules/facilityIcons.js';
import { infraIconDataUri } from '../modules/infraIcons.js';
import {
  CLAIMS_OUT_FIELDS,
  MINERAL_LANDS_QUERY_BASE,
  TENURE_OUT_FIELDS,
  TENURE_WHERE,
  buildClaimsExpiryLegendItems,
  buildTenureLegendFromFeatures,
  labradorGeometryQueryParams
} from './mineralLands.js';
import {
  ATRIS_CLAIMS_QUERY,
  ATRIS_OUT_FIELDS,
  ATRIS_WHERE,
  INUIT_REGIONS_QUERY,
  NUNATSIAVUT_LEGEND_ITEMS,
  NUNATSIAVUT_OUT_FIELDS,
  NUNATSIAVUT_WHERE
} from './indigenousLands.js';
import {
  buildCpcadLegendFromFeatures,
  buildCpcadPaginatedQuery,
  buildLandUsePaginatedQueries
} from './protectedAreas.js';
import {
  SURVEY_DIGITAL_PICKER,
  SURVEY_FOOTPRINT_PICKER
} from './surveyFootprints.js';
import {
  MAP_LAYERS_QUERY_BASE,
  LAND_USE_QUERY_BASE,
  ROADS_WHERE,
  RAIL_WHERE,
  ROADS_OUT_FIELDS,
  RESOURCE_ROADS_OUT_FIELDS,
  NALCOR_OUT_FIELDS,
  CANVEC_TX_OUT_FIELDS,
  MUNICIPAL_OUT_FIELDS,
  RAIL_COLOR,
  SITE_KIND_COLORS,
  buildRoadsLegendItems,
  buildResourceRoadsLegendItems,
  buildTransmissionLegendItems,
  buildSitesLegendItems,
  roadsLineColorExpression,
  roadsLineWidthExpression
} from './infrastructure.js';

// This project is Labrador/NL-scoped, so national feeds are visually clipped
// to this region (the underlying data/query is untouched - only what's
// requested/rendered on screen is limited). See BUILD_PLAN.md.
export const NL_LABRADOR_PROVINCE_NAME = 'Newfoundland and Labrador';

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
  defaultValue: MODS_PICKER_ALL,
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

/** Facility point layers drawn above geology / rights / line infra. */
export const FACILITY_STACK_LAYER_IDS = [
  'infra-mines-layer',
  'infra-processing-layer',
  'infra-exploration-layer',
  'infra-development-layer'
];

const FACILITY_DATA = {
  lazy: true,
  visible: false,
  dataUrl: './data/critical-minerals-nl.geojson',
  cacheKey: 'critical-minerals-nl',
  cacheVersion: '0aac8ae0b666',
  sources: CRITICAL_MINERALS_SOURCES,
  beforeLayerIds: ['mods-layer']
};

function facilityProvinceAndGroupFilter(operationGroup) {
  return [
    'all',
    ['in', NL_LABRADOR_PROVINCE_NAME, ['get', 'ProvincesEN']],
    ['==', ['get', 'OperationGroupEN'], operationGroup]
  ];
}

/** Thematic sidebar groups — order defines display sequence in the UI. */
export const LAYER_GROUP_ORDER = [
  'endowment',
  'occurrences',
  'rights',
  'infrastructure',
  'signals',
  'base'
];

/**
 * Phase 2.4 — Hard exclusions (fatal-flaw) preset.
 * Tier-1 blockers only: gazetted protected/conserved areas + protected public
 * water supplies. Indigenous lands / ATRIS are process hurdles (tier 2), not
 * undevelopable — leave them as normal Rights toggles. Claims/tenure are
 * competition (tier 3), not included.
 */
export const FATAL_FLAW_PRESET_LAYERS = ['geoatlasCpcad', 'geoatlasLandUse'];

/** Land-use kinds included in the hard-exclusion mask (subset of geoatlasLandUse). */
export const FATAL_FLAW_LAND_USE_KINDS = ['publicWaterSupplies'];

/** Uniform high-contrast mask applied to preset fill layers while active. */
export const FATAL_FLAW_MASK_PAINT = {
  'fill-color': '#7f1d1d',
  'fill-opacity': 0.55
};

export const LAYER_GROUPS = {
  endowment: {
    title: 'Geological Endowment',
    hint:
      'Mapped geology and commodity prospectivity (provincial + national). Prefer provincial 1:1M bedrock when zoomed in; national when regional — only one bedrock layer at a time.',
    defaultExpanded: false,
    // Nested category headers inside this group (sidebar only).
    subgroups: [
      { id: 'bedrock', title: 'Bedrock' },
      { id: 'surficial', title: 'Surficial' },
      { id: 'prospectivity', title: 'Prospectivity' }
    ]
  },
  occurrences: {
    title: 'Occurrences & Activity',
    hint: 'MODS mineral occurrences (prospects through producers)',
    defaultExpanded: true
  },
  rights: {
    title: 'Rights & Constraints',
    hint:
      'Mineral tenure, Indigenous lands, protected areas & land use (Labrador mainland clip; off by default). Hard exclusions = parks & water supplies only.',
    defaultExpanded: false
  },
  infrastructure: {
    title: 'Infrastructure',
    hint: 'Roads, rail, HV transmission (no distribution), ports, power, communities & critical-mineral facilities. Off by default.',
    defaultExpanded: false
  },
  signals: {
    title: 'Geophysical & Geochemical Signals',
    hint:
      'Aeromag, 1VD, radiometrics (eU / eTh / K), Bouguer gravity, survey footprints. Radiometrics & 1VD are survey-limited — use footprints. Off by default.',
    defaultExpanded: false
  },
  base: {
    title: 'Base Context',
    hint: 'Topography, hydrography & reference grids',
    defaultExpanded: false
  }
};

/*
 * Demo deposits/tenures/infrastructure were removed 2026-07-06.
 * MODS (1.1) and Mineral Lands claims/tenure (2.1) replace deposits/tenures.
 * Still pending: none for Infrastructure (Phase 3) — see LAYER_CONFIG infra* entries.
 *
 * Value chain: endowment → occurrences → rights → infrastructure.
 */
export const LAYER_CONFIG = {
  geoatlasBedrock: {
    group: 'endowment',
    subgroup: 'bedrock',
    sidebarLabel: 'NL 1:1M (provincial)',
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
    cacheVersion: '7112640d3e8b',
    // Under surficial / rights (when loaded) and under MODS / facilities.
    beforeLayerIds: [
      'geoatlas-surficial-fill',
      'geoatlas-surficial-outline',
      'atris-claims-fill',
      'atris-claims-outline',
      'inuit-nunatsiavut-fill',
      'inuit-nunatsiavut-outline',
      'geoatlas-tenure-fill',
      'geoatlas-tenure-outline',
      'geoatlas-claims-fill',
      'geoatlas-claims-outline',
      'mods-surface-fill',
      'mods-surface-outline',
      'mods-layer',
      ...FACILITY_STACK_LAYER_IDS
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
    legendNote:
      'Provincial 1:1M bedrock units (NL GeoAtlas). Colors from source RGB. Mutually exclusive with National (GSC) bedrock.',
    // Same ArcGIS legend JSON pattern as NRCan WMS — ~153 classification rows.
    legendJsonUrl: `${GEOATLAS_REST_BASE}/Bedrock_Geology_All/MapServer/legend?f=json`,
    legendLayerId: 23
  },
  geoatlasSurficial: {
    group: 'endowment',
    subgroup: 'surficial',
    sidebarLabel: 'NL regional (provincial)',
    indicatorClass: 'geoatlasSurficial',
    source: 'geoatlas-surficial-source',
    layer: 'geoatlas-surficial-fill',
    outline: 'geoatlas-surficial-outline',
    // ~15k regional polygons — lazy + bake-first (npm run fetch:surficial).
    lazy: true,
    visible: false,
    enrichment: 'surficialRgb',
    dataUrl: './data/geoatlas-surficial-regional.geojson',
    cacheKey: 'geoatlas-surficial-regional',
    cacheVersion: '9db6ce561aef',
    // Surface cover draws above bedrock; under rights + MODS / facilities.
    beforeLayerIds: [
      'atris-claims-fill',
      'atris-claims-outline',
      'inuit-nunatsiavut-fill',
      'inuit-nunatsiavut-outline',
      'geoatlas-tenure-fill',
      'geoatlas-tenure-outline',
      'geoatlas-claims-fill',
      'geoatlas-claims-outline',
      'mods-surface-fill',
      'mods-surface-outline',
      'mods-layer',
      ...FACILITY_STACK_LAYER_IDS
    ],
    paginatedQuery: {
      url: `${GEOATLAS_REST_BASE}/Surficial_Geology_All/MapServer/12/query`,
      where: '1=1',
      outFields: 'GENETIC1MA,GENETIC250,SOURCE,REFERENCE,RED,GREEN,BLUE',
      outSR: 4326,
      format: 'esrijson',
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
    legendTitle: 'Surficial Geology (NL regional)',
    legendShape: 'icon',
    legendNote:
      'Provincial regional surficial units (NL GeoAtlas). Genetic classes; colors from source RGB. Complements national GSC surficial WMS.',
    legendJsonUrl: `${GEOATLAS_REST_BASE}/Surficial_Geology_All/MapServer/legend?f=json`,
    legendLayerId: 12
  },
  geoatlasCpcad: {
    group: 'rights',
    sidebarLabel: 'Protected & conserved areas',
    indicatorClass: 'geoatlasCpcad',
    source: 'geoatlas-cpcad-source',
    layer: 'geoatlas-cpcad-fill',
    outline: 'geoatlas-cpcad-outline',
    lazy: true,
    visible: false,
    enrichment: 'cpcadType',
    dataUrl: './data/geoatlas-cpcad-labrador.geojson',
    cacheKey: 'geoatlas-cpcad-labrador',
    cacheVersion: '4247b98e8d94',
    // Under Indigenous / mineral rights so parks read as context.
    beforeLayerIds: [
      'atris-claims-fill',
      'atris-claims-outline',
      'inuit-nunatsiavut-fill',
      'inuit-nunatsiavut-outline',
      'geoatlas-tenure-fill',
      'geoatlas-tenure-outline',
      'geoatlas-claims-fill',
      'geoatlas-claims-outline',
      'mods-surface-fill',
      'mods-surface-outline',
      'mods-layer',
      ...FACILITY_STACK_LAYER_IDS
    ],
    paginatedQuery: buildCpcadPaginatedQuery(),
    paint: {
      fill: {
        'fill-color': ['get', 'fillColor'],
        'fill-opacity': 0.35,
        'fill-outline-color': 'rgba(21, 128, 61, 0.55)'
      },
      line: {
        'line-color': 'rgba(21, 128, 61, 0.9)',
        'line-width': 1.4,
        'line-opacity': 0.95
      }
    },
    legendTitle: 'Protected & Conserved Areas',
    legendShape: 'fill',
    legend: buildCpcadLegendFromFeatures([]),
    legendNote:
      'CPCAD via NL GeoAtlas Land_Use. Parks, reserves, and marine protected areas in the Labrador clip. Styled by TYPE_E.'
  },
  geoatlasLandUse: {
    group: 'rights',
    sidebarLabel: 'Land use constraints',
    indicatorClass: 'geoatlasLandUse',
    source: 'geoatlas-landuse-source',
    layer: 'geoatlas-landuse-fill',
    outline: 'geoatlas-landuse-outline',
    lazy: true,
    visible: false,
    enrichment: 'landUseKind',
    dataUrl: './data/geoatlas-landuse-labrador.geojson',
    cacheKey: 'geoatlas-landuse-labrador',
    cacheVersion: 'b55674763937',
    // Bottom of Rights stack (under CPCAD / Indigenous / mineral rights).
    beforeLayerIds: [
      'geoatlas-cpcad-fill',
      'geoatlas-cpcad-outline',
      'atris-claims-fill',
      'atris-claims-outline',
      'inuit-nunatsiavut-fill',
      'inuit-nunatsiavut-outline',
      'geoatlas-tenure-fill',
      'geoatlas-tenure-outline',
      'geoatlas-claims-fill',
      'geoatlas-claims-outline',
      'mods-surface-fill',
      'mods-surface-outline',
      'mods-layer',
      ...FACILITY_STACK_LAYER_IDS
    ],
    paginatedQueries: buildLandUsePaginatedQueries(),
    paint: {
      fill: {
        'fill-color': ['get', 'fillColor'],
        'fill-opacity': 0.28,
        'fill-outline-color': 'rgba(100, 116, 139, 0.45)'
      },
      line: {
        'line-color': 'rgba(71, 85, 105, 0.85)',
        'line-width': 1.1,
        'line-opacity': 0.9,
        'line-dasharray': [2, 1.5]
      }
    },
    legendTitle: 'Land Use Constraints',
    legendShape: 'fill',
    legend: null,
    legendNote:
      'NL GeoAtlas Land_Use (plan 2020, specified materials, water supplies, planning areas). Toggle kinds when they overlap.'
  },

  // ——— Phase 3 Infrastructure ———
  geoatlasMunicipal: {
    group: 'infrastructure',
    sidebarLabel: 'Municipal boundaries',
    indicatorClass: 'geoatlasMunicipal',
    source: 'geoatlas-municipal-source',
    layer: 'geoatlas-municipal-fill',
    outline: 'geoatlas-municipal-outline',
    lazy: true,
    visible: false,
    enrichment: 'municipal',
    dataUrl: './data/geoatlas-municipal-labrador.geojson',
    cacheKey: 'geoatlas-municipal-labrador',
    cacheVersion: 'b5ea8c3c2ce3',
    beforeLayerIds: [
      'geoatlas-resource-roads-layer',
      'geoatlas-roads-layer',
      'geoatlas-rail-layer',
      'geoatlas-transmission-layer',
      'infra-ports-layer',
      'infra-airports-layer',
      'infra-generation-layer',
      'infra-communities-layer',
      'mods-surface-fill',
      'mods-surface-outline',
      'mods-layer',
      ...FACILITY_STACK_LAYER_IDS
    ],
    paginatedQuery: {
      url: `${LAND_USE_QUERY_BASE}/6/query`,
      where: '1=1',
      outFields: MUNICIPAL_OUT_FIELDS,
      outSR: 4326,
      format: 'esrijson',
      maxAllowableOffset: 0.002,
      pageSize: 200,
      concurrency: 2,
      ...labradorGeometryQueryParams()
    },
    paint: {
      fill: {
        'fill-color': ['get', 'fillColor'],
        'fill-opacity': 0.18,
        'fill-outline-color': 'rgba(71, 85, 105, 0.5)'
      },
      line: {
        'line-color': 'rgba(71, 85, 105, 0.85)',
        'line-width': 1.2,
        'line-opacity': 0.9
      }
    },
    legendTitle: 'Municipal Boundaries',
    legendShape: 'fill',
    legend: [{ label: 'Municipal area', color: '#94a3b8' }],
    legendNote: 'NL GeoAtlas Land_Use municipal boundaries (Labrador clip).'
  },
  geoatlasResourceRoads: {
    group: 'infrastructure',
    sidebarLabel: 'Resource access roads',
    indicatorClass: 'geoatlasResourceRoads',
    source: 'geoatlas-resource-roads-source',
    layer: 'geoatlas-resource-roads-layer',
    lazy: true,
    visible: false,
    enrichment: 'resourceRoads',
    dataUrl: './data/geoatlas-resource-roads-labrador.geojson',
    cacheKey: 'geoatlas-resource-roads-labrador',
    cacheVersion: '72719de3833d',
    beforeLayerIds: [
      'geoatlas-roads-layer',
      'geoatlas-rail-layer',
      'geoatlas-transmission-layer',
      'infra-ports-layer',
      'infra-airports-layer',
      'infra-generation-layer',
      'infra-communities-layer',
      'mods-layer',
      ...FACILITY_STACK_LAYER_IDS
    ],
    paginatedQuery: {
      url: `${MAP_LAYERS_QUERY_BASE}/14/query`,
      where: '1=1',
      outFields: RESOURCE_ROADS_OUT_FIELDS,
      outSR: 4326,
      format: 'esrijson',
      maxAllowableOffset: 0.002,
      pageSize: 200,
      concurrency: 4,
      ...labradorGeometryQueryParams()
    },
    paint: {
      line: {
        'line-color': ['coalesce', ['get', 'lineColor'], '#cbd5e1'],
        'line-width': 1.1,
        'line-opacity': 0.85
      }
    },
    legendTitle: 'Resource Access Roads',
    legendShape: 'line',
    legend: buildResourceRoadsLegendItems(),
    legendNote: 'Forest / resource tracks (GeoAtlas Map_Layers/14). Colored by access status.'
  },
  geoatlasRoads: {
    group: 'infrastructure',
    sidebarLabel: 'Roads (highway & collector)',
    indicatorClass: 'geoatlasRoads',
    source: 'geoatlas-roads-source',
    layer: 'geoatlas-roads-layer',
    lazy: true,
    visible: false,
    enrichment: 'roads',
    dataUrl: './data/geoatlas-roads-labrador.geojson',
    cacheKey: 'geoatlas-roads-labrador',
    cacheVersion: 'fed82d13d477',
    beforeLayerIds: [
      'geoatlas-rail-layer',
      'geoatlas-transmission-layer',
      'infra-ports-layer',
      'infra-airports-layer',
      'infra-generation-layer',
      'infra-communities-layer',
      'mods-layer',
      ...FACILITY_STACK_LAYER_IDS
    ],
    paginatedQuery: {
      url: `${MAP_LAYERS_QUERY_BASE}/12/query`,
      where: ROADS_WHERE,
      outFields: ROADS_OUT_FIELDS,
      outSR: 4326,
      format: 'esrijson',
      maxAllowableOffset: 0.002,
      pageSize: 200,
      concurrency: 4,
      ...labradorGeometryQueryParams()
    },
    paint: {
      line: {
        'line-color': roadsLineColorExpression(),
        'line-width': roadsLineWidthExpression(),
        'line-opacity': 0.95
      }
    },
    legendTitle: 'Roads',
    legendShape: 'line',
    legend: buildRoadsLegendItems(),
    legendNote:
      'National Road Network via GeoAtlas (highways + collectors). Local streets omitted for clarity; railroad is a separate layer.'
  },
  geoatlasRail: {
    group: 'infrastructure',
    sidebarLabel: 'Railways',
    indicatorClass: 'geoatlasRail',
    source: 'geoatlas-rail-source',
    layer: 'geoatlas-rail-layer',
    lazy: true,
    visible: false,
    enrichment: 'rail',
    dataUrl: './data/geoatlas-rail-labrador.geojson',
    cacheKey: 'geoatlas-rail-labrador',
    cacheVersion: '62df829e46cc',
    beforeLayerIds: [
      'geoatlas-transmission-layer',
      'infra-ports-layer',
      'infra-airports-layer',
      'infra-generation-layer',
      'infra-communities-layer',
      'mods-layer',
      ...FACILITY_STACK_LAYER_IDS
    ],
    paginatedQuery: {
      url: `${MAP_LAYERS_QUERY_BASE}/12/query`,
      where: RAIL_WHERE,
      outFields: ROADS_OUT_FIELDS,
      outSR: 4326,
      format: 'esrijson',
      maxAllowableOffset: 0.002,
      pageSize: 200,
      concurrency: 2,
      ...labradorGeometryQueryParams()
    },
    paint: {
      line: {
        'line-color': RAIL_COLOR,
        'line-width': 2.2,
        'line-opacity': 0.95,
        'line-dasharray': [2, 1.5]
      }
    },
    legendTitle: 'Railways',
    legendShape: 'line',
    legend: [{ label: 'Railroad (NRN)', color: RAIL_COLOR }],
    legendNote: 'Iron-ore / QNS&L corridor segments (ROADCLASS=Railroad in GeoAtlas NRN).'
  },
  geoatlasTransmission: {
    group: 'infrastructure',
    sidebarLabel: 'Transmission lines',
    indicatorClass: 'geoatlasTransmission',
    source: 'geoatlas-transmission-source',
    layer: 'geoatlas-transmission-layer',
    lazy: true,
    visible: false,
    enrichment: 'transmission',
    dataUrl: './data/geoatlas-transmission-labrador.geojson',
    cacheKey: 'geoatlas-transmission-labrador',
    cacheVersion: '652a32db3c27',
    beforeLayerIds: [
      'infra-ports-layer',
      'infra-airports-layer',
      'infra-generation-layer',
      'infra-communities-layer',
      'mods-layer',
      ...FACILITY_STACK_LAYER_IDS
    ],
    paginatedQueries: [
      {
        url: `${MAP_LAYERS_QUERY_BASE}/15/query`,
        where: '1=1',
        outFields: NALCOR_OUT_FIELDS,
        outSR: 4326,
        format: 'esrijson',
        maxAllowableOffset: 0.002,
        pageSize: 200,
        concurrency: 1,
        featureProps: { txSource: 'nalcor' },
        ...labradorGeometryQueryParams()
      },
      {
        url: `${MAP_LAYERS_QUERY_BASE}/16/query`,
        where: '1=1',
        outFields: CANVEC_TX_OUT_FIELDS,
        outSR: 4326,
        format: 'esrijson',
        maxAllowableOffset: 0.002,
        pageSize: 200,
        concurrency: 2,
        featureProps: { txSource: 'canvec' },
        ...labradorGeometryQueryParams()
      }
    ],
    paint: {
      line: {
        'line-color': ['coalesce', ['get', 'lineColor'], '#d97706'],
        'line-width': 2.4,
        'line-opacity': 0.9
      }
    },
    legendTitle: 'Transmission Lines',
    legendShape: 'line',
    legend: buildTransmissionLegendItems(),
    legendNote:
      'HV transmission only (GeoAtlas Nalcor/15 + CanVec/16). No distribution / feeder network. Nalcor LTA geometry is generalized and may stop short of plant footprints.'
  },
  infraPorts: {
    group: 'infrastructure',
    sidebarLabel: 'Ports / marine access',
    indicatorClass: 'infraPorts',
    source: 'infra-ports-source',
    layer: 'infra-ports-layer',
    lazy: true,
    visible: false,
    enrichment: 'infraSite',
    dataUrl: './data/infra-ports-labrador.geojson',
    cacheKey: 'infra-ports-labrador',
    cacheVersion: '7e8f35222510',
    beforeLayerIds: ['mods-layer', ...FACILITY_STACK_LAYER_IDS],
    icon: { iconField: 'iconId', default: 'port', size: 0.72, offset: [-15, -12] },
    legendTitle: 'Ports / Marine Access',
    legendShape: 'icon',
    legend: [{ label: 'Port / marine access', icon: infraIconDataUri('port') }],
    legendNote: 'Curated Labrador ports & harbours (not a complete CanVec extract).'
  },
  infraAirports: {
    group: 'infrastructure',
    sidebarLabel: 'Airports / airstrips',
    indicatorClass: 'infraAirports',
    source: 'infra-airports-source',
    layer: 'infra-airports-layer',
    lazy: true,
    visible: false,
    enrichment: 'infraSite',
    dataUrl: './data/infra-airports-labrador.geojson',
    cacheKey: 'infra-airports-labrador',
    cacheVersion: '9a44c833e887',
    beforeLayerIds: ['mods-layer', ...FACILITY_STACK_LAYER_IDS],
    icon: { iconField: 'iconId', default: 'airport', size: 0.72, offset: [15, -12] },
    legendTitle: 'Airports / Airstrips',
    legendShape: 'icon',
    legend: [{ label: 'Airport / airstrip', icon: infraIconDataUri('airport') }],
    legendNote: 'Curated Labrador airports & community airstrips for remote access context.'
  },
  infraGeneration: {
    group: 'infrastructure',
    sidebarLabel: 'Power generation',
    indicatorClass: 'infraGeneration',
    source: 'infra-generation-source',
    layer: 'infra-generation-layer',
    lazy: true,
    visible: false,
    enrichment: 'infraSite',
    dataUrl: './data/infra-generation-labrador.geojson',
    cacheKey: 'infra-generation-labrador',
    cacheVersion: 'd29fb36d7947',
    beforeLayerIds: ['mods-layer', ...FACILITY_STACK_LAYER_IDS],
    icon: { iconField: 'iconId', default: 'hydro', size: 0.76, offset: [0, 15] },
    legendTitle: 'Power Generation',
    legendShape: 'icon',
    legend: [
      { label: 'Operating hydro', icon: infraIconDataUri('hydro') },
      { label: 'Potential (Gull Island)', icon: infraIconDataUri('hydroPotential') }
    ],
    legendNote: 'Churchill Falls & Muskrat Falls (operating); Gull Island marked as proposed / not operating.'
  },
  infraCommunities: {
    group: 'infrastructure',
    sidebarLabel: 'Communities',
    indicatorClass: 'infraCommunities',
    source: 'infra-communities-source',
    layer: 'infra-communities-layer',
    labels: 'infra-communities-labels',
    lazy: true,
    visible: false,
    enrichment: 'infraSite',
    dataUrl: './data/infra-communities-labrador.geojson',
    cacheKey: 'infra-communities-labrador',
    cacheVersion: '4dd4af206432',
    minzoom: 5,
    beforeLayerIds: ['mods-layer', ...FACILITY_STACK_LAYER_IDS],
    paint: {
      circle: {
        'circle-radius': 4.5,
        'circle-color': SITE_KIND_COLORS.community,
        'circle-stroke-width': 1.2,
        'circle-stroke-color': '#ffffff'
      },
      label: {
        'text-color': '#1e293b',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.2
      }
    },
    legendTitle: 'Communities',
    legendShape: 'circle',
    legend: buildSitesLegendItems(['community']),
    legendNote: 'Curated Labrador settlements (labels appear when zoomed in).'
  },

  // NRCan critical-mineral facilities — split by OperationGroupEN under Infrastructure.
  // Early prospecting / showings are NOT in this dataset; use MODS for those.
  infraMines: {
    group: 'infrastructure',
    sidebarLabel: 'Mines / primary producers',
    indicatorClass: 'infraMines',
    source: 'infra-mines-source',
    layer: 'infra-mines-layer',
    ...FACILITY_DATA,
    filter: facilityProvinceAndGroupFilter('Mines and other primary producing sites'),
    icon: {
      field: 'OperationGroupEN',
      mapping: { 'Mines and other primary producing sites': 'mine' },
      default: 'mine',
      size: 0.78
    },
    legendTitle: 'Mines / Primary Producers',
    legendShape: 'icon',
    legend: [{ label: 'Mine / primary producer', icon: facilityIconDataUri('mine') }],
    legendNote:
      'NRCan critical-mineral mines & primary sites (NL&L). Includes active (e.g. Voisey’s Bay, Carol Lake) and past producers on hold.'
  },
  infraProcessing: {
    group: 'infrastructure',
    sidebarLabel: 'Processing / midstream',
    indicatorClass: 'infraProcessing',
    source: 'infra-processing-source',
    layer: 'infra-processing-layer',
    ...FACILITY_DATA,
    filter: facilityProvinceAndGroupFilter('Processing'),
    icon: {
      field: 'OperationGroupEN',
      mapping: { Processing: 'processing' },
      default: 'processing',
      size: 0.78
    },
    legendTitle: 'Processing / Midstream',
    legendShape: 'icon',
    legend: [{ label: 'Processing / midstream', icon: facilityIconDataUri('processing') }],
    legendNote:
      'NRCan processing facilities (NL&L). May be off-island (e.g. Long Harbour) — not local Labrador refining capacity.'
  },
  infraExploration: {
    group: 'infrastructure',
    sidebarLabel: 'Advanced exploration',
    indicatorClass: 'infraExploration',
    source: 'infra-exploration-source',
    layer: 'infra-exploration-layer',
    ...FACILITY_DATA,
    filter: facilityProvinceAndGroupFilter('Advanced exploration project'),
    icon: {
      field: 'OperationGroupEN',
      mapping: { 'Advanced exploration project': 'advancedExploration' },
      default: 'advancedExploration',
      size: 0.78
    },
    legendTitle: 'Advanced Exploration',
    legendShape: 'icon',
    legend: [{ label: 'Advanced exploration project', icon: facilityIconDataUri('advancedExploration') }],
    legendNote:
      'NRCan advanced exploration projects only. Early prospecting / showings / MODS occurrences are under Occurrences & Activity.'
  },
  infraDevelopment: {
    group: 'infrastructure',
    sidebarLabel: 'Development projects',
    indicatorClass: 'infraDevelopment',
    source: 'infra-development-source',
    layer: 'infra-development-layer',
    ...FACILITY_DATA,
    filter: facilityProvinceAndGroupFilter('Advanced processing project'),
    icon: {
      field: 'OperationGroupEN',
      mapping: { 'Advanced processing project': 'advancedProcessing' },
      default: 'advancedProcessing',
      size: 0.78
    },
    legendTitle: 'Development Projects',
    legendShape: 'icon',
    legend: [{ label: 'Advanced processing / development', icon: facilityIconDataUri('advancedProcessing') }],
    legendNote:
      'NRCan advanced processing / development-stage projects (NL&L).'
  },

  atrisLandClaims: {
    group: 'rights',
    sidebarLabel: 'ATRIS land claims',
    indicatorClass: 'atrisLandClaims',
    source: 'atris-claims-source',
    layer: 'atris-claims-fill',
    outline: 'atris-claims-outline',
    lazy: true,
    visible: false,
    enrichment: 'atrisClaim',
    dataUrl: './data/atris-claims-labrador.geojson',
    cacheKey: 'atris-claims-labrador',
    cacheVersion: '32025395a7b9',
    // Context under Nunatsiavut / tenure / mineral claims.
    beforeLayerIds: [
      'inuit-nunatsiavut-fill',
      'inuit-nunatsiavut-outline',
      'geoatlas-tenure-fill',
      'geoatlas-tenure-outline',
      'geoatlas-claims-fill',
      'geoatlas-claims-outline',
      'mods-surface-fill',
      'mods-surface-outline',
      'mods-layer',
      ...FACILITY_STACK_LAYER_IDS
    ],
    paginatedQuery: {
      url: ATRIS_CLAIMS_QUERY,
      where: ATRIS_WHERE,
      outFields: ATRIS_OUT_FIELDS,
      outSR: 4326,
      format: 'esrijson',
      maxAllowableOffset: 0.002,
      pageSize: 200,
      concurrency: 1
    },
    paint: {
      fill: {
        'fill-color': ['get', 'fillColor'],
        'fill-opacity': 0.18,
        'fill-outline-color': 'rgba(126, 34, 206, 0.45)'
      },
      line: {
        'line-color': 'rgba(126, 34, 206, 0.85)',
        'line-width': 1.5,
        'line-opacity': 0.9,
        'line-dasharray': [2, 2]
      }
    },
    legendTitle: 'ATRIS Land Claims',
    legendShape: 'fill',
    // Checklist built in app.updateVectorLegend from loaded TAG_IDs.
    legend: null,
    legendNote:
      'Federal comprehensive land-claim areas (CIRNAC/ISC ATRIS) — consultation / permitting context, not a mineral licence or hard exclusion. Toggle claims when they overlap.'
  },
  inuitNunatsiavut: {
    group: 'rights',
    sidebarLabel: 'Nunatsiavut (LISA)',
    indicatorClass: 'inuitNunatsiavut',
    source: 'inuit-nunatsiavut-source',
    layer: 'inuit-nunatsiavut-fill',
    outline: 'inuit-nunatsiavut-outline',
    lazy: true,
    visible: false,
    enrichment: 'nunatsiavut',
    dataUrl: './data/inuit-nunatsiavut.geojson',
    cacheKey: 'inuit-nunatsiavut',
    cacheVersion: 'bfe5a22c4275',
    beforeLayerIds: [
      'geoatlas-tenure-fill',
      'geoatlas-tenure-outline',
      'geoatlas-claims-fill',
      'geoatlas-claims-outline',
      'mods-surface-fill',
      'mods-surface-outline',
      'mods-layer',
      ...FACILITY_STACK_LAYER_IDS
    ],
    paginatedQuery: {
      url: INUIT_REGIONS_QUERY,
      where: NUNATSIAVUT_WHERE,
      outFields: NUNATSIAVUT_OUT_FIELDS,
      outSR: 4326,
      format: 'esrijson',
      maxAllowableOffset: 0.002,
      pageSize: 200,
      concurrency: 1
    },
    paint: {
      fill: {
        'fill-color': ['get', 'fillColor'],
        'fill-opacity': 0.2,
        'fill-outline-color': 'rgba(13, 148, 136, 0.5)'
      },
      line: {
        'line-color': 'rgba(13, 148, 136, 0.95)',
        'line-width': 1.8,
        'line-opacity': 0.95,
        'line-dasharray': [2.5, 2]
      }
    },
    legendTitle: 'Nunatsiavut',
    legendShape: 'fill',
    legend: NUNATSIAVUT_LEGEND_ITEMS,
    legendNote:
      'Labrador Inuit Settlement Area (Inuit Nunangat). Settled governance / consultation context — not a hard exclusion. CIRNAC/ISC; boundaries approximate.'
  },
  geoatlasClaims: {
    group: 'rights',
    sidebarLabel: 'Map-staked claims',
    indicatorClass: 'geoatlasClaims',
    source: 'geoatlas-claims-source',
    layer: 'geoatlas-claims-fill',
    outline: 'geoatlas-claims-outline',
    lazy: true,
    visible: false,
    enrichment: 'claimsStatus',
    dataUrl: './data/geoatlas-claims-labrador.geojson',
    cacheKey: 'geoatlas-claims-labrador',
    cacheVersion: '43ed1b9b19b2',
    // Above geology/tenure; under MODS points for siting readability.
    beforeLayerIds: [
      'mods-surface-fill',
      'mods-surface-outline',
      'mods-layer',
      ...FACILITY_STACK_LAYER_IDS
    ],
    paginatedQuery: {
      url: `${MINERAL_LANDS_QUERY_BASE}/0/query`,
      where: '1=1',
      outFields: CLAIMS_OUT_FIELDS,
      outSR: 4326,
      format: 'esrijson',
      maxAllowableOffset: 0.002,
      pageSize: 200,
      concurrency: 4,
      ...labradorGeometryQueryParams()
    },
    paint: {
      fill: {
        'fill-color': ['get', 'fillColor'],
        'fill-opacity': 0.5,
        'fill-outline-color': 'rgba(120, 53, 15, 0.55)'
      },
      line: {
        'line-color': 'rgba(120, 53, 15, 0.8)',
        'line-width': 1.2,
        'line-opacity': 0.9
      }
    },
    legendTitle: 'Map-staked Claims',
    legendShape: 'fill',
    // Built from loaded STATUS values in app.updateVectorLegend.
    legend: buildClaimsExpiryLegendItems(),
    legendNote:
      'Active map-staked mineral claims in Labrador (NL GeoAtlas Mineral Lands). Colored by expiry band (≤90 / ≤180 days); longer-dated keep STATUS colors. Popup shows STATUS + EXPIRYDATE.'
  },
  geoatlasTenure: {
    group: 'rights',
    sidebarLabel: 'Mineral tenure',
    indicatorClass: 'geoatlasTenure',
    source: 'geoatlas-tenure-source',
    layer: 'geoatlas-tenure-fill',
    outline: 'geoatlas-tenure-outline',
    lazy: true,
    visible: false,
    enrichment: 'tenureType',
    dataUrl: './data/geoatlas-tenure-labrador.geojson',
    cacheKey: 'geoatlas-tenure-labrador',
    cacheVersion: '7720fa7df5e6',
    // Under map-staked claims and MODS / facilities.
    beforeLayerIds: [
      'geoatlas-claims-fill',
      'geoatlas-claims-outline',
      'mods-surface-fill',
      'mods-surface-outline',
      'mods-layer',
      ...FACILITY_STACK_LAYER_IDS
    ],
    paginatedQuery: {
      url: `${MINERAL_LANDS_QUERY_BASE}/5/query`,
      where: TENURE_WHERE,
      outFields: TENURE_OUT_FIELDS,
      outSR: 4326,
      format: 'esrijson',
      maxAllowableOffset: 0.002,
      pageSize: 200,
      concurrency: 4,
      ...labradorGeometryQueryParams()
    },
    paint: {
      fill: {
        'fill-color': ['get', 'fillColor'],
        'fill-opacity': 0.55,
        'fill-outline-color': 'rgba(30, 41, 59, 0.35)'
      },
      line: {
        'line-color': 'rgba(30, 41, 59, 0.65)',
        'line-width': 1,
        'line-opacity': 0.85
      }
    },
    legendTitle: 'Mineral Tenure',
    legendShape: 'fill',
    // Built from TYPEDESC values present in the Labrador bake (app.updateVectorLegend).
    legend: buildTenureLegendFromFeatures([]),
    legendNote:
      'Labrador mineral rights (leases, exempt mineral land, etc.). Parks & protected areas are on Protected & conserved — not duplicated here.'
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
    cacheVersion: '73a3565e6582',
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
      // Off by default so cold start skips main-thread Turf compute; users
      // opt in via the legend "Show occurrence density surfaces" toggle.
      defaultVisible: false,
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
  },
  surveyFootprints: {
    group: 'signals',
    sidebarLabel: 'Survey footprints (index)',
    indicatorClass: 'surveyFootprints',
    source: 'geoatlas-survey-footprints-source',
    layer: 'geoatlas-survey-footprints-fill',
    outline: 'geoatlas-survey-footprints-outline',
    lazy: true,
    visible: false,
    enrichment: 'surveyFootprints',
    surveyFilterPicker: SURVEY_FOOTPRINT_PICKER,
    surveyDigitalPicker: SURVEY_DIGITAL_PICKER,
    dataUrl: './data/geoatlas-survey-footprints-labrador.geojson',
    cacheKey: 'geoatlas-survey-footprints-labrador',
    cacheVersion: 'de066dead550',
    // Under signal rasters conceptually; keep under rights/MODS stack so outlines stay readable.
    beforeLayerIds: [
      'mods-surface-fill',
      'mods-surface-outline',
      'mods-layer',
      ...FACILITY_STACK_LAYER_IDS
    ],
    paginatedQuery: {
      url: `${GEOATLAS_REST_BASE}/Indexes/MapServer/6/query`,
      where: '1=1',
      outFields:
        'OBJECTID,SURVEY_ID,GEOFILE,DIGITAL,SURV_DATE,SURV_YEAR,LINE_SPACE,PARAMETERS,COMPANY',
      outSR: 4326,
      format: 'esrijson',
      maxAllowableOffset: 0.002,
      pageSize: 200,
      concurrency: 4,
      ...labradorGeometryQueryParams()
    },
    paint: {
      fill: {
        'fill-color': '#7c3aed',
        'fill-opacity': 0.08,
        'fill-outline-color': 'rgba(124, 58, 237, 0.35)'
      },
      line: {
        'line-color': '#6d28d9',
        'line-width': 1.4,
        'line-opacity': 0.9
      }
    },
    legendTitle: 'Airborne survey footprints',
    legendShape: 'fill',
    legend: [{ color: 'rgba(124, 58, 237, 0.45)', label: 'Recorded survey outline' }],
    legendNote:
      'Full GeoAtlas Indexes inventory (~1,200 Labrador surveys). Filter by survey type and digital availability; click a footprint for logistics and the NL airborne detail page. Signal rasters only cover published regional/detailed products — most footprints have no matching image layer here.'
  }
};

/**
 * NRCan WMS host. This ArcGIS WMS service only advertises CRS:84 / EPSG:4326 /
 * EPSG:3978 in its capabilities (no EPSG:3857), so these layers are fetched as
 * single georeferenced images (MapLibre `image` source) rather than an
 * EPSG:3857 XYZ tile grid, which this server rejects outright.
 */
export const WMS_BASE_URL = 'https://maps-cartes.services.geo.ca/server_serveur/services/NRCan';

/** GeoAtlas MapServer root (ExportMap bake / live fallback for geophysics rasters). */
export const GEOATLAS_GEOPHYSICS_MAPSERVER = `${GEOATLAS_REST_BASE}/Geophysics_Labrador/MapServer`;

/** NRCan AGG gravity WMS (Bouguer = layer 75). Often firewalled; bake when reachable. */
export const NRCAN_AGG_WMS_URL = 'http://wms.agg.nrcan.gc.ca/wms2/wms2.aspx';

/** Phase 4.1 — only one signals raster on at a time (aeromag / 1VD / gravity). */
export const SIGNAL_RASTER_KEYS = [
  'aeromag',
  'mag1vd',
  'radioEu',
  'radioEth',
  'radioK',
  'gravity'
];

/** Grayscale stops shared by signal color-bar legends when grayscale mode is on. */
export const SIGNAL_GRAYSCALE_RAMP_COLORS = [
  '#0f172a',
  '#334155',
  '#64748b',
  '#94a3b8',
  '#e2e8f0'
];

/**
 * Build a legend ramp def for a signals raster (color or grayscale).
 * @param {object} config WMS_CONFIG entry
 * @param {boolean} grayscale
 */
export function buildSignalsLegendRamp(config, grayscale = false) {
  const base = config?.legendRamp;
  if (!base?.colors?.length) return null;
  return {
    colors: grayscale ? SIGNAL_GRAYSCALE_RAMP_COLORS : [...base.colors],
    lowLabel: base.lowLabel || 'Lower',
    highLabel: base.highLabel || 'Higher',
    midLabel: base.midLabel
  };
}

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

/**
 * Tight Labrador window for detailed airborne surveys (1VD / radiometrics).
 * Matches scripts/fetch-geophysics.js DETAILED_SURVEY_BOUNDS — keeps pixels in
 * the survey patches instead of stretching them across empty NL/ocean.
 */
export const DETAILED_SURVEY_BOUNDS = [-67.8, 52.5, -56.0, 57.5];

// Note: mines/processing facilities are served as vector point layers
// (see `infraMines` / `infraProcessing` / `infraExploration` / `infraDevelopment`
// in LAYER_CONFIG) rather than a WMS image -
// point symbols in a raster overlay don't rescale with zoom the way vector
// circles do, and it would duplicate the Data Layers section.
export const WMS_CONFIG = {
  lithium: {
    group: 'endowment',
    subgroup: 'prospectivity',
    indicatorClass: 'wms-lithium',
    sidebarLabel: 'Lithium',
    label: 'Lithium Prospectivity',
    provider: 'nrcan-geo',
    service: 'pegmatite_lithium_en',
    layers: '0',
    bounds: NL_LABRADOR_BOUNDS,
    opacity: 0.65,
    visible: false,
    // Baked Mercator-corrected NL&L image (npm run fetch:wms). Live GetMap = fallback.
    imageUrl: './data/wms-lithium-nll.png',
    cacheKey: 'wms-lithium-nll',
    cacheVersion: 'c43d57b541bc',
    legendUrl: wmsLegendUrl('pegmatite_lithium_en', '0'),
    legendJsonUrl: arcgisLegendJsonUrl('pegmatite_lithium_en'),
    legendLayerId: 0
  },
  ree: {
    group: 'endowment',
    subgroup: 'prospectivity',
    indicatorClass: 'wms-ree',
    sidebarLabel: 'Rare Earth Elements',
    label: 'Rare Earth Elements Prospectivity',
    provider: 'nrcan-geo',
    service: 'carbonatite_ree_en',
    layers: '0',
    bounds: NL_LABRADOR_BOUNDS,
    opacity: 0.65,
    visible: false,
    imageUrl: './data/wms-ree-nll.png',
    cacheKey: 'wms-ree-nll',
    cacheVersion: 'ee577b00bc0b',
    legendUrl: wmsLegendUrl('carbonatite_ree_en', '0'),
    legendJsonUrl: arcgisLegendJsonUrl('carbonatite_ree_en'),
    legendLayerId: 0
  },
  graphite: {
    group: 'endowment',
    subgroup: 'prospectivity',
    indicatorClass: 'wms-graphite',
    sidebarLabel: 'Graphite',
    label: 'Graphite Prospectivity',
    provider: 'nrcan-geo',
    service: 'graphite_prospectivity_en',
    layers: '0',
    bounds: NL_LABRADOR_BOUNDS,
    opacity: 0.65,
    visible: false,
    imageUrl: './data/wms-graphite-nll.png',
    cacheKey: 'wms-graphite-nll',
    cacheVersion: '0ae99450961a',
    legendUrl: wmsLegendUrl('graphite_prospectivity_en', '0'),
    legendJsonUrl: arcgisLegendJsonUrl('graphite_prospectivity_en'),
    legendLayerId: 0
  },
  nickel: {
    group: 'endowment',
    subgroup: 'prospectivity',
    indicatorClass: 'wms-nickel',
    sidebarLabel: 'Magmatic nickel',
    label: 'Magmatic Nickel Prospectivity',
    provider: 'nrcan-geo',
    service: '2023_Prospectivity_Magmatic_Nickel_Preferred_EPSG3978_en',
    layers: '0',
    bounds: NL_LABRADOR_BOUNDS,
    opacity: 0.65,
    visible: false,
    imageUrl: './data/wms-nickel-nll.png',
    cacheKey: 'wms-nickel-nll',
    cacheVersion: '8ab0c0672ba3',
    legendUrl: wmsLegendUrl('2023_Prospectivity_Magmatic_Nickel_Preferred_EPSG3978_en', '0'),
    legendJsonUrl: arcgisLegendJsonUrl('2023_Prospectivity_Magmatic_Nickel_Preferred_EPSG3978_en'),
    legendLayerId: 0
  },
  zincCd: {
    group: 'endowment',
    subgroup: 'prospectivity',
    indicatorClass: 'wms-zincCd',
    sidebarLabel: 'Zinc (CD)',
    label: 'CD Zinc Prospectivity',
    provider: 'nrcan-geo',
    service: '2023_Prospectivity_CD_Zinc_Preferred_EPSG3978_en',
    layers: '0',
    bounds: NL_LABRADOR_BOUNDS,
    opacity: 0.65,
    visible: false,
    imageUrl: './data/wms-zincCd-nll.png',
    cacheKey: 'wms-zincCd-nll',
    cacheVersion: '924e3d25ee9a',
    legendUrl: wmsLegendUrl('2023_Prospectivity_CD_Zinc_Preferred_EPSG3978_en', '0'),
    legendJsonUrl: arcgisLegendJsonUrl('2023_Prospectivity_CD_Zinc_Preferred_EPSG3978_en'),
    legendLayerId: 0
  },
  zincMvt: {
    group: 'endowment',
    subgroup: 'prospectivity',
    indicatorClass: 'wms-zincMvt',
    sidebarLabel: 'Zinc (MVT)',
    label: 'MVT Zinc Prospectivity',
    provider: 'nrcan-geo',
    service: '2023_Prospectivity_MVT_Zinc_Preferred_EPSG3978_en',
    layers: '0',
    bounds: NL_LABRADOR_BOUNDS,
    opacity: 0.65,
    visible: false,
    imageUrl: './data/wms-zincMvt-nll.png',
    cacheKey: 'wms-zincMvt-nll',
    cacheVersion: '312348af4bc0',
    legendUrl: wmsLegendUrl('2023_Prospectivity_MVT_Zinc_Preferred_EPSG3978_en', '0'),
    legendJsonUrl: arcgisLegendJsonUrl('2023_Prospectivity_MVT_Zinc_Preferred_EPSG3978_en'),
    legendLayerId: 0
  },
  bedrock: {
    group: 'endowment',
    subgroup: 'bedrock',
    indicatorClass: 'wms-bedrock',
    sidebarLabel: 'National (GSC)',
    label: 'Bedrock Geology (national)',
    provider: 'nrcan-geo',
    service: 'gsc_bedrock_geology_en',
    layers: '0',
    bounds: NL_LABRADOR_BOUNDS,
    opacity: 0.55,
    visible: false,
    imageUrl: './data/wms-bedrock-nll.png',
    cacheKey: 'wms-bedrock-nll',
    cacheVersion: '156ab88567b8',
    legendUrl: wmsLegendUrl('gsc_bedrock_geology_en', '0'),
    legendJsonUrl: arcgisLegendJsonUrl('gsc_bedrock_geology_en'),
    // REST sub-layer 1 = "Bedrock geology" (the 149-class thematic layer);
    // sub-layer 0 = "Map index" (just the source-map footprint key).
    legendLayerId: 1
  },
  surficial: {
    group: 'endowment',
    subgroup: 'surficial',
    indicatorClass: 'wms-surficial',
    sidebarLabel: 'National (GSC)',
    label: 'Surficial Geology (national)',
    provider: 'nrcan-geo',
    service: 'gsc_surficial_geology_en',
    layers: '1',
    bounds: NL_LABRADOR_BOUNDS,
    opacity: 0.55,
    visible: false,
    imageUrl: './data/wms-surficial-nll.png',
    cacheKey: 'wms-surficial-nll',
    cacheVersion: '97224627e46a',
    legendUrl: wmsLegendUrl('gsc_surficial_geology_en', '1'),
    legendJsonUrl: arcgisLegendJsonUrl('gsc_surficial_geology_en'),
    // REST sub-layer 3 = "Surficial geology category" (the thematic classes);
    // 0/2 are footprint/boundary reference layers, not the fill classification.
    legendLayerId: 3
  },
  // --- Phase 4.1 Signals (GeoAtlas ExportMap bake; npm run fetch:geophysics) ---
  aeromag: {
    group: 'signals',
    indicatorClass: 'wms-aeromag',
    sidebarLabel: 'Aeromag (regional)',
    label: 'Residual Magnetics — Labrador',
    provider: 'geoatlas-export',
    layers: '65',
    bounds: NL_LABRADOR_BOUNDS,
    opacity: 0.7,
    visible: false,
    imageUrl: './data/wms-aeromag-nll.png',
    cacheKey: 'wms-aeromag-nll',
    cacheVersion: '296a830f4d53',
    legendRamp: {
      colors: ['#3b0764', '#1d4ed8', '#22c55e', '#eab308', '#b91c1c'],
      lowLabel: 'Lower intensity',
      highLabel: 'Higher intensity'
    },
    legendNote:
      'GSC regional residual magnetic compilation (GeoAtlas). Relative color stretch — not absolute nT. Free forever.'
  },
  mag1vd: {
    group: 'signals',
    indicatorClass: 'wms-mag1vd',
    sidebarLabel: '1VD (detailed surveys)',
    label: 'Magnetic 1st Vertical Derivative',
    provider: 'geoatlas-export',
    layers: '6,21,30,35,38,64',
    bounds: DETAILED_SURVEY_BOUNDS,
    opacity: 0.7,
    visible: false,
    imageUrl: './data/wms-mag1vd-nll.png',
    cacheKey: 'wms-mag1vd-nll',
    cacheVersion: 'abe9393c1b9e',
    legendRamp: {
      colors: ['#14532d', '#22c55e', '#eab308', '#ea580c', '#7f1d1d'],
      lowLabel: 'Lower 1VD',
      highLabel: 'Higher 1VD'
    },
    legendNote:
      'No province-wide 1VD — detailed survey blocks only (tight Labrador bake). Relative stretch; use Survey footprints for coverage. Free forever.'
  },
  radioEu: {
    group: 'signals',
    indicatorClass: 'wms-radioEu',
    sidebarLabel: 'eU (detailed surveys)',
    label: 'Equivalent Uranium (ppm)',
    provider: 'geoatlas-export',
    layers: '11,25,44,54',
    bounds: DETAILED_SURVEY_BOUNDS,
    opacity: 0.7,
    visible: false,
    imageUrl: './data/wms-radioEu-nll.png',
    cacheKey: 'wms-radioEu-nll',
    cacheVersion: '48e115b22e78',
    legendRamp: {
      colors: ['#0c4a6e', '#0284c7', '#eab308', '#ea580c', '#9f1239'],
      lowLabel: 'Lower eU',
      highLabel: 'Higher eU'
    },
    legendNote:
      'Airborne gamma-ray equivalent uranium — Makkovik / Qipuqqaq-Postville / Schefferville only. High-res Labrador mosaic; relative stretch, not a grade map. Free forever.'
  },
  radioEth: {
    group: 'signals',
    indicatorClass: 'wms-radioEth',
    sidebarLabel: 'eTh (detailed surveys)',
    label: 'Equivalent Thorium (ppm)',
    provider: 'geoatlas-export',
    layers: '12,26,45,55',
    bounds: DETAILED_SURVEY_BOUNDS,
    opacity: 0.7,
    visible: false,
    imageUrl: './data/wms-radioEth-nll.png',
    cacheKey: 'wms-radioEth-nll',
    cacheVersion: 'f466ed00b686',
    legendRamp: {
      colors: ['#14532d', '#16a34a', '#eab308', '#f97316', '#9f1239'],
      lowLabel: 'Lower eTh',
      highLabel: 'Higher eTh'
    },
    legendNote:
      'Airborne gamma-ray equivalent thorium — same detailed survey footprints as eU/K. High-res Labrador mosaic; relative stretch. Free forever.'
  },
  radioK: {
    group: 'signals',
    indicatorClass: 'wms-radioK',
    sidebarLabel: 'K (detailed surveys)',
    label: 'Potassium (percent)',
    provider: 'geoatlas-export',
    layers: '13,24,46,56',
    bounds: DETAILED_SURVEY_BOUNDS,
    opacity: 0.7,
    visible: false,
    imageUrl: './data/wms-radioK-nll.png',
    cacheKey: 'wms-radioK-nll',
    cacheVersion: '0305cb99e08f',
    legendRamp: {
      colors: ['#1e3a8a', '#6366f1', '#eab308', '#f59e0b', '#b45309'],
      lowLabel: 'Lower K',
      highLabel: 'Higher K'
    },
    legendNote:
      'Airborne gamma-ray potassium (%) — same detailed survey footprints as eU/eTh. High-res Labrador mosaic; relative stretch. Free forever.'
  },
  gravity: {
    group: 'signals',
    indicatorClass: 'wms-gravity',
    sidebarLabel: 'Gravity (Bouguer)',
    label: 'Bouguer Gravity Anomaly',
    // Baked from local NRCan GeoTIFF (npm run fetch:gravity-local). No live AGG fallback —
    // that host is often unreachable; re-bake from data/Gravity/*.TIF when updating.
    provider: 'local-bouguer-tif',
    layers: 'Bouguer_AC',
    bounds: NL_LABRADOR_BOUNDS,
    opacity: 0.7,
    visible: false,
    imageUrl: './data/wms-gravity-nll.png',
    cacheKey: 'wms-gravity-nll',
    cacheVersion: 'ff3663a73edd',
    legendRamp: {
      colors: ['#0e7490', '#22c55e', '#eab308', '#dc2626', '#a21caf'],
      lowLabel: 'Lower (mass deficit)',
      highLabel: 'Higher (mass excess)'
    },
    legendNote:
      'NRCan Canadian Gravity Database — Canada 2 km Bouguer color grid. Includes offshore; relative color stretch (not labelled mGal). Free forever.'
  }
};
