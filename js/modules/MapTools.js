/**
 * Soft-launch geo toolbox: Measure (up to 3 paths) + Polygon (multiple closed rings).
 * Labels: measure along the line; polygon area at true polygon center. No toolbar HUD text.
 */

import maplibregl from 'maplibre-gl';
import { point as turfPoint, polygon as turfPolygon } from '@turf/helpers';
import distance from '@turf/distance';
import area from '@turf/area';
import bbox from '@turf/bbox';
import { setDrawnPolygon, clearDrawnPolygon } from './ScreenAoi.js';

export const MEASURE_COLOR = '#111111';
export const POLYGON_COLOR = '#111111';
export const MAX_MEASUREMENTS = 3;
export const MAX_POLYGONS = 8;

const MEASURE_SRC = 'softlaunch-measure';
const POLYGON_SRC = 'softlaunch-polygon';
const SQUARE_IMG = 'tool-vertex-square';

let coordMarker = null;

/** @type {'none'|'measure'|'polygon'} */
let activeTool = 'none';

/** True while Measure or Polygon drawing is active (suppresses map feature popups). */
export function isMapToolDrawing() {
  return activeTool === 'measure' || activeTool === 'polygon';
}

/**
 * @param {Array<[number, number]>} points
 */
export function pathLengthKm(points) {
  let sum = 0;
  for (let i = 0; i < points.length - 1; i++) {
    sum += distance(turfPoint(points[i]), turfPoint(points[i + 1]), { units: 'kilometers' });
  }
  return sum;
}

/**
 * @param {Array<[number, number]>} points
 */
export function lastLegKm(points) {
  if (points.length < 2) return 0;
  return distance(
    turfPoint(points[points.length - 2]),
    turfPoint(points[points.length - 1]),
    { units: 'kilometers' }
  );
}

/**
 * @param {number} km
 */
export function formatKm(km) {
  if (!Number.isFinite(km) || km <= 0) return '';
  return km < 10 ? `${km.toFixed(2)} km` : `${Math.round(km * 10) / 10} km`;
}

/**
 * @param {number} m2
 */
export function formatAreaKm2(m2) {
  const km2 = m2 / 1e6;
  if (!Number.isFinite(km2) || km2 <= 0) return '';
  return km2 < 10 ? `${km2.toFixed(2)} km²` : `${Math.round(km2 * 10) / 10} km²`;
}

/**
 * Planar shoelace centroid of a ring (lon/lat treated as plane — fine for on-map labels).
 * @param {Array<[number, number]>} ring
 * @returns {[number, number]|null}
 */
export function ringCentroid(ring) {
  if (!ring?.length) return null;
  const closed =
    ring.length > 1 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1]
      ? ring
      : [...ring, ring[0]];
  let twiceArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < closed.length - 1; i++) {
    const [x0, y0] = closed[i];
    const [x1, y1] = closed[i + 1];
    const cross = x0 * y1 - x1 * y0;
    twiceArea += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  if (Math.abs(twiceArea) < 1e-18) {
    // Degenerate — fall back to vertex average
    let sx = 0;
    let sy = 0;
    const n = closed.length - 1;
    for (let i = 0; i < n; i++) {
      sx += closed[i][0];
      sy += closed[i][1];
    }
    return n ? [sx / n, sy / n] : null;
  }
  const a = twiceArea * 3;
  return [cx / a, cy / a];
}

/**
 * @param {import('maplibre-gl').Map} map
 */
function ensureSquareImage(map) {
  if (map.hasImage(SQUARE_IMG)) return;
  const s = 8;
  const data = new Uint8Array(s * s * 4);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const i = (y * s + x) * 4;
      const edge = x === 0 || y === 0 || x === s - 1 || y === s - 1;
      data[i] = edge ? 255 : 17;
      data[i + 1] = edge ? 255 : 17;
      data[i + 2] = edge ? 255 : 17;
      data[i + 3] = 255;
    }
  }
  map.addImage(SQUARE_IMG, { width: s, height: s, data }, { pixelRatio: 2 });
}

