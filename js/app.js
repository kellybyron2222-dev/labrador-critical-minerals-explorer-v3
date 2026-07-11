/**
 * Critical Minerals Explorer - Application Orchestrator
 * Wires Module 1 (MapBase) and Module 2 (LayerManager)
 */

import maplibregl from 'maplibre-gl';
import MapBase from './modules/MapBase.js';
import LayerManager from './modules/LayerManager.js';
import LegendPanel from './modules/LegendPanel.js';
import OccurrenceBrowser from './modules/OccurrenceBrowser.js';
import {
  LAYER_CONFIG,
  WMS_CONFIG,
  LAYER_GROUPS,
  LAYER_GROUP_ORDER,
  buildMODSColorExpression,
  buildMODSEnabledCommodityFilter,
  buildMODSLegendItems,
  modsCommodityPickerLabel,
  resolveMODSCommodities,
  resolveMODSCommodityColor,
  resolveMODSLegendCommodities,
  featureBelongsToCommodity,
  MODS_SURFACE_DEFAULT_COUNT
} from './config/layerConfig.js';
import { combineMODSFilters, filterMODSFeatures, featureMatchesBrowserFilters } from './config/modsFilters.js';
import { computeCommoditySurface } from './modules/SurfaceInterpolation.js';
import MobileChrome from './modules/MobileChrome.js';

class MineralsMapApp {
  constructor() {
    this.mapBase = new MapBase();
    this.layerManager = null;
    this.legendPanel = new LegendPanel('legend-panel');
    this.occurrenceBrowser = null;
    this.mobileChrome = new MobileChrome({
      onLayoutChange: () => this.mapBase.map?.resize()
    });
    this.selectedPopup = null;
    // Occurrence-density surface visibility (Phase 1.1c) - a sub-toggle
    // inside the MODS legend card, independent of the commodity picker and
    // the main layer checkbox. Seeded from config so a future author can
    // ship it off-by-default without hunting through app.js.
    this.showMODSSurface = LAYER_CONFIG.modsOccurrences.surface?.defaultVisible !== false;
    // Per-mineral legend checkboxes control both circle visibility and which
    // surfaces are eligible (master surface toggle still gates shading).
    this.enabledCommodities = [];
    this.modsSurfaceCache = new Map();
    this.currentMODSPickerValue = null;
    this.init();
  }

  async init() {
    const map = await this.mapBase.init();

    this.layerManager = new LayerManager(map);
    this.mapBase.onStyleChange = () => {
      this.layerManager.refreshLayers();
      this.applyMODSCommodityVisibility();
    };

    await this.layerManager.loadAllLayers();

    this.occurrenceBrowser = new OccurrenceBrowser({
      onChange: () => this.applyMODSCommodityVisibility(),
      onSelect: (feature) => this.onOccurrenceSelect(feature)
    });

    this.mobileChrome.init();
    this.renderLayerSidebar();
    this.bindLayerControls();
    // Applies the default commodity filter/color + legend before the initial
    // legend sync below, so MODS renders its default (critical-minerals
    // preset) legend on the first paint rather than a generic one that
    // immediately gets replaced.
    this.bindMODSCommodityPicker();
    this.bindInteractions();
    this.syncInitialLegends();
  }

  /** Groups vector + WMS layer configs by their `group` id for sidebar rendering. */
  buildLayerGroupMap() {
    const map = new Map();

    const addToGroup = (groupId, entry) => {
      if (!groupId) return;
      if (!map.has(groupId)) map.set(groupId, []);
      map.get(groupId).push(entry);
    };

    Object.entries(LAYER_CONFIG).forEach(([name, config]) => {
      addToGroup(config.group, { type: 'vector', name, config });
    });
    Object.entries(WMS_CONFIG).forEach(([name, config]) => {
      addToGroup(config.group, { type: 'wms', name, config });
    });

    return map;
  }

