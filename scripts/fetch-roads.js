/**
 * Bake Labrador roads (GeoAtlas Map_Layers/12 Regional Road Network).
 * Highways + arterials/collectors only (local streets excluded; railroad → fetch:rail).
 *
 * Usage: npm run fetch:roads
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bakeLabradorPolylines } from './lib/bakePolylines.js';
import {
  MAP_LAYERS_QUERY_BASE,
  ROADS_OUT_FIELDS,
  ROADS_WHERE,
  enrichRoadsFeatureProperties
} from '../js/config/infrastructure.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

await bakeLabradorPolylines({
  queryUrl: `${MAP_LAYERS_QUERY_BASE}/12/query`,
  where: ROADS_WHERE,
  outFields: ROADS_OUT_FIELDS,
  outGeojson: path.join(ROOT, 'public', 'data', 'geoatlas-roads-labrador.geojson'),
  outMeta: path.join(ROOT, 'public', 'data', 'geoatlas-roads-labrador.meta.json'),
  cadenceMonths: 6,
  enrich: (f) => {
    enrichRoadsFeatureProperties(f.properties);
    return f;
  },
  metaExtra: {
    layerId: 12,
    layerName: 'Regional Road Network',
    note: 'NRN highways + collectors; local streets and railroad excluded'
  },
  userAgent: 'explorer-v3-fetch-roads/1.0'
});

console.log('Bump LAYER_CONFIG.geoatlasRoads.cacheVersion if version changed.');
