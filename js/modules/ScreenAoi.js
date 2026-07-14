/**
 * Screen AOI state: current view, radius around a pin, or closed drawn polygon.
 */

import maplibregl from 'maplibre-gl';
import { point as turfPoint, polygon as turfPolygon } from '@turf/helpers';
import distance from '@turf/distance';
import bbox from '@turf/bbox';
import { normalizeMapBounds } from './KpiEngine.js';

/** @typedef {'view' | 'radius' | 'polygon'} ScreenAoiMode */

/** @deprecated Use DEFAULT_RADIUS_KM — kept for older imports/tests */
export const GOTO_BUFFER_KM = 25;
export const DEFAULT_RADIUS_KM = 25;
export const RADIUS_OPTIONS_KM = [1, 5, 10, 25];
const TOOL_INK = '#111111';

/** @type {ScreenAoiMode} */
let mode = 'view';

/** @type {[number, number]|null} [lon, lat] */
let focus = null;

/** @type {number} */
let radiusKm = DEFAULT_RADIUS_KM;

/** @type {GeoJSON.Feature|null} */
let drawnPolygon = null;

/** @type {((state: ReturnType<typeof getScreenAoiState>) => void)|null} */
let listener = null;

/** @type {import('maplibre-gl').Marker|null} */
let focusMarker = null;

/** @type {{ map: import('maplibre-gl').Map, onPicked?: Function, onCancel?: Function, clickHandler: Function }|null} */
let pinPickSession = null;

/**
 * Normalize legacy `goto` → `radius`.
 * @param {string} next
 * @returns {ScreenAoiMode|null}
 */
function normalizeMode(next) {
  if (next === 'goto') return 'radius';
  if (next === 'view' || next === 'radius' || next === 'polygon') return next;
  return null;
}

export function getScreenAoiState() {
  return {
    mode,
    focus: focus ? [...focus] : null,
    radiusKm,
    drawnPolygon,
    hasDrawnPolygon: Boolean(drawnPolygon),
    pinPicking: Boolean(pinPickSession)
  };
}

/**
 * @param {ScreenAoiMode|'goto'} next
 */
export function setScreenAoiMode(next) {
  const m = normalizeMode(next);
  if (!m) return;
  mode = m;
  notify();
}

/**
 * @param {number} km
 */
export function setScreenRadiusKm(km) {
  if (!Number.isFinite(km) || km <= 0) return;
  radiusKm = km;
  notify();
}

/**
 * @param {number} lon
 * @param {number} lat
 * @param {import('maplibre-gl').Map} [map]
 */
export function setScreenFocus(lon, lat, map) {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
  focus = [lon, lat];
  if (map) placeFocusMarker(map, lon, lat);
  notify();
}

/**
 * Place focus + set radius mode (used by right-click / selection shortcuts).
 * @param {number} lon
 * @param {number} lat
 * @param {import('maplibre-gl').Map} map
 * @param {number} [km]
 */
export function placeScreenRadius(lon, lat, map, km = radiusKm) {
  if (Number.isFinite(km) && km > 0) radiusKm = km;
  setScreenFocus(lon, lat, map);
  setScreenAoiMode('radius');
  const feature = circlePolygon([lon, lat], radiusKm);
  paintScreenAoiOutline(map, feature);
  return feature;
}

/**
 * @param {import('maplibre-gl').Map} map
 * @param {number} lon
 * @param {number} lat
 */
export function placeFocusMarker(map, lon, lat) {
  if (!map) return;
  if (focusMarker) {
    try {
      focusMarker.remove();
    } catch {
      /* ignore */
    }
  }
  focusMarker = new maplibregl.Marker({ color: TOOL_INK }).setLngLat([lon, lat]).addTo(map);
}

export function cancelPinPick() {
  if (!pinPickSession) return;
  const { map, clickHandler, onCancel } = pinPickSession;
  map.off('click', clickHandler);
  map.getCanvas().style.cursor = '';
  pinPickSession = null;
  notify();
  onCancel?.();
}

/**
 * Ask the user to click the map to place a radius focus pin.
 * @param {import('maplibre-gl').Map} map
 * @param {{ onPicked?: (lon: number, lat: number) => void, onCancel?: () => void }} [opts]
 * @returns {boolean}
 */
export function beginPinPickFocus(map, opts = {}) {
  if (!map) return false;
  if (pinPickSession) cancelPinPick();

  const clickHandler = (e) => {
    const lon = e.lngLat.lng;
    const lat = e.lngLat.lat;
    const session = pinPickSession;
    map.off('click', clickHandler);
    map.getCanvas().style.cursor = '';
    pinPickSession = null;
    setScreenFocus(lon, lat, map);
    setScreenAoiMode('radius');
    paintScreenAoiOutline(map, circlePolygon([lon, lat], radiusKm));
    notify();
    session?.onPicked?.(lon, lat);
  };

  pinPickSession = {
    map,
    clickHandler,
    onPicked: opts.onPicked,
    onCancel: opts.onCancel
  };
  map.getCanvas().style.cursor = 'crosshair';
  map.on('click', clickHandler);
  notify();
  return true;
}

/**
 * @param {GeoJSON.Feature|null} feature
 */
export function setDrawnPolygon(feature) {
  drawnPolygon = feature;
  if (feature) mode = 'polygon';
  notify();
}

export function clearDrawnPolygon() {
  drawnPolygon = null;
  if (mode === 'polygon') mode = 'view';
  notify();
}

