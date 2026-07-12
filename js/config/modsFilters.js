/**
 * Lightweight MODS filter helpers for V3 cherry-pick (F4/F5).
 * Status buckets mirror live MODS STATUS labels — not B’s group taxonomy.
 *
 * ============================================================================
 * Commodity visibility matrix (primary vs secondary)
 * ============================================================================
 *
 * ~33% of Labrador MODS records list secondary commodities in COMMODS that
 * differ from primary COMNAME. Surfaces and map *colors* are primary-only so
 * one coordinate maps to one mineral visual. Sidebar search can still find
 * secondary mentions.
 *
 * | Surface                         | Match field                         | Notes |
 * |---------------------------------|-------------------------------------|-------|
 * | Map circles (multi / preset)    | `primaryCommodity` ∈ enabled set    | Legend checklist |
 * | Map circles (single mineral)    | `commodityList` includes mineral    | Broader research |
 * | Density surfaces                | `primaryCommodity` only             | Always |
 * | Occurrence list / KPI / search  | Same as map circles for commodity; status + query AND | |
 * | Popup                           | Shows Primary + Also reported       | Informational |
 *
 * `modsUsesPrimaryOnlyFilter(resolvedPickerCommodities)` encodes the picker
 * rule: null/"All"/preset/multi → primaryOnly true; single commodity → false.
 */

export const MODS_STATUS_BUCKETS = [
  'Producer',
  'Past Producer',
  'Developed Prospect',
  'Prospect',
  'Showing',
  'Indication'
];

/**
 * Whether legend/map commodity filtering should use primaryCommodity only.
 * @param {string[]|null} resolvedPickerCommodities from resolveMODSCommodities()
 *   null = All commodities; length>1 = preset/multi; length===1 = single pick.
 */
export function modsUsesPrimaryOnlyFilter(resolvedPickerCommodities) {
  return !resolvedPickerCommodities || resolvedPickerCommodities.length > 1;
}

/** Collapse Past Producer (Dormant|Exhausted) → Past Producer; pass through known buckets. */
export function normalizeMODSStatus(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^past\s*producer/i.test(s)) return 'Past Producer';
  if (/^producer$/i.test(s)) return 'Producer';
  if (/developed\s*prospect/i.test(s)) return 'Developed Prospect';
  if (/^prospect$/i.test(s)) return 'Prospect';
  if (/^showing$/i.test(s)) return 'Showing';
  if (/^indication$/i.test(s)) return 'Indication';
  return null;
}

export const OCCURRENCE_LIST_CAP = 300;

/**
 * Combine commodity filter with optional status + NMINO allowlist (search).
 * Empty status set / null allowlist = no extra constraint.
 */
export function combineMODSFilters(commodityFilter, { statuses, nminoAllowlist } = {}) {
  const parts = [];
  if (commodityFilter) parts.push(commodityFilter);

  if (statuses?.size > 0) {
    parts.push(['in', ['get', 'statusBucket'], ['literal', [...statuses]]]);
  }

  if (nminoAllowlist) {
    parts.push(['in', ['get', 'NMINO'], ['literal', nminoAllowlist]]);
  }

  if (!parts.length) return null;
  if (parts.length === 1) return parts[0];
  return ['all', ...parts];
}

/** Client-side match for list/KPI — same rules as MapLibre filters above. */
export function featureMatchesBrowserFilters(feature, { statuses, query } = {}) {
  const p = feature.properties || {};

  if (statuses?.size > 0) {
    if (!statuses.has(p.statusBucket)) return false;
  }

  const q = (query || '').trim().toLowerCase();
  if (q) {
    const hay = [
      p.name,
      p.DEPNAME,
      p.primaryCommodity,
      ...(p.commodityList || []),
      p.STATUS,
      p.statusBucket,
      p.NMINO,
      p.DEPDESC,
      p.NTS
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!hay.includes(q)) return false;
  }

  return true;
}

/**
 * @param {object[]} features
 * @param {{
 *   pickerCommodities: string[]|null,
 *   enabledCommodities: string[],
 *   primaryOnly: boolean,
 *   statuses: Set<string>,
 *   query: string
 * }} opts
 */
export function filterMODSFeatures(features, opts) {
  const {
    pickerCommodities = null,
    enabledCommodities = [],
    primaryOnly = true,
    statuses = new Set(),
    query = ''
  } = opts;

  return features.filter((f) => {
    const p = f.properties || {};
    const list = p.commodityList || [];

    if (!enabledCommodities.length) return false;

    if (pickerCommodities) {
      if (!pickerCommodities.some((c) => list.includes(c))) return false;
    }

    if (primaryOnly) {
      if (!enabledCommodities.includes(p.primaryCommodity)) return false;
    } else if (!enabledCommodities.some((c) => list.includes(c))) {
      return false;
    }

    return featureMatchesBrowserFilters(f, { statuses, query });
  });
}

export function countByStatusBucket(features) {
  const m = new Map();
  for (const f of features) {
    const b = f.properties?.statusBucket;
    if (!b) continue;
    m.set(b, (m.get(b) || 0) + 1);
  }
  return m;
}
