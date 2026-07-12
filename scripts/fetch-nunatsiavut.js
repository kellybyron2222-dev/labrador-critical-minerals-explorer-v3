/**
 * Bake Nunatsiavut (Labrador Inuit Settlement Area) from SAC-ISC Inuit Regions.
 *
 * Writes:
 *   public/data/inuit-nunatsiavut.geojson
 *   public/data/inuit-nunatsiavut.meta.json
 *
 * Usage: npm run fetch:nunatsiavut
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureTlsRelaxed, writeBakeOutputs } from './lib/bakeMeta.js';
import { esriPolygonToGeoJSON } from './lib/esriPolygons.js';
import {
  INUIT_REGIONS_QUERY,
  NUNATSIAVUT_OUT_FIELDS,
  NUNATSIAVUT_WHERE,
  resolveNunatsiavutFillColor
} from '../js/config/indigenousLands.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_GEOJSON = path.join(ROOT, 'public', 'data', 'inuit-nunatsiavut.geojson');
const OUT_META = path.join(ROOT, 'public', 'data', 'inuit-nunatsiavut.meta.json');

const OUT_SR = 4326;
const MAX_ALLOWABLE_OFFSET = 0.002;
const CADENCE_MONTHS = 12;

ensureTlsRelaxed();

function enrichFeature(feature) {
  const props = feature.properties;
  props.name = props.REGION?.trim() || 'Nunatsiavut';
  props.fillColor = resolveNunatsiavutFillColor();
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
    headers: { 'User-Agent': 'explorer-v3-fetch-nunatsiavut/1.0' }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

async function main() {
  const started = Date.now();
  const params = new URLSearchParams({
    where: NUNATSIAVUT_WHERE,
    outFields: NUNATSIAVUT_OUT_FIELDS,
    f: 'json',
    outSR: String(OUT_SR),
    maxAllowableOffset: String(MAX_ALLOWABLE_OFFSET)
  });
  console.log('Fetching Nunatsiavut Inuit Region…');
  const page = await fetchJson(`${INUIT_REGIONS_QUERY}?${params}`);
  if (page.error) throw new Error(JSON.stringify(page.error));

  const features = (page.features || []).map(esriFeatureToGeoJSON).filter(Boolean);
  if (!features.length) throw new Error('No Nunatsiavut features returned');

  const geojsonBody = JSON.stringify({ type: 'FeatureCollection', features });
  const { version, nextDue, bytes } = await writeBakeOutputs({
    assetPath: OUT_GEOJSON,
    metaPath: OUT_META,
    assetBody: geojsonBody,
    cadenceMonths: CADENCE_MONTHS,
    metaExtra: {
      featureCount: features.length,
      source: INUIT_REGIONS_QUERY,
      where: NUNATSIAVUT_WHERE,
      outSR: OUT_SR,
      maxAllowableOffset: MAX_ALLOWABLE_OFFSET,
      attribution: 'CIRNAC / ISC — Inuit Regions (Inuit Nunangat); approximate boundaries'
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
