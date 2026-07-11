/**
 * Infrequent refresh of provincial bedrock (GeoAtlas MapServer/23).
 *
 * Writes:
 *   public/data/geoatlas-bedrock-1m.geojson
 *   public/data/geoatlas-bedrock-1m.meta.json
 *
 * Usage: npm run fetch:bedrock
 * CI / scheduled: npm run refresh:data (see .github/workflows/refresh-data.yml)
 *
 * GeoAtlas serves a government TLS chain that Node may not trust on some
 * Windows installs — the script disables strict TLS for this host only when
 * NODE_TLS_REJECT_UNAUTHORIZED is not already set.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_GEOJSON = path.join(ROOT, 'public', 'data', 'geoatlas-bedrock-1m.geojson');
const OUT_META = path.join(ROOT, 'public', 'data', 'geoatlas-bedrock-1m.meta.json');

const QUERY_URL =
  'https://dnrmaps.gov.nl.ca/arcgis/rest/services/GeoAtlas/Bedrock_Geology_All/MapServer/23/query';
const OUT_FIELDS = 'LABEL,LITHOLOGY,AGE,TECTONIC,REFERENCE,RED,GREEN,BLUE';
const OUT_SR = 4326;
const MAX_ALLOWABLE_OFFSET = 0.002;
const PAGE_SIZE = 200;
const CONCURRENCY = 4;

if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === undefined) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

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
  props.name = props.LABEL?.trim() || 'Unnamed unit';
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
    headers: { 'User-Agent': 'explorer-v3-fetch-bedrock/1.0' }
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
  console.log('Counting GeoAtlas bedrock features…');
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
  const generatedAt = new Date();
  const version = generatedAt.toISOString().slice(0, 10);
  const cadenceMonths = 6;
  const nextDueDate = new Date(generatedAt);
  nextDueDate.setUTCMonth(nextDueDate.getUTCMonth() + cadenceMonths);
  const nextDue = nextDueDate.toISOString().slice(0, 10);

  const geojsonBody = JSON.stringify(collection);
  const contentHash = createHash('sha256').update(geojsonBody).digest('hex');

  await mkdir(path.dirname(OUT_GEOJSON), { recursive: true });
  await writeFile(OUT_GEOJSON, geojsonBody);
  await writeFile(
    OUT_META,
    JSON.stringify(
      {
        version,
        featureCount: features.length,
        contentHash,
        source: QUERY_URL,
        outSR: OUT_SR,
        maxAllowableOffset: MAX_ALLOWABLE_OFFSET,
        cadenceMonths,
        generatedAt: generatedAt.toISOString(),
        nextDue,
        refresh: 'GitHub Actions refresh-data.yml (1 Jan & 1 Jul UTC) or npm run refresh:data'
      },
      null,
      2
    )
  );

  const bytes = Buffer.byteLength(geojsonBody);
  console.log(
    `Wrote ${features.length} features → ${path.relative(ROOT, OUT_GEOJSON)} (${(bytes / 1e6).toFixed(1)} MB) in ${((Date.now() - started) / 1000).toFixed(1)}s`
  );
  console.log(`Meta version=${version} nextDue=${nextDue} → ${path.relative(ROOT, OUT_META)}`);
  console.log('Bump LAYER_CONFIG.geoatlasBedrock.cacheVersion to match meta.version if it changed (npm run refresh:data does this).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
