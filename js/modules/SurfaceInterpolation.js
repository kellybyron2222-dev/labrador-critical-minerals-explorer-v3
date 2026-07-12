/**
 * Module: MODS occurrence-density surfaces
 *
 * Turns scattered MODS occurrence points into filled "regions of occurrence"
 * polygons. Pipeline per enabled mineral:
 *   1. Group points by commodity
 *   2. DBSCAN into local spatial clusters
 *   3. Build a non-normalized inverse-distance density grid (peaks at
 *      clusters, falls off beyond MAX_INFLUENCE_KM) weighted by STATUS
 *   4. Slice into isobands + soft edges with polygonSmooth
 *
 * IMPORTANT — this is NOT a concentration/grade/prospectivity surface. MODS
 * has no assay/tonnage fields (see BUILD_PLAN.md "Quantitative data" note);
 * this interpolates occurrence *presence*, optionally weighted by economic
 * maturity (STATUS), to show "where occurrences cluster" as a smooth trend
 * rather than a scatter of dots. True concentration surfaces would need
 * `GeoAtlas/Geochemistry_All` (lake/till sediment ppm data) - future work.
 */

import { point, featureCollection } from '@turf/helpers';
import bbox from '@turf/bbox';
import distance from '@turf/distance';
import clustersDbscan from '@turf/clusters-dbscan';
import pointGrid from '@turf/point-grid';
import isobands from '@turf/isobands';
import polygonSmooth from '@turf/polygon-smooth';

// Economic-maturity weight for IDW input values - a Producer cluster should
// pull the surface "up" more than a cluster of unconfirmed Indications, even
// at equal point density. Mirrors the maturity ladder used for circle radius
// (MODS_STATUS_RADIUS in layerConfig.js) but as an IDW weight, not a size.
const STATUS_WEIGHTS = {
  'Producer': 3,
  'Past Producer (Dormant)': 2.5,
  'Past Producer (Exhausted)': 2.5,
  'Developed Prospect': 2,
  'Prospect': 1.5,
  'Showing': 1,
  'Indication': 0.75
};
const DEFAULT_STATUS_WEIGHT = 1;

// Target grid dimension (cells along the longer bbox axis) - keeps compute
// roughly constant regardless of how large/small a local cluster's footprint is.
const TARGET_GRID_CELLS = 40;
const MIN_CELL_SIZE_KM = 4;
const MAX_CELL_SIZE_KM = 20;

// Tight padding around each cluster bbox (was 40 km regionally).
const BBOX_PADDING_KM = 12;

// Drop grid cells farther than this from any input point so IDW tails
// cannot bridge gaps between distant clusters.
const MAX_INFLUENCE_KM = 35;

// DBSCAN: points within this distance form one local occurrence area.
const CLUSTER_MAX_DISTANCE_KM = 30;
const CLUSTER_MIN_POINTS = 4;

// Minimum points needed for a meaningful IDW + isoband surface.
const MIN_INTERPOLATION_POINTS = 6;

// IDW distance-decay exponent (turf's `weight` option). Slightly softer than
// the conventional 2 so tier boundaries graduate more gently.
const IDW_POWER = 1.5;

// Number of isoband tiers (including the lowest "background" tier, which is
// deliberately not rendered - see `minTierToRender` in layerConfig.js).
const TIER_COUNT = 5;

const SMOOTH_ITERATIONS = 2;

/**
 * Builds a weighted point FeatureCollection ready for turf.interpolate from
 * raw MODS GeoJSON features. `val` = STATUS-based economic-maturity weight
 * (see STATUS_WEIGHTS above); every matching feature contributes at least
 * some weight, so pure occurrence density still comes through even where
 * all points share one status.
 */
function buildWeightedPoints(features) {
  const points = features.map((feature) => {
    const [lon, lat] = feature.geometry.coordinates;
    const weight = STATUS_WEIGHTS[feature.properties.STATUS] ?? DEFAULT_STATUS_WEIGHT;
    return point([lon, lat], { val: weight });
  });
  return featureCollection(points);
}

/** Padded bounding box around a point set, in [west, south, east, north]. */
function paddedBbox(pointsFC) {
  const [west, south, east, north] = bbox(pointsFC);
  const padDeg = BBOX_PADDING_KM / 111; // ~111km per degree latitude, close enough for padding
  return [west - padDeg, south - padDeg, east + padDeg, north + padDeg];
}

/** Picks a cellSize (km) so the grid has roughly TARGET_GRID_CELLS cells along its longer side. */
function chooseCellSize(bboxCoords) {
  const [west, south, east, north] = bboxCoords;
  const widthKm = distance([west, south], [east, south], { units: 'kilometers' });
  const heightKm = distance([west, south], [west, north], { units: 'kilometers' });
  const longerSide = Math.max(widthKm, heightKm);
  const raw = longerSide / TARGET_GRID_CELLS;
  return Math.min(MAX_CELL_SIZE_KM, Math.max(MIN_CELL_SIZE_KM, raw));
}

