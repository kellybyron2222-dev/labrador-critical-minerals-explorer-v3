/**
 * Bake Labrador land-use constraints (GeoAtlas Land_Use layers 0,1,5,7,8 merged).
 *
 * Writes:
 *   public/data/geoatlas-landuse-labrador.geojson
 *   public/data/geoatlas-landuse-labrador.meta.json
 *
 * Usage: npm run fetch:landuse
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureTlsRelaxed, writeBakeOutputs } from './lib/bakeMeta.js';
import { esriPolygonToGeoJSON, mapPool } from './lib/esriPolygons.js';
import { LABRADOR_CLIP_BBOX, labradorGeometryQueryParams } from '../js/config/mineralLands.js';
import {
  LAND_USE_MAPSERVER,
  LAND_USE_SOURCES,
  enrichLandUseFeatureProperties
} from '../js/config/protectedAreas.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_GEOJSON = path.join(ROOT, 'public', 'data', 'geoatlas-landuse-labrador.geojson');
const OUT_META = path.join(ROOT, 'public', 'data', 'geoatlas-landuse-labrador.meta.json');

const OUT_SR = 4326;
const MAX_ALLOWABLE_OFFSET = 0.002;
const PAGE_SIZE = 200;
const CONCURRENCY = 4;
const CADENCE_MONTHS = 12;

ensureTlsRelaxed();

function esriFeatureToGeoJSON(feature, landUseKind) {
  const geometry = esriPolygonToGeoJSON(feature?.geometry);
  if (!geometry) return null;
  return {
    type: 'Feature',
    properties: enrichLandUseFeatureProperties({
      ...(feature.attributes || {}),
      landUseKind
    }),
    geometry
  };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'explorer-v3-fetch-landuse/1.0' }
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

async function fetchSource(source) {
  const queryUrl = `${LAND_USE_MAPSERVER}/${source.layerId}/query`;
  const countJson = await fetchJson(
    `${queryUrl}?${new URLSearchParams(baseParams({ returnCountOnly: 'true' }))}`
  );
  const total = countJson.count ?? 0;
  if (!total) {
    console.log(`  ${source.label} (layer ${source.layerId}): 0 features — skip`);
    return [];
  }

  const offsets = [];
  for (let offset = 0; offset < total; offset += PAGE_SIZE) {
    offsets.push(offset);
  }
  console.log(
    `  ${source.label} (layer ${source.layerId}): ${total} features in ${offsets.length} pages…`
  );

  const pages = await mapPool(offsets, CONCURRENCY, async (offset) => {
    const params = new URLSearchParams(
      baseParams({
        outFields: source.outFields,
        outSR: String(OUT_SR),
        maxAllowableOffset: String(MAX_ALLOWABLE_OFFSET),
        resultOffset: String(offset),
        resultRecordCount: String(PAGE_SIZE)
      })
    );
    const page = await fetchJson(`${queryUrl}?${params}`);
    if (page.error) {
      throw new Error(`${source.label}: ${JSON.stringify(page.error)}`);
    }
    return (page.features || [])
      .map((f) => esriFeatureToGeoJSON(f, source.kind))
      .filter(Boolean);
  });

  return pages.flat();
}

async function main() {
  const started = Date.now();
  console.log('Fetching Labrador-clipped land-use constraints…');

  const features = [];
  const perSource = {};
  for (const source of LAND_USE_SOURCES) {
    const part = await fetchSource(source);
    perSource[source.kind] = part.length;
    features.push(...part);
  }

  if (!features.length) {
    throw new Error('Merged land-use feature count was 0');
  }

  const collection = { type: 'FeatureCollection', features };
  const geojsonBody = JSON.stringify(collection);

  const { version, nextDue, bytes } = await writeBakeOutputs({
    assetPath: OUT_GEOJSON,
    metaPath: OUT_META,
    assetBody: geojsonBody,
    cadenceMonths: CADENCE_MONTHS,
    metaExtra: {
      featureCount: features.length,
      perSource,
      source: LAND_USE_MAPSERVER,
      layerIds: LAND_USE_SOURCES.map((s) => s.layerId),
      layerKinds: LAND_USE_SOURCES.map((s) => s.kind),
      outSR: OUT_SR,
      maxAllowableOffset: MAX_ALLOWABLE_OFFSET,
      clip: 'Labrador bbox (south of Strait of Belle Isle)',
      clipBbox: LABRADOR_CLIP_BBOX
    }
  });

  console.log(
    `Wrote ${features.length} features → ${path.relative(ROOT, OUT_GEOJSON)} (${(bytes / 1e6).toFixed(1)} MB) in ${((Date.now() - started) / 1000).toFixed(1)}s`
  );
  console.log(`Per source:`, perSource);
  console.log(`Meta version=${version} nextDue=${nextDue} → ${path.relative(ROOT, OUT_META)}`);
  console.log(
    'Bump LAYER_CONFIG.geoatlasLandUse.cacheVersion to match meta.version if it changed (npm run refresh:data does this).'
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
