/** Module 2: Async GeoJSON and WMS layer loading */

import {
  LAYER_CONFIG,
  WMS_CONFIG,
  WMS_BASE_URL,
  buildMODSSurfaceColorExpression
} from '../config/layerConfig.js';
import { normalizeMODSStatus } from '../config/modsFilters.js';
import { getCachedGeoJSON, setCachedGeoJSON } from './layerCache.js';
import { reprojectToMercator } from './wmsReprojection.js';

// Source datasets are national-scale compilations (1:5M geology maps, ~1km
// prospectivity model grids). Now that requests are clipped to the NL&L bbox
// (see NL_LABRADOR_BOUNDS in layerConfig.js) instead of all of Canada, 900px
// covers ~3x the effective resolution over the region that 1600px did at the
// old Canada-wide extent, while being a notably smaller/faster image to
// fetch, reproject, and serialize on every layer toggle.
const WMS_IMAGE_WIDTH = 900;

/**
 * Cleans up MODS source-data quirks (stray punctuation like "Platinum(?)",
 * inconsistent casing like "cobalt"/"Nickel") so commodity names compare
 * reliably in filter/color-match expressions regardless of which field
 * (COMNAME vs COMMODS) they came from.
 */
function normalizeCommodityName(raw) {
  const cleaned = raw.replace(/[^a-zA-Z\s]/g, '').trim();
  return cleaned.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

/**
 * `fill-opacity`/`line-opacity` for an occurrence-density surface tier: a
 * top-level `interpolate` on zoom (the only place MapLibre allows a bare
 * `["zoom"]` reference - see the `circle-radius` validation note in
 * layerConfig.js) whose *output* at each zoom stop is a `match` on the
 * isoband's `tier` property. Fades from the configured per-tier opacity at
 * regional zoom to fully transparent by zoom 9, handing off to the
 * now-full-size circle layer (see buildMODSRadiusExpression).
 */
function buildSurfaceOpacityExpression(opacityByTier) {
  const tierMatch = ['match', ['get', 'tier']];
  opacityByTier.forEach((opacity, tier) => tierMatch.push(tier, opacity));
  tierMatch.push(0);
  return ['interpolate', ['linear'], ['zoom'], 4, tierMatch, 9, 0];
}

export default class LayerManager {
  constructor(map) {
    this.map = map;
    this.layers = {};
    this.loadedData = {};
    this.legendItemsCache = {};
    // Occurrence-density surface state (Phase 1.1c) - kept separately from
    // `this.layers` since a surface is derived data (recomputed by app.js
    // whenever the commodity picker / per-mineral toggles change), not a 1:1
    // mirror of a fetched source. Persisted here so `refreshLayers()` can
    // restore it after a basemap switch tears down runtime layers/sources.
    this.surfaceData = {};
    this.surfaceEnabledCommodities = {};
    this.surfaceVisible = {};
  }

  async fetchGeoJSON(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Failed to load ${url}:`, error);
      return null;
    }
  }

  /**
   * Esri polygon rings → GeoJSON Polygon / MultiPolygon.
   * Exterior rings are clockwise in ArcGIS; opposite winding = holes.
   */
  esriPolygonToGeoJSON(geometry) {
    const rings = geometry?.rings;
    if (!Array.isArray(rings) || !rings.length) return null;

    const ringArea = (ring) => {
      let sum = 0;
      for (let i = 0; i < ring.length - 1; i++) {
        sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
      }
      return sum / 2;
    };
    // ArcGIS exteriors are clockwise (negative shoelace in lon/lat space).
    const isClockwise = (ring) => ringArea(ring) < 0;

    const polys = [];
    let current = null;
    for (const ring of rings) {
      if (!ring?.length) continue;
      if (isClockwise(ring) || !current) {
        if (current) polys.push(current);
        current = [ring];
      } else {
        current.push(ring);
      }
    }
    if (current) polys.push(current);

    if (!polys.length) return null;
    if (polys.length === 1) return { type: 'Polygon', coordinates: polys[0] };
    return { type: 'MultiPolygon', coordinates: polys };
  }

  esriFeatureToGeoJSON(feature) {
    const geometry = this.esriPolygonToGeoJSON(feature?.geometry);
    if (!geometry) return null;
    return {
      type: 'Feature',
      properties: { ...(feature.attributes || {}) },
      geometry
    };
  }

  /**
   * Loops resultOffset/resultRecordCount against an ArcGIS REST query
   * endpoint whose feature count exceeds maxRecordCount (e.g. GeoAtlas MODS:
   * 1000/page, ~3,173 Labrador features -> 4 pages). Stops once a page comes
   * back short of a full page (cheaper and more robust than trusting
   * `exceededTransferLimit`, which some ArcGIS versions omit).
   *
   * `format: 'esrijson'` — required for GeoAtlas bedrock: `f=geojson&outSR=4326`
   * returns an empty FeatureCollection on that service; `f=json&outSR=4326`
   * returns projected rings we convert client-side.
   */
  async fetchPaginatedGeoJSON({
    url,
    where = '1=1',
    outFields = '*',
    pageSize = 1000,
    outSR,
    format = 'geojson',
    maxAllowableOffset,
    concurrency = 1
  }) {
    const useEsri = format === 'esrijson';

    const buildParams = (offset) => {
      const params = new URLSearchParams({
        where,
        outFields,
        f: useEsri ? 'json' : 'geojson',
        resultOffset: String(offset),
        resultRecordCount: String(pageSize)
      });
      // GeoAtlas bedrock (and some other MapServers) return native projected
      // meters unless outSR=4326 is set — MapLibre needs WGS84 lon/lat.
      if (outSR != null) params.set('outSR', String(outSR));
      if (maxAllowableOffset != null) {
        params.set('maxAllowableOffset', String(maxAllowableOffset));
      }
      return params;
    };

    const parsePage = (page) => {
      if (page?.error) {
        console.error('ArcGIS query error:', page.error);
        return { raw: [], features: [] };
      }
      const raw = page?.features ?? [];
      const features = useEsri
        ? raw.map((f) => this.esriFeatureToGeoJSON(f)).filter(Boolean)
        : raw;
      return { raw, features };
    };

    // Parallel path: count first, then fetch pages in a small pool.
    if (concurrency > 1) {
      const countParams = new URLSearchParams({
        where,
        returnCountOnly: 'true',
        f: 'json'
      });
      const countPage = await this.fetchGeoJSON(`${url}?${countParams}`);
      const total = countPage?.count ?? 0;
      if (!total) return null;

      const offsets = [];
      for (let offset = 0; offset < total; offset += pageSize) {
        offsets.push(offset);
      }

      const pages = new Array(offsets.length);
      let next = 0;
      const workers = Array.from({ length: Math.min(concurrency, offsets.length) }, async () => {
        while (next < offsets.length) {
          const i = next++;
          const page = await this.fetchGeoJSON(`${url}?${buildParams(offsets[i])}`);
          pages[i] = parsePage(page).features;
        }
      });
      await Promise.all(workers);

      const features = pages.flat();
      return features.length ? { type: 'FeatureCollection', features } : null;
    }

    const features = [];
    let offset = 0;
    for (;;) {
      const page = await this.fetchGeoJSON(`${url}?${buildParams(offset)}`);
      const { raw, features: pageFeatures } = parsePage(page);
      features.push(...pageFeatures);
      if (raw.length < pageSize) break;
      offset += pageSize;
    }

    return features.length ? { type: 'FeatureCollection', features } : null;
  }

  async loadAllLayers() {
    const loadPromises = Object.entries(LAYER_CONFIG)
      .filter(([, config]) => !config.lazy)
      .map(([name, config]) => this.loadLayer(name, config));
    await Promise.all(loadPromises);
  }

  /** True once a lazy (or eager) vector layer has been fetched into loadedData. */
  isLayerLoaded(name) {
    return Boolean(this.loadedData[name]);
  }

  /**
   * One-shot fetch + add for `lazy: true` layers (e.g. GeoAtlas bedrock).
   * Idempotent if already loaded.
   */
  async loadLayerOnDemand(name) {
    const config = LAYER_CONFIG[name];
    if (!config) return false;
    if (this.loadedData[name]) {
      this.ensureSource(config, this.loadedData[name]);
      this.addLayerByType(name, config, this.loadedData[name]);
      return true;
    }
    await this.loadLayer(name, config);
    return Boolean(this.loadedData[name]);
  }

  /** Fetches and merges multiple GeoJSON endpoints (e.g. an ArcGIS service split across sub-layers) into one FeatureCollection. */
  async fetchMergedGeoJSON(urls) {
    const results = await Promise.all(urls.map((url) => this.fetchGeoJSON(url)));
    const features = results
      .filter(Boolean)
      .flatMap((collection) => collection.features)
      .map((feature) => ({
        ...feature,
        properties: {
          ...feature.properties,
          name: feature.properties.PropertyNameEN
        }
      }));

    return features.length ? { type: 'FeatureCollection', features } : null;
  }

  /**
   * Resolve GeoJSON for a layer: IndexedDB → static dataUrl → live query.
   * Heavy layers (bedrock) ship a baked file and warm IndexedDB after first hit.
   */
  async resolveLayerData(name, config) {
    const { cacheKey, cacheVersion } = config;

    if (cacheKey && cacheVersion) {
      const cached = await getCachedGeoJSON(cacheKey, cacheVersion);
      if (cached?.features?.length) return cached;
    }

    if (config.dataUrl) {
      const staticData = await this.fetchGeoJSON(config.dataUrl);
      if (staticData?.features?.length) {
        if (cacheKey && cacheVersion) {
          setCachedGeoJSON(cacheKey, cacheVersion, staticData);
        }
        return staticData;
      }
    }

    let live = null;
    if (config.paginatedQuery) {
      live = await this.fetchPaginatedGeoJSON(config.paginatedQuery);
    } else if (config.sources) {
      live = await this.fetchMergedGeoJSON(config.sources);
    } else if (config.dataUrl) {
      // Already tried above; keep for configs that only have dataUrl.
      live = null;
    }

    if (live?.features?.length && cacheKey && cacheVersion) {
      setCachedGeoJSON(cacheKey, cacheVersion, live);
    }
    return live;
  }

  async loadLayer(name, config) {
    const data = await this.resolveLayerData(name, config);
    if (!data?.features?.length) return;

    if (config.enrichment === 'mods' || name === 'modsOccurrences') {
      // MODS: DEPNAME is the human deposit/occurrence name; some records only
      // have COMNAME (the commodity), so fall back to that rather than a
      // blank popup title. `commodityList` is a deduped, normalized array of
      // every commodity mentioned for a feature (primary COMNAME + secondary
      // comma-separated COMMODS) - the commodity picker filters/colors
      // against this so a "secondary commodity" search (e.g. Nickel showing
      // up inside a Copper occurrence's COMMODS) actually finds it, which a
      // COMNAME-only match would miss.
      data.features.forEach((feature) => {
        const props = feature.properties;
        props.name = props.DEPNAME?.trim() || props.COMNAME?.trim() || 'Unnamed occurrence';
        const rawCommodities = [props.COMNAME, ...(props.COMMODS || '').split(',')];
        const normalized = rawCommodities.map((c) => c && normalizeCommodityName(c)).filter(Boolean);
        props.commodityList = Array.from(new Set(normalized));
        props.primaryCommodity = props.COMNAME
          ? normalizeCommodityName(props.COMNAME)
          : props.commodityList[0] || null;
        props.secondaryCommodities = props.commodityList.filter((c) => c !== props.primaryCommodity);
        // Status bucket for F5 filters (Past Producer variants collapsed).
        props.statusBucket = normalizeMODSStatus(props.STATUS);
      });
    } else if (config.enrichment === 'bedrockRgb') {
      data.features.forEach((feature) => {
        const props = feature.properties;
        if (props.fillColor && props.name) return;
        props.name = props.LABEL?.trim() || props.name || 'Unnamed unit';
        const r = Number(props.RED);
        const g = Number(props.GREEN);
        const b = Number(props.BLUE);
        props.fillColor =
          Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)
            ? `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`
            : props.fillColor || '#94a3b8';
      });
    }

    this.loadedData[name] = data;

    this.ensureSource(config, data);
    this.addLayerByType(name, config, data);
    this.setLayerVisibility(name, config.visible);

    this.layers[name] = {
      config,
      visible: config.visible
    };
  }

  /** Adds a layer's GeoJSON source if missing - also called from `refreshLayers` since `map.setStyle()` (basemap switch) tears down runtime-added sources along with the layers that reference them. */
  ensureSource(config, data) {
    if (this.map.getSource(config.source)) return;

    this.map.addSource(config.source, {
      type: 'geojson',
      data,
      generateId: true
    });
  }

  addLayerByType(name, config, data) {
    const geometryType = data.features[0]?.geometry?.type;

    if (geometryType === 'Point') {
      this.addPointLayer(name, config);
    } else if (geometryType === 'LineString' || geometryType === 'MultiLineString') {
      this.addLineLayer(name, config);
    } else if (geometryType === 'Polygon' || geometryType === 'MultiPolygon') {
      this.addPolygonLayer(name, config);
    }
  }

  addPointLayer(name, config) {
    if (config.icon) {
      this.addIconPointLayer(config);
    } else {
      this.addCirclePointLayer(config);
    }
  }

  addCirclePointLayer(config) {
    if (!this.map.getLayer(config.layer)) {
      this.map.addLayer({
        id: config.layer,
        type: 'circle',
        source: config.source,
        paint: config.paint.circle,
        ...(config.filter ? { filter: config.filter } : {})
      });
    }

    if (config.labels && !this.map.getLayer(config.labels)) {
      this.map.addLayer({
        id: config.labels,
        type: 'symbol',
        source: config.source,
        layout: {
          'text-field': ['get', 'name'],
          'text-offset': [0, 1.5],
          'text-size': 11,
          'text-anchor': 'top',
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular']
        },
        paint: config.paint.label
      });
    }
  }

  /** Renders points as category-specific badge icons instead of plain circles (see facilityIcons.js). */
  addIconPointLayer(config) {
    if (this.map.getLayer(config.layer)) return;

    const { field, mapping, default: defaultIcon, size, sortKey } = config.icon;

    const layout = {
      'icon-image': this.buildMatchExpression(field, mapping, defaultIcon),
      'icon-size': size || 1,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true
    };

    if (sortKey) {
      layout['symbol-sort-key'] = this.buildMatchExpression(
        sortKey.field,
        sortKey.mapping,
        sortKey.default ?? 0
      );
    }

    this.map.addLayer({
      id: config.layer,
      type: 'symbol',
      source: config.source,
      layout,
      ...(config.filter ? { filter: config.filter } : {})
    });
  }

  /** Builds a MapLibre `match` expression from a {value: output} mapping plus a fallback. */
  buildMatchExpression(field, mapping, fallback) {
    const expression = ['match', ['get', field]];
    Object.entries(mapping).forEach(([value, output]) => {
      expression.push(value, output);
    });
    expression.push(fallback);
    return expression;
  }

  addLineLayer(name, config) {
    if (!this.map.getLayer(config.layer)) {
      this.map.addLayer({
        id: config.layer,
        type: 'line',
        source: config.source,
        paint: config.paint.line,
        ...(config.filter ? { filter: config.filter } : {})
      });
    }

    if (!this.map.getLayer(`${config.layer}-hover`)) {
      this.map.addLayer({
        id: `${config.layer}-hover`,
        type: 'line',
        source: config.source,
        paint: {
          'line-color': config.paint.line['line-color'],
          'line-width': 5,
          'line-opacity': 0.5
        },
        filter: ['==', 'id', '']
      });
    }
  }

  addPolygonLayer(name, config) {
    const beforeId = this.resolveBeforeLayerId(config);

    if (!this.map.getLayer(config.layer)) {
      this.map.addLayer(
        {
          id: config.layer,
          type: 'fill',
          source: config.source,
          paint: config.paint.fill,
          ...(config.filter ? { filter: config.filter } : {})
        },
        beforeId
      );
    }

    if (config.outline && !this.map.getLayer(config.outline)) {
      this.map.addLayer(
        {
          id: config.outline,
          type: 'line',
          source: config.source,
          paint: config.paint.line,
          ...(config.filter ? { filter: config.filter } : {})
        },
        beforeId
      );
    }

    if (config.labels && !this.map.getLayer(config.labels)) {
      this.map.addLayer(
        {
          id: config.labels,
          type: 'symbol',
          source: config.source,
          layout: {
            'text-field': ['get', 'name'],
            'text-size': 10,
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold']
          },
          paint: {
            'text-color': '#1e293b',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1
          }
        },
        beforeId
      );
    }
  }

  /** First existing layer id from config.beforeLayerIds — keep endowment under points. */
  resolveBeforeLayerId(config) {
    const ids = config.beforeLayerIds || [];
    for (const id of ids) {
      if (this.map.getLayer(id)) return id;
    }
    return undefined;
  }

  setLayerVisibility(name, visible) {
    const config = LAYER_CONFIG[name];
    if (!config) return;

    const visibility = visible ? 'visible' : 'none';

    [config.layer, config.labels, config.outline, `${config.layer}-hover`]
      .filter(Boolean)
      .forEach((layerId) => {
        if (this.map.getLayer(layerId)) {
          this.map.setLayoutProperty(layerId, 'visibility', visibility);
        }
      });

    if (this.layers[name]) {
      this.layers[name].visible = visible;
    }
  }

  /** Sets/clears a MapLibre filter on a vector layer (e.g. the MODS commodity picker) and remembers it so `refreshLayers` can reapply it after a basemap switch tears the layer down. */
  setLayerFilter(name, filterExpression) {
    const config = LAYER_CONFIG[name];
    if (!config) return;

    if (this.map.getLayer(config.layer)) {
      this.map.setFilter(config.layer, filterExpression || null);
    }
    if (this.layers[name]) {
      this.layers[name].filter = filterExpression || null;
    }
  }

  /** Sets a paint property on a vector layer at runtime (e.g. MODS commodity-color override) and remembers it for basemap-switch persistence, same reasoning as `setLayerFilter`. */
  setPaintProperty(name, property, value) {
    const config = LAYER_CONFIG[name];
    if (!config) return;

    if (this.map.getLayer(config.layer)) {
      this.map.setPaintProperty(config.layer, property, value);
    }
    if (this.layers[name]) {
      this.layers[name].paintOverrides = { ...(this.layers[name].paintOverrides || {}), [property]: value };
    }
  }

  /** Raw loaded GeoJSON features for a layer (e.g. so app.js can commodity-filter MODS points before handing them to SurfaceInterpolation). */
  getLoadedFeatures(name) {
    return this.loadedData[name]?.features || [];
  }

  /**
   * Adds/updates the occurrence-density surface (fill + outline layers) for
   * a layer with `surface` config - see SurfaceInterpolation.js for how
   * `geojson` (isoband polygons tagged with `commodity` + `tier`) is derived.
   * Called when the picker or per-mineral surface toggles change.
   *
   * @param {string} name
   * @param {GeoJSON.FeatureCollection|null} geojson
   * @param {string[]} [enabledCommodities] - minerals whose polygons are shown
   */
  updateOccurrenceSurface(name, geojson, enabledCommodities) {
    const config = LAYER_CONFIG[name];
    const surfaceConfig = config?.surface;
    if (!surfaceConfig?.enabled) return;

    const data = geojson || { type: 'FeatureCollection', features: [] };
    this.surfaceData[name] = data;
    if (enabledCommodities) this.surfaceEnabledCommodities[name] = [...enabledCommodities];
    const enabled = this.surfaceEnabledCommodities[name] || [];
    const colorExpr = buildMODSSurfaceColorExpression();
    const filter = this.buildSurfaceFilter(surfaceConfig, enabled);
    const visibility = this.surfaceVisible[name] === false ? 'none' : 'visible';

    const source = this.map.getSource(surfaceConfig.source);
    if (source) {
      source.setData(data);
    } else {
      this.map.addSource(surfaceConfig.source, { type: 'geojson', data });
    }

    if (!this.map.getLayer(surfaceConfig.fillLayer)) {
      this.map.addLayer(
        {
          id: surfaceConfig.fillLayer,
          type: 'fill',
          source: surfaceConfig.source,
          filter,
          layout: { visibility },
          paint: {
            'fill-color': colorExpr,
            'fill-opacity': buildSurfaceOpacityExpression(surfaceConfig.fillOpacityByTier)
          }
        },
        config.layer
      );
    } else {
      this.map.setFilter(surfaceConfig.fillLayer, filter);
      this.map.setPaintProperty(surfaceConfig.fillLayer, 'fill-color', colorExpr);
    }

    if (!this.map.getLayer(surfaceConfig.lineLayer)) {
      this.map.addLayer(
        {
          id: surfaceConfig.lineLayer,
          type: 'line',
          source: surfaceConfig.source,
          filter,
          layout: { visibility },
          paint: {
            'line-color': colorExpr,
            'line-width': 0.5,
            'line-opacity': buildSurfaceOpacityExpression(surfaceConfig.lineOpacityByTier)
          }
        },
        config.layer
      );
    } else {
      this.map.setFilter(surfaceConfig.lineLayer, filter);
      this.map.setPaintProperty(surfaceConfig.lineLayer, 'line-color', colorExpr);
    }
  }

  /**
   * MapLibre filter: tier >= minTier AND commodity in the enabled list.
   * Empty enabled list yields a filter that matches nothing.
   */
  buildSurfaceFilter(surfaceConfig, enabledCommodities) {
    const tierFilter = ['>=', ['get', 'tier'], surfaceConfig.minTierToRender];
    if (!enabledCommodities?.length) {
      return ['all', tierFilter, ['==', ['get', 'commodity'], '__none__']];
    }
    return [
      'all',
      tierFilter,
      ['in', ['get', 'commodity'], ['literal', enabledCommodities]]
    ];
  }

  /** Updates which commodity surfaces are visible without recomputing geometry. */
  setSurfaceEnabledCommodities(name, enabledCommodities) {
    const config = LAYER_CONFIG[name];
    const surfaceConfig = config?.surface;
    if (!surfaceConfig) return;

    this.surfaceEnabledCommodities[name] = [...(enabledCommodities || [])];
    const filter = this.buildSurfaceFilter(surfaceConfig, this.surfaceEnabledCommodities[name]);
    [surfaceConfig.fillLayer, surfaceConfig.lineLayer].forEach((layerId) => {
      if (this.map.getLayer(layerId)) this.map.setFilter(layerId, filter);
    });
  }

  /** Shows/hides an occurrence-density surface independently of its parent point layer (sidebar sub-toggle), and remembers the state for basemap-switch persistence. */
  setSurfaceVisibility(name, visible) {
    const config = LAYER_CONFIG[name];
    const surfaceConfig = config?.surface;
    if (!surfaceConfig) return;

    this.surfaceVisible[name] = visible;
    const visibility = visible ? 'visible' : 'none';
    [surfaceConfig.fillLayer, surfaceConfig.lineLayer].forEach((layerId) => {
      if (this.map.getLayer(layerId)) this.map.setLayoutProperty(layerId, 'visibility', visibility);
    });
  }

  async refreshLayers() {
    for (const [name, layerState] of Object.entries(this.layers)) {
      const config = LAYER_CONFIG[name];
      const data = this.loadedData[name];
      if (config && data) {
        this.ensureSource(config, data);
        this.addLayerByType(name, config, data);
        this.setLayerVisibility(name, layerState.visible);

        if (layerState.filter !== undefined && this.map.getLayer(config.layer)) {
          this.map.setFilter(config.layer, layerState.filter);
        }
        if (layerState.paintOverrides && this.map.getLayer(config.layer)) {
          Object.entries(layerState.paintOverrides).forEach(([property, value]) => {
            this.map.setPaintProperty(config.layer, property, value);
          });
        }

        // setStyle() (basemap switch) tears down runtime sources/layers, so
        // the surface fill/outline need re-adding the same way `ensureSource`
        // handles the main point layer above.
        if (config.surface?.enabled && this.surfaceData[name]) {
          this.updateOccurrenceSurface(
            name,
            this.surfaceData[name],
            this.surfaceEnabledCommodities[name]
          );
          this.setSurfaceVisibility(name, this.surfaceVisible[name] !== false);
        }
      }
    }
    this.refreshWMSLayers();
  }

  /**
   * Build a single GetMap request covering the full layer bounds.
   * CRS:84 uses lon/lat axis order, and is the only unprojected CRS this
   * server supports (it rejects EPSG:3857 outright).
   */
  buildWMSImageUrl(config, width, height) {
    const [west, south, east, north] = config.bounds;

    const params = new URLSearchParams({
      service: 'WMS',
      version: '1.3.0',
      request: 'GetMap',
      layers: config.layers,
      styles: '',
      crs: 'CRS:84',
      bbox: `${west},${south},${east},${north}`,
      width: String(width),
      height: String(height),
      format: 'image/png',
      transparent: 'true'
    });

    return `${WMS_BASE_URL}/${config.service}/MapServer/WMSServer?${params.toString()}`;
  }

  /**
   * Fetches the CRS:84 GetMap image and resamples it onto a Mercator-linear
   * grid so it aligns with the basemap, returning a data URL ready for a
   * MapLibre `image` source.
   */
  async fetchReprojectedWMSImage(config) {
    const [west, south, east, north] = config.bounds;
    const aspect = (east - west) / (north - south);
    const srcWidth = WMS_IMAGE_WIDTH;
    const srcHeight = Math.round(srcWidth / aspect);
    const url = this.buildWMSImageUrl(config, srcWidth, srcHeight);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);
      const canvas = reprojectToMercator(bitmap, config.bounds);
      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error(`Failed to load WMS layer ${config.service}:`, error);
      return null;
    }
  }

  /** Lazily loads a WMS / endowment raster the first time it's enabled.
   * Prefers baked Mercator-corrected `imageUrl` (cache-busted by cacheVersion);
   * falls back to live GetMap + client reprojection if the static file is missing.
   */
  async ensureWMSLayer(name) {
    const config = WMS_CONFIG[name];
    const key = `wms-${name}`;
    if (!config || this.layers[key]) return;

    let dataUrl = null;
    if (config.imageUrl) {
      const versioned = config.cacheVersion
        ? `${config.imageUrl}?v=${encodeURIComponent(config.cacheVersion)}`
        : config.imageUrl;
      try {
        const response = await fetch(versioned, { method: 'HEAD' });
        // Some static hosts omit HEAD — 405 still means the path is routable.
        if (response.ok || response.status === 405) {
          dataUrl = versioned;
        }
      } catch {
        // Fall through to live GetMap.
      }
    }

    if (!dataUrl) {
      dataUrl = await this.fetchReprojectedWMSImage(config);
    }
    if (!dataUrl) return;

    const sourceId = `${key}-source`;
    const layerId = `${key}-layer`;

    this.addWMSSourceAndLayer(sourceId, layerId, dataUrl, config);

    this.layers[key] = {
      config,
      sourceId,
      layerId,
      dataUrl,
      visible: true,
      isWMS: true
    };
  }

  addWMSSourceAndLayer(sourceId, layerId, dataUrl, config) {
    const [west, south, east, north] = config.bounds;

    if (!this.map.getSource(sourceId)) {
      this.map.addSource(sourceId, {
        type: 'image',
        url: dataUrl,
        coordinates: [
          [west, north],
          [east, north],
          [east, south],
          [west, south]
        ]
      });
    }

    if (!this.map.getLayer(layerId)) {
      this.map.addLayer({
        id: layerId,
        type: 'raster',
        source: sourceId,
        paint: {
          'raster-opacity': config.opacity,
          'raster-fade-duration': 300,
          'raster-resampling': 'linear'
        },
        layout: {
          visibility: 'visible'
        }
      });
    }
  }

  async setWMSLayerVisibility(name, visible) {
    const key = `wms-${name}`;

    if (visible && !this.layers[key]) {
      await this.ensureWMSLayer(name);
      return;
    }

    const state = this.layers[key];
    if (!state) return;

    const visibility = visible ? 'visible' : 'none';
    if (this.map.getLayer(state.layerId)) {
      this.map.setLayoutProperty(state.layerId, 'visibility', visibility);
    }

    state.visible = visible;
  }

  /** Re-adds previously-enabled WMS layers after a basemap style change, reusing the cached image (no re-fetch). */
  refreshWMSLayers() {
    for (const [key, state] of Object.entries(this.layers)) {
      if (state.isWMS && key.startsWith('wms-') && state.visible) {
        this.addWMSSourceAndLayer(state.sourceId, state.layerId, state.dataUrl, state.config);
      }
    }
  }

  /**
   * Fetches the ArcGIS REST `legend` JSON for a WMS layer's config and
   * normalizes it into the same {label, icon} shape LegendPanel already
   * renders for vector layers - real text + a small swatch, versus one
   * baked-in raster picture (which can't reflow/wrap and gets illegible
   * once a classification runs to 100+ rows, e.g. bedrock geology).
   */
  async fetchArcGISLegendItems(config) {
    if (!config.legendJsonUrl) return null;
    try {
      const response = await fetch(config.legendJsonUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      const layer = data.layers?.find((l) => l.layerId === config.legendLayerId);
      if (!layer?.legend?.length) return null;

      return layer.legend.map((item) => ({
        label: item.label || '(unlabeled)',
        icon: `data:${item.contentType};base64,${item.imageData}`
      }));
    } catch (error) {
      console.error(`Failed to load legend JSON for ${config.service}:`, error);
      return null;
    }
  }

  /** Cached ArcGIS legend JSON for WMS or vector layers that declare legendJsonUrl. */
  async getArcGISLegendItems(name, config) {
    if (this.legendItemsCache[name]) return this.legendItemsCache[name];
    if (!config) return null;

    const items = await this.fetchArcGISLegendItems(config);
    if (items) this.legendItemsCache[name] = items;
    return items;
  }

  /** Cached accessor - the legend rarely changes, so fetch once per session per layer. */
  async getWMSLegendItems(name) {
    return this.getArcGISLegendItems(name, WMS_CONFIG[name]);
  }

  async getVectorLegendItems(name) {
    return this.getArcGISLegendItems(name, LAYER_CONFIG[name]);
  }
}
