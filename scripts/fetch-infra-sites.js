/**
 * Bake curated Labrador infrastructure sites (ports, airports, generation, communities).
 * Static points — no live ArcGIS dependency.
 *
 * Usage: npm run fetch:infra-sites
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeBakeOutputs } from './lib/bakeMeta.js';
import { curatedSitesFeatureCollection } from '../js/config/infrastructure.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const KINDS = [
  {
    kinds: ['port'],
    file: 'infra-ports-labrador',
    label: 'Ports / marine access'
  },
  {
    kinds: ['airport'],
    file: 'infra-airports-labrador',
    label: 'Airports / airstrips'
  },
  {
    kinds: ['generation'],
    file: 'infra-generation-labrador',
    label: 'Power generation'
  },
  {
    kinds: ['community'],
    file: 'infra-communities-labrador',
    label: 'Communities'
  }
];

const CADENCE_MONTHS = 12;

for (const entry of KINDS) {
  const collection = curatedSitesFeatureCollection(entry.kinds);
  const outGeojson = path.join(ROOT, 'public', 'data', `${entry.file}.geojson`);
  const outMeta = path.join(ROOT, 'public', 'data', `${entry.file}.meta.json`);
  const body = JSON.stringify(collection);
  const { version, nextDue, bytes } = await writeBakeOutputs({
    assetPath: outGeojson,
    metaPath: outMeta,
    assetBody: body,
    cadenceMonths: CADENCE_MONTHS,
    metaExtra: {
      featureCount: collection.features.length,
      source: 'curated Labrador infrastructure points (explorer-v3)',
      kinds: entry.kinds,
      label: entry.label
    }
  });
  console.log(
    `${entry.label}: ${collection.features.length} pts → ${entry.file}.geojson (${bytes} B) version=${version} nextDue=${nextDue}`
  );
}

console.log('Bump LAYER_CONFIG infra* cacheVersion fields if versions changed.');
