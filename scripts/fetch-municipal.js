/**
 * Bake Labrador municipal boundaries (GeoAtlas Land_Use/6).
 *
 * Usage: npm run fetch:municipal
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureTlsRelaxed, writeBakeOutputs } from './lib/bakeMeta.js';
import { esriPolygonToGeoJSON, mapPool } from './lib/esriPolygons.js';
import {
  LAND_USE_QUERY_BASE,
  MUNICIPAL_OUT_FIELDS,
  enrichMunicipalProperties,
  LABRADOR_CLIP_BBOX,
  labradorGeometryQueryParams
} from '../js/config/infrastructure.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_GEOJSON = path.join(ROOT, 'public', 'data', 'geoatlas-municipal-labrador.geojson');
const OUT_META = path.join(ROOT, 'public', 'data', 'geoatlas-municipal-labrador.meta.json');
const QUERY_URL = `${LAND_USE_QUERY_BASE}/6/query`;
const OUT_SR = 4326;
const MAX_ALLOWABLE_OFFSET = 0.002;
const PAGE_SIZE = 200;
const CONCURRENCY = 4;
const CADENCE_MONTHS = 12;

ensureTlsRelaxed();

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'explorer-v3-fetch-municipal/1.0' }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function baseParams(extra = {}) {
  return {
    where: '1=1',
    f: 'json',
    ...labradorGeometryQueryParams(),
    ...extra
  };
}

function toFeature(feature) {
  const geometry = esriPolygonToGeoJSON(feature?.geometry);
  if (!geometry) return null;
  const props = { ...(feature.attributes || {}) };
  enrichMunicipalProperties(props);
  return { type: 'Feature', properties: props, geometry };
}

const started = Date.now();
const countJson = await fetchJson(
  `${QUERY_URL}?${new URLSearchParams(baseParams({ returnCountOnly: 'true' }))}`
);
const total = countJson.count ?? 0;
if (!total) throw new Error('Municipal feature count was 0');

const offsets = [];
for (let offset = 0; offset < total; offset += PAGE_SIZE) offsets.push(offset);

const pages = await mapPool(offsets, CONCURRENCY, async (offset, index) => {
  const params = new URLSearchParams(
    baseParams({
      outFields: MUNICIPAL_OUT_FIELDS,
      outSR: String(OUT_SR),
      maxAllowableOffset: String(MAX_ALLOWABLE_OFFSET),
      resultOffset: String(offset),
      resultRecordCount: String(PAGE_SIZE)
    })
  );
  const page = await fetchJson(`${QUERY_URL}?${params}`);
  if (page.error) throw new Error(JSON.stringify(page.error));
  const features = (page.features || []).map(toFeature).filter(Boolean);
  console.log(`  page ${index + 1}/${offsets.length} → ${features.length}`);
  return features;
});

const features = pages.flat();
const { version, nextDue, bytes } = await writeBakeOutputs({
  assetPath: OUT_GEOJSON,
  metaPath: OUT_META,
  assetBody: JSON.stringify({ type: 'FeatureCollection', features }),
  cadenceMonths: CADENCE_MONTHS,
  metaExtra: {
    featureCount: features.length,
    source: QUERY_URL,
    layerId: 6,
    layerName: 'Municipal Boundaries',
    clip: 'Labrador bbox (south of Strait of Belle Isle)',
    clipBbox: LABRADOR_CLIP_BBOX
  }
});

console.log(
  `Wrote ${features.length} municipal polys (${(bytes / 1e6).toFixed(2)} MB) in ${((Date.now() - started) / 1000).toFixed(1)}s`
);
console.log(`Meta version=${version} nextDue=${nextDue}`);
console.log('Bump LAYER_CONFIG.geoatlasMunicipal.cacheVersion if version changed.');
