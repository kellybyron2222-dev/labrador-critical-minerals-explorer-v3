/**
 * Protected areas & land use (GeoAtlas Land_Use) — shared bake + app constants.
 *
 * Source: GeoAtlas/Land_Use/MapServer (not federal CPCAD REST; GeoAtlas mirrors CPCAD).
 * Clip: LABRADOR_CLIP_BBOX from mineralLands.js (same Rights-group envelope).
 *
 * Labrador extents (§5.1.13) — three definitions in this app:
 *   1. LABRADOR_CLIP_BBOX — Rights vector bakes (claims, tenure, CPCAD, land use)
 *   2. REGION='Labrador' — MODS attribute filter (province field, no numeric bbox)
 *   3. NL_LABRADOR_BOUNDS — WMS PNG window only (includes Newfoundland island)
 */

import { labradorGeometryQueryParams } from './mineralLands.js';

export const LAND_USE_MAPSERVER =
  'https://dnrmaps.gov.nl.ca/arcgis/rest/services/GeoAtlas/Land_Use/MapServer';

/** GeoAtlas Land_Use/4 — Canadian Protected Conserved Areas (CPCAD mirror). */
export const CPCAD_LAYER_ID = 4;
export const CPCAD_QUERY = `${LAND_USE_MAPSERVER}/${CPCAD_LAYER_ID}/query`;

export const CPCAD_OUT_FIELDS =
  'NAME_E,NAME_F,TYPE_E,BIOME,PA_OECM_DF,IUCN_CAT,STATUS,ESTYEAR,MECH_E,OWNER_E,MGMT_E,O_AREA_HA,LOC';

/** TYPE_E → fill for CPCAD protected/conserved areas. */
export const CPCAD_TYPE_COLORS = {
  'National Park': '#15803d',
  'Provincial Park': '#22c55e',
  'Ecological Reserve': '#059669',
  'Marine Protected Area': '#0284c7',
  'National Historic Site': '#65a30d',
  'Wildlife Reserve': '#0d9488',
  'Other Effective Area-Based Conservation Measure': '#84cc16'
};

export const CPCAD_TYPE_FALLBACK = '#166534';

/**
 * Land-use constraint sublayers (merged into one FeatureCollection).
 * Skip LIL/LISA (2/3) — covered by ATRIS + Nunatsiavut. Skip municipal (6) — Phase 3.
 */
export const LAND_USE_SOURCES = [
  {
    layerId: 0,
    kind: 'protectedAreasPlan',
    label: 'Protected Areas Plan 2020',
    color: '#b45309',
    description: 'Provincial Protected Areas Plan (2020) proposed reserves and related polygons.',
    outFields: 'NAME_E,NASP_Statu,Label,region'
  },
  {
    layerId: 1,
    kind: 'specifiedMaterialLands',
    label: 'Specified Material Lands',
    color: '#a16207',
    description: 'Specified material land parcels (aggregate / borrow context).',
    outFields: 'PARCEL_ID,TITLE,TITLE_2,AREA_SQKM,LIL_PARCEL,COMMENTS'
  },
  {
    layerId: 5,
    kind: 'publicWaterSupplies',
    label: 'Public Water Supplies',
    color: '#0369a1',
    description: 'Protected public water-supply zones (drinking-water buffers).',
    outFields: 'COMMUNITY_,SOURCENAME,DESCRIPTIO,SUPPLYSTAT,SUPPLYTYPE,PROTECTED,STATUS,REGION_MAP'
  },
  {
    layerId: 7,
    kind: 'planningAreas',
    label: 'Planning Areas',
    color: '#7c3aed',
    description: 'Municipal / regional planning area boundaries.',
    outFields: 'MUNICIPALI,MPAB_LINK,OLR_LINK,GOV_LEG'
  },
  {
    layerId: 8,
    kind: 'windEnergyReserve',
    label: 'Wind Energy Land Reserve',
    color: '#0e7490',
    description: 'Wind energy land-reserve polygons (may be empty in Labrador clip).',
    outFields: 'Area_ha,AreaName,Comments,URL'
  }
];

export const LAND_USE_KIND_COLORS = Object.fromEntries(
  LAND_USE_SOURCES.map((s) => [s.kind, s.color])
);
export const LAND_USE_KIND_FALLBACK = '#64748b';

