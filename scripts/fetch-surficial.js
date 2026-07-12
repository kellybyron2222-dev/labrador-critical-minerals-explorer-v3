/**
 * Bake provincial regional surficial geology (GeoAtlas MapServer/12).
 *
 * Writes:
 *   public/data/geoatlas-surficial-regional.geojson
 *   public/data/geoatlas-surficial-regional.meta.json
 *
 * Usage: npm run fetch:surficial
 * CI / scheduled: npm run refresh:data (see .github/workflows/refresh-data.yml)
 *
 * Layer 12 = "Regional Surficial Geology" — full NL&L extent (~15k polys),
 * genetic classes (GENETIC1MA / GENETIC250), SOURCE mix of GSNL + GSC.
 * Detailed Surficial (MapServer/11) is deferred (partial northern coverage,
 * ~97k polys) — see BUILD_PLAN.md optional later.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureTlsRelaxed, writeBakeOutputs } from './lib/bakeMeta.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_GEOJSON = path.join(ROOT, 'public', 'data', 'geoatlas-surficial-regional.geojson');
const OUT_META = path.join(ROOT, 'public', 'data', 'geoatlas-surficial-regional.meta.json');

const QUERY_URL =
  'https://dnrmaps.gov.nl.ca/arcgis/rest/services/GeoAtlas/Surficial_Geology_All/MapServer/12/query';
const OUT_FIELDS = 'GENETIC1MA,GENETIC250,SOURCE,REFERENCE,RED,GREEN,BLUE';
const OUT_SR = 4326;
const MAX_ALLOWABLE_OFFSET = 0.002;
const PAGE_SIZE = 200;
const CONCURRENCY = 4;
const CADENCE_MONTHS = 6;

ensureTlsRelaxed();

function ringArea(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return sum / 2;
}

function esriPolygonToGeoJSON(geometry) {
  const rings = geometry?.rings;
  if (!Array.isArray(rings) || !rings.length) return null;

  const isClockwise = (ring) => ringArea(ring) < 0;
  const polys = [];
  let current = null;
  for (const ring of rings) {
    if (!ring?.length) continue;
    if (isClockwise(ring) || !current) {
      if (current) polys.push(current);
      current = [ring];
    } else {
      current.push(ring);
    }
  }
  if (current) polys.push(current);
  if (!polys.length) return null;
  if (polys.length === 1) return { type: 'Polygon', coordinates: polys[0] };
  return { type: 'MultiPolygon', coordinates: polys };
}

function enrichFeature(feature) {
  const props = feature.properties;
  const genetic1m = props.GENETIC1MA?.trim();
  const genetic250 = props.GENETIC250?.trim();
  props.name = genetic1m || genetic250 || 'Unnamed unit';
  const r = Number(props.RED);
  const g = Number(props.GREEN);
  const b = Number(props.BLUE);
  props.fillColor =
    Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)
      ? `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`
      : '#94a3b8';
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
    headers: { 'User-Agent': 'explorer-v3-fetch-surficial/1.0' }
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.json();
}

async function fetchPage(offset) {
  const params = new URLSearchParams({
    where: '1=1',
    outFields: OUT_FIELDS,
    f: 'json',
    outSR: String(OUT_SR),
    maxAllowableOffset: String(MAX_ALLOWABLE_OFFSET),
    resultOffset: String(offset),
    resultRecordCount: String(PAGE_SIZE)
  });
  const page = await fetchJson(`${QUERY_URL}?${params}`);
  if (page.error) {
    throw new Error(JSON.stringify(page.error));
  }
  return (page.features || [])
    .map((f) => esriFeatureToGeoJSON(f))
    .filter(Boolean);
}

async function mapPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()));
  return results;
}

async function main() {
  const started = Date.now();
  console.log('Counting GeoAtlas regional surficial features…');
  const countJson = await fetchJson(
    `${QUERY_URL}?${new URLSearchParams({ where: '1=1', returnCountOnly: 'true', f: 'json' })}`
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
      layerId: 12,
      layerName: 'Regional Surficial Geology',
      outSR: OUT_SR,
      maxAllowableOffset: MAX_ALLOWABLE_OFFSET,
      outFields: OUT_FIELDS
    }
  });

  console.log(
    `Wrote ${features.length} features → ${path.relative(ROOT, OUT_GEOJSON)} (${(bytes / 1e6).toFixed(1)} MB) in ${((Date.now() - started) / 1000).toFixed(1)}s`
  );
  console.log(`Meta version=${version} nextDue=${nextDue} → ${path.relative(ROOT, OUT_META)}`);
  console.log(
    'Bump LAYER_CONFIG.geoatlasSurficial.cacheVersion to match meta.version if it changed (npm run refresh:data does this).'
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
