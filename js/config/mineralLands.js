/**
 * Shared Mineral Lands (GeoAtlas) constants — used by bake scripts,
 * layerConfig, and LayerManager enrichment.
 *
 * Labrador extents (§5.1.13) — three definitions in this app:
 *   1. LABRADOR_CLIP_BBOX (below) — Rights vector bakes: claims, tenure,
 *      CPCAD, land use. South of Strait of Belle Isle (~51.5°N); mainland
 *      Labrador only.
 *   2. REGION='Labrador' — MODS attribute filter (province field; no bbox).
 *   3. NL_LABRADOR_BOUNDS (layerConfig WMS) — PNG window including the
 *      island of Newfoundland. Deliberately NOT used for Rights clips.
 */

export const LABRADOR_CLIP_BBOX = {
  xmin: -67.8,
  ymin: 51.5,
  xmax: -55.5,
  ymax: 60.6,
  spatialReference: { wkid: 4326 }
};

/** ArcGIS REST geometry filter params for Labrador envelope intersects. */
export function labradorGeometryQueryParams() {
  return {
    geometry: JSON.stringify(LABRADOR_CLIP_BBOX),
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects'
  };
}

/** Status → fill color for map-staked claims (muted; Issued is dominant). */
export const CLAIMS_STATUS_COLORS = {
  Issued: '#d97706',
  Recorded: '#0ea5e9',
  Pending: '#eab308',
  Grouped: '#a855f7',
  'Partially Surrendered': '#f97316',
  Cancelled: '#64748b'
};

export const CLAIMS_STATUS_FALLBACK = '#94a3b8';

/**
 * Park / protected TYPEDESC values excluded from mineral tenure.
 * Those polygons live on the CPCAD Protected & conserved layer instead
 * (avoids duplicating Torngat / Mealy / provincial parks in both layers).
 */
export const TENURE_EXCLUDED_PARK_TYPES = [
  'National Park',
  'Provincial Park',
  'Ecological Reserve',
  'National Historic Park'
];

/** ArcGIS where: Labrador tenure minus parks (parks → CPCAD). */
export const TENURE_WHERE = `TYPEDESC NOT IN ('${TENURE_EXCLUDED_PARK_TYPES.join("','")}')`;

/** TYPEDESC → fill for mineral tenure (mineral-rights types only). */
export const TENURE_TYPE_COLORS = {
  'Mining Lease': '#dc2626',
  'Exempt Mineral Land': '#2563eb',
  'Impost Land': '#16a34a',
  'Federal Land': '#475569',
  LIL: '#7c3aed'
};

export const TENURE_TYPE_FALLBACK = '#94a3b8';

export function resolveClaimsFillColor(status) {
  const key = (status || '').trim();
  return CLAIMS_STATUS_COLORS[key] || CLAIMS_STATUS_FALLBACK;
}

export function resolveTenureFillColor(typedesc) {
  const key = (typedesc || '').trim();
  return TENURE_TYPE_COLORS[key] || TENURE_TYPE_FALLBACK;
}

/** Legend rows for STATUS values present in loaded claims features. */
export function buildClaimsLegendFromFeatures(features = []) {
  const counts = new Map();
  for (const f of features) {
    const status = (f.properties?.STATUS || '').trim() || 'Other / unknown';
    counts.set(status, (counts.get(status) || 0) + 1);
  }
  if (!counts.size) {
    return Object.entries(CLAIMS_STATUS_COLORS).map(([label, color]) => ({ label, color }));
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label]) => ({
      label,
      color: label === 'Other / unknown' ? CLAIMS_STATUS_FALLBACK : resolveClaimsFillColor(label)
    }));
}

/** Legend rows for TYPEDESC values present in loaded tenure features (not the full provincial catalog). */
export function buildTenureLegendFromFeatures(features = []) {
  const counts = new Map();
  for (const f of features) {
    const type = (f.properties?.TYPEDESC || '').trim() || 'Other';
    counts.set(type, (counts.get(type) || 0) + 1);
  }
  if (!counts.size) {
    return Object.entries(TENURE_TYPE_COLORS).map(([label, color]) => ({ label, color }));
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label]) => ({
      label,
      color: label === 'Other' ? TENURE_TYPE_FALLBACK : resolveTenureFillColor(label)
    }));
}

export const CLAIMS_OUT_FIELDS =
  'LICENSE_NBR,FILENUM,CLIENT_NAME,LOCATION,NUMCLAIMS,STATUS,STAKEDATE,ISSDATE,EXPIRYDATE,RPTDUE,MAPSHEETS,TOTAL_EXP';

export const TENURE_OUT_FIELDS =
  'TYPECODE,TYPEDESC,FEATURENAME,COMMENTS,COMPANY_NAME,NTSMAP';

export const MINERAL_LANDS_QUERY_BASE =
  'https://dnrmaps.gov.nl.ca/arcgis/rest/services/GeoAtlas/Mineral_Lands/MapServer';
