/**
 * Bake Labrador map-staked claims (GeoAtlas Mineral_Lands MapServer/0).
 *
 * Writes:
 *   public/data/geoatlas-claims-labrador.geojson
 *   public/data/geoatlas-claims-labrador.meta.json
 *
 * Usage: npm run fetch:claims
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureTlsRelaxed, writeBakeOutputs } from './lib/bakeMeta.js';
import { esriPolygonToGeoJSON, mapPool } from './lib/esriPolygons.js';
import {
  CLAIMS_OUT_FIELDS,
  LABRADOR_CLIP_BBOX,
  MINERAL_LANDS_QUERY_BASE,
  labradorGeometryQueryParams,
  resolveClaimsFillColor
} from '../js/config/mineralLands.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_GEOJSON = path.join(ROOT, 'public', 'data', 'geoatlas-claims-labrador.geojson');
const OUT_META = path.join(ROOT, 'public', 'data', 'geoatlas-claims-labrador.meta.json');

const QUERY_URL = `${MINERAL_LANDS_QUERY_BASE}/0/query`;
const OUT_SR = 4326;
const MAX_ALLOWABLE_OFFSET = 0.002;
const PAGE_SIZE = 200;
const CONCURRENCY = 4;
const CADENCE_MONTHS = 3;

ensureTlsRelaxed();

function enrichFeature(feature) {
  const props = feature.properties;
  const license = props.LICENSE_NBR?.trim();
  const holder = props.CLIENT_NAME?.trim();
  props.name = license || holder || 'Unnamed claim';
  props.fillColor = resolveClaimsFillColor(props.STATUS);
  return feature;
}

function esriFeatureToGeoJSON(feature) {
  const geometry = esriPolygonToGeoJSON(feature?.geometry);
  if (!geometry) return null;
  return enrichFeature({
    type: 'Feature',
    properties: { ...(feature.attributes || {}) },
    geometry
  });
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'explorer-v3-fetch-claims/1.0' }
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
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

async function fetchPage(offset) {
  const params = new URLSearchParams(
    baseParams({
      outFields: CLAIMS_OUT_FIELDS,
      outSR: String(OUT_SR),
      maxAllowableOffset: String(MAX_ALLOWABLE_OFFSET),
      resultOffset: String(offset),
      resultRecordCount: String(PAGE_SIZE)
    })
  );
  const page = await fetchJson(`${QUERY_URL}?${params}`);
  if (page.error) {
    throw new Error(JSON.stringify(page.error));
  }
  return (page.features || []).map((f) => esriFeatureToGeoJSON(f)).filter(Boolean);
}

async function main() {
  const started = Date.now();
  console.log('Counting Labrador-clipped map-staked claims…');
  const countJson = await fetchJson(
    `${QUERY_URL}?${new URLSearchParams(baseParams({ returnCountOnly: 'true' }))}`
  );
  const total = countJson.count ?? 0;
  if (!total) throw new Error('Feature count was 0');

  const offsets = [];
  for (let offset = 0; offset < total; offset += PAGE_SIZE) {
    offsets.push(offset);
  }
  console.log(`Fetching ${total} features in ${offsets.length} pages (concurrency ${CONCURRENCY})…`);

  const pages = await mapPool(offsets, CONCURRENCY, async (offset, index) => {
    const features = await fetchPage(offset);
    console.log(`  page ${index + 1}/${offsets.length} offset=${offset} → ${features.length}`);
    return features;
  });

  const features = pages.flat();
  const collection = { type: 'FeatureCollection', features };
  const geojsonBody = JSON.stringify(collection);

  const { version, nextDue, bytes } = await writeBakeOutputs({
    assetPath: OUT_GEOJSON,
    metaPath: OUT_META,
    assetBody: geojsonBody,
    cadenceMonths: CADENCE_MONTHS,
    metaExtra: {
      featureCount: features.length,
      source: QUERY_URL,
      layerId: 0,
      layerName: 'Map Staked Claims',
      outSR: OUT_SR,
      maxAllowableOffset: MAX_ALLOWABLE_OFFSET,
      outFields: CLAIMS_OUT_FIELDS,
      clip: 'Labrador bbox (south of Strait of Belle Isle)',
      clipBbox: LABRADOR_CLIP_BBOX
    }
  });

  console.log(
    `Wrote ${features.length} features → ${path.relative(ROOT, OUT_GEOJSON)} (${(bytes / 1e6).toFixed(1)} MB) in ${((Date.now() - started) / 1000).toFixed(1)}s`
  );
  console.log(`Meta version=${version} nextDue=${nextDue} → ${path.relative(ROOT, OUT_META)}`);
  console.log(
    'Bump LAYER_CONFIG.geoatlasClaims.cacheVersion to match meta.version if it changed (npm run refresh:data does this).'
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
