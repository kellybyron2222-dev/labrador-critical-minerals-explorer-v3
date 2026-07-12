/**
 * Esri geometry → GeoJSON helpers (polyline / point) for infrastructure bakes.
 * Polygon conversion stays in esriPolygons.js; mapPool is re-exported for convenience.
 */

import { esriPolygonToGeoJSON as ringsToPolygon } from './esriPolygons.js';

export { mapPool, esriPolygonToGeoJSON } from './esriPolygons.js';

/** Esri polyline paths → GeoJSON LineString / MultiLineString. */
export function esriPolylineToGeoJSON(geometry) {
  const paths = geometry?.paths;
  if (!Array.isArray(paths) || !paths.length) return null;
  const clean = paths.filter((p) => Array.isArray(p) && p.length >= 2);
  if (!clean.length) return null;
  if (clean.length === 1) return { type: 'LineString', coordinates: clean[0] };
  return { type: 'MultiLineString', coordinates: clean };
}

/** Esri point (x/y) → GeoJSON Point. */
export function esriPointToGeoJSON(geometry) {
  if (geometry == null) return null;
  const x = geometry.x;
  const y = geometry.y;
  if (typeof x !== 'number' || typeof y !== 'number') return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { type: 'Point', coordinates: [x, y] };
}

/**
 * Auto-detect Esri geometry type from rings / paths / x,y.
 * @returns {GeoJSON.Geometry|null}
 */
export function esriGeometryToGeoJSON(geometry) {
  if (!geometry) return null;
  if (Array.isArray(geometry.rings)) return ringsToPolygon(geometry);
  if (Array.isArray(geometry.paths)) return esriPolylineToGeoJSON(geometry);
  if (geometry.x != null && geometry.y != null) return esriPointToGeoJSON(geometry);
  return null;
}

export function esriPolylineFeatureToGeoJSON(feature, enrich) {
  const geometry = esriPolylineToGeoJSON(feature?.geometry);
  if (!geometry) return null;
  const props = { ...(feature.attributes || {}) };
  const out = { type: 'Feature', properties: props, geometry };
  return enrich ? enrich(out) || out : out;
}
