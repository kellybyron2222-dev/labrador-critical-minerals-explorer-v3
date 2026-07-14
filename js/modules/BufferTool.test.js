import { describe, expect, it } from 'vitest';
import { point as turfPoint } from '@turf/helpers';
import {
  boundsFromBbox,
  formatInventorySummary,
  inventoryBuffer
} from './BufferTool.js';
import { circlePolygon } from './ScreenAoi.js';
import { parseStoredAnnotations, serializeAnnotations } from './Annotations.js';

describe('boundsFromBbox', () => {
  it('normalizes turf bbox arrays', () => {
    expect(boundsFromBbox([-65, 52, -60, 55])).toEqual({
      west: -65,
      south: 52,
      east: -60,
      north: 55
    });
  });

  it('returns null for invalid input', () => {
    expect(boundsFromBbox(null)).toBeNull();
    expect(boundsFromBbox([1, 2])).toBeNull();
  });
});

describe('inventoryBuffer', () => {
  const claims = [
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-62, 54] }, properties: {} },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-50, 40] }, properties: {} }
  ];
  const roads = [
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-63, 53],
          [-61, 54]
        ]
      },
      properties: {}
    }
  ];

  it('counts features intersecting buffer bounds', () => {
    const circle = circlePolygon([-62, 54], 25);
    const box = boundsFromBbox([-63.5, 52.5, -60.5, 55.5]);
    const report = inventoryBuffer({
      getFeatures: (name) => (name === 'claims' ? claims : name === 'roads' ? roads : []),
      layerNames: ['claims', 'roads', 'empty'],
      bounds: box
    });
    expect(report.claims).toBe(1);
    expect(report.roads).toBe(1);
    expect(report.empty).toBe(0);
  });

  it('formats a readable summary', () => {
    const summary = formatInventorySummary({ claims: 2, roads: 0, mods: 1 });
    expect(summary).toContain('3 in buffer');
    expect(summary).toContain('claims: 2');
    expect(summary).toContain('mods: 1');
    expect(summary).not.toContain('roads');
  });

  it('reports empty buffer', () => {
    expect(formatInventorySummary({ a: 0, b: 0 })).toBe('No features in buffer');
  });
});

describe('annotation storage helpers', () => {
  it('round-trips feature collections', () => {
    const fc = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { kind: 'pin', text: 'A' },
          geometry: { type: 'Point', coordinates: turfPoint([-60, 54]).geometry.coordinates }
        }
      ]
    };
    const raw = serializeAnnotations(fc);
    const parsed = parseStoredAnnotations(raw);
    expect(parsed.features).toHaveLength(1);
    expect(parsed.features[0].properties.text).toBe('A');
  });

  it('returns empty collection for corrupt JSON', () => {
    expect(parseStoredAnnotations('{not json')).toEqual({
      type: 'FeatureCollection',
      features: []
    });
  });
});
