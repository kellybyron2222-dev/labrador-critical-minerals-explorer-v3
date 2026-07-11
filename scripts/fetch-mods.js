/**
 * Bake Labrador MODS occurrences to public/data for fast cold loads.
 *
 * Writes:
 *   public/data/mods-labrador.geojson
 *   public/data/mods-labrador.meta.json
 *
 * Usage: npm run fetch:mods
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureTlsRelaxed, writeBakeOutputs } from './lib/bakeMeta.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_GEOJSON = path.join(ROOT, 'public', 'data', 'mods-labrador.geojson');
const OUT_META = path.join(ROOT, 'public', 'data', 'mods-labrador.meta.json');

const QUERY_URL =
  'https://dnrmaps.gov.nl.ca/arcgis/rest/services/GeoAtlas/Map_Layers/MapServer/3/query';
const WHERE = "REGION='Labrador'";
const OUT_FIELDS =
  'NMINO,DEPNAME,COMNAME,COMMODS,STATUS,DEPDESC,OREMIN,GANGUE,WORKING,DDH,TRENCH,ADIT,NTS';
const PAGE_SIZE = 1000;
const CADENCE_MONTHS = 3;

ensureTlsRelaxed();

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'explorer-v3-fetch-mods/1.0' }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

async function main() {
  const started = Date.now();
  const features = [];
  let offset = 0;

  console.log('Fetching Labrador MODS (paginated GeoJSON)…');
  for (;;) {
    const params = new URLSearchParams({
      where: WHERE,
      outFields: OUT_FIELDS,
      f: 'geojson',
      resultOffset: String(offset),
      resultRecordCount: String(PAGE_SIZE)
    });
    const page = await fetchJson(`${QUERY_URL}?${params}`);
    if (page.error) throw new Error(JSON.stringify(page.error));
    const batch = page.features || [];
    features.push(...batch);
    console.log(`  offset=${offset} → ${batch.length} (total ${features.length})`);
    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  if (!features.length) throw new Error('MODS feature count was 0');

  const collection = { type: 'FeatureCollection', features };
  const body = JSON.stringify(collection);
  const { version, nextDue, bytes } = await writeBakeOutputs({
    assetPath: OUT_GEOJSON,
    metaPath: OUT_META,
    assetBody: body,
    cadenceMonths: CADENCE_MONTHS,
    metaExtra: {
      featureCount: features.length,
      source: QUERY_URL,
      where: WHERE,
      outFields: OUT_FIELDS
    }
  });

  console.log(
    `Wrote ${features.length} features → ${path.relative(ROOT, OUT_GEOJSON)} (${(bytes / 1e6).toFixed(2)} MB) in ${((Date.now() - started) / 1000).toFixed(1)}s`
  );
  console.log(`Meta version=${version} nextDue=${nextDue}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
