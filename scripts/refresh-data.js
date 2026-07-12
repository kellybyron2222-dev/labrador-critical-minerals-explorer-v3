/**
 * CI / local entrypoint for scheduled data refreshes.
 *
 * Reads scripts/data-refresh-registry.json. For each entry:
 *   - skips when meta.nextDue is still in the future (unless FORCE_REFRESH=1
 *     or --force), so one monthly GHA cron can honour 3/6/12-month cadences
 *   - runs the fetch script (scripts marked fetchOncePerScript run at most once
 *     per refresh invocation — used by fetch:wms which bakes all WMS layers)
 *   - compares content hash (+ featureCount for geojson) to the previous bake
 *   - bumps LAYER_CONFIG / WMS_CONFIG cacheVersion when changed
 *   - writes scripts/.refresh-result.json for the GitHub Action
 *
 * Usage: npm run refresh:data
 * Force all: FORCE_REFRESH=1 npm run refresh:data
 */

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(__dirname, 'data-refresh-registry.json');
const RESULT_PATH = path.join(__dirname, '.refresh-result.json');

const FORCE =
  process.env.FORCE_REFRESH === '1' ||
  process.argv.includes('--force') ||
  process.argv.includes('--all');

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

async function readMeta(metaPath) {
  if (!(await fileExists(metaPath))) return null;
  return JSON.parse(await readFile(metaPath, 'utf8'));
}

function runNpmScript(scriptName) {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', scriptName], {
      cwd: ROOT,
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        NODE_TLS_REJECT_UNAUTHORIZED: process.env.NODE_TLS_REJECT_UNAUTHORIZED ?? '0'
      }
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`npm run ${scriptName} exited with code ${code}`));
    });
  });
}

async function bumpCacheVersion(configPath, cacheKey, newVersion) {
  const absolute = path.join(ROOT, configPath);
  const text = await readFile(absolute, 'utf8');
  const escapedKey = cacheKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `(cacheKey:\\s*'${escapedKey}',\\s*(?:\\/\\/[^\\n]*\\n\\s*)*cacheVersion:\\s*')[^']+(')`
  );
  if (!pattern.test(text)) {
    throw new Error(`Could not find cacheVersion for cacheKey=${cacheKey} in ${configPath}`);
  }
  const updated = text.replace(pattern, `$1${newVersion}$2`);
  await writeFile(absolute, updated);
}

function assetPathFor(entry) {
  return entry.assetPath || entry.geojsonPath;
}

async function snapshotDataset(entry) {
  const assetRel = assetPathFor(entry);
  const assetAbs = path.join(ROOT, assetRel);
  const metaPath = path.join(ROOT, entry.metaPath);
  const meta = await readMeta(metaPath);
  const hash = (await fileExists(assetAbs)) ? await hashFile(assetAbs) : null;
  const contentHash = meta?.contentHash || hash;
  return {
    featureCount: meta?.featureCount ?? null,
    version: meta?.version ?? null,
    contentHash,
    /** Prefer hash prefix for IndexedDB / HTTP cache busting. */
    cacheVersion: contentHash ? String(contentHash).slice(0, 12) : meta?.version ?? null,
    generatedAt: meta?.generatedAt ?? null,
    nextDue: meta?.nextDue ?? null,
    hash
  };
}

function isDue(meta) {
  if (FORCE) return true;
  if (!meta?.nextDue) return true;
  const due = new Date(`${meta.nextDue}T00:00:00Z`);
  if (Number.isNaN(due.getTime())) return true;
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return due.getTime() <= todayUtc;
}

async function refreshDataset(entry, ranScripts, treatAsDue) {
  console.log(`\n=== Refresh: ${entry.label} (${entry.id}) ===`);
  const before = await snapshotDataset(entry);
  const metaBefore = await readMeta(path.join(ROOT, entry.metaPath));

  if (!treatAsDue && !isDue(metaBefore)) {
    console.log(`Skipped: nextDue=${metaBefore?.nextDue ?? 'n/a'} (not due yet)`);
    return {
      id: entry.id,
      label: entry.label,
      changed: false,
      skipped: true,
      reason: 'not-due',
      before,
      after: before
    };
  }

  if (entry.fetchOncePerScript && ranScripts.has(entry.fetchScript)) {
    console.log(`Fetch already ran this invocation (${entry.fetchScript}); comparing outputs only.`);
  } else {
    await runNpmScript(entry.fetchScript);
    ranScripts.add(entry.fetchScript);
  }

  const after = await snapshotDataset(entry);
  const changed =
    !before.hash ||
    before.hash !== after.hash ||
    (entry.kind !== 'image' && before.featureCount !== after.featureCount);

  if (changed) {
    const cacheVersion = after.cacheVersion || after.version;
    if (!cacheVersion) {
      throw new Error(`Missing contentHash/version after fetch for ${entry.id}`);
    }
    if (entry.cacheKey && entry.cacheVersionPath) {
      await bumpCacheVersion(entry.cacheVersionPath, entry.cacheKey, cacheVersion);
    }
    console.log(
      `Changed: yes (count ${before.featureCount ?? 'n/a'} → ${after.featureCount ?? 'n/a'}, cacheVersion ${cacheVersion})`
    );
  } else {
    console.log('Changed: no (content hash unchanged)');
  }

  return {
    id: entry.id,
    label: entry.label,
    changed,
    skipped: false,
    before,
    after
  };
}

async function main() {
  const registry = JSON.parse(await readFile(REGISTRY_PATH, 'utf8'));
  if (!Array.isArray(registry) || !registry.length) {
    throw new Error('data-refresh-registry.json is empty');
  }

  if (FORCE) console.log('FORCE_REFRESH enabled — ignoring nextDue for all datasets');

  // If any entry sharing a fetchOncePerScript is due, treat all siblings as due
  // so a shared bake (e.g. fetch:wms) doesn't leave some layers skipped mid-run.
  const dueByOwnCadence = new Set();
  for (const entry of registry) {
    const meta = await readMeta(path.join(ROOT, entry.metaPath));
    if (isDue(meta)) dueByOwnCadence.add(entry.id);
  }
  const dueScripts = new Set(
    registry.filter((e) => dueByOwnCadence.has(e.id)).map((e) => e.fetchScript)
  );
  const treatAsDue = new Set(dueByOwnCadence);
  for (const entry of registry) {
    if (entry.fetchOncePerScript && dueScripts.has(entry.fetchScript)) {
      treatAsDue.add(entry.id);
    }
  }

  const ranScripts = new Set();
  const results = [];
  for (const entry of registry) {
    results.push(await refreshDataset(entry, ranScripts, treatAsDue.has(entry.id)));
  }

  const anyChanged = results.some((r) => r.changed);
  const dueCount = results.filter((r) => !r.skipped).length;
  const payload = {
    anyChanged,
    force: FORCE,
    dueCount,
    generatedAt: new Date().toISOString(),
    results
  };
  await writeFile(RESULT_PATH, JSON.stringify(payload, null, 2));

  if (process.env.GITHUB_OUTPUT) {
    await writeFile(process.env.GITHUB_OUTPUT, `changed=${anyChanged}\n`, { flag: 'a' });
  }

  console.log(`\nRefresh complete. anyChanged=${anyChanged} dueCount=${dueCount}/${results.length}`);
  console.log(`Result → ${path.relative(ROOT, RESULT_PATH)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