/** Quantile breaks (tierCount+1 edges -> tierCount bands) from a sorted value array. */
function quantileBreaks(sortedValues, tierCount) {
  const breaks = [];
  for (let i = 0; i <= tierCount; i++) {
    const idx = Math.min(sortedValues.length - 1, Math.floor((i / tierCount) * (sortedValues.length - 1)));
    breaks.push(sortedValues[idx]);
  }
  // isobands requires strictly increasing breaks; nudge any ties apart.
  for (let i = 1; i < breaks.length; i++) {
    if (breaks[i] <= breaks[i - 1]) breaks[i] = breaks[i - 1] + 1e-6;
  }
  return breaks;
}

/**
 * Groups MODS features by primary commodity (`primaryCommodity` / COMNAME).
 * Secondary minerals in COMMODS do not duplicate points into other buckets.
 */
export function groupFeaturesByCommodity(features) {
  const groups = new Map();
  for (const feature of features) {
    const commodity = feature.properties?.primaryCommodity || feature.properties?.COMNAME;
    if (!commodity) continue;
    if (!groups.has(commodity)) groups.set(commodity, []);
    groups.get(commodity).push(feature);
  }
  return groups;
}

/**
 * Splits a weighted point FeatureCollection into local DBSCAN clusters.
 * Noise points (cluster = -1) are omitted; clusters below
 * MIN_INTERPOLATION_POINTS are skipped at the surface stage.
 *
 * @returns {{ clusterId: number, features: GeoJSON.Feature[] }[]}
 */
function clusterOccurrencePoints(pointsFC) {
  if (!pointsFC.features.length) return [];

  let clustered;
  try {
    clustered = clustersDbscan(pointsFC, CLUSTER_MAX_DISTANCE_KM, {
      minPoints: CLUSTER_MIN_POINTS,
      units: 'kilometers'
    });
  } catch (error) {
    console.error('Occurrence surface clustering failed:', error);
    return [{ clusterId: 0, features: pointsFC.features }];
  }

  const byId = new Map();
  for (const feature of clustered.features) {
    const id = feature.properties.cluster;
    if (id === undefined || id === null || id < 0) continue;
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push(feature);
  }

  return Array.from(byId.entries()).map(([clusterId, features]) => ({
    clusterId,
    features
  }));
}

/**
 * Builds a density potential grid over `bbox`: each cell gets
 *   sum_i (statusWeight_i / (distance_i ^ IDW_POWER))
 * for points within MAX_INFLUENCE_KM. Unlike turf.interpolate (normalized
 * IDW), this is intentionally *not* normalized — identical status weights
 * still produce peaks at clusters and fall to zero away from points, which
 * is what "occurrence density" needs.
 */
function buildDensityGrid(pointsFC, bboxCoords, cellSize) {
  const grid = pointGrid(bboxCoords, cellSize, { units: 'kilometers' });
  const eps = 1e-6;

  for (const cell of grid.features) {
    let sum = 0;
    for (const pt of pointsFC.features) {
      const d = distance(cell, pt, { units: 'kilometers' });
      if (d > MAX_INFLUENCE_KM) continue;
      const w = pt.properties.val ?? DEFAULT_STATUS_WEIGHT;
      sum += w / (d ** IDW_POWER + eps);
    }
    cell.properties.val = sum;
  }

  return grid;
}

/**
 * Density grid + isobands + smooth for one spatial cluster of weighted points.
 *
 * @param {GeoJSON.Feature[]} clusterFeatures - weighted points (property `val`)
 * @param {{tierCount?: number, commodity: string, clusterId: number}} options
 * @returns {GeoJSON.Feature[]} isoband polygons tagged with commodity/clusterId/tier
 */
