import { describe, expect, it } from 'vitest';
import {
  formatDistanceKm,
  computeNearestInfraDistancesFromData
} from './infraDistance.js';

describe('formatDistanceKm', () => {
  it('formats meters under 1 km', () => {
    expect(formatDistanceKm(0.25)).toBe('250 m');
  });

  it('formats one-decimal km under 10', () => {
    expect(formatDistanceKm(3.24)).toBe('3.2 km');
  });

  it('rounds larger distances', () => {
    expect(formatDistanceKm(42.6)).toBe('43 km');
  });
});

describe('computeNearestInfraDistancesFromData', () => {
  const data = {
    roads: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: 'Hwy test' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [-60.0, 53.0],
              [-60.0, 53.1]
            ]
          }
        }
      ]
    },
    resourceRoads: { type: 'FeatureCollection', features: [] },
    transmission: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: 'TL test' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [-60.5, 53.0],
              [-60.5, 53.1]
            ]
          }
        }
      ]
    },
    ports: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: 'Test harbour' },
          geometry: { type: 'Point', coordinates: [-60.1, 53.05] }
        }
      ]
    }
  };

  it('finds nearest road, transmission, and port', () => {
    const result = computeNearestInfraDistancesFromData([-60.01, 53.05], data);
    expect(result.road.name).toBe('Hwy test');
    expect(result.road.km).toBeLessThan(2);
    expect(result.transmission.name).toBe('TL test');
    expect(result.transmission.km).toBeGreaterThan(result.road.km);
    expect(result.port.name).toBe('Test harbour');
    expect(result.port.km).toBeLessThan(15);
  });

  it('prefers nearer resource road over highway', () => {
    const withResource = {
      ...data,
      resourceRoads: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { name: 'Forest track' },
            geometry: {
              type: 'LineString',
              coordinates: [
                [-60.011, 53.05],
                [-60.012, 53.051]
              ]
            }
          }
        ]
      }
    };
    const result = computeNearestInfraDistancesFromData([-60.01, 53.05], withResource);
    expect(result.road.kind).toBe('resource road');
    expect(result.road.name).toBe('Forest track');
  });
});
