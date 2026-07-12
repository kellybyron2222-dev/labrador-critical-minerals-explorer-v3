/**
 * Bake Labrador airborne geophysical survey footprints
 * (GeoAtlas Indexes MapServer/6).
 *
 * Writes:
 *   public/data/geoatlas-survey-footprints-labrador.geojson
 *   public/data/geoatlas-survey-footprints-labrador.meta.json
 *
 * Usage: npm run fetch:survey-footprints
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureTlsRelaxed, writeBakeOutputs } from './lib/bakeMeta.js';
import { esriPolygonToGeoJSON, mapPool } from './lib/esriPolygons.js';
import {
  LABRADOR_CLIP_BBOX,
  labradorGeometryQueryParams
} from '../js/config/mineralLands.js';
import { enrichSurveyFootprintProperties } from '../js/config/surveyFootprints.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_GEOJSON = path.join(
  ROOT,
  'public',
  'data',
  'geoatlas-survey-footprints-labrador.geojson'
);
const OUT_META = path.join(
  ROOT,
  'public',
  'data',
  'geoatlas-survey-footprints-labrador.meta.json'
);

const QUERY_URL =
  'https://dnrmaps.gov.nl.ca/arcgis/rest/services/GeoAtlas/Indexes/MapServer/6/query';
const OUT_FIELDS =
  'OBJECTID,SURVEY_ID,GEOFILE,DIGITAL,SURV_DATE,SURV_YEAR,LINE_SPACE,PARAMETERS,COMPANY';
const OUT_SR = 4326;
const MAX_ALLOWABLE_OFFSET = 0.002;
const PAGE_SIZE = 200;
const CONCURRENCY = 4;
const CADENCE_MONTHS = 12;

ensureTlsRelaxed();

function enrichFeature(feature) {
  enrichSurveyFootprintProperties(feature.properties);
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
    headers: { 'User-Agent': 'explorer-v3-fetch-survey-footprints/1.0' }
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
      outFields: OUT_FIELDS,
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
  console.log(
    `Counting Labrador-clipped airborne survey footprints (bbox ${LABRADOR_CLIP_BBOX.xmin},${LABRADOR_CLIP_BBOX.ymin}…${LABRADOR_CLIP_BBOX.xmax},${LABRADOR_CLIP_BBOX.ymax})…`
  );
  const countJson = await fetchJson(
    `${QUERY_URL}?${new URLSearchParams(baseParams({ returnCountOnly: 'true' }))}`
  );
  const total = countJson.count ?? 0;
  if (!total) throw new Error('Feature count was 0');

  const offsets = [];
  for (let offset = 0; offset < total; offset += PAGE_SIZE) {
    offsets.push(offset);
  }
  console.log(
    `Fetching ${total} features in ${offsets.length} pages (concurrency ${CONCURRENCY})…`
  );

  const pages = await mapPool(offsets, CONCURRENCY, async (offset, index) => {
    const features = await fetchPage(offset);
    console.log(
      `  page ${index + 1}/${offsets.length} offset=${offset} → ${features.length}`
    );
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
      source: QUERY_URL.replace('/query', ''),
      layerId: 6,
      clip: LABRADOR_CLIP_BBOX,
      outFields: OUT_FIELDS
    }
  });

  console.log(
    `Wrote ${path.relative(ROOT, OUT_GEOJSON)} ${features.length} features (${(bytes / 1e6).toFixed(2)} MB) version=${version} nextDue=${nextDue} in ${((Date.now() - started) / 1000).toFixed(1)}s`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
