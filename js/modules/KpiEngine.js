/**
 * Computes viewport-aware KPI metric values for the bottom HUD.
 */

import { KPI_CATALOG_BY_ID } from '../config/kpiCatalog.js';
import { MODS_STATUS_BUCKETS, countByStatusBucket } from '../config/modsFilters.js';
import { NL_LABRADOR_PROVINCE_NAME } from '../config/layerConfig.js';

const STATUS_SHORT = {
  Producer: 'producing',
  'Past Producer': 'past',
  'Developed Prospect': 'developed',
  Prospect: 'prospect',
  Showing: 'showing',
  Indication: 'indication'
};

/**
 * @param {{ west: number, south: number, east: number, north: number }} bounds
 * @param {[number, number]} coords [lon, lat]
 */
export function pointInBounds(bounds, coords) {
  if (!coords || coords.length < 2) return false;
  const [lon, lat] = coords;
  return lon >= bounds.west && lon <= bounds.east && lat >= bounds.south && lat <= bounds.north;
}

/** Expand ring/polygon coordinate arrays into a flat [lon,lat] list. */
function collectPositions(coords, out = []) {
  if (!Array.isArray(coords) || !coords.length) return out;
  if (typeof coords[0] === 'number') {
    out.push(coords);
    return out;
  }
  coords.forEach((c) => collectPositions(c, out));
  return out;
}

export function featureBBox(feature) {
  const positions = collectPositions(feature?.geometry?.coordinates);
  if (!positions.length) return null;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lon, lat] of positions) {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    if (lon < west) west = lon;
    if (lon > east) east = lon;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  if (!Number.isFinite(west)) return null;
  return { west, south, east, north };
}

export function bboxIntersects(a, b) {
  if (!a || !b) return false;
  return !(a.east < b.west || a.west > b.east || a.north < b.south || a.south > b.north);
}

/** Ray-cast point-in-ring (ring is [[lon,lat],...] closed or open). */
function pointInRing(point, ring) {
  if (!ring?.length) return false;
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInPolygonCoords(point, coords) {
  // Polygon: [ring, hole, ...]; MultiPolygon handled by caller.
  if (!coords?.[0]) return false;
  if (!pointInRing(point, coords[0])) return false;
  for (let h = 1; h < coords.length; h++) {
    if (pointInRing(point, coords[h])) return false;
  }
  return true;
}

function segmentIntersects(a1, a2, b1, b2) {
  const orient = (p, q, r) => {
    const v = (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]);
    if (v === 0) return 0;
    return v > 0 ? 1 : 2;
  };
  const onSeg = (p, q, r) =>
    Math.min(p[0], r[0]) <= q[0] &&
    q[0] <= Math.max(p[0], r[0]) &&
    Math.min(p[1], r[1]) <= q[1] &&
    q[1] <= Math.max(p[1], r[1]);

  const o1 = orient(a1, a2, b1);
  const o2 = orient(a1, a2, b2);
  const o3 = orient(b1, b2, a1);
  const o4 = orient(b1, b2, a2);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSeg(a1, b1, a2)) return true;
  if (o2 === 0 && onSeg(a1, b2, a2)) return true;
  if (o3 === 0 && onSeg(b1, a1, b2)) return true;
  if (o4 === 0 && onSeg(b1, a2, b2)) return true;
  return false;
}

function ringEdgesIntersectViewport(ring, bounds) {
  const corners = [
    [bounds.west, bounds.south],
    [bounds.east, bounds.south],
    [bounds.east, bounds.north],
    [bounds.west, bounds.north],
    [bounds.west, bounds.south]
  ];
  if (!ring?.length) return false;
  for (let i = 0; i < ring.length - 1; i++) {
    const a1 = ring[i];
    const a2 = ring[i + 1];
    for (let e = 0; e < 4; e++) {
      if (segmentIntersects(a1, a2, corners[e], corners[e + 1])) return true;
    }
  }
  return false;
}

function polygonTouchesBounds(coords, bounds) {
  // Vertex in view?
  const positions = collectPositions(coords);
  if (positions.some((c) => pointInBounds(bounds, c))) return true;

  // Viewport corner inside polygon (covers view fully inside a large tenure)?
  const corners = [
    [bounds.west, bounds.south],
    [bounds.east, bounds.south],
    [bounds.east, bounds.north],
    [bounds.west, bounds.north]
  ];
  if (corners.some((c) => pointInPolygonCoords(c, coords))) return true;

  // Edge cross?
  for (const ring of coords) {
    if (ringEdgesIntersectViewport(ring, bounds)) return true;
  }
  return false;
}

/**
 * True if geometry intersects the viewport (points: containment;
 * polygons: true geometry touch, not bbox-only).
 */
export function featureIntersectsBounds(feature, bounds) {
  const type = feature?.geometry?.type;
  if (type === 'Point') {
    return pointInBounds(bounds, feature.geometry.coordinates);
  }
  if (type === 'MultiPoint') {
    return (feature.geometry.coordinates || []).some((c) => pointInBounds(bounds, c));
  }

  // Fast reject on envelope.
  if (!bboxIntersects(featureBBox(feature), bounds)) return false;

  if (type === 'Polygon') {
    return polygonTouchesBounds(feature.geometry.coordinates, bounds);
  }
  if (type === 'MultiPolygon') {
    return (feature.geometry.coordinates || []).some((poly) => polygonTouchesBounds(poly, bounds));
  }
  // LineString / fallback: any vertex in view or bbox overlap (bbox already passed).
  const positions = collectPositions(feature.geometry?.coordinates);
  return positions.some((c) => pointInBounds(bounds, c));
}

