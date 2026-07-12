/**
 * Bake Labrador resource access roads (GeoAtlas Map_Layers/14).
 *
 * Usage: npm run fetch:resource-roads
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bakeLabradorPolylines } from './lib/bakePolylines.js';
import {
  MAP_LAYERS_QUERY_BASE,
  RESOURCE_ROADS_OUT_FIELDS,
  enrichResourceRoadProperties
} from '../js/config/infrastructure.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

await bakeLabradorPolylines({
  queryUrl: `${MAP_LAYERS_QUERY_BASE}/14/query`,
  where: '1=1',
  outFields: RESOURCE_ROADS_OUT_FIELDS,
  outGeojson: path.join(ROOT, 'public', 'data', 'geoatlas-resource-roads-labrador.geojson'),
  outMeta: path.join(ROOT, 'public', 'data', 'geoatlas-resource-roads-labrador.meta.json'),
  cadenceMonths: 6,
  enrich: (f) => {
    enrichResourceRoadProperties(f.properties);
    return f;
  },
  metaExtra: {
    layerId: 14,
    layerName: 'Resource Access Roads'
  },
  userAgent: 'explorer-v3-fetch-resource-roads/1.0'
});

console.log('Bump LAYER_CONFIG.geoatlasResourceRoads.cacheVersion if version changed.');
