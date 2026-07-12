import { describe, expect, it } from 'vitest';
import {
  pointInBounds,
  featureBBox,
  bboxIntersects,
  featureIntersectsBounds,
  featureMatchesFacilitiesFilter
} from './KpiEngine.js';

const view = { west: -65, south: 53, east: -60, north: 56 };

describe('pointInBounds', () => {
  it('includes points inside the viewport', () => {
    expect(pointInBounds(view, [-62, 54])).toBe(true);
  });

  it('excludes points outside', () => {
    expect(pointInBounds(view, [-70, 54])).toBe(false);
    expect(pointInBounds(view, null)).toBe(false);
  });
});

describe('featureBBox', () => {
  it('computes bbox for a polygon', () => {
    const feature = {
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-64, 53.5],
            [-61, 53.5],
            [-61, 55],
            [-64, 55],
            [-64, 53.5]
          ]
        ]
      }
    };
    expect(featureBBox(feature)).toEqual({
      west: -64,
      south: 53.5,
      east: -61,
      north: 55
    });
  });
});

describe('bboxIntersects', () => {
  it('detects overlap and separation', () => {
    expect(bboxIntersects(view, { west: -63, south: 54, east: -61, north: 55 })).toBe(true);
    expect(bboxIntersects(view, { west: -80, south: 40, east: -70, north: 45 })).toBe(false);
  });
});

describe('featureIntersectsBounds', () => {
  it('matches points by containment', () => {
    const point = { geometry: { type: 'Point', coordinates: [-62, 54] } };
    expect(featureIntersectsBounds(point, view)).toBe(true);
  });

  it('matches polygons that overlap the viewport', () => {
    const poly = {
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-64, 53.5],
            [-61, 53.5],
            [-61, 55],
            [-64, 55],
            [-64, 53.5]
          ]
        ]
      }
    };
    expect(featureIntersectsBounds(poly, view)).toBe(true);
  });

  it('rejects polygons far outside', () => {
    const poly = {
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-80, 40],
            [-79, 40],
            [-79, 41],
            [-80, 41],
            [-80, 40]
          ]
        ]
      }
    };
    expect(featureIntersectsBounds(poly, view)).toBe(false);
  });
});

describe('featureMatchesFacilitiesFilter', () => {
  it('requires ProvincesEN to include Newfoundland and Labrador', () => {
    expect(
      featureMatchesFacilitiesFilter({
        properties: { ProvincesEN: 'Newfoundland and Labrador' }
      })
    ).toBe(true);
    expect(
      featureMatchesFacilitiesFilter({
        properties: { ProvincesEN: 'Ontario' }
      })
    ).toBe(false);
    expect(featureMatchesFacilitiesFilter({ properties: {} })).toBe(false);
  });
});
