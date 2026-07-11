/**
 * Bake NL&L Critical Mineral Facilities (NRCan) to public/data.
 *
 * Merges MapServer sublayers 0–3, keeps features whose ProvincesEN mentions
 * Newfoundland and Labrador, and writes:
 *   public/data/critical-minerals-nl.geojson
 *   public/data/critical-minerals-nl.meta.json
 *
 * Usage: npm run fetch:facilities
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureTlsRelaxed, writeBakeOutputs } from './lib/bakeMeta.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_GEOJSON = path.join(ROOT, 'public', 'data', 'critical-minerals-nl.geojson');
const OUT_META = path.join(ROOT, 'public', 'data', 'critical-minerals-nl.meta.json');

const NRCAN_REST_BASE =
  'https://maps-cartes.services.geo.ca/server_serveur/rest/services/NRCan';
const OUT_FIELDS =
  'PropertyNameEN,OperatorOwnersEN,ProvincesEN,CommoditiesEN,DevelopmentStageEN,ActivityStatusEN,OperationGroupEN,Website';
const PROVINCE = 'Newfoundland and Labrador';
const CADENCE_MONTHS = 3;

ensureTlsRelaxed();

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'explorer-v3-fetch-facilities/1.0' }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

async function main() {
  const started = Date.now();
  const urls = [0, 1, 2, 3].map(
    (layerIndex) =>
      `${NRCAN_REST_BASE}/critical_minerals_en/MapServer/${layerIndex}/query` +
      `?where=1%3D1&outFields=${OUT_FIELDS}&f=geojson`
  );

  console.log('Fetching NRCan critical minerals sublayers…');
  const pages = await Promise.all(urls.map((url) => fetchJson(url)));
  const national = pages.flatMap((page, i) => {
    if (page.error) throw new Error(`Layer ${i}: ${JSON.stringify(page.error)}`);
    return page.features || [];
  });

  const features = national
    .filter((f) => String(f.properties?.ProvincesEN || '').includes(PROVINCE))
    .map((feature) => ({
      ...feature,
      properties: {
        ...feature.properties,
        name: feature.properties.PropertyNameEN
      }
    }));

  if (!features.length) throw new Error('No NL&L critical mineral facilities found');

  const collection = { type: 'FeatureCollection', features };
  const body = JSON.stringify(collection);
  const { version, nextDue, bytes } = await writeBakeOutputs({
    assetPath: OUT_GEOJSON,
    metaPath: OUT_META,
    assetBody: body,
    cadenceMonths: CADENCE_MONTHS,
    metaExtra: {
      featureCount: features.length,
      nationalFeatureCount: national.length,
      source: `${NRCAN_REST_BASE}/critical_minerals_en/MapServer`,
      filter: `ProvincesEN contains "${PROVINCE}"`,
      outFields: OUT_FIELDS
    }
  });

  console.log(
    `Wrote ${features.length}/${national.length} NL features → ${path.relative(ROOT, OUT_GEOJSON)} (${(bytes / 1e3).toFixed(1)} KB) in ${((Date.now() - started) / 1000).toFixed(1)}s`
  );
  console.log(`Meta version=${version} nextDue=${nextDue}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
