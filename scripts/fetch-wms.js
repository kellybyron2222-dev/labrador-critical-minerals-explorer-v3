/**
 * Bake NRCan WMS endowment layers as Mercator-corrected NL&L PNGs.
 *
 * Writes public/data/wms-<key>-nll.png + .meta.json for each layer in WMS_LAYERS.
 *
 * Usage: npm run fetch:wms
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureTlsRelaxed, writeBakeOutputs } from './lib/bakeMeta.js';
import { decodePng, encodePng } from './lib/png.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'data');

const WMS_BASE =
  'https://maps-cartes.services.geo.ca/server_serveur/services/NRCan';
const BOUNDS = [-68, 46, -52, 61]; // NL_LABRADOR_BOUNDS
const IMAGE_WIDTH = 900;
const CADENCE_MONTHS = 12;

const WMS_LAYERS = [
  { key: 'lithium', service: 'pegmatite_lithium_en', layers: '0' },
  { key: 'ree', service: 'carbonatite_ree_en', layers: '0' },
  { key: 'graphite', service: 'graphite_prospectivity_en', layers: '0' },
  { key: 'bedrock', service: 'gsc_bedrock_geology_en', layers: '0' },
  { key: 'surficial', service: 'gsc_surficial_geology_en', layers: '1' }
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

/** Port of js/modules/wmsReprojection.js for Node (row resample → Mercator Y). */
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

function buildGetMapUrl(service, layers, width, height) {
  const [west, south, east, north] = BOUNDS;
  const params = new URLSearchParams({
    service: 'WMS',
    version: '1.3.0',
    request: 'GetMap',
    layers,
    styles: '',
    crs: 'CRS:84',
    bbox: `${west},${south},${east},${north}`,
    width: String(width),
    height: String(height),
    format: 'image/png',
    transparent: 'true'
  });
  return `${WMS_BASE}/${service}/MapServer/WMSServer?${params.toString()}`;
}

async function bakeLayer({ key, service, layers }) {
  const [west, south, east, north] = BOUNDS;
  const aspect = (east - west) / (north - south);
  const srcWidth = IMAGE_WIDTH;
  const srcHeight = Math.round(srcWidth / aspect);
  const url = buildGetMapUrl(service, layers, srcWidth, srcHeight);

  console.log(`\n=== ${key} ===`);
  console.log(`GET ${url.slice(0, 120)}…`);

  const response = await fetch(url, {
    headers: { 'User-Agent': 'explorer-v3-fetch-wms/1.0' }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${key}`);
  const raw = Buffer.from(await response.arrayBuffer());
  const decoded = decodePng(raw);
  const reprojected = reprojectToMercator(decoded, south, north);
  const pngBody = encodePng(reprojected);

  const assetPath = path.join(OUT_DIR, `wms-${key}-nll.png`);
  const metaPath = path.join(OUT_DIR, `wms-${key}-nll.meta.json`);
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
      bounds: BOUNDS,
      source: url.split('?')[0],
      service,
      layers,
      imageWidthRequest: srcWidth
    }
  });

  console.log(
    `Wrote ${path.relative(ROOT, assetPath)} ${reprojected.width}×${reprojected.height} (${(bytes / 1e3).toFixed(1)} KB) version=${version} nextDue=${nextDue}`
  );
  return { key, assetPath, metaPath, version, bytes };
}

async function main() {
  const started = Date.now();
  const results = [];
  for (const layer of WMS_LAYERS) {
    results.push(await bakeLayer(layer));
  }
  console.log(
    `\nBaked ${results.length} WMS layers in ${((Date.now() - started) / 1000).toFixed(1)}s`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
