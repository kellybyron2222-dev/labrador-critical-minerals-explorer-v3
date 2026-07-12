/**
 * Shared helpers for dataset bake scripts (GeoJSON / PNG + meta sidecars).
 */

import { createHash } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export function ensureTlsRelaxed() {
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === undefined) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }
}

export function versionFromDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/** Client IndexedDB / HTTP cache key — content-derived so same-day re-bakes invalidate. */
export function cacheVersionFromHash(contentHash) {
  return String(contentHash || '').slice(0, 12);
}

export function nextDueFrom(date, cadenceMonths) {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + cadenceMonths);
  return next.toISOString().slice(0, 10);
}

export function sha256(bufferOrString) {
  return createHash('sha256').update(bufferOrString).digest('hex');
}

/**
 * Write asset + meta.json with standard refresh fields.
 * @returns {{ version: string, nextDue: string, contentHash: string, bytes: number }}
 */
export async function writeBakeOutputs({
  assetPath,
  metaPath,
  assetBody,
  metaExtra = {},
  cadenceMonths,
  refreshNote = 'GitHub Actions refresh-data.yml (monthly; skips until nextDue) or npm run refresh:data'
}) {
  const generatedAt = new Date();
  const contentHash = sha256(assetBody);
  // `version` is the cache key (hash prefix), not a calendar date — dates live in generatedAt/nextDue.
  const version = cacheVersionFromHash(contentHash);
  const nextDue = nextDueFrom(generatedAt, cadenceMonths);
  const bytes = Buffer.byteLength(assetBody);

  await mkdir(path.dirname(assetPath), { recursive: true });
  await writeFile(assetPath, assetBody);
  await writeFile(
    metaPath,
    JSON.stringify(
      {
        version,
        contentHash,
        cadenceMonths,
        generatedAt: generatedAt.toISOString(),
        nextDue,
        refresh: refreshNote,
        ...metaExtra
      },
      null,
      2
    )
  );

  return { version, nextDue, contentHash, bytes };
}
