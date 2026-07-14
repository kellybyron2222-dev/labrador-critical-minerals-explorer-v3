import { describe, expect, it } from 'vitest';
import { parseCoordinatePair } from './MapTools.js';

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