/**
 * @param {(state: ReturnType<typeof getScreenAoiState>) => void} fn
 */
export function onScreenAoiChange(fn) {
  listener = fn;
}

function notify() {
  listener?.(getScreenAoiState());
}

/**
 * Approximate circle polygon around a lon/lat (km radius).
 * @param {[number, number]} center
 * @param {number} radiusKmArg
 * @param {number} [steps]
 * @returns {GeoJSON.Feature}
 */
export function circlePolygon(center, radiusKmArg, steps = 64) {
  const [lon, lat] = center;
  const ring = [];
  for (let i = 0; i <= steps; i++) {
    const bearing = (i / steps) * 360;
    ring.push(destinationPoint(lon, lat, radiusKmArg, bearing));
  }
  return turfPolygon([ring]);
}

/**
 * @param {number} lon
 * @param {number} lat
 * @param {number} distanceKm
 * @param {number} bearingDeg
 * @returns {[number, number]}
 */
function destinationPoint(lon, lat, distanceKm, bearingDeg) {
  const R = 6371.0088;
  const δ = distanceKm / R;
  const θ = (bearingDeg * Math.PI) / 180;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lon * Math.PI) / 180;
  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ)
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
    );
  return [((λ2 * 180) / Math.PI + 540) % 360 - 180, (φ2 * 180) / Math.PI];
}

/**
 * Bounds → closed rectangle polygon.
 * @param {{ west: number, south: number, east: number, north: number }} b
 * @returns {GeoJSON.Feature}
 */
export function boundsToPolygon(b) {
  const { west, south, east, north } = b;
  return turfPolygon([
    [
      [west, south],
      [east, south],
      [east, north],
      [west, north],
      [west, south]
    ]
  ]);
}

/**
 * Resolve active AOI geometry for the current mode.
 * @param {import('maplibre-gl').Map} map
 * @returns {{ ok: true, feature: GeoJSON.Feature, label: string } | { ok: false, message: string, needsPin?: boolean }}
 */
export function resolveScreenAoi(map) {
  if (mode === 'view') {
    const b = normalizeMapBounds(map?.getBounds?.());
    if (!b) return { ok: false, message: 'Map bounds unavailable.' };
    const feature = boundsToPolygon(b);
    const w = distance(turfPoint([b.west, b.south]), turfPoint([b.east, b.south]), {
      units: 'kilometers'
    });
    const h = distance(turfPoint([b.west, b.south]), turfPoint([b.west, b.north]), {
      units: 'kilometers'
    });
    return {
      ok: true,
      feature,
      label: `Current view · ~${fmtKm(w)} × ${fmtKm(h)}`
    };
  }

  if (mode === 'radius') {
    if (!focus) {
      return {
        ok: false,
        needsPin: true,
        message: `Click the map to drop a pin (${radiusKm} km radius).`
      };
    }
    const feature = circlePolygon(focus, radiusKm);
    return {
      ok: true,
      feature,
      label: `Radius · ${radiusKm} km around pin`
    };
  }

  if (mode === 'polygon') {
    if (!drawnPolygon) {
      return {
        ok: false,
        message: 'Draw and close a polygon with the Polygon tool first.'
      };
    }
    return {
      ok: true,
      feature: drawnPolygon,
      label: 'Drawn polygon'
    };
  }

  return { ok: false, message: 'Unknown AOI mode.' };
}

/**
 * @param {GeoJSON.Feature} feature
 * @returns {[number, number, number, number]|null}
 */
export function aoiBbox(feature) {
  try {
    const box = bbox(feature);
    if (!box || box.some((n) => !Number.isFinite(n))) return null;
    return box;
  } catch {
    return null;
  }
}

function fmtKm(n) {
  if (!Number.isFinite(n)) return '—';
  return n < 10 ? `${n.toFixed(1)} km` : `${Math.round(n)} km`;
}

const AOI_SOURCE = 'screen-aoi-outline';
const AOI_FILL = 'screen-aoi-outline-fill';
const AOI_LINE = 'screen-aoi-outline-line';

/**
 * Draw / update AOI outline on the map.
 * @param {import('maplibre-gl').Map} map
 * @param {GeoJSON.Feature|null} feature
 */
export function paintScreenAoiOutline(map, feature) {
  if (!map) return;
  if (!map.getSource(AOI_SOURCE)) {
    map.addSource(AOI_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });
  }
  if (!map.getLayer(AOI_FILL)) {
    map.addLayer({
      id: AOI_FILL,
      type: 'fill',
      source: AOI_SOURCE,
      paint: { 'fill-color': TOOL_INK, 'fill-opacity': 0.06 }
    });
  }
  if (!map.getLayer(AOI_LINE)) {
    map.addLayer({
      id: AOI_LINE,
      type: 'line',
      source: AOI_SOURCE,
      paint: {
        'line-color': TOOL_INK,
        'line-width': 2,
        'line-dasharray': [2, 1.5]
      }
    });
  }
  map.getSource(AOI_SOURCE)?.setData({
    type: 'FeatureCollection',
    features: feature ? [feature] : []
  });
}

/** Test helper — reset module state. */
export function _resetScreenAoiForTests() {
  mode = 'view';
  focus = null;
  radiusKm = DEFAULT_RADIUS_KM;
  drawnPolygon = null;
  listener = null;
  pinPickSession = null;
  focusMarker = null;
}
