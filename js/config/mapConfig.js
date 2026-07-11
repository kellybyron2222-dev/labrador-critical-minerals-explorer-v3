/** Module 1: Map base layer configuration */

export const LABRADOR_CENTER = [-63.0, 54.0];
export const DEFAULT_ZOOM = 6;
export const MIN_ZOOM = 4;
export const MAX_ZOOM = 14;

export const BASEMAP_STYLES = {
  positron: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  streets: 'https://demotiles.maplibre.org/style.json'
};

export const DEFAULT_BASEMAP = 'positron';

export const MAP_OPTIONS = {
  container: 'map',
  center: LABRADOR_CENTER,
  zoom: DEFAULT_ZOOM,
  minZoom: MIN_ZOOM,
  maxZoom: MAX_ZOOM,
  attributionControl: true
};
