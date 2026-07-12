/**
 * Validate baked datasets against the refresh registry.
 *
 * Checks (fail process with exit 1 on any error):
 *   - registry outputs / asset / meta paths exist
 *   - sha256(asset) === meta.contentHash
 *   - meta.version === contentHash.slice(0, 12)
 *   - layerConfig cacheVersion for cacheKey matches that prefix
 *   - GeoJSON features.length === meta.featureCount (+ floor sanity)
 *   - meta.cadenceMonths === registry.cadenceMonths
 *   - image bakes: hash + cacheVersion only
 *
 * Usage: npm run validate:data
 */

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cacheVersionFromHash } from './lib/bakeMeta.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(__dirname, 'data-refresh-registry.json');
const LAYER_CONFIG_PATH = path.join(ROOT, 'js', 'config', 'layerConfig.js');

/** Minimum feature counts to catch truncated pagination. */
const FEATURE_FLOORS = {
  'mods-labrador': 3000,
  'geoatlas-bedrock-1m': 3000,
  'geoatlas-surficial-regional': 10000,
  'geoatlas-claims-labrador': 900,
  'geoatlas-tenure-labrador': 60,
  'geoatlas-cpcad-labrador': 10,
  'geoatlas-landuse-labrador': 100,
  'atris-claims-labrador': 4,
  'inuit-nunatsiavut': 1,
  'critical-minerals-nl': 10,
  'geoatlas-roads-labrador': 1000,
  'geoatlas-rail-labrador': 150,
  'geoatlas-resource-roads-labrador': 900,
  'geoatlas-transmission-labrador': 50,
  'infra-ports-labrador': 5,
  'infra-airports-labrador': 8,
  'infra-generation-labrador': 2,
  'infra-communities-labrador': 10,
  'geoatlas-municipal-labrador': 10
};

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

/** Parse cacheKey → cacheVersion pairs from layerConfig.js source text. */
function parseCacheVersions(source) {
  const map = new Map();
  const re = /cacheKey:\s*'([^']+)'[\s\S]*?cacheVersion:\s*'([^']+)'/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    map.set(match[1], match[2]);
  }
  return map;
}

async function validateEntry(entry, cacheVersions, errors) {
  const label = entry.label || entry.id;
  const assetPath = path.join(ROOT, entry.assetPath);
  const metaPath = path.join(ROOT, entry.metaPath);

  for (const rel of entry.outputs || []) {
    const abs = path.join(ROOT, rel);
    if (!(await fileExists(abs))) {
      errors.push(`${label}: missing output ${rel}`);
    }
  }
  if (!(await fileExists(assetPath))) {
    errors.push(`${label}: missing asset ${entry.assetPath}`);
    return;
  }
  if (!(await fileExists(metaPath))) {
    errors.push(`${label}: missing meta ${entry.metaPath}`);
    return;
  }

  let meta;
  try {
    meta = JSON.parse(await readFile(metaPath, 'utf8'));
  } catch (err) {
    errors.push(`${label}: invalid meta JSON (${err.message})`);
    return;
  }

  const contentHash = await hashFile(assetPath);
  if (!meta.contentHash) {
    errors.push(`${label}: meta.contentHash missing`);
  } else if (meta.contentHash !== contentHash) {
    errors.push(
      `${label}: contentHash mismatch (meta ${meta.contentHash.slice(0, 12)}… ≠ file ${contentHash.slice(0, 12)}…)`
    );
  }

  const expectedVersion = cacheVersionFromHash(contentHash);
  if (meta.version !== expectedVersion) {
    errors.push(
      `${label}: meta.version "${meta.version}" ≠ contentHash prefix "${expectedVersion}"`
    );
  }

  if (entry.cacheKey) {
    const cfgVersion = cacheVersions.get(entry.cacheKey);
    if (!cfgVersion) {
      errors.push(`${label}: cacheKey "${entry.cacheKey}" not found in layerConfig.js`);
    } else if (cfgVersion !== expectedVersion) {
      errors.push(
        `${label}: layerConfig cacheVersion "${cfgVersion}" ≠ "${expectedVersion}"`
      );
    }
  }

  if (entry.cadenceMonths != null && meta.cadenceMonths !== entry.cadenceMonths) {
    errors.push(
      `${label}: cadenceMonths meta=${meta.cadenceMonths} registry=${entry.cadenceMonths}`
    );
  }

  if (entry.kind === 'image') {
    if (meta.featureCount != null) {
      errors.push(`${label}: image bake should not have featureCount (got ${meta.featureCount})`);
    }
    return;
  }

  // GeoJSON checks
  let geojson;
  try {
    geojson = JSON.parse(await readFile(assetPath, 'utf8'));
  } catch (err) {
    errors.push(`${label}: invalid GeoJSON (${err.message})`);
    return;
  }

  const count = Array.isArray(geojson.features) ? geojson.features.length : -1;
  if (count < 0) {
    errors.push(`${label}: GeoJSON missing features array`);
    return;
  }

  if (meta.featureCount !== count) {
    errors.push(
      `${label}: featureCount meta=${meta.featureCount} file=${count}`
    );
  }

  const floor = FEATURE_FLOORS[entry.id];
  if (floor != null && count < floor) {
    errors.push(`${label}: feature count ${count} below floor ${floor}`);
  }
}

async function main() {
  const registry = JSON.parse(await readFile(REGISTRY_PATH, 'utf8'));
  const layerConfigSource = await readFile(LAYER_CONFIG_PATH, 'utf8');
  const cacheVersions = parseCacheVersions(layerConfigSource);
  const errors = [];

  console.log(`Validating ${registry.length} registry datasets…`);

  for (const entry of registry) {
    await validateEntry(entry, cacheVersions, errors);
  }

  if (errors.length) {
    console.error(`\nvalidate:data FAILED (${errors.length} error${errors.length === 1 ? '' : 's'}):\n`);
    for (const err of errors) {
      console.error(`  • ${err}`);
    }
    process.exit(1);
  }

  console.log(`validate:data OK — ${registry.length} datasets.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