/**
 * Normalize MapLibre LngLatBounds (getWest/…) or a plain {west,south,east,north}.
 * @param {object | null | undefined} bounds
 * @returns {{ west: number, south: number, east: number, north: number } | null}
 */
export function normalizeMapBounds(bounds) {
  if (!bounds) return null;
  if (typeof bounds.getWest === 'function') {
    return {
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth()
    };
  }
  if (
    Number.isFinite(bounds.west) &&
    Number.isFinite(bounds.south) &&
    Number.isFinite(bounds.east) &&
    Number.isFinite(bounds.north)
  ) {
    return {
      west: bounds.west,
      south: bounds.south,
      east: bounds.east,
      north: bounds.north
    };
  }
  return null;
}

/** Mirror MapLibre facilities filter: province string contains NL&L. */
export function featureMatchesFacilitiesFilter(feature) {
  const provinces = feature?.properties?.ProvincesEN;
  if (provinces == null) return false;
  return String(provinces).includes(NL_LABRADOR_PROVINCE_NAME);
}

function boundsFromMap(map) {
  if (!map) return null;
  return normalizeMapBounds(map.getBounds());
}

/**
 * @param {{
 *   map: import('maplibre-gl').Map,
 *   enabledIds: string[],
 *   isLayerOn: (layerName: string) => boolean,
 *   getFeatures: (layerName: string) => object[],
 *   modsFiltered: object[],
 *   atrisEnabledTagIds: string[]|null,
 *   layersOnCount: number
 * }} ctx
 * @returns {{ id: string, kind: 'count'|'bits'|'flag', label: string, value?: number, bits?: {label:string,count:number}[], flag?: boolean }[]}
 */
export function computeKpiMetrics(ctx) {
  const bounds = boundsFromMap(ctx.map);
  const out = [];

  for (const id of ctx.enabledIds) {
    const meta = KPI_CATALOG_BY_ID[id];
    if (!meta) continue;

    if (meta.layer && !ctx.isLayerOn(meta.layer)) continue;

    if (id === 'modsInView') {
      if (!bounds) continue;
      const n = ctx.modsFiltered.filter((f) => featureIntersectsBounds(f, bounds)).length;
      out.push({ id, kind: 'count', label: meta.shortLabel, value: n });
      continue;
    }

    if (id === 'modsFiltered') {
      out.push({ id, kind: 'count', label: meta.shortLabel, value: ctx.modsFiltered.length });
      continue;
    }

    if (id === 'modsStatusBits') {
      if (!bounds) continue;
      const inView = ctx.modsFiltered.filter((f) => featureIntersectsBounds(f, bounds));
      const byStatus = countByStatusBucket(inView);
      const bits = MODS_STATUS_BUCKETS.filter((b) => byStatus.get(b))
        .slice(0, 4)
        .map((b) => ({ label: STATUS_SHORT[b] || b, count: byStatus.get(b) }));
      if (!bits.length) continue;
      out.push({ id, kind: 'bits', label: meta.shortLabel, bits });
      continue;
    }

    if (id === 'facilitiesInView') {
      if (!bounds) continue;
      const facilityLayers = [
        'infraMines',
        'infraProcessing',
        'infraExploration',
        'infraDevelopment'
      ];
      const seen = new Set();
      let n = 0;
      for (const layer of facilityLayers) {
        for (const f of ctx.getFeatures(layer).filter(featureMatchesFacilitiesFilter)) {
          const key =
            f.properties?.PropertyNameEN ||
            f.properties?.name ||
            `${f.geometry?.coordinates?.[0]},${f.geometry?.coordinates?.[1]}`;
          if (seen.has(key)) continue;
          seen.add(key);
          if (featureIntersectsBounds(f, bounds)) n += 1;
        }
      }
      out.push({ id, kind: 'count', label: meta.shortLabel, value: n });
      continue;
    }

    if (id === 'claimsInView' || id === 'tenureInView' || id === 'nunatsiavutInView' || id === 'protectedInView') {
      if (!bounds) continue;
      const layer = meta.layer;
      const features = ctx.getFeatures(layer);
      if (!features.length) continue;
      const n = features.filter((f) => featureIntersectsBounds(f, bounds)).length;
      if (id === 'nunatsiavutInView') {
        out.push({ id, kind: 'flag', label: meta.shortLabel, flag: n > 0 });
      } else {
        out.push({ id, kind: 'count', label: meta.shortLabel, value: n });
      }
      continue;
    }

    if (id === 'atrisInView') {
      if (!bounds) continue;
      let features = ctx.getFeatures('atrisLandClaims');
      const tags = ctx.atrisEnabledTagIds;
      if (Array.isArray(tags)) {
        if (!tags.length) continue;
        const set = new Set(tags);
        features = features.filter((f) => set.has(f.properties?.TAG_ID));
      }
      if (!features.length) continue;
      const n = features.filter((f) => featureIntersectsBounds(f, bounds)).length;
      out.push({ id, kind: 'count', label: meta.shortLabel, value: n });
      continue;
    }

    if (id === 'landUseInView') {
      if (!bounds) continue;
      let features = ctx.getFeatures('geoatlasLandUse');
      const kinds = ctx.landUseEnabledKinds;
      if (Array.isArray(kinds)) {
        if (!kinds.length) continue;
        const set = new Set(kinds);
        features = features.filter((f) => set.has(f.properties?.landUseKind));
      }
      if (!features.length) continue;
      const n = features.filter((f) => featureIntersectsBounds(f, bounds)).length;
      out.push({ id, kind: 'count', label: meta.shortLabel, value: n });
      continue;
    }

    if (id === 'layersOn') {
      out.push({ id, kind: 'count', label: meta.shortLabel, value: ctx.layersOnCount });
    }
  }

  return out;
}
