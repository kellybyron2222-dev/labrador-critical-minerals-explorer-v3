/**
 * Bake Labrador railways (GeoAtlas Map_Layers/12 ROADCLASS = Railroad).
 *
 * Usage: npm run fetch:rail
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bakeLabradorPolylines } from './lib/bakePolylines.js';
import {
  MAP_LAYERS_QUERY_BASE,
  RAIL_WHERE,
  ROADS_OUT_FIELDS,
  enrichRailFeatureProperties
} from '../js/config/infrastructure.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

await bakeLabradorPolylines({
  queryUrl: `${MAP_LAYERS_QUERY_BASE}/12/query`,
  where: RAIL_WHERE,
  outFields: ROADS_OUT_FIELDS,
  outGeojson: path.join(ROOT, 'public', 'data', 'geoatlas-rail-labrador.geojson'),
  outMeta: path.join(ROOT, 'public', 'data', 'geoatlas-rail-labrador.meta.json'),
  cadenceMonths: 6,
  enrich: (f) => {
    enrichRailFeatureProperties(f.properties);
    return f;
  },
  metaExtra: {
    layerId: 12,
    layerName: 'Regional Road Network (Railroad class)',
    note: 'Iron-ore / QNS&L corridor segments tagged ROADCLASS=Railroad in NRN'
  },
  userAgent: 'explorer-v3-fetch-rail/1.0'
});

console.log('Bump LAYER_CONFIG.geoatlasRail.cacheVersion if version changed.');