  /** Builds collapsible thematic layer groups in the sidebar from layer config. */
  renderLayerSidebar() {
    const container = document.getElementById('layer-groups');
    if (!container) return;

    const groupMap = this.buildLayerGroupMap();
    container.innerHTML = '';

    LAYER_GROUP_ORDER.forEach((groupId) => {
      const layers = groupMap.get(groupId);
      if (!layers?.length) return;

      const groupDef = LAYER_GROUPS[groupId];
      if (!groupDef) return;

      const section = document.createElement('section');
      section.className = 'layer-group';
      if (groupDef.defaultExpanded) section.classList.add('expanded');

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'layer-group-toggle';
      toggle.setAttribute('aria-expanded', String(groupDef.defaultExpanded));
      toggle.innerHTML = `
        <svg class="layer-group-chevron" viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="9 6 15 12 9 18"></polyline>
        </svg>
        <span class="layer-group-title">${groupDef.title}</span>
        <span class="layer-group-count">${layers.length}</span>
      `;
      toggle.addEventListener('click', () => {
        const expanded = section.classList.toggle('expanded');
        toggle.setAttribute('aria-expanded', String(expanded));
      });
      section.appendChild(toggle);

      const body = document.createElement('div');
      body.className = 'layer-group-body';

      const list = document.createElement('div');
      list.className = `layer-list${layers.some((l) => l.type === 'wms') ? ' wms-layers' : ''}`;

      layers.forEach(({ type, name, config }) => {
        const checkboxId = type === 'vector' ? `layer-${name}` : `wms-${name}`;
        const label = type === 'vector' ? config.sidebarLabel : config.label;

        const item = document.createElement('label');
        item.className = 'layer-item';
        item.innerHTML = `
          <input type="checkbox" id="${checkboxId}"${config.visible ? ' checked' : ''}>
          <span class="layer-indicator ${config.indicatorClass}"></span>
          <span class="layer-label">${label}</span>
        `;
        list.appendChild(item);

        if (type === 'vector' && config.commodityPicker) {
          list.appendChild(this.buildCommodityPicker(name, config.commodityPicker));
        }
      });

      body.appendChild(list);

      if (groupDef.hint) {
        const hint = document.createElement('p');
        hint.className = 'layer-hint';
        hint.textContent = groupDef.hint;
        body.appendChild(hint);
      }
      if (groupDef.note) {
        const note = document.createElement('p');
        note.className = 'layer-note';
        note.textContent = groupDef.note;
        body.appendChild(note);
      }

      section.appendChild(body);
      container.appendChild(section);
    });
  }

