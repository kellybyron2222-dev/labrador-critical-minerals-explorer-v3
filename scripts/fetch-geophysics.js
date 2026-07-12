/**
 * Bake Labrador geophysics rasters (Phase 4.1+):
 *   - aeromag: GeoAtlas Residual Mag - Labrador (layer 65) — full NL&L window
 *   - mag1vd / radioEu / radioEth / radioK: detailed-survey mosaics on a
 *     tight Labrador window at higher resolution (province-wide 1200px made
 *     survey patches look like muddy blobs)
 *   - gravity: NRCan AGG (often unreachable; prefer fetch:gravity-local)
 *
 * Usage: npm run fetch:geophysics
 *        npm run fetch:geophysics -- radioEu radioEth radioK mag1vd
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureTlsRelaxed, writeBakeOutputs } from './lib/bakeMeta.js';
import { decodePng, encodePng } from './lib/png.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'data');

/** Full display window used by regional aeromag / gravity. */
const NL_LABRADOR_BOUNDS = [-68, 46, -52, 61];

/**
 * Tight Labrador window covering detailed airborne surveys (Schefferville,
 * Makkovik, Qipuqqaq-Postville, Mistastin, Shabogamo). Excludes empty
 * Newfoundland/ocean so pixels go into the survey patches.
 */
const DETAILED_SURVEY_BOUNDS = [-67.8, 52.5, -56.0, 57.5];

const IMAGE_WIDTH_REGIONAL = 1200;
const IMAGE_WIDTH_DETAILED = 2400;
const CADENCE_MONTHS = 12;

const GEOATLAS_GEOPHYSICS =
  'https://dnrmaps.gov.nl.ca/arcgis/rest/services/GeoAtlas/Geophysics_Labrador/MapServer';
const AGG_WMS = 'http://wms.agg.nrcan.gc.ca/wms2/wms2.aspx';

const MAG1VD_LAYER_IDS = ['6', '21', '30', '35', '38', '64'];
const RADIO_EU_LAYER_IDS = ['11', '25', '44', '54'];
const RADIO_ETH_LAYER_IDS = ['12', '26', '45', '55'];
const RADIO_K_LAYER_IDS = ['13', '24', '46', '56'];

const LAYERS = [
  {
    key: 'aeromag',
    provider: 'geoatlas-export',
    layers: '65',
    label: 'Residual Mag - Labrador',
    bounds: NL_LABRADOR_BOUNDS,
    imageWidth: IMAGE_WIDTH_REGIONAL,
    mosaic: false
  },
  {
    key: 'mag1vd',
    provider: 'geoatlas-export',
    layerIds: MAG1VD_LAYER_IDS,
    label: 'Mag 1st Vert. Derivative (detailed surveys)',
    bounds: DETAILED_SURVEY_BOUNDS,
    imageWidth: IMAGE_WIDTH_DETAILED,
    mosaic: true
  },
  {
    key: 'radioEu',
    provider: 'geoatlas-export',
    layerIds: RADIO_EU_LAYER_IDS,
    label: 'Equiv. Uranium (detailed surveys)',
    bounds: DETAILED_SURVEY_BOUNDS,
    imageWidth: IMAGE_WIDTH_DETAILED,
    mosaic: true
  },
  {
    key: 'radioEth',
    provider: 'geoatlas-export',
    layerIds: RADIO_ETH_LAYER_IDS,
    label: 'Equiv. Thorium (detailed surveys)',
    bounds: DETAILED_SURVEY_BOUNDS,
    imageWidth: IMAGE_WIDTH_DETAILED,
    mosaic: true
  },
  {
    key: 'radioK',
    provider: 'geoatlas-export',
    layerIds: RADIO_K_LAYER_IDS,
    label: 'Potassium (detailed surveys)',
    bounds: DETAILED_SURVEY_BOUNDS,
    imageWidth: IMAGE_WIDTH_DETAILED,
    mosaic: true
  },
  {
    key: 'gravity',
    provider: 'nrcan-agg',
    layers: '75',
    label: 'Bouguer gravity anomaly (NRCan AGG)',
    bounds: NL_LABRADOR_BOUNDS,
    imageWidth: IMAGE_WIDTH_REGIONAL,
    mosaic: false
  }
];

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

ensureTlsRelaxed();

function latToMercatorY(latDeg) {
  const latRad = latDeg * DEG2RAD;
  return Math.log(Math.tan(Math.PI / 4 + latRad / 2));
}

