/**
 * Bake Labrador gravity overlay from a local NRCan Bouguer GeoTIFF
 * (Canada 2 km GRAV Bouguer_AC color grid, EPSG:3978).
 *
 * Reads: data/Gravity/*.TIF (or *.tif)
 * Writes: public/data/wms-gravity-nll.png + .meta.json
 *
 * Usage: npm run fetch:gravity-local
 * Requires: Python 3 + rasterio + numpy + Pillow
 */

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeBakeOutputs } from './lib/bakeMeta.js';
import { decodePng, encodePng } from './lib/png.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'data', 'Gravity');
const OUT_DIR = path.join(ROOT, 'public', 'data');
const BOUNDS = [-68, 46, -52, 61];
const IMAGE_WIDTH = 1200;
const CADENCE_MONTHS = 12;

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

function latToMercatorY(latDeg) {
  const latRad = latDeg * DEG2RAD;
  return Math.log(Math.tan(Math.PI / 4 + latRad / 2));
}

function mercatorYToLat(y) {
  return (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * RAD2DEG;
}

function mercatorStretchFactor(south, north) {
  const mercRange = latToMercatorY(north) - latToMercatorY(south);
  const equirectRange = (north - south) * DEG2RAD;
  return mercRange / equirectRange;
}

function reprojectToMercator(png, south, north) {
  const { width, height: srcHeight, channels, data } = png;
  const destHeight = Math.round(srcHeight * mercatorStretchFactor(south, north));
  const dest = Buffer.alloc(width * destHeight * channels);
  const yMercNorth = latToMercatorY(north);
  const yMercSouth = latToMercatorY(south);
  const stride = width * channels;

  for (let row = 0; row < destHeight; row++) {
    const v = destHeight === 1 ? 0 : row / (destHeight - 1);
    const yMerc = yMercNorth + v * (yMercSouth - yMercNorth);
    const lat = mercatorYToLat(yMerc);
    const srcRow = Math.min(
      srcHeight - 1,
      Math.max(0, Math.round(((north - lat) / (north - south)) * (srcHeight - 1)))
    );
    data.copy(dest, row * stride, srcRow * stride, srcRow * stride + stride);
  }

  return { width, height: destHeight, channels, data: dest };
}

const PYTHON_SCRIPT = `
import sys
from pathlib import Path
import numpy as np
import rasterio
from rasterio.warp import reproject, Resampling
from rasterio.transform import from_bounds
from PIL import Image

src_path = Path(sys.argv[1])
out_path = Path(sys.argv[2])
west, south, east, north = map(float, sys.argv[3:7])
width = int(sys.argv[7])
height = int(round(width * (north - south) / (east - west)))

with rasterio.open(src_path) as src:
    dst_transform = from_bounds(west, south, east, north, width, height)
    dst = np.zeros((3, height, width), dtype=np.uint8)
    for i in range(1, 4):
        reproject(
            source=rasterio.band(src, i),
            destination=dst[i - 1],
            src_transform=src.transform,
            src_crs=src.crs,
            dst_transform=dst_transform,
            dst_crs="EPSG:4326",
            resampling=Resampling.bilinear,
            dst_nodata=0,
        )

# White / near-white = outside Canada grid coverage → transparent.
rgb = np.dstack([dst[0], dst[1], dst[2]])
near_white = np.all(rgb >= 245, axis=2)
alpha = np.where(near_white, 0, 255).astype(np.uint8)
rgba = np.dstack([rgb, alpha])
Image.fromarray(rgba, "RGBA").save(out_path)
print(f"warped {width}x{height} transparent={int(near_white.sum())}")
`;

async function findSourceTif() {
  let names;
  try {
    names = await readdir(SRC_DIR);
  } catch {
    return null;
  }
  const match = names.find((n) => /\.tif$/i.test(n) && !n.startsWith('_'));
  return match ? path.join(SRC_DIR, match) : null;
}

async function main() {
  const started = Date.now();
  const srcTif = await findSourceTif();
  if (!srcTif) {
    console.warn(
      `No .TIF in ${path.relative(ROOT, SRC_DIR)} — skipping gravity re-bake (keep existing public/data/wms-gravity-nll.png).`
    );
    process.exit(0);
  }
  const [west, south, east, north] = BOUNDS;
  const aspect = (east - west) / (north - south);
  const srcWidth = IMAGE_WIDTH;
  const srcHeight = Math.round(srcWidth / aspect);

  await mkdir(OUT_DIR, { recursive: true });
  const tmpPng = path.join(SRC_DIR, '_warped-nll-rgba.png');

  console.log(`Source: ${path.relative(ROOT, srcTif)}`);
  console.log(`Warping to NL&L bbox ${BOUNDS.join(',')} at ${srcWidth}×${srcHeight}…`);

  const py = spawnSync(
    'python',
    [
      '-c',
      PYTHON_SCRIPT,
      srcTif,
      tmpPng,
      String(west),
      String(south),
      String(east),
      String(north),
      String(srcWidth)
    ],
    { encoding: 'utf8' }
  );
  if (py.status !== 0) {
    console.error(py.stdout);
    console.error(py.stderr);
    throw new Error(`Python warp failed (exit ${py.status})`);
  }
  console.log(py.stdout.trim());

  const raw = await readFile(tmpPng);
  const decoded = decodePng(raw);
  const reprojected = reprojectToMercator(decoded, south, north);
  const pngBody = encodePng(reprojected);

  const assetPath = path.join(OUT_DIR, 'wms-gravity-nll.png');
  const metaPath = path.join(OUT_DIR, 'wms-gravity-nll.meta.json');
  const { version, nextDue, bytes } = await writeBakeOutputs({
    assetPath,
    metaPath,
    assetBody: pngBody,
    cadenceMonths: CADENCE_MONTHS,
    metaExtra: {
      featureCount: null,
      width: reprojected.width,
      height: reprojected.height,
      channels: reprojected.channels,
      bounds: BOUNDS,
      source: path.relative(ROOT, srcTif).replace(/\\/g, '/'),
      provider: 'local-bouguer-tif',
      layers: 'Bouguer_AC',
      label: 'Bouguer gravity anomaly (NRCan 2 km color grid)',
      imageWidthRequest: srcWidth,
      contentNote:
        'Baked from local GeoTIFF download (AGG Canada 2 km GRAV Bouguer_AC). Not live AGG WMS.'
    }
  });

  // Stamp cacheVersion hint for the operator.
  const stamp = `# gravity bake ${version} ${createHash('sha256').update(pngBody).digest('hex').slice(0, 12)}\n`;
  await writeFile(path.join(SRC_DIR, '_last-bake.txt'), stamp);

  console.log(
    `Wrote ${path.relative(ROOT, assetPath)} ${reprojected.width}×${reprojected.height} (${(bytes / 1e3).toFixed(1)} KB) version=${version} nextDue=${nextDue} in ${((Date.now() - started) / 1000).toFixed(1)}s`
  );
  console.log(`Update WMS_CONFIG.gravity cacheVersion to '${version}' if not already set.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