  /** Builds the commodity-filter `<select>` shown under a layer row (currently only MODS) from its `commodityPicker` config. */
  buildCommodityPicker(name, pickerConfig) {
    const wrap = document.createElement('div');
    wrap.className = 'commodity-picker-wrap';

    const select = document.createElement('select');
    select.id = `${name}-commodity-picker`;
    select.className = 'commodity-select';

    pickerConfig.groups.forEach((group) => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = group.label;
      group.options.forEach(({ value, label }) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        optgroup.appendChild(option);
      });
      select.appendChild(optgroup);
    });

    select.value = pickerConfig.defaultValue;
    wrap.appendChild(select);
    return wrap;
  }

  /** Wires the MODS commodity picker to a MapLibre filter + color override on the underlying circle layer (no re-fetch - same source data, just filtered/recolored), recomputes the occurrence-density surface for the new selection, and keeps the legend in sync. */
  bindMODSCommodityPicker() {
    const picker = document.getElementById('modsOccurrences-commodity-picker');
    if (!picker) return;

    const applyCommodity = (value) => {
      this.currentMODSPickerValue = value;
      this.layerManager.setPaintProperty('modsOccurrences', 'circle-color', buildMODSColorExpression(value));
      this.resetMODSEnabledCommodities(value);
      this.applyMODSCommodityVisibility();
      this.scheduleMODSSurfaceUpdate();
      this.updateMODSLegend(value);
    };

    picker.addEventListener('change', (e) => applyCommodity(e.target.value));
    applyCommodity(picker.value);
  }

  /**
   * Resets which minerals are checked when the picker changes.
   * Single commodity → that mineral only. Multi-commodity → first N of the
   * legend list (MODS_SURFACE_DEFAULT_COUNT). Clears the geometry cache.
   */
  resetMODSEnabledCommodities(value) {
    this.modsSurfaceCache.clear();
    const available = resolveMODSLegendCommodities(value);
    const resolved = resolveMODSCommodities(value);
    if (resolved && resolved.length === 1) {
      this.enabledCommodities = [resolved[0]];
    } else {
      this.enabledCommodities = available.slice(0, MODS_SURFACE_DEFAULT_COUNT);
    }
  }

  /** Applies circle + surface filters from picker, legend, status, and search. */
  applyMODSCommodityVisibility() {
    const value = this.currentMODSPickerValue;
    const resolved = resolveMODSCommodities(value);
    const primaryOnly = !resolved || resolved.length > 1;
    const browser = this.occurrenceBrowser?.getFilterState() || { statuses: new Set(), query: '' };

    const commodityFilter = buildMODSEnabledCommodityFilter(value, this.enabledCommodities, {
      primaryOnly
    });

    // Search → NMINO allowlist (MapLibre can't do substring match)
    let nminoAllowlist = null;
    if (browser.query.trim()) {
      const all = this.layerManager.getLoadedFeatures('modsOccurrences');
      const matched = filterMODSFeatures(all, {
        pickerCommodities: resolved,
        enabledCommodities: this.enabledCommodities,
        primaryOnly,
        statuses: browser.statuses,
        query: browser.query
      });
      nminoAllowlist = matched.map((f) => f.properties.NMINO).filter(Boolean);
    }

    this.layerManager.setLayerFilter(
      'modsOccurrences',
      combineMODSFilters(commodityFilter, {
        statuses: browser.statuses,
        nminoAllowlist
      })
    );
    this.layerManager.setSurfaceEnabledCommodities('modsOccurrences', this.enabledCommodities);
    this.syncOccurrenceBrowser();
  }

  /** Keep KPI / list in sync with the same filtered feature set as the map. */
  syncOccurrenceBrowser() {
    if (!this.occurrenceBrowser) return;

    const all = this.layerManager.getLoadedFeatures('modsOccurrences');
    const value = this.currentMODSPickerValue;
    const resolved = resolveMODSCommodities(value);
    const primaryOnly = !resolved || resolved.length > 1;
    const browser = this.occurrenceBrowser.getFilterState();

    const commodityScoped = filterMODSFeatures(all, {
      pickerCommodities: resolved,
      enabledCommodities: this.enabledCommodities,
      primaryOnly,
      statuses: new Set(),
      query: ''
    });

    // Status/search only — avoid a second full commodity pass over `all`.
    const filtered = commodityScoped.filter((f) =>
      featureMatchesBrowserFilters(f, {
        statuses: browser.statuses,
        query: browser.query
      })
    );

    this.occurrenceBrowser.update(commodityScoped, filtered);
  }

  onOccurrenceSelect(feature) {
    if (this.selectedPopup) {
      this.selectedPopup.remove();
      this.selectedPopup = null;
    }
    if (!feature) return;

    this.mobileChrome?.close({ silent: true });

    const [lon, lat] = feature.geometry.coordinates;
    this.map.flyTo({ center: [lon, lat], zoom: Math.max(this.map.getZoom(), 9) });

    const p = feature.properties;
    const primary = p.primaryCommodity || p.COMNAME;
    const secondaries = p.secondaryCommodities || [];
    const commodityRows = [['Primary commodity', primary]];
    if (secondaries.length) {
      commodityRows.push(['Also reported', secondaries.join(', ')]);
    }
    const rows = [
      ...commodityRows,
      ['Status', p.STATUS],
      ['Deposit type', p.DEPDESC],
      ['Ore minerals', p.OREMIN],
      ['Work history', p.WORKING],
      ['NTS sheet', p.NTS]
    ]
      .filter(([, v]) => v && String(v).trim())
      .map(
        ([label, value]) =>
          `<div class="popup-row"><span class="popup-label">${label}:</span> <span class="popup-value">${value}</span></div>`
      )
      .join('');

    const recordUrl = this.modsRecordUrl(p.NMINO);
    const linkRow = recordUrl
      ? `<div class="popup-row"><span class="popup-label">MODS record:</span> <span class="popup-value"><a href="${recordUrl}" target="_blank" rel="noopener">${p.NMINO}</a></span></div>`
      : '';

    this.selectedPopup = new maplibregl.Popup({ closeButton: true, closeOnClick: true })
      .setLngLat([lon, lat])
      .setHTML(`
        <div class="popup-content">
          <h3 class="popup-title">${p.name || 'Unnamed occurrence'}</h3>
          ${rows}
          ${linkRow}
        </div>
      `)
      .addTo(this.map);
  }

  /**
   * Ensures geometry exists for every currently enabled mineral, then pushes
   * the merged FeatureCollection to LayerManager. Surfaces always use
   * primary-commodity points only. No-ops while the master surface toggle is off
   * so cold start / picker changes skip Turf work until the user opts in.
   */
  updateMODSSurface() {
    if (!this.showMODSSurface) {
      this.layerManager.setSurfaceVisibility('modsOccurrences', false);
      return;
    }

    const allFeatures = this.layerManager.getLoadedFeatures('modsOccurrences');
    const tierCount = LAYER_CONFIG.modsOccurrences.surface?.tierCount;

    for (const commodity of this.enabledCommodities) {
      if (this.modsSurfaceCache.has(commodity)) continue;
      const features = allFeatures.filter((f) => featureBelongsToCommodity(f, commodity));
      const surface = computeCommoditySurface(features, commodity, { tierCount });
      this.modsSurfaceCache.set(commodity, surface.features);
    }

    const merged = {
      type: 'FeatureCollection',
      features: []
    };
    for (const [commodity, features] of this.modsSurfaceCache) {
      if (!this.enabledCommodities.includes(commodity)) continue;
      merged.features.push(...features);
    }

    this.layerManager.updateOccurrenceSurface(
      'modsOccurrences',
      merged,
      this.enabledCommodities
    );
    this.layerManager.setSurfaceVisibility('modsOccurrences', true);
  }

  /** Defer Turf surface compute so UI paint / map interaction stay responsive. */
  scheduleMODSSurfaceUpdate() {
    if (!this.showMODSSurface) {
      this.layerManager.setSurfaceVisibility('modsOccurrences', false);
      return;
    }
    if (this._surfaceIdleHandle != null) {
      if (typeof cancelIdleCallback === 'function') cancelIdleCallback(this._surfaceIdleHandle);
      else clearTimeout(this._surfaceIdleHandle);
    }
    const run = () => {
      this._surfaceIdleHandle = null;
      this.updateMODSSurface();
    };
    if (typeof requestIdleCallback === 'function') {
      this._surfaceIdleHandle = requestIdleCallback(run, { timeout: 900 });
    } else {
      this._surfaceIdleHandle = setTimeout(run, 0);
    }
  }

  /** Per-mineral checkbox: toggles circles and surfaces for that mineral. */
  setMODSCommodityEnabled(commodity, checked) {
    if (checked) {
      if (!this.enabledCommodities.includes(commodity)) {
        this.enabledCommodities = [...this.enabledCommodities, commodity];
      }
      this.modsSurfaceCache.delete(commodity);
      this.applyMODSCommodityVisibility();
      this.scheduleMODSSurfaceUpdate();
    } else {
      this.enabledCommodities = this.enabledCommodities.filter((c) => c !== commodity);
      this.applyMODSCommodityVisibility();
      this.scheduleMODSSurfaceUpdate();
    }
  }

  setAllMODSCommoditiesEnabled(enabled) {
    const value = this.currentMODSPickerValue;
    const available = resolveMODSLegendCommodities(value);
    this.enabledCommodities = enabled ? [...available] : [];
    this.applyMODSCommodityVisibility();
    this.scheduleMODSSurfaceUpdate();
    this.updateMODSLegend(value);
  }

  /** Rebuilds the MODS legend card for the current commodity selection - mutates the shared config object so `updateVectorLegend`/`syncInitialLegends` stay generic. */
  updateMODSLegend(value) {
    const config = LAYER_CONFIG.modsOccurrences;
    config.legendTitle = `MODS — ${modsCommodityPickerLabel(value)}`;
    config.surfaceToggle = {
      label: 'Show occurrence density surfaces',
      checked: this.showMODSSurface,
      onChange: (checked) => {
        this.showMODSSurface = checked;
        if (checked) this.scheduleMODSSurfaceUpdate();
        else this.layerManager.setSurfaceVisibility('modsOccurrences', false);
      }
    };

    const legendCommodities = resolveMODSLegendCommodities(value);
    const isMulti = legendCommodities.length > 1;

    if (isMulti) {
      config.legend = null;
      config.commodityToggles = {
        commodities: legendCommodities.map((c) => ({
          value: c,
          label: c,
          color: resolveMODSCommodityColor(c)
        })),
        enabled: [...this.enabledCommodities],
        onChange: (commodity, checked) => this.setMODSCommodityEnabled(commodity, checked),
        onAllOn: () => this.setAllMODSCommoditiesEnabled(true),
        onAllOff: () => this.setAllMODSCommoditiesEnabled(false)
      };
    } else {
      config.commodityToggles = null;
      config.legend = buildMODSLegendItems(value);
    }

    const checkbox = document.getElementById('layer-modsOccurrences');
    const visible = checkbox ? checkbox.checked : config.visible;

    this.legendPanel.hideLegend('layer-modsOccurrences');
    this.updateVectorLegend('modsOccurrences', visible);
  }

  /** Shows legends for any layers that are checked/visible by default on page load. */
  syncInitialLegends() {
    Object.entries(LAYER_CONFIG).forEach(([name, config]) => {
      if (config.visible) this.updateVectorLegend(name, true);
    });
  }

  updateVectorLegend(name, visible) {
    const config = LAYER_CONFIG[name];
    if (!config) return;

    // ArcGIS classification legends (e.g. GeoAtlas bedrock) — fetch async like WMS.
    if (config.legendJsonUrl) {
      this.updateVectorArcGISLegend(name, visible);
      return;
    }

    this.legendPanel.setLayerLegend(`layer-${name}`, visible, {
      title: config.legendTitle,
      items: config.legend,
      shape: config.legendShape,
      note: config.legendNote,
      surfaceToggle: config.surfaceToggle,
      commodityToggles: config.commodityToggles
    });
  }

  async updateVectorArcGISLegend(name, visible) {
    const key = `layer-${name}`;
    if (!visible) {
      this.legendPanel.hideLegend(key);
      return;
    }

    const config = LAYER_CONFIG[name];
    const items = await this.layerManager.getVectorLegendItems(name);
    this.legendPanel.setLayerLegend(key, visible, items
      ? { title: config.legendTitle, items, shape: 'icon', note: config.legendNote }
      : { title: config.legendTitle, note: config.legendNote || 'Legend unavailable' });
  }

  async updateWMSLegend(name, visible) {
    const key = `wms-${name}`;
    if (!visible) {
      this.legendPanel.hideLegend(key);
      return;
    }

    const config = WMS_CONFIG[name];
    const items = await this.layerManager.getWMSLegendItems(name);

    this.legendPanel.setLayerLegend(key, visible, items
      ? { title: config.label, items, shape: 'icon' }
      : { title: config.label, imageUrl: config.legendUrl });
  }

  get map() {
    return this.mapBase.map;
  }

  bindLayerControls() {
    Object.keys(LAYER_CONFIG).forEach((name) => {
      const checkbox = document.getElementById(`layer-${name}`);
      if (!checkbox) return;

      const config = LAYER_CONFIG[name];
      const item = checkbox.closest('.layer-item');

      checkbox.addEventListener('change', async (e) => {
        const checked = e.target.checked;

        if (config.lazy && checked && !this.layerManager.isLayerLoaded(name)) {
          checkbox.disabled = true;
          item?.classList.add('loading');
          try {
            const ok = await this.layerManager.loadLayerOnDemand(name);
            if (!ok) {
              checkbox.checked = false;
              return;
            }
            this.layerManager.setLayerVisibility(name, true);
            if (this.layerManager.layers[name]) {
              this.layerManager.layers[name].visible = true;
            }
            await this.updateVectorLegend(name, true);
          } finally {
            checkbox.disabled = false;
            item?.classList.remove('loading');
          }
          return;
        }

        this.layerManager.setLayerVisibility(name, checked);
        await this.updateVectorLegend(name, checked);
      });
    });

    Object.keys(WMS_CONFIG).forEach((name) => {
      const checkbox = document.getElementById(`wms-${name}`);
      if (!checkbox) return;

      const item = checkbox.closest('.layer-item');

      checkbox.addEventListener('change', async (e) => {
        const checked = e.target.checked;
        checkbox.disabled = true;
        item?.classList.add('loading');
        try {
          await this.layerManager.setWMSLayerVisibility(name, checked);
          await this.updateWMSLegend(name, checked);
        } finally {
          checkbox.disabled = false;
          item?.classList.remove('loading');
        }
      });
    });
  }

  bindInteractions() {
    this.map.on('click', 'critical-minerals-layer', (e) => {
      const coordinates = e.features[0].geometry.coordinates.slice();
      const {
        name,
        OperatorOwnersEN: operator,
        CommoditiesEN: commodities,
        ProvincesEN: province,
        DevelopmentStageEN: stage,
        ActivityStatusEN: status,
        Website: website
      } = e.features[0].properties;

      const websiteRow = website && website !== 'N/A'
        ? `<div class="popup-row"><span class="popup-label">Website:</span> <span class="popup-value"><a href="${website}" target="_blank" rel="noopener">Visit site</a></span></div>`
        : '';

      new maplibregl.Popup({ closeButton: true, closeOnClick: true })
        .setLngLat(coordinates)
        .setHTML(`
          <div class="popup-content">
            <h3 class="popup-title">${name}</h3>
            <div class="popup-row"><span class="popup-label">Operator:</span> <span class="popup-value">${operator}</span></div>
            <div class="popup-row"><span class="popup-label">Commodities:</span> <span class="popup-value">${commodities}</span></div>
            <div class="popup-row"><span class="popup-label">Province:</span> <span class="popup-value">${province}</span></div>
            <div class="popup-row"><span class="popup-label">Stage:</span> <span class="popup-value">${stage}</span></div>
            <div class="popup-row"><span class="popup-label">Status:</span> <span class="popup-value">${status}</span></div>
            ${websiteRow}
          </div>
        `)
        .addTo(this.map);
    });

    this.bindMODSInteractions();
    this.bindBedrockInteractions();

    ['critical-minerals-layer', 'mods-layer', 'geoatlas-bedrock-fill'].forEach((layerId) => {
      this.map.on('mouseenter', layerId, () => {
        this.map.getCanvas().style.cursor = 'pointer';
      });
      this.map.on('mouseleave', layerId, () => {
        this.map.getCanvas().style.cursor = '';
      });
    });
  }

  bindBedrockInteractions() {
    this.map.on('click', 'geoatlas-bedrock-fill', (e) => {
      if (!e.features?.length) return;
      const feature = e.features[0];
      const p = feature.properties || {};
      const coordinates = e.lngLat;

      const rows = [
        ['Unit label', p.LABEL || p.name],
        ['Lithology', p.LITHOLOGY],
        ['Age', p.AGE],
        ['Tectonic setting', p.TECTONIC],
        ['Reference', p.REFERENCE]
      ]
        .filter(([, v]) => v && String(v).trim())
        .map(
          ([label, value]) =>
            `<div class="popup-row"><span class="popup-label">${label}:</span> <span class="popup-value">${value}</span></div>`
        )
        .join('');

      new maplibregl.Popup({ closeButton: true, closeOnClick: true })
        .setLngLat(coordinates)
        .setHTML(`
          <div class="popup-content">
            <h3 class="popup-title">${p.name || p.LABEL || 'Bedrock unit'}</h3>
            ${rows}
          </div>
        `)
        .addTo(this.map);
    });
  }

  /** MODS deep-link: NMINO (e.g. "023G/09/Ni 002") plugs straight into the province's occurrence-report lookup. */
  modsRecordUrl(nmino) {
    if (!nmino) return null;
    return `https://gis.geosurv.gov.nl.ca/mods/ModsCard.asp?NMINOString=${encodeURIComponent(nmino).replace(/%20/g, '+')}`;
  }

  bindMODSInteractions() {
    // Single circle layer, visible/clickable at every zoom (see
    // `commodityPicker`/`paint.circle` in layerConfig.js) - no separate
    // cluster/heatmap layer to bind here.
    this.map.on('click', 'mods-layer', (e) => {
      const coordinates = e.features[0].geometry.coordinates.slice();
      const props = e.features[0].properties;
      const {
        name,
        primaryCommodity,
        COMNAME: commodity,
        secondaryCommodities,
        commodityList,
        STATUS: status,
        DEPDESC: depositType,
        OREMIN: oreMinerals,
        WORKING: workHistory,
        NTS: nts,
        NMINO: nmino
      } = props;

      const parseMaybeArray = (v) => {
        if (Array.isArray(v)) return v;
        if (typeof v === 'string' && v.startsWith('[')) {
          try {
            return JSON.parse(v);
          } catch {
            return [];
          }
        }
        return [];
      };

      const list = parseMaybeArray(commodityList);
      const secondaries = Array.isArray(secondaryCommodities)
        ? secondaryCommodities
        : parseMaybeArray(secondaryCommodities).length
          ? parseMaybeArray(secondaryCommodities)
          : list.filter((c) => c !== (primaryCommodity || commodity));

      if (this.occurrenceBrowser) {
        this.occurrenceBrowser.selectByNmino(nmino);
      }

      const primary = primaryCommodity || commodity;
      const commodityRows = [['Primary commodity', primary]];
      if (secondaries.length) {
        commodityRows.push(['Also reported', secondaries.join(', ')]);
      }

      const rows = [
        ...commodityRows,
        ['Status', status],
        ['Deposit type', depositType],
        ['Ore minerals', oreMinerals],
        ['Work history', workHistory],
        ['NTS sheet', nts]
      ]
        .filter(([, value]) => value && String(value).trim())
        .map(
          ([label, value]) =>
            `<div class="popup-row"><span class="popup-label">${label}:</span> <span class="popup-value">${value}</span></div>`
        )
        .join('');

      const recordUrl = this.modsRecordUrl(nmino);
      const linkRow = recordUrl
        ? `<div class="popup-row"><span class="popup-label">MODS record:</span> <span class="popup-value"><a href="${recordUrl}" target="_blank" rel="noopener">${nmino}</a></span></div>`
        : '';

      this.selectedPopup?.remove();
      this.selectedPopup = new maplibregl.Popup({ closeButton: true, closeOnClick: true })
        .setLngLat(coordinates)
        .setHTML(`
          <div class="popup-content">
            <h3 class="popup-title">${name}</h3>
            ${rows}
            ${linkRow}
          </div>
        `)
        .addTo(this.map);
    });
  }
}

export default MineralsMapApp;
