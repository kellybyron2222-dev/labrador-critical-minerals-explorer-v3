import { describe, expect, it } from 'vitest';
import { buildShareUrl } from './viewState.js';

describe('viewState', () => {
  it('buildShareUrl includes version and layers', () => {
    const url = buildShareUrl({
      zoom: 8,
      lat: 55.1,
      lon: -61.2,
      layers: ['modsOccurrences', 'wms:aeromag'],
      mods: 'critical',
      statuses: ['Showing'],
      q: 'nickel',
      fatalFlaw: true
    });
    expect(url).toContain('#v=1');
    expect(url).toContain('layers=modsOccurrences');
    expect(url).toMatch(/wms(:|%3A)aeromag/);
    expect(url).toContain('ff=1');
    expect(url).toContain('q=nickel');
  });

  it('omits default zoom/center when compact', () => {
    const url = buildShareUrl({ layers: ['modsOccurrences'] });
    expect(url).toContain('#v=1');
    expect(url).not.toMatch(/[?&#]z=/);
  });
});