function mercatorYToLat(y) {
  return (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * RAD2DEG;
}

function mercatorStretchFactor(south, north) {
  const mercRange = latToMercatorY(north) - latToMercatorY(south);
  const equirectRange = (north - south) * DEG2RAD;
  return mercRange / equirectRange;
}

function reprojectToMercator(png, south, north) {
  const { width, height: srcHeight, channels, data } = png;
  const destHeight = Math.round(srcHeight * mercatorStretchFactor(south, north));
  const dest = Buffer.alloc(width * destHeight * channels);
  const yMercNorth = latToMercatorY(north);
  const yMercSouth = latToMercatorY(south);
  const stride = width * channels;

  for (let row = 0; row < destHeight; row++) {
    const v = destHeight === 1 ? 0 : row / (destHeight - 1);
    const yMerc = yMercNorth + v * (yMercSouth - yMercNorth);
    const lat = mercatorYToLat(yMerc);
    const srcRow = Math.min(
      srcHeight - 1,
      Math.max(0, Math.round(((north - lat) / (north - south)) * (srcHeight - 1)))
    );
    data.copy(dest, row * stride, srcRow * stride, srcRow * stride + stride);
  }

  return { width, height: destHeight, channels, data: dest };
}

function buildGeoAtlasExportUrl(layerIds, bounds, width, height) {
  const [west, south, east, north] = bounds;
  const params = new URLSearchParams({
    bbox: `${west},${south},${east},${north}`,
    bboxSR: '4326',
    imageSR: '4326',
    size: `${width},${height}`,
    dpi: '96',
    format: 'png32',
    transparent: 'true',
    layers: `show:${Array.isArray(layerIds) ? layerIds.join(',') : layerIds}`,
    f: 'image'
  });
  return `${GEOATLAS_GEOPHYSICS}/export?${params.toString()}`;
}

function buildAggGetMapUrl(layers, bounds, width, height) {
  const [west, south, east, north] = bounds;
  const params = new URLSearchParams({
    service: 'WMS',
    version: '1.1.1',
    request: 'GetMap',
    layers,
    styles: '',
    srs: 'EPSG:4326',
    bbox: `${west},${south},${east},${north}`,
    width: String(width),
    height: String(height),
    format: 'image/png',
    transparent: 'true'
  });
  return `${AGG_WMS}?${params.toString()}`;
}

async function fetchPng(url, label) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'explorer-v3-fetch-geophysics/1.0' }
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${label}`);
  }
  const ct = response.headers.get('content-type') || '';
  const raw = Buffer.from(await response.arrayBuffer());
  if (!ct.includes('image') && raw.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    throw new Error(
      `Expected PNG for ${label}, got ${ct} (${raw.length} bytes): ${raw.toString('utf8').slice(0, 160)}`
    );
  }
  return raw;
}

/** Alpha-composite tiles: keep first opaque pixel (survey A then B …). */
function mosaicRgba(tiles) {
  if (!tiles.length) throw new Error('No tiles to mosaic');
  const { width, height, channels } = tiles[0];
  if (channels < 4) {
    throw new Error(`Mosaic expects RGBA, got ${channels} channels`);
  }
  for (const t of tiles) {
    if (t.width !== width || t.height !== height || t.channels !== channels) {
      throw new Error('Mosaic tile size/channel mismatch');
    }
  }

  const out = Buffer.alloc(width * height * 4, 0);
  const n = width * height;
  for (const tile of tiles) {
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      if (out[o + 3] >= 16) continue; // already have coverage
      const a = tile.data[o + 3];
      if (a < 16) continue;
      out[o] = tile.data[o];
      out[o + 1] = tile.data[o + 1];
      out[o + 2] = tile.data[o + 2];
      out[o + 3] = a;
    }
  }
  return { width, height, channels: 4, data: out };
}

function ensureRgba(png) {
  if (png.channels === 4) return png;
  if (png.channels !== 3) {
    throw new Error(`Unsupported PNG channels: ${png.channels}`);
  }
  const n = png.width * png.height;
  const data = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    data[i * 4] = png.data[i * 3];
    data[i * 4 + 1] = png.data[i * 3 + 1];
    data[i * 4 + 2] = png.data[i * 3 + 2];
    data[i * 4 + 3] = 255;
  }
  return { width: png.width, height: png.height, channels: 4, data };
}

async function fetchDecodedExport(layerId, bounds, width, height, label) {
  const url = buildGeoAtlasExportUrl(layerId, bounds, width, height);
  console.log(`  GET layer ${layerId}…`);
  const raw = await fetchPng(url, `${label}:${layerId}`);
  return ensureRgba(decodePng(raw));
}

async function bakeLayer(layer) {
  const bounds = layer.bounds || NL_LABRADOR_BOUNDS;
  const [west, south, east, north] = bounds;
  const aspect = (east - west) / (north - south);
  const srcWidth = layer.imageWidth || IMAGE_WIDTH_REGIONAL;
  const srcHeight = Math.round(srcWidth / aspect);

  console.log(`\n=== ${layer.key} (${layer.label}) ===`);
  console.log(
    `bounds=[${bounds.join(',')}] ${srcWidth}×${srcHeight}${layer.mosaic ? ' mosaic' : ''}`
  );

  let decoded;
  if (layer.provider === 'geoatlas-export' && layer.mosaic) {
    const tiles = [];
    for (const id of layer.layerIds) {
      tiles.push(await fetchDecodedExport(id, bounds, srcWidth, srcHeight, layer.key));
    }
    decoded = mosaicRgba(tiles);
    let opaque = 0;
    for (let i = 3; i < decoded.data.length; i += 4) {
      if (decoded.data[i] >= 16) opaque += 1;
    }
    const pct = (100 * opaque) / (decoded.width * decoded.height);
    console.log(`  mosaic coverage ${pct.toFixed(1)}%`);
  } else if (layer.provider === 'geoatlas-export') {
    const url = buildGeoAtlasExportUrl(layer.layers, bounds, srcWidth, srcHeight);
    console.log(`GET ${url.slice(0, 120)}…`);
    decoded = ensureRgba(decodePng(await fetchPng(url, layer.key)));
  } else if (layer.provider === 'nrcan-agg') {
    const url = buildAggGetMapUrl(layer.layers, bounds, srcWidth, srcHeight);
    console.log(`GET ${url.slice(0, 120)}…`);
    decoded = ensureRgba(decodePng(await fetchPng(url, layer.key)));
  } else {
    throw new Error(`Unknown provider: ${layer.provider}`);
  }

  const reprojected = reprojectToMercator(decoded, south, north);
  const pngBody = encodePng(reprojected);

  const assetPath = path.join(OUT_DIR, `wms-${layer.key}-nll.png`);
  const metaPath = path.join(OUT_DIR, `wms-${layer.key}-nll.meta.json`);
  const layerList = layer.layerIds?.join(',') || layer.layers;
  const { version, nextDue, bytes } = await writeBakeOutputs({
    assetPath,
    metaPath,
    assetBody: pngBody,
    cadenceMonths: CADENCE_MONTHS,
    metaExtra: {
      featureCount: null,
      width: reprojected.width,
      height: reprojected.height,
      channels: reprojected.channels,
      bounds,
      source: `${GEOATLAS_GEOPHYSICS}/export`,
      provider: layer.provider,
      layers: layerList,
      mosaic: Boolean(layer.mosaic),
      label: layer.label,
      imageWidthRequest: srcWidth
    }
  });

  console.log(
    `Wrote ${path.relative(ROOT, assetPath)} ${reprojected.width}×${reprojected.height} (${(bytes / 1e3).toFixed(1)} KB) version=${version} nextDue=${nextDue}`
  );
  return { key: layer.key, version, bytes };
}

async function main() {
  const started = Date.now();
  const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const strict = process.argv.includes('--strict');
  const layers = only.length
    ? LAYERS.filter((l) => only.includes(l.key))
    : LAYERS;
  if (!layers.length) {
    throw new Error(
      `No matching layers for: ${only.join(', ') || '(none)'}. Known: ${LAYERS.map((l) => l.key).join(', ')}`
    );
  }

  const results = [];
  const errors = [];
  for (const layer of layers) {
    try {
      results.push(await bakeLayer(layer));
    } catch (err) {
      console.error(`FAILED ${layer.key}:`, err.message);
      errors.push({ key: layer.key, error: err.message });
    }
  }

  console.log(
    `\nBaked ${results.length}/${layers.length} geophysics layers in ${((Date.now() - started) / 1000).toFixed(1)}s`
  );
  if (results.length) {
    console.log(
      'Update cacheVersion in js/config/layerConfig.js for:',
      results.map((r) => `${r.key}=${r.version}`).join(', ')
    );
  }
  if (errors.length) {
    console.error('Errors:', errors.map((e) => `${e.key}: ${e.error}`).join('; '));
    if (strict || results.length === 0) process.exit(1);
    console.warn('Continuing with partial bake (use --strict to fail).');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
