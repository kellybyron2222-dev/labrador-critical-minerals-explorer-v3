import { describe, expect, it } from 'vitest';
import { buildStoreZip } from './zipStore.js';
import { featuresToCsv, featuresToKml } from './exportPackage.js';

describe('zipStore', () => {
  it('builds a ZIP blob with local file signatures', async () => {
    const blob = buildStoreZip({
      'README.txt': 'hello',
      'geojson/test.geojson': '{"type":"FeatureCollection","features":[]}'
    });
    expect(blob.type).toBe('application/zip');
    const buf = new Uint8Array(await blob.arrayBuffer());
    // Local file header signature PK\x03\x04
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
    expect(buf[2]).toBe(0x03);
    expect(buf[3]).toBe(0x04);
    expect(blob.size).toBeGreaterThan(40);
  });
});

describe('exportPackage helpers', () => {
  const points = [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-60.1, 54.2] },
      properties: { DEPNAME: 'Test', STATUS: 'Showing' }
    }
  ];

  it('featuresToCsv includes lon/lat and properties', () => {
    const csv = featuresToCsv(points);
    expect(csv).toContain('longitude,latitude');
    expect(csv).toContain('-60.1');
    expect(csv).toContain('Test');
  });

  it('featuresToKml emits KML placemarks', () => {
    const kml = featuresToKml(points, 'MODS');
    expect(kml).toContain('<kml');
    expect(kml).toContain('<Placemark>');
    expect(kml).toContain('-60.1,54.2,0');
  });
});