/**
 * @param {import('maplibre-gl').Map} map
 * @returns {Promise<{ destroy: () => void, mode: () => string }>}
 */
export async function attachMapTools(map) {
  const host = document.getElementById('map-toolbar-tools');
  if (!host) {
    console.warn('map-toolbar-tools missing — tools not mounted');
    return { destroy() {}, mode: () => 'none' };
  }

  /** @type {Array<{ id: string, points: Array<[number, number]> }>} */
  let measures = [];
  /** @type {Array<[number, number]>} */
  let draftMeasure = [];

  /** @type {Array<{ id: string, points: Array<[number, number]>, feature: GeoJSON.Feature }>} */
  let polygons = [];
  /** @type {Array<[number, number]>} */
  let draftPoly = [];

  let idSeq = 1;
  const nextId = (prefix) => `${prefix}-${idSeq++}`;

  host.innerHTML = `
    <button type="button" class="map-toolbar-btn" data-measure-toggle aria-pressed="false"
      title="Measure distance (up to ${MAX_MEASUREMENTS} lines) — click points; double-click or Esc to finish a line">Measure</button>
    <button type="button" class="map-toolbar-btn" data-polygon-toggle aria-pressed="false"
      title="Draw closed polygons for Screen this area">Polygon</button>
    <button type="button" class="map-toolbar-btn map-toolbar-btn-ghost" data-polygon-close hidden
      title="Close the polygon ring">Close</button>
    <button type="button" class="map-toolbar-btn map-toolbar-btn-ghost" data-tool-clear
      title="Clear draft; Shift+Clear removes all">Clear</button>`;

  const measureBtn = host.querySelector('[data-measure-toggle]');
  const polygonBtn = host.querySelector('[data-polygon-toggle]');
  const closeBtn = host.querySelector('[data-polygon-close]');
  const clearBtn = host.querySelector('[data-tool-clear]');

  const syncScreenAoiPolygon = () => {
    if (polygons.length) {
      setDrawnPolygon(polygons[polygons.length - 1].feature);
    } else {
      clearDrawnPolygon();
    }
  };

  const ensureLayers = () => {
    ensureSquareImage(map);

    if (!map.getSource(MEASURE_SRC)) {
      map.addSource(MEASURE_SRC, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
    }
    if (!map.getLayer(`${MEASURE_SRC}-line`)) {
      map.addLayer({
        id: `${MEASURE_SRC}-line`,
        type: 'line',
        source: MEASURE_SRC,
        filter: ['==', '$type', 'LineString'],
        paint: {
          'line-color': MEASURE_COLOR,
          'line-width': 2
        }
      });
    }
    if (!map.getLayer(`${MEASURE_SRC}-pts`)) {
      map.addLayer({
        id: `${MEASURE_SRC}-pts`,
        type: 'symbol',
        source: MEASURE_SRC,
        filter: ['==', ['get', 'kind'], 'vertex'],
        layout: {
          'icon-image': SQUARE_IMG,
          'icon-size': 0.55,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true
        }
      });
    }
    // Distance text placed along the line (not a rotated point label).
    if (!map.getLayer(`${MEASURE_SRC}-labels`)) {
      map.addLayer({
        id: `${MEASURE_SRC}-labels`,
        type: 'symbol',
        source: MEASURE_SRC,
        filter: ['==', ['get', 'kind'], 'seg'],
        layout: {
          'symbol-placement': 'line-center',
          'text-field': ['get', 'label'],
          'text-size': 12,
          'text-offset': [0, -0.85],
          'text-keep-upright': true,
          'text-allow-overlap': true,
          'text-ignore-placement': true
        },
        paint: {
          'text-color': '#111111',
          'text-halo-color': 'rgba(255,255,255,0.92)',
          'text-halo-width': 1.6
        }
      });
    }

    if (!map.getSource(POLYGON_SRC)) {
      map.addSource(POLYGON_SRC, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
    }
    if (!map.getLayer(`${POLYGON_SRC}-fill`)) {
      map.addLayer({
        id: `${POLYGON_SRC}-fill`,
        type: 'fill',
        source: POLYGON_SRC,
        filter: ['==', '$type', 'Polygon'],
        paint: {
          'fill-color': '#111111',
          'fill-opacity': 0.08
        }
      });
    }
    if (!map.getLayer(`${POLYGON_SRC}-line`)) {
      map.addLayer({
        id: `${POLYGON_SRC}-line`,
        type: 'line',
        source: POLYGON_SRC,
        filter: ['in', '$type', 'LineString', 'Polygon'],
        paint: {
          'line-color': POLYGON_COLOR,
          'line-width': 2,
          'line-dasharray': [2, 1.5]
        }
      });
    }
    if (!map.getLayer(`${POLYGON_SRC}-pts`)) {
      map.addLayer({
        id: `${POLYGON_SRC}-pts`,
        type: 'symbol',
        source: POLYGON_SRC,
        filter: ['==', ['get', 'kind'], 'vertex'],
        layout: {
          'icon-image': SQUARE_IMG,
          'icon-size': 0.5,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true
        }
      });
    }
    if (!map.getLayer(`${POLYGON_SRC}-labels`)) {
      map.addLayer({
        id: `${POLYGON_SRC}-labels`,
        type: 'symbol',
        source: POLYGON_SRC,
        filter: ['==', ['get', 'kind'], 'area-label'],
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 12,
          'text-anchor': 'center',
          'text-allow-overlap': true,
          'text-ignore-placement': true
        },
        paint: {
          'text-color': '#111111',
          'text-halo-color': 'rgba(255,255,255,0.92)',
          'text-halo-width': 1.6
        }
      });
    }
  };

  const buildMeasureFeatures = () => {
    /** @type {GeoJSON.Feature[]} */
    const features = [];
    const allPaths = [
      ...measures.map((m) => m.points),
      ...(draftMeasure.length ? [draftMeasure] : [])
    ];
    for (const pts of allPaths) {
      for (const c of pts) {
        features.push({
          type: 'Feature',
          properties: { kind: 'vertex' },
          geometry: { type: 'Point', coordinates: c }
        });
      }
      if (pts.length < 2) continue;
      // One LineString per segment so line-center labels sit along each leg.
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const leg = distance(turfPoint(a), turfPoint(b), { units: 'kilometers' });
        features.push({
          type: 'Feature',
          properties: { kind: 'seg', label: formatKm(leg) },
          geometry: { type: 'LineString', coordinates: [a, b] }
        });
      }
    }
    return features;
  };

  const buildPolygonFeature = (pts) => {
    if (pts.length < 3) return null;
    const ring = [...pts];
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first]);
    return turfPolygon([ring]);
  };

  const areaLabelFor = (pts, feature) => {
    const c = ringCentroid(pts);
    if (!c || !feature) return null;
    return {
      type: 'Feature',
      properties: {
        kind: 'area-label',
        label: formatAreaKm2(area(feature))
      },
      geometry: { type: 'Point', coordinates: c }
    };
  };

  const buildPolygonFeatures = () => {
    /** @type {GeoJSON.Feature[]} */
    const features = [];
    for (const p of polygons) {
      features.push(p.feature);
      const label = areaLabelFor(p.points, p.feature);
      if (label) features.push(label);
    }
    for (const c of draftPoly) {
      features.push({
        type: 'Feature',
        properties: { kind: 'vertex' },
        geometry: { type: 'Point', coordinates: c }
      });
    }
    if (draftPoly.length >= 2) {
      features.push({
        type: 'Feature',
        properties: { kind: 'draft' },
        geometry: { type: 'LineString', coordinates: draftPoly }
      });
    }
    // Live area preview at centroid once we have a closable ring
    if (draftPoly.length >= 3) {
      const preview = buildPolygonFeature(draftPoly);
      if (preview) {
        features.push({
          ...preview,
          properties: { ...(preview.properties || {}), draft: true }
        });
        const label = areaLabelFor(draftPoly, preview);
        if (label) features.push(label);
      }
    }
    return features;
  };

  const refresh = () => {
    ensureLayers();
    map.getSource(MEASURE_SRC)?.setData({
      type: 'FeatureCollection',
      features: buildMeasureFeatures()
    });
    map.getSource(POLYGON_SRC)?.setData({
      type: 'FeatureCollection',
      features: buildPolygonFeatures()
    });
    if (closeBtn) {
      closeBtn.hidden = !(activeTool === 'polygon' && draftPoly.length >= 3);
    }
  };

  const deactivate = () => {
    activeTool = 'none';
    measureBtn?.classList.remove('active');
    measureBtn?.setAttribute('aria-pressed', 'false');
    polygonBtn?.classList.remove('active');
    polygonBtn?.setAttribute('aria-pressed', 'false');
    if (closeBtn) closeBtn.hidden = true;
    map.getCanvas().style.cursor = '';
  };

  const activateMeasure = () => {
    activeTool = 'measure';
    measureBtn?.classList.add('active');
    measureBtn?.setAttribute('aria-pressed', 'true');
    polygonBtn?.classList.remove('active');
    polygonBtn?.setAttribute('aria-pressed', 'false');
    if (closeBtn) closeBtn.hidden = true;
    map.getCanvas().style.cursor = 'crosshair';
    // Close any open feature popup while drawing
    document.querySelector('.maplibregl-popup')?.remove();
    refresh();
  };

  const activatePolygon = () => {
    activeTool = 'polygon';
    polygonBtn?.classList.add('active');
    polygonBtn?.setAttribute('aria-pressed', 'true');
    measureBtn?.classList.remove('active');
    measureBtn?.setAttribute('aria-pressed', 'false');
    map.getCanvas().style.cursor = 'crosshair';
    document.querySelector('.maplibregl-popup')?.remove();
    refresh();
  };

  const commitMeasureIfReady = () => {
    if (draftMeasure.length < 2) {
      draftMeasure = [];
      refresh();
      return;
    }
    if (measures.length >= MAX_MEASUREMENTS) measures.shift();
    measures.push({ id: nextId('m'), points: [...draftMeasure] });
    draftMeasure = [];
    refresh();
  };

  const closePolygon = () => {
    if (draftPoly.length < 3) return;
    if (polygons.length >= MAX_POLYGONS) polygons.shift();
    const feature = buildPolygonFeature(draftPoly);
    if (!feature) return;
    polygons.push({
      id: nextId('p'),
      points: [...draftPoly],
      feature
    });
    draftPoly = [];
    syncScreenAoiPolygon();
    refresh();
    deactivate();
  };

  const onClick = (e) => {
    if (activeTool === 'measure') {
      if (measures.length >= MAX_MEASUREMENTS && draftMeasure.length === 0) return;
      draftMeasure.push([e.lngLat.lng, e.lngLat.lat]);
      refresh();
      return;
    }
    if (activeTool === 'polygon') {
      if (polygons.length >= MAX_POLYGONS && draftPoly.length === 0) return;
      const pt = /** @type {[number, number]} */ ([e.lngLat.lng, e.lngLat.lat]);
      if (draftPoly.length >= 3) {
        const first = draftPoly[0];
        const p0 = map.project(first);
        const p1 = map.project(pt);
        if (Math.hypot(p0.x - p1.x, p0.y - p1.y) <= 14) {
          closePolygon();
          return;
        }
      }
      draftPoly.push(pt);
      refresh();
    }
  };

  const onDblClick = (e) => {
    if (activeTool === 'measure' && draftMeasure.length >= 2) {
      e.preventDefault();
      commitMeasureIfReady();
      return;
    }
    if (activeTool === 'polygon' && draftPoly.length >= 3) {
      e.preventDefault();
      closePolygon();
    }
  };

  const onKey = (e) => {
    if (e.key !== 'Escape') return;
    if (activeTool === 'measure') {
      if (draftMeasure.length >= 2) commitMeasureIfReady();
      else {
        draftMeasure = [];
        deactivate();
        refresh();
      }
    } else if (activeTool === 'polygon') {
      draftPoly = [];
      deactivate();
      refresh();
    }
  };

  measureBtn?.addEventListener('click', () => {
    if (activeTool === 'measure') {
      if (draftMeasure.length >= 2) commitMeasureIfReady();
      deactivate();
      refresh();
      return;
    }
    activateMeasure();
  });
  polygonBtn?.addEventListener('click', () => {
    if (activeTool === 'polygon') {
      deactivate();
      refresh();
      return;
    }
    activatePolygon();
  });
  closeBtn?.addEventListener('click', () => closePolygon());
  clearBtn?.addEventListener('click', (ev) => {
    if (ev.shiftKey) {
      measures = [];
      polygons = [];
      draftMeasure = [];
      draftPoly = [];
      syncScreenAoiPolygon();
      refresh();
      return;
    }
    if (activeTool === 'measure' || draftMeasure.length) {
      draftMeasure = [];
    } else if (measures.length) {
      measures.pop();
    }
    if (activeTool === 'polygon' || draftPoly.length) {
      draftPoly = [];
    } else if (polygons.length) {
      polygons.pop();
      syncScreenAoiPolygon();
    }
    refresh();
  });

  map.on('click', onClick);
  map.on('dblclick', onDblClick);
  window.addEventListener('keydown', onKey);
  map.on('style.load', () => refresh());

  return {
    destroy() {
      map.off('click', onClick);
      map.off('dblclick', onDblClick);
      window.removeEventListener('keydown', onKey);
      activeTool = 'none';
      host.innerHTML = '';
    },
    mode: () => activeTool
  };
}

