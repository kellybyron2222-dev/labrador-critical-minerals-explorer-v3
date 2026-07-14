import { describe, expect, it, beforeEach } from 'vitest';
import {
  formatAreaKm2,
  formatKm,
  lastLegKm,
  parseCoordinatePair,
  pathLengthKm,
  ringCentroid
} from './MapTools.js';
import {
  _resetScreenAoiForTests,
  boundsToPolygon,
  circlePolygon,
  getScreenAoiState,
  GOTO_BUFFER_KM,
  resolveScreenAoi,
  setDrawnPolygon,
  setScreenAoiMode,
  setScreenFocus
} from './ScreenAoi.js';
import {
  boundsFromAoiFeature,
  buildScreenReportIndex,
  featureDisplayName,
  orderedReportLayers,
  renderScreenReportHtml
} from './ScreenReport.js';
import { polygon as turfPolygon } from '@turf/helpers';

describe('parseCoordinatePair', () => {
  it('parses lon,lat', () => {
    expect(parseCoordinatePair('-60.5, 53.2')).toEqual([-60.5, 53.2]);
  });

  it('parses lat,lon for Labrador band', () => {
    expect(parseCoordinatePair('53.2, -60.5')).toEqual([-60.5, 53.2]);
  });

  it('returns null for garbage', () => {
    expect(parseCoordinatePair('hello')).toBeNull();
    expect(parseCoordinatePair('')).toBeNull();
  });
});

describe('pathLengthKm', () => {
  it('sums legs', () => {
    const pts = [
      [-60, 54],
      [-60, 55],
      [-59, 55]
    ];
    const total = pathLengthKm(pts);
    const last = lastLegKm(pts);
    expect(total).toBeGreaterThan(100);
    expect(last).toBeGreaterThan(50);
    expect(total).toBeGreaterThan(last);
  });

  it('formats km readout', () => {
    expect(formatKm(3.1415)).toBe('3.14 km');
    expect(formatKm(42.2)).toMatch(/42/);
    expect(formatAreaKm2(5e6)).toBe('5.00 km²');
  });

  it('shoelace centroid is inside a square', () => {
    const c = ringCentroid([
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
      [0, 0]
    ]);
    expect(c?.[0]).toBeCloseTo(1, 5);
    expect(c?.[1]).toBeCloseTo(1, 5);
  });
});

describe('ScreenAoi', () => {
  beforeEach(() => _resetScreenAoiForTests());

  it('defaults to view mode', () => {
    expect(getScreenAoiState().mode).toBe('view');
  });

  it('resolves current view from map bounds', () => {
    const map = {
      getBounds: () => ({
        getWest: () => -65,
        getSouth: () => 52,
        getEast: () => -60,
        getNorth: () => 56
      })
    };
    setScreenAoiMode('view');
    const r = resolveScreenAoi(map);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.label).toMatch(/Current view/);
      expect(r.feature.geometry.type).toBe('Polygon');
    }
  });

  it('requires Go-to focus for goto mode', () => {
    setScreenAoiMode('goto');
    const r = resolveScreenAoi({ getBounds: () => null });
    expect(r.ok).toBe(false);
    expect(r.needsPin).toBe(true);
  });

  it('builds 25 km buffer around focus', () => {
    setScreenFocus(-60.5, 53.2);
    setScreenAoiMode('goto');
    const r = resolveScreenAoi({});
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.label).toContain(String(GOTO_BUFFER_KM));
      expect(r.feature.geometry.coordinates[0].length).toBeGreaterThan(16);
    }
  });

  it('requires closed drawn polygon', () => {
    setScreenAoiMode('polygon');
    expect(resolveScreenAoi({}).ok).toBe(false);
    const poly = turfPolygon([
      [
        [-61, 53],
        [-60, 53],
        [-60, 54],
        [-61, 54],
        [-61, 53]
      ]
    ]);
    setDrawnPolygon(poly);
    const r = resolveScreenAoi({});
    expect(r.ok).toBe(true);
    expect(getScreenAoiState().mode).toBe('polygon');
  });

  it('circlePolygon and boundsToPolygon produce closed rings', () => {
    const c = circlePolygon([-63, 54], 10, 8);
    expect(c.geometry.coordinates[0][0]).toEqual(c.geometry.coordinates[0].at(-1));
    const b = boundsToPolygon({ west: -64, south: 53, east: -62, north: 55 });
    expect(b.geometry.coordinates[0]).toHaveLength(5);
  });
});

describe('ScreenReport', () => {
  it('splits in-area vs not-in-area with stable order', () => {
    const aoi = turfPolygon([
      [
        [-61, 53],
        [-59, 53],
        [-59, 55],
        [-61, 55],
        [-61, 53]
      ]
    ]);
    expect(boundsFromAoiFeature(aoi)?.west).toBe(-61);
    expect(featureDisplayName({ DEPNAME: 'Foo', COMMODITY: 'Cu' })).toBe('Foo');
    expect(orderedReportLayers().length).toBeGreaterThan(5);

    const report = buildScreenReportIndex({
      aoiFeature: aoi,
      aoiLabel: 'Test AOI',
      isLayerOn: (n) => n === 'modsOccurrences',
      getFeatures: () => [],
      modsFiltered: [
        {
          type: 'Feature',
          properties: { DEPNAME: 'Inside', COMMODITY: 'Copper' },
          geometry: { type: 'Point', coordinates: [-60, 54] }
        },
        {
          type: 'Feature',
          properties: { DEPNAME: 'Outside' },
          geometry: { type: 'Point', coordinates: [-70, 54] }
        }
      ],
      wmsOn: []
    });
    expect(report.ok).toBe(true);
    if (report.ok) {
      expect(report.inArea.some((s) => s.id === 'modsOccurrences' && s.count === 1)).toBe(true);
      expect(report.notInArea.length).toBeGreaterThan(0);
      expect(report.notInArea.some((s) => s.id === 'modsOccurrences')).toBe(false);
      const html = renderScreenReportHtml(report);
      expect(html).toContain('1. In this area');
      expect(html).toContain('2. Not in this area');
      expect(html).toContain('Inside');
    }
  });
});
