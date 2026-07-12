/**
 * KPI metric catalog — ids used by UserPrefs + KpiEngine + Settings.
 */

export const KPI_CATALOG = [
  {
    id: 'modsInView',
    label: 'Occurrences in view',
    shortLabel: 'occ.',
    description: 'MODS points matching current filters inside the map view.',
    layer: 'modsOccurrences'
  },
  {
    id: 'modsFiltered',
    label: 'Occurrences filtered (all)',
    shortLabel: 'filtered',
    description: 'Total MODS matches for current filters across Labrador (not clipped to view).',
    layer: 'modsOccurrences'
  },
  {
    id: 'modsStatusBits',
    label: 'Occurrence status breakdown',
    shortLabel: 'status',
    description: 'Top MODS status buckets among points currently in view.',
    layer: 'modsOccurrences'
  },
  {
    id: 'facilitiesInView',
    label: 'Facilities intersecting view',
    shortLabel: 'facilities',
    description:
      'NL&L critical mineral facilities intersecting the map view (same province filter as the map layer).',
    layer: 'criticalMinerals'
  },
  {
    id: 'claimsInView',
    label: 'Claims intersecting view',
    shortLabel: 'claims',
    description: 'Map-staked mineral claims whose geometry intersects the map view.',
    layer: 'geoatlasClaims'
  },
  {
    id: 'tenureInView',
    label: 'Tenure intersecting view',
    shortLabel: 'tenure',
    description: 'Mineral tenure polygons whose geometry intersects the map view.',
    layer: 'geoatlasTenure'
  },
  {
    id: 'atrisInView',
    label: 'ATRIS claims intersecting view',
    shortLabel: 'ATRIS',
    description:
      'ATRIS land-claim polygons intersecting the view (respects legend claim toggles).',
    layer: 'atrisLandClaims'
  },
  {
    id: 'nunatsiavutInView',
    label: 'Nunatsiavut intersecting view',
    shortLabel: 'Nunatsiavut',
    description: 'Whether the Nunatsiavut settlement area geometry intersects the map view.',
    layer: 'inuitNunatsiavut'
  },
  {
    id: 'protectedInView',
    label: 'Protected areas intersecting view',
    shortLabel: 'protected',
    description: 'CPCAD protected/conserved polygons whose geometry intersects the map view.',
    layer: 'geoatlasCpcad'
  },
  {
    id: 'landUseInView',
    label: 'Land-use constraints intersecting view',
    shortLabel: 'land use',
    description:
      'Land-use constraint polygons intersecting the view (respects legend kind toggles).',
    layer: 'geoatlasLandUse'
  },
  {
    id: 'layersOn',
    label: 'Layers on',
    shortLabel: 'layers',
    description: 'How many sidebar layers (vector + WMS) are currently checked.',
    layer: null
  }
];

export const KPI_CATALOG_BY_ID = Object.fromEntries(KPI_CATALOG.map((m) => [m.id, m]));

/** Default enabled metrics (order = display order). */
export const DEFAULT_KPI_ENABLED_IDS = [
  'modsInView',
  'modsStatusBits',
  'claimsInView',
  'tenureInView'
];
