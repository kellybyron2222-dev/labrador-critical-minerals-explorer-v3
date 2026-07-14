/**
 * Contour line overlay on the current basemap (Positron / Dark / Satellite).
 * Uses maplibre-contour from CDN when available; otherwise MapLibre hillshade from Terrarium DEM.
 */

import maplibregl from 'maplibre-gl';

export const CONTOUR_DEM_URL =
  'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

const HILLSHADE_SOURCE = 'topo-dem-hillshade';
const HILLSHADE_LAYER = 'topo-dem-hillshade-layer';
const CONTOUR_SOURCE = 'topo-contours';
const CONTOUR_LINE = 'topo-contours-line';
const CONTOUR_MAJOR = 'topo-contours-major';
const CONTOUR_LABEL = 'topo-contours-label';

/** @type {import('maplibre-contour').DemSource | null} */
let demSource = null;
let contourReady = false;
let overlayOn = false;

/**
 * @param {import('maplibre-gl').Map} map
 * @returns {Promise<boolean>} true if vector contours available
 */
async function ensureContourEngine(map) {
  if (contourReady && demSource) return true;
  try {
    const mod = await import(/* @vite-ignore */ 'https://esm.sh/maplibre-contour@0.0.8');
    const MlContour = mod.default || mod;
    demSource = new MlContour.DemSource({
      url: CONTOUR_DEM_URL,
      encoding: 'terrarium',
      maxzoom: 13,
      worker: true
    });
    demSource.setupMaplibre(maplibregl);
    contourReady = true;
    return true;
  } catch (err) {
    console.warn('maplibre-contour unavailable — using hillshade fallback', err);
    contourReady = false;
    demSource = null;
    return false;
  }
}

/**
 * @param {import('maplibre-gl').Map} map
 */
function addHillshadeFallback(map) {
  if (!map.getSource(HILLSHADE_SOURCE)) {
    map.addSource(HILLSHADE_SOURCE, {
      type: 'raster-dem',
      tiles: [CONTOUR_DEM_URL],
      tileSize: 256,
      maxzoom: 15,
      encoding: 'terrarium',
      attribution: 'Elevation © Mapzen / AWS Terrain Tiles'
    });
  }
  if (!map.getLayer(HILLSHADE_LAYER)) {
    map.addLayer({
      id: HILLSHADE_LAYER,
      type: 'hillshade',
      source: HILLSHADE_SOURCE,
      paint: {
        'hillshade-exaggeration': 0.55,
        'hillshade-shadow-color': '#1a1a1a',
        'hillshade-highlight-color': '#ffffff',
        'hillshade-accent-color': '#444444'
      }
    });
  }
}

/**
 * @param {import('maplibre-gl').Map} map
 */
function removeHillshadeFallback(map) {
  if (map.getLayer(HILLSHADE_LAYER)) map.removeLayer(HILLSHADE_LAYER);
  if (map.getSource(HILLSHADE_SOURCE)) map.removeSource(HILLSHADE_SOURCE);
}

/**
 * @param {import('maplibre-gl').Map} map
 */
function addContourLayers(map) {
  if (!demSource) return;
  const tiles = [
    demSource.contourProtocolUrl({
      overzoom: 1,
      thresholds: {
        9: [200, 1000],
        10: [100, 500],
        11: [50, 200],
        12: [20, 100],
        13: [10, 50],
        14: [5, 25],
        15: [5, 25]
      }
    })
  ];

  if (!map.getSource(CONTOUR_SOURCE)) {
    map.addSource(CONTOUR_SOURCE, {
      type: 'vector',
      tiles,
      maxzoom: 15
    });
  }

  if (!map.getLayer(CONTOUR_LINE)) {
    map.addLayer({
      id: CONTOUR_LINE,
      type: 'line',
      source: CONTOUR_SOURCE,
      'source-layer': 'contours',
      filter: ['!=', ['get', 'level'], 1],
      paint: {
        'line-color': '#333333',
        'line-width': 0.6,
        'line-opacity': 0.55
      }
    });
  }
  if (!map.getLayer(CONTOUR_MAJOR)) {
    map.addLayer({
      id: CONTOUR_MAJOR,
      type: 'line',
      source: CONTOUR_SOURCE,
      'source-layer': 'contours',
      filter: ['==', ['get', 'level'], 1],
      paint: {
        'line-color': '#111111',
        'line-width': 1.15,
        'line-opacity': 0.75
      }
    });
  }
}

/**
 * @param {import('maplibre-gl').Map} map
 */
function removeContourLayers(map) {
  for (const id of [CONTOUR_LABEL, CONTOUR_MAJOR, CONTOUR_LINE]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(CONTOUR_SOURCE)) map.removeSource(CONTOUR_SOURCE);
}

export function isContourOverlayOn() {
  return overlayOn;
}

/**
 * @param {import('maplibre-gl').Map} map
 * @param {boolean} on
 * @returns {Promise<'contours'|'hillshade'|'off'>}
 */
export async function setContourOverlay(map, on) {
  overlayOn = Boolean(on);
  if (!map) return 'off';
  if (!overlayOn) {
    removeContourLayers(map);
    removeHillshadeFallback(map);
    return 'off';
  }

  const ok = await ensureContourEngine(map);
  removeHillshadeFallback(map);
  removeContourLayers(map);
  if (ok) {
    addContourLayers(map);
    return 'contours';
  }
  addHillshadeFallback(map);
  return 'hillshade';
}

/**
 * Re-apply after basemap `setStyle` / layer refresh.
 * @param {import('maplibre-gl').Map} map
 */
export async function restoreContourOverlay(map) {
  if (!overlayOn) return 'off';
  return setContourOverlay(map, true);
}
