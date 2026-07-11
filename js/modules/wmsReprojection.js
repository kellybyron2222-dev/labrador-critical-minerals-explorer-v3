/**
 * NRCan's WMS only renders in CRS:84 (Plate Carrée / equirectangular), while
 * MapLibre draws its basemap in Web Mercator. A flat 4-corner image placement
 * is only accurate for small extents - across a country-wide latitude range
 * the two projections diverge enough to visibly shift coastlines/borders.
 *
 * Longitude/X needs no correction - it is linear in both projections.
 * Only the Y axis (latitude) needs resampling onto a Mercator-linear grid so
 * the result lines up pixel-for-pixel with the basemap.
 */

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

function latToMercatorY(latDeg) {
  const latRad = latDeg * DEG2RAD;
  return Math.log(Math.tan(Math.PI / 4 + latRad / 2));
}

function mercatorYToLat(y) {
  return (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * RAD2DEG;
}

/**
 * Web Mercator stretches higher latitudes vertically. This factor tells us
 * how many extra destination rows are needed (relative to the equirectangular
 * source) so the most-stretched edge of the bounds doesn't come out blurry.
 */
export function mercatorStretchFactor(south, north) {
  const mercRange = latToMercatorY(north) - latToMercatorY(south);
  const equirectRange = (north - south) * DEG2RAD;
  return mercRange / equirectRange;
}

/**
 * Resamples an equirectangular source image so its rows are spaced linearly
 * in Web Mercator Y instead of linearly in latitude.
 */
export function reprojectToMercator(imageBitmap, bounds) {
  const [, south, , north] = bounds;
  const width = imageBitmap.width;
  const srcHeight = imageBitmap.height;
  const destHeight = Math.round(srcHeight * mercatorStretchFactor(south, north));

  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = width;
  srcCanvas.height = srcHeight;
  srcCanvas.getContext('2d').drawImage(imageBitmap, 0, 0);

  const destCanvas = document.createElement('canvas');
  destCanvas.width = width;
  destCanvas.height = destHeight;
  const destCtx = destCanvas.getContext('2d');

  const yMercNorth = latToMercatorY(north);
  const yMercSouth = latToMercatorY(south);

  for (let row = 0; row < destHeight; row++) {
    const v = row / (destHeight - 1);
    const yMerc = yMercNorth + v * (yMercSouth - yMercNorth);
    const lat = mercatorYToLat(yMerc);
    const srcRow = Math.min(
      srcHeight - 1,
      Math.max(0, Math.round(((north - lat) / (north - south)) * (srcHeight - 1)))
    );
    destCtx.drawImage(srcCanvas, 0, srcRow, width, 1, 0, row, width, 1);
  }

  return destCanvas;
}