function computeClusterSurface(clusterFeatures, options) {
  const tierCount = options.tierCount || TIER_COUNT;
  if (!clusterFeatures || clusterFeatures.length < MIN_INTERPOLATION_POINTS) return [];

  const pointsFC = featureCollection(clusterFeatures);
  const bboxCoords = paddedBbox(pointsFC);
  const cellSize = chooseCellSize(bboxCoords);

  let grid;
  try {
    grid = buildDensityGrid(pointsFC, bboxCoords, cellSize);
  } catch (error) {
    console.error('Occurrence surface density grid failed:', error);
    return [];
  }

  if (!grid?.features?.length) return [];

  const values = grid.features
    .map((f) => f.properties.val)
    .filter((v) => Number.isFinite(v) && v > 0);
  if (values.length < 4) return [];

  values.sort((a, b) => a - b);
  // Include an explicit 0 floor so empty grid cells fall into tier 0
  // (hidden by minTierToRender) rather than polluting quantile edges.
  const breaks = [0, ...quantileBreaks(values, tierCount).slice(1)];
  // Re-nudge after prepending 0.
  for (let i = 1; i < breaks.length; i++) {
    if (breaks[i] <= breaks[i - 1]) breaks[i] = breaks[i - 1] + 1e-6;
  }

  if (breaks[0] === breaks[breaks.length - 1]) return [];

  let bands;
  try {
    bands = isobands(grid, breaks, {
      zProperty: 'val',
      breaksProperties: breaks.slice(0, -1).map((_, tier) => ({
        tier,
        commodity: options.commodity,
        clusterId: options.clusterId
      }))
    });
  } catch (error) {
    console.error('Occurrence surface isoband generation failed:', error);
    return [];
  }

  if (!bands?.features?.length) return [];

  for (const feature of bands.features) {
    feature.properties = feature.properties || {};
    if (feature.properties.commodity == null) feature.properties.commodity = options.commodity;
    if (feature.properties.clusterId == null) feature.properties.clusterId = options.clusterId;
  }

  return bands.features.map(smoothFeatureSafely).filter(hasDrawablePolygon);
}

/**
 * Softens hard isoband rings. Falls back to the original geometry when
 * polygonSmooth collapses a thin band into an empty multipolygon.
 */
function smoothFeatureSafely(feature) {
  if (!hasDrawablePolygon(feature)) return feature;
  try {
    const smoothed = polygonSmooth(featureCollection([feature]), {
      iterations: SMOOTH_ITERATIONS
    });
    const result = smoothed?.features?.[0];
    if (result && hasDrawablePolygon(result)) {
      result.properties = { ...feature.properties, ...result.properties };
      return result;
    }
  } catch {
    // keep original
  }
  return feature;
}

/** True when a polygon/multipolygon has at least one ring with real coordinates. */
function hasDrawablePolygon(feature) {
  const geom = feature?.geometry;
  if (!geom) return false;
  if (geom.type === 'Polygon') {
    return Array.isArray(geom.coordinates?.[0]) && geom.coordinates[0].length >= 4;
  }
  if (geom.type === 'MultiPolygon') {
    return geom.coordinates.some(
      (poly) => Array.isArray(poly?.[0]) && poly[0].length >= 4
    );
  }
  return false;
}

/**
 * Computes localized occurrence-density surfaces for one commodity's points:
 * DBSCAN → per-cluster IDW + influence mask → isobands → polygonSmooth.
 *
 * @param {GeoJSON.Feature[]} features - MODS points that include this commodity
 * @param {string} commodity
 * @param {{tierCount?: number}} [options]
 * @returns {GeoJSON.FeatureCollection} may be empty if too few points / no clusters
 */
export function computeCommoditySurface(features, commodity, options = {}) {
  const empty = featureCollection([]);
  if (!features?.length || !commodity) return empty;

  const pointsFC = buildWeightedPoints(features);
  const clusters = clusterOccurrencePoints(pointsFC);
  const out = [];

  for (const { clusterId, features: clusterFeatures } of clusters) {
    out.push(
      ...computeClusterSurface(clusterFeatures, {
        tierCount: options.tierCount || TIER_COUNT,
        commodity,
        clusterId
      })
    );
  }

  return featureCollection(out);
}

/**
 * Orchestrator: compute surfaces only for the requested commodities
 * (lazy — callers pass the currently enabled mineral list).
 *
 * @param {GeoJSON.Feature[]} features - typically the full loaded MODS set (or commodity-filtered)
 * @param {string[]} commodities - mineral names to compute
 * @param {{tierCount?: number}} [options]
 * @returns {GeoJSON.FeatureCollection}
 */
export function computeOccurrenceSurfaces(features, commodities, options = {}) {
  const empty = featureCollection([]);
  if (!features?.length || !commodities?.length) return empty;

  const groups = groupFeaturesByCommodity(features);
  const out = [];

  for (const commodity of commodities) {
    const group = groups.get(commodity);
    if (!group?.length) continue;
    const surface = computeCommoditySurface(group, commodity, options);
    out.push(...surface.features);
  }

  return featureCollection(out);
}

/**
 * Legacy single-call entry used by older callers. Prefer
 * `computeOccurrenceSurfaces` / `computeCommoditySurface` for per-mineral
 * localized surfaces. Kept as a thin wrapper that treats the input as one
 * anonymous commodity ("_").
 *
 * @param {GeoJSON.Feature[]} features
 * @param {{tierCount?: number}} [options]
 * @returns {GeoJSON.FeatureCollection|null}
 */
export function computeOccurrenceSurface(features, options = {}) {
  if (!features || features.length < MIN_INTERPOLATION_POINTS) return null;
  const result = computeCommoditySurface(features, '_', options);
  return result.features.length ? result : null;
}
