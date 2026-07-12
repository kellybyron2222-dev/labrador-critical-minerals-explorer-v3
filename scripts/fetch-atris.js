/**
 * Bake Labrador-relevant ATRIS comprehensive land claims (federal, not mineral licences).
 *
 * Writes:
 *   public/data/atris-claims-labrador.geojson
 *   public/data/atris-claims-labrador.meta.json
 *
 * Usage: npm run fetch:atris
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureTlsRelaxed, writeBakeOutputs } from './lib/bakeMeta.js';
import { esriPolygonToGeoJSON } from './lib/esriPolygons.js';
import {
  ATRIS_CLAIMS_QUERY,
  ATRIS_LABRADOR_TAG_IDS,
  ATRIS_OUT_FIELDS,
  ATRIS_WHERE,
  resolveAtrisFillColor
} from '../js/config/indigenousLands.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_GEOJSON = path.join(ROOT, 'public', 'data', 'atris-claims-labrador.geojson');
const OUT_META = path.join(ROOT, 'public', 'data', 'atris-claims-labrador.meta.json');

const OUT_SR = 4326;
const MAX_ALLOWABLE_OFFSET = 0.002;
const CADENCE_MONTHS = 12;

ensureTlsRelaxed();

function enrichFeature(feature) {
  const props = feature.properties;
  const ename = (props.ENAME || '').trim();
  props.ENAME = ename;
  props.name = ename || props.TAG_ID || 'Land claim';
  props.fillColor = resolveAtrisFillColor(props.TAG_ID || ename);
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
    headers: { 'User-Agent': 'explorer-v3-fetch-atris/1.0' }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

async function main() {
  const started = Date.now();
  const params = new URLSearchParams({
    where: ATRIS_WHERE,
    outFields: ATRIS_OUT_FIELDS,
    f: 'json',
    outSR: String(OUT_SR),
    maxAllowableOffset: String(MAX_ALLOWABLE_OFFSET)
  });
  console.log(`Fetching ATRIS Labrador TAG_IDs: ${ATRIS_LABRADOR_TAG_IDS.join(', ')}…`);
  const page = await fetchJson(`${ATRIS_CLAIMS_QUERY}?${params}`);
  if (page.error) throw new Error(JSON.stringify(page.error));

  const features = (page.features || []).map(esriFeatureToGeoJSON).filter(Boolean);
  if (!features.length) throw new Error('No ATRIS Labrador features returned');

  const geojsonBody = JSON.stringify({ type: 'FeatureCollection', features });
  const { version, nextDue, bytes } = await writeBakeOutputs({
    assetPath: OUT_GEOJSON,
    metaPath: OUT_META,
    assetBody: geojsonBody,
    cadenceMonths: CADENCE_MONTHS,
    metaExtra: {
      featureCount: features.length,
      source: ATRIS_CLAIMS_QUERY,
      where: ATRIS_WHERE,
      tagIds: ATRIS_LABRADOR_TAG_IDS,
      outSR: OUT_SR,
      maxAllowableOffset: MAX_ALLOWABLE_OFFSET,
      attribution: 'CIRNAC / ISC — ATRIS comprehensive land claims; approximate boundaries'
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