/**
 * @param {import('maplibre-gl').Map} map
 * @param {GeoJSON.FeatureCollection|GeoJSON.Feature[]} fcOrFeatures
 */
export function zoomToFeatures(map, fcOrFeatures) {
  const features = Array.isArray(fcOrFeatures) ? fcOrFeatures : fcOrFeatures?.features || [];
  if (!features.length) return false;
  try {
    const box = bbox({ type: 'FeatureCollection', features });
    if (!box || box.some((n) => !Number.isFinite(n))) return false;
    const pad = 0.05;
    const west = box[0] === box[2] ? box[0] - pad : box[0];
    const south = box[1] === box[3] ? box[1] - pad : box[1];
    const east = box[0] === box[2] ? box[2] + pad : box[2];
    const north = box[1] === box[3] ? box[3] + pad : box[3];
    map.fitBounds(
      [
        [west, south],
        [east, north]
      ],
      { padding: 48, maxZoom: 12, duration: 800 }
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} raw
 * @returns {[number, number]|null}
 */
export function parseCoordinatePair(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const m = raw.trim().match(/^(-?\d+\.?\d*)\s*[,;\s]\s*(-?\d+\.?\d*)$/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a >= 45 && a <= 62 && b >= -70 && b <= -50) return [b, a];
  if (b >= 45 && b <= 62 && a >= -70 && a <= -50) return [a, b];
  if (Math.abs(a) <= 180 && Math.abs(b) <= 90) return [a, b];
  return null;
}

export function flyToCoordinate(map, lon, lat) {
  map.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 9), essential: true });
  if (coordMarker) {
    try {
      coordMarker.remove();
    } catch {
      /* ignore */
    }
  }
  coordMarker = new maplibregl.Marker({ color: '#111111' }).setLngLat([lon, lat]).addTo(map);
}
