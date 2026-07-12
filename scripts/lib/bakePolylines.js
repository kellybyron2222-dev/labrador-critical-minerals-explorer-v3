/**
 * Shared paginated Esri polyline bake for GeoAtlas infrastructure layers.
 */

import { ensureTlsRelaxed, writeBakeOutputs } from './bakeMeta.js';
import { esriPolylineFeatureToGeoJSON, mapPool } from './esriGeometries.js';
import { LABRADOR_CLIP_BBOX, labradorGeometryQueryParams } from '../../js/config/mineralLands.js';

ensureTlsRelaxed();

export async function fetchJson(url, userAgent) {
  const response = await fetch(url, {
    headers: { 'User-Agent': userAgent || 'explorer-v3-fetch-infra/1.0' }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

export async function fetchLabradorPolylineFeatures({
  queryUrl,
  where = '1=1',
  outFields,
  enrich,
  pageSize = 200,
  concurrency = 4,
  maxAllowableOffset = 0.002,
  outSR = 4326,
  userAgent,
  allowEmpty = false
}) {
  const baseParams = (extra = {}) => ({
    where,
    f: 'json',
    ...labradorGeometryQueryParams(),
    ...extra
  });

  console.log(`Counting features (${where})…`);
  const countJson = await fetchJson(
    `${queryUrl}?${new URLSearchParams(baseParams({ returnCountOnly: 'true' }))}`,
    userAgent
  );
  const total = countJson.count ?? 0;
  if (!total) {
    if (allowEmpty) return [];
    throw new Error(`Feature count was 0 for ${queryUrl}`);
  }

  const offsets = [];
  for (let offset = 0; offset < total; offset += pageSize) offsets.push(offset);
  console.log(`Fetching ${total} features in ${offsets.length} pages…`);

  const pages = await mapPool(offsets, concurrency, async (offset, index) => {
    const params = new URLSearchParams(
      baseParams({
        outFields,
        outSR: String(outSR),
        maxAllowableOffset: String(maxAllowableOffset),
        resultOffset: String(offset),
        resultRecordCount: String(pageSize)
      })
    );
    const page = await fetchJson(`${queryUrl}?${params}`, userAgent);
    if (page.error) throw new Error(JSON.stringify(page.error));
    const features = (page.features || [])
      .map((f) => esriPolylineFeatureToGeoJSON(f, enrich))
      .filter(Boolean);
    console.log(`  page ${index + 1}/${offsets.length} offset=${offset} → ${features.length}`);
    return features;
  });

  return pages.flat();
}

export async function bakeLabradorPolylines({
  queryUrl,
  where = '1=1',
  outFields,
  outGeojson,
  outMeta,
  cadenceMonths,
  enrich,
  metaExtra = {},
  pageSize = 200,
  concurrency = 4,
  maxAllowableOffset = 0.002,
  outSR = 4326,
  userAgent
}) {
  const started = Date.now();
  const features = await fetchLabradorPolylineFeatures({
    queryUrl,
    where,
    outFields,
    enrich,
    pageSize,
    concurrency,
    maxAllowableOffset,
    outSR,
    userAgent
  });

  const geojsonBody = JSON.stringify({ type: 'FeatureCollection', features });
  const { version, nextDue, bytes } = await writeBakeOutputs({
    assetPath: outGeojson,
    metaPath: outMeta,
    assetBody: geojsonBody,
    cadenceMonths,
    metaExtra: {
      featureCount: features.length,
      source: queryUrl,
      where,
      outSR,
      maxAllowableOffset,
      outFields,
      clip: 'Labrador bbox (south of Strait of Belle Isle)',
      clipBbox: LABRADOR_CLIP_BBOX,
      ...metaExtra
    }
  });

  console.log(
    `Wrote ${features.length} features (${(bytes / 1e6).toFixed(2)} MB) in ${((Date.now() - started) / 1000).toFixed(1)}s`
  );
  console.log(`Meta version=${version} nextDue=${nextDue}`);
  return { features, version, nextDue, bytes };
}
