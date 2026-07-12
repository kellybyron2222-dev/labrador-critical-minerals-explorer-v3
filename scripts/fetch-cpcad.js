/**
 * Bake Labrador protected/conserved areas (GeoAtlas Land_Use MapServer/4 CPCAD mirror).
 *
 * Writes:
 *   public/data/geoatlas-cpcad-labrador.geojson
 *   public/data/geoatlas-cpcad-labrador.meta.json
 *
 * Usage: npm run fetch:cpcad
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureTlsRelaxed, writeBakeOutputs } from './lib/bakeMeta.js';
import { esriPolygonToGeoJSON, mapPool } from './lib/esriPolygons.js';
import { LABRADOR_CLIP_BBOX, labradorGeometryQueryParams } from '../js/config/mineralLands.js';
import {
  CPCAD_LAYER_ID,
  CPCAD_OUT_FIELDS,
  CPCAD_QUERY,
  enrichCpcadFeatureProperties
} from '../js/config/protectedAreas.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_GEOJSON = path.join(ROOT, 'public', 'data', 'geoatlas-cpcad-labrador.geojson');
const OUT_META = path.join(ROOT, 'public', 'data', 'geoatlas-cpcad-labrador.meta.json');

const OUT_SR = 4326;
const MAX_ALLOWABLE_OFFSET = 0.002;
const PAGE_SIZE = 200;
const CONCURRENCY = 4;
const CADENCE_MONTHS = 12;

ensureTlsRelaxed();

function esriFeatureToGeoJSON(feature) {
  const geometry = esriPolygonToGeoJSON(feature?.geometry);
  if (!geometry) return null;
  return {
    type: 'Feature',
    properties: enrichCpcadFeatureProperties({ ...(feature.attributes || {}) }),
    geometry
  };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'explorer-v3-fetch-cpcad/1.0' }
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
      outFields: CPCAD_OUT_FIELDS,
      outSR: String(OUT_SR),
      maxAllowableOffset: String(MAX_ALLOWABLE_OFFSET),
      resultOffset: String(offset),
      resultRecordCount: String(PAGE_SIZE)
    })
  );
  const page = await fetchJson(`${CPCAD_QUERY}?${params}`);
  if (page.error) {
    throw new Error(JSON.stringify(page.error));
  }
  return (page.features || []).map((f) => esriFeatureToGeoJSON(f)).filter(Boolean);
}

async function main() {
  const started = Date.now();
  console.log('Counting Labrador-clipped CPCAD (Land_Use/4)…');
  const countJson = await fetchJson(
    `${CPCAD_QUERY}?${new URLSearchParams(baseParams({ returnCountOnly: 'true' }))}`
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
      source: CPCAD_QUERY,
      layerId: CPCAD_LAYER_ID,
      layerName: 'Canadian Protected Conserved Areas',
      outSR: OUT_SR,
      maxAllowableOffset: MAX_ALLOWABLE_OFFSET,
      outFields: CPCAD_OUT_FIELDS,
      clip: 'Labrador bbox (south of Strait of Belle Isle)',
      clipBbox: LABRADOR_CLIP_BBOX
    }
  });

  console.log(
    `Wrote ${features.length} features → ${path.relative(ROOT, OUT_GEOJSON)} (${(bytes / 1e6).toFixed(1)} MB) in ${((Date.now() - started) / 1000).toFixed(1)}s`
  );
  console.log(`Meta version=${version} nextDue=${nextDue} → ${path.relative(ROOT, OUT_META)}`);
  console.log(
    'Bump LAYER_CONFIG.geoatlasCpcad.cacheVersion to match meta.version if it changed (npm run refresh:data does this).'
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
