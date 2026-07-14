/**
 * Buffer inventory helpers (Screen Radius owns circle placement now).
 */

import { featureIntersectsBounds, normalizeMapBounds } from './KpiEngine.js';

/**
 * Normalize a Turf bbox `[west, south, east, north]` to KPI bounds.
 * @param {[number, number, number, number]|null|undefined} box
 * @returns {{ west: number, south: number, east: number, north: number } | null}
 */
export function boundsFromBbox(box) {
  if (!box || box.length < 4 || box.some((n) => !Number.isFinite(n))) return null;
  return normalizeMapBounds({
    west: box[0],
    south: box[1],
    east: box[2],
    north: box[3]
  });
}

/**
 * Count features per layer whose geometry intersects the buffer bounds.
 * @param {{ getFeatures: (layerName: string) => GeoJSON.Feature[], layerNames: string[], bounds: { west: number, south: number, east: number, north: number } }} args
 * @returns {{ [layerName: string]: number }}
 */
export function inventoryBuffer({ getFeatures, layerNames, bounds }) {
  /** @type {{ [layerName: string]: number }} */
  const report = {};
  for (const name of layerNames) {
    const features = getFeatures(name) || [];
    report[name] = features.filter((f) => featureIntersectsBounds(f, bounds)).length;
  }
  return report;
}

/**
 * @param {{ [layerName: string]: number }} report
 * @returns {string}
 */
export function formatInventorySummary(report) {
  const parts = Object.entries(report)
    .filter(([, n]) => n > 0)
    .map(([layer, n]) => `${layer}: ${n}`);
  if (!parts.length) return 'No features in buffer';
  const total = Object.values(report).reduce((s, n) => s + n, 0);
  return `${total} in buffer · ${parts.join(', ')}`;
}
