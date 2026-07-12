import { describe, expect, it } from 'vitest';
import {
  modsUsesPrimaryOnlyFilter,
  normalizeMODSStatus,
  combineMODSFilters,
  featureMatchesBrowserFilters,
  filterMODSFeatures
} from './modsFilters.js';

describe('modsUsesPrimaryOnlyFilter', () => {
  it('treats All / null as primary-only', () => {
    expect(modsUsesPrimaryOnlyFilter(null)).toBe(true);
  });

  it('treats multi / preset as primary-only', () => {
    expect(modsUsesPrimaryOnlyFilter(['Nickel', 'Copper'])).toBe(true);
  });

  it('treats single commodity pick as broader match', () => {
    expect(modsUsesPrimaryOnlyFilter(['Nickel'])).toBe(false);
  });
});

describe('normalizeMODSStatus', () => {
  it('collapses Past Producer variants', () => {
    expect(normalizeMODSStatus('Past Producer (Dormant)')).toBe('Past Producer');
    expect(normalizeMODSStatus('Past Producer (Exhausted)')).toBe('Past Producer');
  });

  it('passes known buckets through', () => {
    expect(normalizeMODSStatus('Producer')).toBe('Producer');
    expect(normalizeMODSStatus('Developed Prospect')).toBe('Developed Prospect');
    expect(normalizeMODSStatus('Showing')).toBe('Showing');
  });

  it('returns null for unknown / empty', () => {
    expect(normalizeMODSStatus('')).toBe(null);
    expect(normalizeMODSStatus(null)).toBe(null);
    expect(normalizeMODSStatus('Mystery')).toBe(null);
  });
});

describe('combineMODSFilters', () => {
  it('returns null when nothing to combine', () => {
    expect(combineMODSFilters(null)).toBe(null);
  });

  it('returns a single filter unchanged', () => {
    const commodity = ['==', ['get', 'primaryCommodity'], 'Nickel'];
    expect(combineMODSFilters(commodity)).toEqual(commodity);
  });

  it('ANDs commodity + status + allowlist', () => {
    const commodity = ['==', ['get', 'primaryCommodity'], 'Nickel'];
    const combined = combineMODSFilters(commodity, {
      statuses: new Set(['Prospect']),
      nminoAllowlist: ['001', '002']
    });
    expect(combined[0]).toBe('all');
    expect(combined).toHaveLength(4);
  });
});

describe('featureMatchesBrowserFilters', () => {
  const feature = {
    properties: {
      name: 'Test Deposit',
      statusBucket: 'Prospect',
      primaryCommodity: 'Nickel',
      commodityList: ['Nickel', 'Copper'],
      NMINO: 'LAB-1'
    }
  };

  it('matches status set', () => {
    expect(
      featureMatchesBrowserFilters(feature, { statuses: new Set(['Prospect']) })
    ).toBe(true);
    expect(
      featureMatchesBrowserFilters(feature, { statuses: new Set(['Producer']) })
    ).toBe(false);
  });

  it('matches free-text query', () => {
    expect(featureMatchesBrowserFilters(feature, { query: 'nickel' })).toBe(true);
    expect(featureMatchesBrowserFilters(feature, { query: 'uranium' })).toBe(false);
  });
});

describe('filterMODSFeatures', () => {
  const features = [
    {
      properties: {
        primaryCommodity: 'Copper',
        commodityList: ['Copper', 'Nickel'],
        statusBucket: 'Prospect',
        name: 'A'
      }
    },
    {
      properties: {
        primaryCommodity: 'Nickel',
        commodityList: ['Nickel'],
        statusBucket: 'Showing',
        name: 'B'
      }
    }
  ];

  it('primary-only excludes secondary-only matches', () => {
    const out = filterMODSFeatures(features, {
      pickerCommodities: null,
      enabledCommodities: ['Nickel'],
      primaryOnly: true,
      statuses: new Set(),
      query: ''
    });
    expect(out).toHaveLength(1);
    expect(out[0].properties.name).toBe('B');
  });

  it('broader match includes secondary Nickel', () => {
    const out = filterMODSFeatures(features, {
      pickerCommodities: ['Nickel'],
      enabledCommodities: ['Nickel'],
      primaryOnly: false,
      statuses: new Set(),
      query: ''
    });
    expect(out).toHaveLength(2);
  });
});
