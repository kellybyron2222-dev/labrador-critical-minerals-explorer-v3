/**
 * Indigenous lands (SAC-ISC / ATRIS) — shared bake + app constants.
 *
 * Nunatsiavut = settled Labrador Inuit settlement region (Inuit Nunangat).
 * ATRIS = federal comprehensive land-claim assertion polygons (not mineral licences).
 */

export const INUIT_REGIONS_QUERY =
  'https://geo.sac-isc.gc.ca/geomatics/rest/services/Donnees_Ouvertes-Open_Data/Region_inuite_Inuit_Region/MapServer/0/query';

export const ATRIS_CLAIMS_QUERY =
  'https://geo.sac-isc.gc.ca/geomatics/rest/services/ATRIS_PRD/ATRIS_E_PC/MapServer/2/query';

/**
 * Curated Labrador-relevant ATRIS claims.
 * TAG_ID is the stable filter key; descriptions are plain-language for the legend.
 */
export const ATRIS_CLAIMS = [
  {
    tagId: 'CL7705m',
    label: 'Innu of Labrador (1977)',
    color: '#a21caf',
    description:
      'Comprehensive land claim by the Innu Nation covering much of Labrador — Indigenous rights assertion used for consultation and permitting context (not a mineral licence).'
  },
  {
    tagId: 'CL9105f',
    label: 'NunatuKavut Community Council (1991)',
    color: '#c026d3',
    description:
      'Claim area of the NunatuKavut Community Council (southern/central Labrador Inuit-Métis). Shows asserted traditional territory for siting awareness.'
  },
  {
    tagId: 'CL7603e',
    label: 'Labrador Inuit Association (1976) – Quebec Claim',
    color: '#86198f',
    description:
      'Historic Labrador Inuit Association claim extending into Quebec. Related to, but separate from, the settled Nunatsiavut (LISA) region.'
  },
  {
    tagId: 'CL9501a',
    label: 'Naskapi Band of Québec (1995) – Labrador Claim',
    color: '#7e22ce',
    description:
      'Naskapi claim overlapping western Labrador / Quebec border country. Relevant where Labrador projects sit near that boundary.'
  }
];

export const ATRIS_LABRADOR_TAG_IDS = ATRIS_CLAIMS.map((c) => c.tagId);

export const ATRIS_WHERE = `TAG_ID IN ('${ATRIS_LABRADOR_TAG_IDS.join("','")}')`;

export const NUNATSIAVUT_WHERE = "REGION='Nunatsiavut'";

export const NUNATSIAVUT_OUT_FIELDS = 'REGION,REGION_INUKTITUT';
export const ATRIS_OUT_FIELDS = 'ENAME,TAG_ID,CATEGORY_TYPE_EN,PROVINCES_EN,CLAIM_ID';

export const NUNATSIAVUT_FILL = '#0d9488';
export const ATRIS_FILL_FALLBACK = '#9333ea';

const ATRIS_BY_TAG = Object.fromEntries(ATRIS_CLAIMS.map((c) => [c.tagId, c]));

export function resolveNunatsiavutFillColor() {
  return NUNATSIAVUT_FILL;
}

export function resolveAtrisFillColor(enameOrTag) {
  const key = (enameOrTag || '').trim();
  if (ATRIS_BY_TAG[key]) return ATRIS_BY_TAG[key].color;
  const byLabel = ATRIS_CLAIMS.find(
    (c) => key === c.label || key.startsWith(c.label) || c.label.startsWith(key)
  );
  if (byLabel) return byLabel.color;
  if (/NunatuKavut/i.test(key)) return ATRIS_BY_TAG.CL9105f.color;
  if (/Innu of Labrador/i.test(key)) return ATRIS_BY_TAG.CL7705m.color;
  if (/Labrador Inuit Association/i.test(key)) return ATRIS_BY_TAG.CL7603e.color;
  if (/Naskapi/i.test(key)) return ATRIS_BY_TAG.CL9501a.color;
  return ATRIS_FILL_FALLBACK;
}

export function resolveAtrisClaimMeta(featureOrTag) {
  if (typeof featureOrTag === 'string') return ATRIS_BY_TAG[featureOrTag] || null;
  const tag = featureOrTag?.properties?.TAG_ID || featureOrTag?.TAG_ID;
  if (tag && ATRIS_BY_TAG[tag]) return ATRIS_BY_TAG[tag];
  const ename = (featureOrTag?.properties?.ENAME || featureOrTag?.ENAME || '').trim();
  return (
    ATRIS_CLAIMS.find((c) => ename === c.label || ename.startsWith(c.label.split('(')[0].trim())) ||
    null
  );
}

/** Legend checklist rows for ATRIS claims present in loaded features. */
export function buildAtrisClaimTogglesFromFeatures(features = []) {
  const present = new Set(
    features.map((f) => f.properties?.TAG_ID).filter((id) => ATRIS_BY_TAG[id])
  );
  const list = present.size
    ? ATRIS_CLAIMS.filter((c) => present.has(c.tagId))
    : ATRIS_CLAIMS;
  return list.map((c) => ({
    value: c.tagId,
    label: c.label,
    color: c.color,
    description: c.description
  }));
}

/** MapLibre filter: show only enabled TAG_IDs (empty → hide all). */
export function buildAtrisEnabledFilter(enabledTagIds = []) {
  if (!enabledTagIds.length) return ['==', ['get', 'TAG_ID'], '__none__'];
  if (enabledTagIds.length === 1) return ['==', ['get', 'TAG_ID'], enabledTagIds[0]];
  return ['in', ['get', 'TAG_ID'], ['literal', enabledTagIds]];
}

export function enrichAtrisFeatureProperties(props) {
  const ename = (props.ENAME || '').trim();
  props.ENAME = ename;
  const meta = resolveAtrisClaimMeta({ TAG_ID: props.TAG_ID, ENAME: ename });
  props.name = meta?.label || ename || props.TAG_ID || 'Land claim';
  props.fillColor = props.fillColor || resolveAtrisFillColor(props.TAG_ID || ename);
  if (meta?.description) props.claimDescription = meta.description;
  return props;
}

export const NUNATSIAVUT_LEGEND_ITEMS = [
  { label: 'Nunatsiavut (Labrador Inuit Settlement Area)', color: NUNATSIAVUT_FILL }
];
