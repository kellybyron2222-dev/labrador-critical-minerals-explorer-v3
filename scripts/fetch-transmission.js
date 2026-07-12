/**
 * Bake Labrador transmission lines (Nalcor Map_Layers/15 + CanVec /16).
 *
 * Usage: npm run fetch:transmission
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeBakeOutputs } from './lib/bakeMeta.js';
import { fetchLabradorPolylineFeatures } from './lib/bakePolylines.js';
import {
  MAP_LAYERS_QUERY_BASE,
  NALCOR_OUT_FIELDS,
  CANVEC_TX_OUT_FIELDS,
  enrichTransmissionProperties,
  LABRADOR_CLIP_BBOX
} from '../js/config/infrastructure.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_GEOJSON = path.join(ROOT, 'public', 'data', 'geoatlas-transmission-labrador.geojson');
const OUT_META = path.join(ROOT, 'public', 'data', 'geoatlas-transmission-labrador.meta.json');
const CADENCE_MONTHS = 6;

const started = Date.now();

const nalcor = await fetchLabradorPolylineFeatures({
  queryUrl: `${MAP_LAYERS_QUERY_BASE}/15/query`,
  outFields: NALCOR_OUT_FIELDS,
  enrich: (f) => {
    enrichTransmissionProperties(f.properties, 'nalcor');
    return f;
  },
  userAgent: 'explorer-v3-fetch-transmission/1.0'
});

const canvec = await fetchLabradorPolylineFeatures({
  queryUrl: `${MAP_LAYERS_QUERY_BASE}/16/query`,
  outFields: CANVEC_TX_OUT_FIELDS,
  enrich: (f) => {
    enrichTransmissionProperties(f.properties, 'canvec');
    return f;
  },
  userAgent: 'explorer-v3-fetch-transmission/1.0'
});

const features = [...nalcor, ...canvec];
const geojsonBody = JSON.stringify({ type: 'FeatureCollection', features });
const { version, nextDue, bytes } = await writeBakeOutputs({
  assetPath: OUT_GEOJSON,
  metaPath: OUT_META,
  assetBody: geojsonBody,
  cadenceMonths: CADENCE_MONTHS,
  metaExtra: {
    featureCount: features.length,
    nalcorCount: nalcor.length,
    canvecCount: canvec.length,
    sources: [`${MAP_LAYERS_QUERY_BASE}/15`, `${MAP_LAYERS_QUERY_BASE}/16`],
    clip: 'Labrador bbox (south of Strait of Belle Isle)',
    clipBbox: LABRADOR_CLIP_BBOX
  }
});

console.log(
  `Merged ${features.length} transmission features → ${(bytes / 1e6).toFixed(2)} MB in ${((Date.now() - started) / 1000).toFixed(1)}s`
);
console.log(`Meta version=${version} nextDue=${nextDue}`);
console.log('Bump LAYER_CONFIG.geoatlasTransmission.cacheVersion if version changed.');