const LAND_USE_BY_KIND = Object.fromEntries(LAND_USE_SOURCES.map((s) => [s.kind, s]));

export function resolveCpcadFillColor(typeE) {
  const key = (typeE || '').trim();
  return CPCAD_TYPE_COLORS[key] || CPCAD_TYPE_FALLBACK;
}

export function resolveLandUseFillColor(kind) {
  const key = (kind || '').trim();
  return LAND_USE_KIND_COLORS[key] || LAND_USE_KIND_FALLBACK;
}

export function resolveLandUseKindMeta(kind) {
  return LAND_USE_BY_KIND[(kind || '').trim()] || null;
}

export function enrichCpcadFeatureProperties(props) {
  const name = (props.NAME_E || '').trim();
  const type = (props.TYPE_E || '').trim();
  props.name = name || type || 'Protected area';
  props.fillColor = props.fillColor || resolveCpcadFillColor(type);
  return props;
}

export function enrichLandUseFeatureProperties(props) {
  const meta = resolveLandUseKindMeta(props.landUseKind);
  const title =
    (props.NAME_E || props.TITLE || props.AreaName || props.MUNICIPALI || props.SOURCENAME || '')
      .toString()
      .trim();
  props.name = title || meta?.label || 'Land use area';
  props.landUseKindLabel = meta?.label || props.landUseKind || 'Other';
  props.fillColor = props.fillColor || resolveLandUseFillColor(props.landUseKind);
  if (meta?.description) props.landUseDescription = meta.description;
  return props;
}

/** Legend rows for CPCAD TYPE_E values present in loaded features. */
export function buildCpcadLegendFromFeatures(features = []) {
  const counts = new Map();
  for (const f of features) {
    const type = (f.properties?.TYPE_E || '').trim() || 'Other';
    counts.set(type, (counts.get(type) || 0) + 1);
  }
  if (!counts.size) {
    return Object.entries(CPCAD_TYPE_COLORS).map(([label, color]) => ({ label, color }));
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label]) => ({
      label,
      color: label === 'Other' ? CPCAD_TYPE_FALLBACK : resolveCpcadFillColor(label)
    }));
}

/** Legend checklist rows for land-use kinds present in loaded features. */
export function buildLandUseKindTogglesFromFeatures(features = []) {
  const present = new Set(
    features.map((f) => f.properties?.landUseKind).filter((k) => LAND_USE_BY_KIND[k])
  );
  const list = present.size
    ? LAND_USE_SOURCES.filter((s) => present.has(s.kind))
    : LAND_USE_SOURCES;
  return list.map((s) => ({
    value: s.kind,
    label: s.label,
    color: s.color,
    description: s.description
  }));
}

/** MapLibre filter: show only enabled landUseKind values (empty → hide all). */
export function buildLandUseEnabledFilter(enabledKinds = []) {
  if (!enabledKinds.length) return ['==', ['get', 'landUseKind'], '__none__'];
  if (enabledKinds.length === 1) return ['==', ['get', 'landUseKind'], enabledKinds[0]];
  return ['in', ['get', 'landUseKind'], ['literal', enabledKinds]];
}

/** Live-fallback query configs for the merged land-use bake (LayerManager.paginatedQueries). */
export function buildLandUsePaginatedQueries() {
  const spatial = labradorGeometryQueryParams();
  return LAND_USE_SOURCES.map((s) => ({
    url: `${LAND_USE_MAPSERVER}/${s.layerId}/query`,
    where: '1=1',
    outFields: s.outFields,
    outSR: 4326,
    format: 'esrijson',
    maxAllowableOffset: 0.002,
    pageSize: 200,
    concurrency: 2,
    featureProps: { landUseKind: s.kind },
    ...spatial
  }));
}

export function buildCpcadPaginatedQuery() {
  return {
    url: CPCAD_QUERY,
    where: '1=1',
    outFields: CPCAD_OUT_FIELDS,
    outSR: 4326,
    format: 'esrijson',
    maxAllowableOffset: 0.002,
    pageSize: 200,
    concurrency: 2,
    ...labradorGeometryQueryParams()
  };
}
