/**
 * Esri polygon ring → GeoJSON helpers shared by Mineral Lands bake scripts.
 */

export function ringArea(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return sum / 2;
}

export function esriPolygonToGeoJSON(geometry) {
  const rings = geometry?.rings;
  if (!Array.isArray(rings) || !rings.length) return null;

  const isClockwise = (ring) => ringArea(ring) < 0;
  const polys = [];
  let current = null;
  for (const ring of rings) {
    if (!ring?.length) continue;
    if (isClockwise(ring) || !current) {
      if (current) polys.push(current);
      current = [ring];
    } else {
      current.push(ring);
    }
  }
  if (current) polys.push(current);
  if (!polys.length) return null;
  if (polys.length === 1) return { type: 'Polygon', coordinates: polys[0] };
  return { type: 'MultiPolygon', coordinates: polys };
}

export async function mapPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()));
  return results;
}
