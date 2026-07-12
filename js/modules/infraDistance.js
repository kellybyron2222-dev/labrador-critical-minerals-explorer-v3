/**
 * Phase 3.4 — nearest infrastructure distances for a point (MODS prospect).
 * Distances only (km); no composite viability score.
 *
 * Sources (bake-first, independent of sidebar layer visibility):
 *   - Roads: highway/collector + resource access (whichever nearer)
 *   - Transmission: Nalcor + CanVec merge
 *   - Port: curated Labrador marine access points
 */

import { point as turfPoint } from '@turf/helpers';
import distance from '@turf/distance';

const DATA_URLS = {
  roads: './data/geoatlas-roads-labrador.geojson',
  resourceRoads: './data/geoatlas-resource-roads-labrador.geojson',
  transmission: './data/geoatlas-transmission-labrador.geojson',
  ports: './data/infra-ports-labrador.geojson'
};

/** @type {Record<string, GeoJSON.FeatureCollection|null>} */
const cache = {
  roads: null,
  resourceRoads: null,
  transmission: null,
  ports: null
};

/** @type {Promise<void>|null} */
let loadPromise = null;

async function fetchCollection(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

/** Prefetch / cache baked infra used for distance queries. */
export async function ensureInfraDistanceData() {
  if (cache.roads && cache.transmission && cache.ports && cache.resourceRoads) {
    return cache;
  }
  if (!loadPromise) {
    loadPromise = (async () => {
      const [roads, resourceRoads, transmission, ports] = await Promise.all([
        fetchCollection(DATA_URLS.roads),
        fetchCollection(DATA_URLS.resourceRoads),
        fetchCollection(DATA_URLS.transmission),
        fetchCollection(DATA_URLS.ports)
      ]);
      cache.roads = roads;
      cache.resourceRoads = resourceRoads;
      cache.transmission = transmission;
      cache.ports = ports;
    })().catch((err) => {
      loadPromise = null;
      throw err;
    });
  }
  await loadPromise;
  return cache;
}

function asPoint(featureOrCoords) {
  if (Array.isArray(featureOrCoords) && featureOrCoords.length >= 2) {
    return turfPoint([Number(featureOrCoords[0]), Number(featureOrCoords[1])]);
  }
  const coords = featureOrCoords?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  return turfPoint([Number(coords[0]), Number(coords[1])]);
}

function lineFeatures(collection) {
  return (collection?.features || []).filter(
    (f) =>
      f?.geometry &&
      (f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString')
  );
}

function pointFeatures(collection) {
  return (collection?.features || []).filter((f) => f?.geometry?.type === 'Point');
}

/** Project point onto segment in lon/lat (adequate for regional Labrador km distances). */
function nearestOnSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = 0;
  if (len2 > 0) {
    t = ((px - ax) * dx + (py - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
  }
  return [ax + t * dx, ay + t * dy];
}

/**
 * Nearest point on a LineString / MultiLineString feature (local, no extra dep).
 * @returns {{ km: number, name: string, kind: string }|null}
 */
function nearestLine(from, features, kind) {
  const [px, py] = from.geometry.coordinates;
  let best = null;

  for (const feature of features) {
    const geom = feature.geometry;
    const lines =
      geom.type === 'MultiLineString' ? geom.coordinates : geom.type === 'LineString' ? [geom.coordinates] : [];

    for (const coords of lines) {
      if (!Array.isArray(coords) || coords.length < 2) continue;
      for (let i = 0; i < coords.length - 1; i++) {
        const a = coords[i];
        const b = coords[i + 1];
        if (!a || !b || a.length < 2 || b.length < 2) continue;
        const [sx, sy] = nearestOnSegment(px, py, a[0], a[1], b[0], b[1]);
        const km = distance(from, turfPoint([sx, sy]), { units: 'kilometers' });
        if (!Number.isFinite(km)) continue;
        if (best == null || km < best.km) {
          const props = feature.properties || {};
          best = {
            km,
            name: props.name || props.ROADCLASS || props.TL_ID || kind,
            kind
          };
        }
      }
    }
  }
  return best;
}

/**
 * @returns {{ km: number, name: string, kind: string }|null}
 */
function nearestPoint(from, features, kind) {
  let best = null;
  for (const feature of features) {
    try {
      const km = distance(from, feature, { units: 'kilometers' });
      if (!Number.isFinite(km)) continue;
      if (best == null || km < best.km) {
        const props = feature.properties || {};
        best = {
          km,
          name: props.name || kind,
          kind
        };
      }
    } catch {
      // skip
    }
  }
  return best;
}

export function formatDistanceKm(km) {
  if (km == null || !Number.isFinite(km)) return null;
  if (km < 1) return `${(km * 1000).toFixed(0)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

/**
 * Sync compute given already-loaded collections (also used by tests).
 * @param {GeoJSON.Feature|[number, number]} featureOrCoords
 * @param {{ roads?: object, resourceRoads?: object, transmission?: object, ports?: object }} data
 */
export function computeNearestInfraDistancesFromData(featureOrCoords, data) {
  const from = asPoint(featureOrCoords);
  if (!from) return null;

  const highway = nearestLine(from, lineFeatures(data.roads), 'road');
  const resource = nearestLine(from, lineFeatures(data.resourceRoads), 'resource road');
  let road = highway;
  if (resource && (!road || resource.km < road.km)) {
    road = { ...resource, kind: 'resource road' };
  } else if (road) {
    road = { ...road, kind: 'road' };
  }

  const transmission = nearestLine(from, lineFeatures(data.transmission), 'transmission');
  const port = nearestPoint(from, pointFeatures(data.ports), 'port');

  return { road, transmission, port };
}

/**
 * Compute nearest road, transmission, and port for a MODS (or any) point feature.
 */
export async function computeNearestInfraDistances(featureOrCoords) {
  await ensureInfraDistanceData();
  return computeNearestInfraDistancesFromData(featureOrCoords, cache);
}

/** Reset cache (tests). */
export function _resetInfraDistanceCacheForTests() {
  cache.roads = null;
  cache.resourceRoads = null;
  cache.transmission = null;
  cache.ports = null;
  loadPromise = null;
}
