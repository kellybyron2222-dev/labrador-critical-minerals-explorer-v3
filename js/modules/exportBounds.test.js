import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  featureIntersectsBounds,
  normalizeMapBounds,
  pointInBounds
} from './KpiEngine.js';
import { buildExportPackage } from './exportPackage.js';

describe('normalizeMapBounds', () => {
  it('reads MapLibre-style getWest/getSouth/getEast/getNorth', () => {
    const ml = {
      getWest: () => -65,
      getSouth: () => 52,
      getEast: () => -60,
      getNorth: () => 56
    };
    expect(normalizeMapBounds(ml)).toEqual({
      west: -65,
      south: 52,
      east: -60,
      north: 56
    });
  });

  it('passes through plain bounds objects', () => {
    const b = { west: -65, south: 52, east: -60, north: 56 };
    expect(normalizeMapBounds(b)).toEqual(b);
  });

  it('returns null for MapLibre bounds used as plain props (the export bug)', () => {
    // Raw LngLatBounds without calling getters — .west is undefined
    const broken = { _sw: { lng: -65, lat: 52 }, _ne: { lng: -60, lat: 56 } };
    expect(normalizeMapBounds(broken)).toBeNull();
  });
});

describe('featureIntersectsBounds with normalized viewport', () => {
  const point = {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [-62.5, 54.0] },
    properties: { DEPNAME: 'Test' }
  };

  it('rejects when given raw MapLibre bounds without west/south props', () => {
    const ml = {
      getWest: () => -65,
      getSouth: () => 52,
      getEast: () => -60,
      getNorth: () => 56
    };
    // Passing the object itself (without normalize) fails — this was the bug
    expect(featureIntersectsBounds(point, ml)).toBe(false);
    // Normalized works
    expect(featureIntersectsBounds(point, normalizeMapBounds(ml))).toBe(true);
  });

  it('pointInBounds works with plain bounds', () => {
    expect(pointInBounds({ west: -65, south: 52, east: -60, north: 56 }, [-62.5, 54])).toBe(
      true
    );
  });
});

describe('buildExportPackage with in-view MODS', () => {
  it('builds a ZIP containing geojson when features are provided', async () => {
    const bounds = { west: -65, south: 52, east: -60, north: 56 };
    const features = [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-62.5, 54.0] },
        properties: { DEPNAME: 'Demo', STATUS: 'Showing' }
      },
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-61.0, 53.5] },
        properties: { DEPNAME: 'Demo2', STATUS: 'Prospect' }
      }
    ];
    const inView = features.filter((f) => featureIntersectsBounds(f, bounds));
    expect(inView).toHaveLength(2);

    const { blob, filename, summary } = await buildExportPackage({
      bounds,
      vectorLayers: [{ id: 'modsOccurrences', label: 'MODS', features: inView }],
      rasterLayers: [],
      formats: { geojson: true, csv: true, kml: true, shapefile: false, rasters: false },
      meta: { filters: { mods: 'all' } }
    });

    expect(filename).toMatch(/^labrador-explorer-export-\d{4}-\d{2}-\d{2}\.zip$/);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(100);
    expect(blob.type).toBe('application/zip');
    expect(summary).toContain('1 layer');

    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(bytes[0]).toBe(0x50); // P
    expect(bytes[1]).toBe(0x4b); // K
  });
});
