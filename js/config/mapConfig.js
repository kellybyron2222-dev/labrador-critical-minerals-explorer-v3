/** Module 1: Map base layer configuration */

export const LABRADOR_CENTER = [-63.0, 54.0];
export const DEFAULT_ZOOM = 6;
export const MIN_ZOOM = 4;
export const MAX_ZOOM = 14;

/**
 * Esri World Imagery — free tile endpoint with required attribution.
 * (Google Earth / Google Maps tiles are not ToS-safe without Google’s APIs.)
 */
export const ESRI_SATELLITE_STYLE = {
  version: 8,
  name: 'Esri World Imagery',
  sources: {
    esriWorldImagery: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      ],
      tileSize: 256,
      attribution:
        'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
    }
  },
  layers: [
    {
      id: 'esri-world-imagery',
      type: 'raster',
      source: 'esriWorldImagery',
      minzoom: 0,
      maxzoom: 22
    }
  ]
};

/** Esri World Topographic Map — useful for field orientation. */
export const ESRI_TOPO_STYLE = {
  version: 8,
  name: 'Esri World Topographic',
  sources: {
    esriWorldTopo: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'
      ],
      tileSize: 256,
      attribution:
        'Tiles © Esri — Source: Esri, TomTom, Garmin, FAO, NOAA, USGS, and the GIS User Community'
    }
  },
  layers: [
    {
      id: 'esri-world-topo',
      type: 'raster',
      source: 'esriWorldTopo',
      minzoom: 0,
      maxzoom: 22
    }
  ]
};

/** Style URL string or MapLibre style object. */
export const BASEMAP_STYLES = {
  positron: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  topo: ESRI_TOPO_STYLE,
  satellite: ESRI_SATELLITE_STYLE
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
