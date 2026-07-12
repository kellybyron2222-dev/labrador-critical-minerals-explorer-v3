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
  FATAL_FLAW_PRESET_LAYERS,
  FATAL_FLAW_LAND_USE_KINDS,
  FATAL_FLAW_MASK_PAINT,
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
import { downloadGeoJSON } from './modules/geoJsonExport.js';
import {
  combineMODSFilters,
  filterMODSFeatures,
  featureMatchesBrowserFilters,
  modsUsesPrimaryOnlyFilter
} from './config/modsFilters.js';
import {
  buildClaimsExpiryLegendItems,
  buildClaimsExpiryBandToggles,
  buildClaimsExpiryBandFilter,
  buildTenureLegendFromFeatures
} from './config/mineralLands.js';
import {
  NUNATSIAVUT_LEGEND_ITEMS,
  buildAtrisClaimTogglesFromFeatures,
  buildAtrisEnabledFilter
} from './config/indigenousLands.js';
import {
  buildCpcadLegendFromFeatures,
  buildLandUseKindTogglesFromFeatures,
  buildLandUseEnabledFilter
} from './config/protectedAreas.js';
import { computeCommoditySurface } from './modules/SurfaceInterpolation.js';
import MobileChrome from './modules/MobileChrome.js';
import KpiBar from './modules/KpiBar.js';
import SettingsPanel from './modules/SettingsPanel.js';
import { getKpiEnabledIds } from './modules/UserPrefs.js';
import { computeKpiMetrics, featureIntersectsBounds } from './modules/KpiEngine.js';
import { buildPopupSection, buildModsPopupSection } from './modules/PopupBuilder.js';

const POPUP_LAYER_IDS = [
  'mods-layer',
  'critical-minerals-layer',
  'geoatlas-claims-fill',
  'geoatlas-tenure-fill',
  'inuit-nunatsiavut-fill',
  'atris-claims-fill',
  'geoatlas-cpcad-fill',
  'geoatlas-landuse-fill',
  'geoatlas-bedrock-fill',
  'geoatlas-surficial-fill'
];

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
    /** null = not yet initialized; [] = all claims hidden via legend. */
    this.enabledAtrisClaims = null;
    /** null = not yet initialized; [] = all land-use kinds hidden via legend. */
    this.enabledLandUseKinds = null;
    /** null = all expiry bands; else subset of vulnerable|approaching|active */
    this.enabledClaimExpiryBands = null;
    this.modsSurfaceCache = new Map();
    this.currentMODSPickerValue = null;
    /** Phase 2.4 — Fatal-flaw / restricted-land preset active. */
    this.fatalFlawPresetActive = false;
    this._fatalFlawApplying = false;
    this._modsFilteredCache = [];
    this._kpiTimer = null;
    this.kpiBar = null;
    this.settingsPanel = null;
    this.init();
  }

  async init() {
    const map = await this.mapBase.init();

    this.layerManager = new LayerManager(map);
    this.mapBase.onStyleChange = () => {
      this.layerManager.refreshLayers();
      this.applyMODSCommodityVisibility();
    };

    await this.layerManager.loadAllLayers().then((result) => {
      if (result?.failed?.length) {
        this.setDataStatus(
          `Failed to load: ${result.failed.join(', ')}. Check network or try refreshing.`,
          'error'
        );
      }
    });

    this.occurrenceBrowser = new OccurrenceBrowser({
      onChange: () => this.applyMODSCommodityVisibility(),
      onSelect: (feature) => this.onOccurrenceSelect(feature)
    });

    this.kpiBar = new KpiBar({
      onOpenSettings: (opts) => this.settingsPanel?.show(opts)
    });
    this.settingsPanel = new SettingsPanel({
      onChange: () => this.refreshKpiBar(),
      onExportVisible: () => this.exportVisibleGeoJSON()
    });
    document.getElementById('settings-open')?.addEventListener('click', () => {
      this.settingsPanel?.show();
    });
    document.getElementById('settings-open-sidebar')?.addEventListener('click', () => {
      this.mobileChrome?.close({ silent: true });
      this.settingsPanel?.show();
    });

    this.mobileChrome.init();
    this.renderLayerSidebar();
    this.bindLayerControls();
    // Applies the default commodity filter/color + legend before the initial
    // legend sync below, so MODS renders its default (critical-minerals
    // preset) legend on the first paint rather than a generic one that
    // immediately gets replaced.
    this.bindMODSCommodityPicker();
    this.bindFatalFlawPreset();
    this.bindInteractions();
    this.bindKpiMapEvents();
    this.syncInitialLegends();
    this.refreshKpiBar();
  }

  /** Soft-launch export: filtered MODS in view + claims if that layer is on. */
  exportVisibleGeoJSON() {
    const bounds = this.map?.getBounds?.();
    const features = [];

    const value = this.currentMODSPickerValue;
    const resolved = resolveMODSCommodities(value);
    const primaryOnly = modsUsesPrimaryOnlyFilter(resolved);
    const browser = this.occurrenceBrowser?.getFilterState() || { statuses: new Set(), query: '' };
    const modsAll = this.layerManager.getLoadedFeatures('modsOccurrences');
    const modsFiltered = filterMODSFeatures(modsAll, {
      pickerCommodities: resolved,
      enabledCommodities: this.enabledCommodities?.length
        ? this.enabledCommodities
        : resolveMODSLegendCommodities(value),
      primaryOnly,
      statuses: browser.statuses,
      query: browser.query
    });
    const modsInView = bounds
      ? modsFiltered.filter((f) => featureIntersectsBounds(f, bounds))
      : modsFiltered;
    modsInView.forEach((f) => {
      features.push({
        type: 'Feature',
        geometry: f.geometry,
        properties: { ...f.properties, _exportLayer: 'modsOccurrences' }
      });
    });

    const claimsOn = document.getElementById('layer-geoatlasClaims')?.checked;
    if (claimsOn) {
      let claims = this.layerManager.getLoadedFeatures('geoatlasClaims');
      const bands = this.enabledClaimExpiryBands;
      if (bands?.length) {
        claims = claims.filter((f) => bands.includes(f.properties?.expiryBand));
      }
      const claimsInView = bounds
        ? claims.filter((f) => featureIntersectsBounds(f, bounds))
        : claims;
      claimsInView.forEach((f) => {
        features.push({
          type: 'Feature',
          geometry: f.geometry,
          properties: { ...f.properties, _exportLayer: 'geoatlasClaims' }
        });
      });
    }

    if (!features.length) {
      this.setDataStatus('Nothing to export in the current view / filters.', 'error');
      return;
    }

    const stamp = new Date().toISOString().slice(0, 10);
    downloadGeoJSON(
      { type: 'FeatureCollection', features },
      `labrador-explorer-visible-${stamp}.geojson`
    );
    this.setDataStatus(`Exported ${features.length} features (GeoJSON).`, 'info');
  }

  /** Sidebar footer status (default copy or load errors). */
  setDataStatus(message, kind = 'info') {
    const el = document.querySelector('.data-status');
    if (!el) return;
    if (!this._defaultDataStatus) {
      this._defaultDataStatus = el.textContent;
    }
    el.textContent = message || this._defaultDataStatus;
    el.classList.toggle('data-status-error', kind === 'error');
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

  /**
   * Split a group's layers into ordered subgroups (from LAYER_GROUPS.subgroups).
   * Layers without a matching subgroup id fall into an untitled trailing bucket.
   */
  partitionGroupLayers(layers, groupDef) {
    const defs = groupDef.subgroups;
    if (!defs?.length) {
      return [{ id: null, title: null, layers }];
    }

    const buckets = new Map(defs.map((d) => [d.id, { id: d.id, title: d.title, layers: [] }]));
    const ungrouped = [];

    layers.forEach((entry) => {
      const subgroupId = entry.config.subgroup;
      if (subgroupId && buckets.has(subgroupId)) {
        buckets.get(subgroupId).layers.push(entry);
      } else {
        ungrouped.push(entry);
      }
    });

    const parts = [...buckets.values()].filter((b) => b.layers.length);
    if (ungrouped.length) {
      parts.push({ id: '_other', title: null, layers: ungrouped });
    }
    return parts;
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
      section.dataset.groupId = groupId;
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

      if (groupId === 'rights') {
        body.appendChild(this.buildFatalFlawPresetControl());
      }

      const subgroups = this.partitionGroupLayers(layers, groupDef);
      subgroups.forEach(({ title, layers: subgroupLayers }) => {
        const list = document.createElement('div');
        const hasWms = subgroupLayers.some((l) => l.type === 'wms');
        list.className = `layer-list${hasWms ? ' wms-layers' : ''}`;

        if (title) {
          const heading = document.createElement('div');
          heading.className = 'layer-subgroup-title';
          heading.textContent = title;
          list.appendChild(heading);
        }

        subgroupLayers.forEach(({ type, name, config }) => {
          const checkboxId = type === 'vector' ? `layer-${name}` : `wms-${name}`;
          const label =
            type === 'vector'
              ? config.sidebarLabel
              : config.sidebarLabel || config.label;

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
      });

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

  /** Rights-group control: hard exclusions / fatal-flaw mask (Phase 2.4). */
  buildFatalFlawPresetControl() {
    const wrap = document.createElement('div');
    wrap.className = 'fatal-flaw-preset';

    const label = document.createElement('label');
    label.className = 'fatal-flaw-preset-label layer-item';
    label.htmlFor = 'fatal-flaw-preset-toggle';
    label.title =
      'Show parks, conserved areas, and protected water supplies only. Indigenous lands and claims are not hard exclusions.';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'fatal-flaw-preset-toggle';
    checkbox.checked = this.fatalFlawPresetActive;

    const indicator = document.createElement('span');
    indicator.className = 'layer-indicator fatalFlawPreset';
    indicator.setAttribute('aria-hidden', 'true');

    const text = document.createElement('span');
    text.className = 'layer-label';
    text.textContent = 'Hard exclusions';

    const meta = document.createElement('span');
    meta.className = 'fatal-flaw-preset-meta';
    meta.textContent = 'parks & water';

    label.appendChild(checkbox);
    label.appendChild(indicator);
    label.appendChild(text);
    label.appendChild(meta);
    wrap.appendChild(label);

    const note = document.createElement('p');
    note.className = 'fatal-flaw-preset-note';
    note.hidden = !this.fatalFlawPresetActive;
    note.textContent = 'Protected / conserved areas and water-supply buffers only.';
    wrap.appendChild(note);

    return wrap;
  }

  bindFatalFlawPreset() {
    const checkbox = document.getElementById('fatal-flaw-preset-toggle');
    if (!checkbox) return;

    checkbox.addEventListener('change', async (e) => {
      const active = e.target.checked;
      checkbox.disabled = true;
      try {
        await this.applyFatalFlawPreset(active);
      } finally {
        checkbox.disabled = false;
        this.syncFatalFlawUi();
      }
    });
  }

  syncFatalFlawUi() {
    const checkbox = document.getElementById('fatal-flaw-preset-toggle');
    if (checkbox) checkbox.checked = this.fatalFlawPresetActive;
    const note = document.querySelector('.fatal-flaw-preset-note');
    if (note) note.hidden = !this.fatalFlawPresetActive;
    const wrap = document.querySelector('.fatal-flaw-preset');
    wrap?.classList.toggle('active', this.fatalFlawPresetActive);
  }

  expandRightsGroup() {
    const section = document.querySelector('.layer-group[data-group-id="rights"]');
    if (!section) return;
    section.classList.add('expanded');
    const toggle = section.querySelector('.layer-group-toggle');
    toggle?.setAttribute('aria-expanded', 'true');
  }

  /**
   * Enable/disable a vector layer (lazy load + legend + KPI), shared by
   * checkbox handlers and the fatal-flaw preset.
   */
  async setLayerEnabled(name, on) {
    const config = LAYER_CONFIG[name];
    if (!config) return false;

    const checkbox = document.getElementById(`layer-${name}`);
    const item = checkbox?.closest('.layer-item');

    if (on) {
      if (config.lazy && !this.layerManager.isLayerLoaded(name)) {
        if (checkbox) checkbox.disabled = true;
        item?.classList.add('loading');
        try {
          const ok = await this.layerManager.loadLayerOnDemand(name);
          if (!ok) {
            if (checkbox) checkbox.checked = false;
            this.setDataStatus(
              `Could not load ${config.sidebarLabel || name}. Try again or check your connection.`,
              'error'
            );
            return false;
          }
          this.setDataStatus(null);
        } finally {
          if (checkbox) checkbox.disabled = false;
          item?.classList.remove('loading');
        }
      }
      if (checkbox) checkbox.checked = true;
      this.layerManager.setLayerVisibility(name, true);
      if (this.layerManager.layers[name]) {
        this.layerManager.layers[name].visible = true;
      }
      await this.updateVectorLegend(name, true);
      return true;
    }

    if (checkbox) checkbox.checked = false;
    this.layerManager.setLayerVisibility(name, false);
    await this.updateVectorLegend(name, false);
    return true;
  }

  applyFatalFlawMask() {
    FATAL_FLAW_PRESET_LAYERS.forEach((name) => {
      Object.entries(FATAL_FLAW_MASK_PAINT).forEach(([property, value]) => {
        this.layerManager.setPaintProperty(name, property, value);
      });
    });
  }

  clearFatalFlawMask() {
    FATAL_FLAW_PRESET_LAYERS.forEach((name) => {
      this.layerManager.clearPaintOverrides(name);
    });
  }

  /** Restrict land-use layer to hard-exclusion kinds (public water supplies). */
  ensureFatalFlawLandUseFilter() {
    const landUseFeatures = this.layerManager.getLoadedFeatures('geoatlasLandUse');
    if (!landUseFeatures.length) {
      this.enabledLandUseKinds = [...FATAL_FLAW_LAND_USE_KINDS];
      this.applyLandUseKindVisibility();
      return;
    }
    const present = new Set(
      landUseFeatures.map((f) => f.properties?.landUseKind).filter(Boolean)
    );
    this.enabledLandUseKinds = FATAL_FLAW_LAND_USE_KINDS.filter((k) => present.has(k));
    if (!this.enabledLandUseKinds.length) {
      // Still apply filter so other land-use kinds stay hidden if bake has none.
      this.enabledLandUseKinds = [...FATAL_FLAW_LAND_USE_KINDS];
    }
    this.applyLandUseKindVisibility();
  }

  async applyFatalFlawPreset(active) {
    this._fatalFlawApplying = true;
    try {
      if (active) {
        this.expandRightsGroup();
        const results = await Promise.all(
          FATAL_FLAW_PRESET_LAYERS.map((name) => this.setLayerEnabled(name, true))
        );
        if (results.some((ok) => !ok)) {
          this.fatalFlawPresetActive = false;
          await Promise.all(
            FATAL_FLAW_PRESET_LAYERS.map((name) => this.setLayerEnabled(name, false))
          );
          this.clearFatalFlawMask();
          this.refreshKpiBar();
          return;
        }
        this.ensureFatalFlawLandUseFilter();
        this.fatalFlawPresetActive = true;
        this.applyFatalFlawMask();
        for (const name of FATAL_FLAW_PRESET_LAYERS) {
          await this.updateVectorLegend(name, true);
        }
      } else {
        this.fatalFlawPresetActive = false;
        this.clearFatalFlawMask();
        await Promise.all(
          FATAL_FLAW_PRESET_LAYERS.map((name) => this.setLayerEnabled(name, false))
        );
      }
      this.refreshKpiBar();
    } finally {
      this._fatalFlawApplying = false;
      this.syncFatalFlawUi();
    }
  }

  /**
   * If the user manually toggles a preset layer while hard exclusions is on,
   * drop preset mode and restore normal paints (leave layers as the user set them).
   */
  onFatalFlawLayerManualChange(name, checked) {
    if (this._fatalFlawApplying || !this.fatalFlawPresetActive) return;
    if (!FATAL_FLAW_PRESET_LAYERS.includes(name)) return;

    this.fatalFlawPresetActive = false;
    this.clearFatalFlawMask();
    this.syncFatalFlawUi();
    FATAL_FLAW_PRESET_LAYERS.forEach((layerName) => {
      const cb = document.getElementById(`layer-${layerName}`);
      if (cb?.checked) this.updateVectorLegend(layerName, true);
    });
    if (!checked) this.updateVectorLegend(name, false);
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
    const primaryOnly = modsUsesPrimaryOnlyFilter(resolved);
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

  /** Keep list + KPI in sync with MODS filters; KPI also listens to map move. */
  syncOccurrenceBrowser() {
    if (!this.occurrenceBrowser) return;

    const all = this.layerManager.getLoadedFeatures('modsOccurrences');
    const value = this.currentMODSPickerValue;
    const resolved = resolveMODSCommodities(value);
    const primaryOnly = modsUsesPrimaryOnlyFilter(resolved);
    const browser = this.occurrenceBrowser.getFilterState();

    const commodityScoped = filterMODSFeatures(all, {
      pickerCommodities: resolved,
      enabledCommodities: this.enabledCommodities,
      primaryOnly,
      statuses: new Set(),
      query: ''
    });

    const filtered = commodityScoped.filter((f) =>
      featureMatchesBrowserFilters(f, {
        statuses: browser.statuses,
        query: browser.query
      })
    );

    this._modsFilteredCache = filtered;

    let inViewCount = null;
    if (this.map && this.isLayerOn('modsOccurrences')) {
      const b = this.map.getBounds();
      const bounds = {
        west: b.getWest(),
        south: b.getSouth(),
        east: b.getEast(),
        north: b.getNorth()
      };
      inViewCount = filtered.filter((f) => featureIntersectsBounds(f, bounds)).length;
    }

    this.occurrenceBrowser.update(commodityScoped, filtered, { inViewCount });
    this.refreshKpiBar();
  }

  bindKpiMapEvents() {
    if (!this.map) return;
    const schedule = () => this.scheduleKpiRefresh();
    this.map.on('moveend', schedule);
    this.map.on('zoomend', schedule);
  }

  scheduleKpiRefresh() {
    clearTimeout(this._kpiTimer);
    this._kpiTimer = setTimeout(() => this.refreshKpiBar(true), 120);
  }

  isLayerOn(name) {
    const state = this.layerManager?.layers?.[name];
    if (state && typeof state.visible === 'boolean') return state.visible;
    const cb = document.getElementById(`layer-${name}`);
    if (cb) return cb.checked;
    return Boolean(LAYER_CONFIG[name]?.visible);
  }

  isWmsOn(name) {
    const key = `wms-${name}`;
    const state = this.layerManager?.layers?.[key];
    if (state && typeof state.visible === 'boolean') return state.visible;
    const cb = document.getElementById(`wms-${name}`);
    if (cb) return cb.checked;
    return Boolean(WMS_CONFIG[name]?.visible);
  }

  countLayersOn() {
    let n = 0;
    Object.keys(LAYER_CONFIG).forEach((name) => {
      if (this.isLayerOn(name)) n += 1;
    });
    Object.keys(WMS_CONFIG).forEach((name) => {
      if (this.isWmsOn(name)) n += 1;
    });
    return n;
  }

  /**
   * @param {boolean} [fromMapMove] when true, also refresh occurrence list in-view hint
   */
  refreshKpiBar(fromMapMove = false) {
    if (!this.kpiBar) return;

    if (fromMapMove && this.occurrenceBrowser && this._modsFilteredCache) {
      let inViewCount = null;
      if (this.map && this.isLayerOn('modsOccurrences')) {
        const b = this.map.getBounds();
        const bounds = {
          west: b.getWest(),
          south: b.getSouth(),
          east: b.getEast(),
          north: b.getNorth()
        };
        inViewCount = this._modsFilteredCache.filter((f) =>
          featureIntersectsBounds(f, bounds)
        ).length;
      }
      this.occurrenceBrowser.update(
        this.occurrenceBrowser.commodityScoped,
        this.occurrenceBrowser.filtered,
        { inViewCount }
      );
    }

    const metrics = computeKpiMetrics({
      map: this.map,
      enabledIds: getKpiEnabledIds(),
      isLayerOn: (name) => this.isLayerOn(name),
      getFeatures: (name) => this.layerManager.getLoadedFeatures(name),
      modsFiltered: this._modsFilteredCache || [],
      atrisEnabledTagIds: this.enabledAtrisClaims,
      landUseEnabledKinds: this.enabledLandUseKinds,
      layersOnCount: this.countLayersOn()
    });
    this.kpiBar.render(metrics);
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

    this.selectedPopup = new maplibregl.Popup({ closeButton: true, closeOnClick: true })
      .setLngLat([lon, lat])
      .setHTML(buildModsPopupSection(feature, { standalone: true }))
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

  /** Rebuilds the MODS legend card for the current commodity selection (runtime legend def — does not mutate LAYER_CONFIG). */
  updateMODSLegend(value) {
    const config = LAYER_CONFIG.modsOccurrences;
    const legendCommodities = resolveMODSLegendCommodities(value);
    const isMulti = legendCommodities.length > 1;

    const legendDef = {
      title: `MODS — ${modsCommodityPickerLabel(value)}`,
      shape: config.legendShape,
      note: config.legendNote,
      surfaceToggle: {
        label: 'Show occurrence density surfaces',
        checked: this.showMODSSurface,
        onChange: (checked) => {
          this.showMODSSurface = checked;
          if (checked) this.scheduleMODSSurfaceUpdate();
          else this.layerManager.setSurfaceVisibility('modsOccurrences', false);
        }
      },
      items: isMulti ? null : buildMODSLegendItems(value),
      commodityToggles: isMulti
        ? {
            commodities: legendCommodities.map((c) => ({
              value: c,
              label: c,
              color: resolveMODSCommodityColor(c)
            })),
            enabled: [...this.enabledCommodities],
            onChange: (commodity, checked) => this.setMODSCommodityEnabled(commodity, checked),
            onAllOn: () => this.setAllMODSCommoditiesEnabled(true),
            onAllOff: () => this.setAllMODSCommoditiesEnabled(false)
          }
        : null
    };

    const checkbox = document.getElementById('layer-modsOccurrences');
    const visible = checkbox ? checkbox.checked : config.visible;

    this.legendPanel.hideLegend('layer-modsOccurrences');
    if (visible) {
      this.legendPanel.setLayerLegend('layer-modsOccurrences', true, legendDef);
    }
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
    const key = `layer-${name}`;

    // ArcGIS classification legends (e.g. GeoAtlas bedrock) — fetch async like WMS.
    if (config.legendJsonUrl) {
      this.updateVectorArcGISLegend(name, visible);
      return;
    }

    if (name === 'modsOccurrences') {
      this.updateMODSLegend(this.currentMODSPickerValue);
      return;
    }

    // Claims / tenure: color swatches for types actually present in loaded data.
    let items = config.legend;
    let note = config.legendNote;
    let commodityToggles = null;
    const fatalMask =
      this.fatalFlawPresetActive && FATAL_FLAW_PRESET_LAYERS.includes(name);

    if (name === 'geoatlasClaims') {
      this.updateClaimsLegend(visible);
      return;
    } else if (name === 'geoatlasTenure') {
      items = buildTenureLegendFromFeatures(this.layerManager.getLoadedFeatures(name));
      note =
        'Mineral-rights types only. Parks & protected areas are on Protected & conserved (not duplicated here).';
    } else if (name === 'geoatlasCpcad') {
      items = fatalMask
        ? [{ label: 'Hard exclusion (protected / conserved)', color: FATAL_FLAW_MASK_PAINT['fill-color'] }]
        : buildCpcadLegendFromFeatures(this.layerManager.getLoadedFeatures(name));
      note = fatalMask
        ? 'Hard-exclusion mode: parks and conserved areas (tier-1 blocker).'
        : 'Protected-area types present in the Labrador CPCAD bake (GeoAtlas Land_Use/4).';
    } else if (name === 'geoatlasLandUse') {
      this.updateLandUseLegend(visible);
      return;
    } else if (name === 'atrisLandClaims') {
      this.updateAtrisLegend(visible);
      return;
    } else if (name === 'inuitNunatsiavut') {
      items = NUNATSIAVUT_LEGEND_ITEMS;
      note = 'Labrador Inuit Settlement Area (Inuit Nunangat). CIRNAC/ISC; boundaries approximate. Consultation / governance context — not a hard exclusion.';
    }

    // Allow rebuild when lazy data arrives after first toggle.
    this.legendPanel.hideLegend(key);
    this.legendPanel.setLayerLegend(key, visible, {
      title: config.legendTitle,
      items,
      shape: config.legendShape === 'icon' && !items?.[0]?.icon ? 'fill' : config.legendShape,
      note,
      surfaceToggle: null,
      commodityToggles
    });
  }

  /** Claims legend: expiry bands (2.1c) with optional band filter; STATUS remains in popup. */
  updateClaimsLegend(visible) {
    const name = 'geoatlasClaims';
    const config = LAYER_CONFIG[name];
    const key = `layer-${name}`;
    if (!visible) {
      this.legendPanel.hideLegend(key);
      return;
    }

    const bands = buildClaimsExpiryBandToggles();
    if (this.enabledClaimExpiryBands == null) {
      this.enabledClaimExpiryBands = bands.map((b) => b.value);
    }

    this.applyClaimsExpiryBandVisibility();

    const commodityToggles = {
      commodities: bands,
      enabled: [...this.enabledClaimExpiryBands],
      onChange: (band, checked) => this.setClaimExpiryBandEnabled(band, checked),
      onAllOn: () => this.setAllClaimExpiryBandsEnabled(true),
      onAllOff: () => this.setAllClaimExpiryBandsEnabled(false)
    };

    this.legendPanel.hideLegend(key);
    this.legendPanel.setLayerLegend(key, true, {
      title: config.legendTitle,
      items: buildClaimsExpiryLegendItems(),
      shape: 'fill',
      note:
        'Fill emphasizes expiry (≤90 / ≤180 days). Active/unknown keep STATUS colors. Registry STATUS still in popup. Bake refreshes every 3 months — not live.',
      commodityToggles
    });
  }

  applyClaimsExpiryBandVisibility() {
    const enabled = this.enabledClaimExpiryBands || [];
    this.layerManager.setLayerFilter('geoatlasClaims', buildClaimsExpiryBandFilter(enabled));
    this.refreshKpiBar();
  }

  setClaimExpiryBandEnabled(band, checked) {
    const current = this.enabledClaimExpiryBands || [];
    if (checked) {
      if (!current.includes(band)) this.enabledClaimExpiryBands = [...current, band];
    } else {
      this.enabledClaimExpiryBands = current.filter((id) => id !== band);
    }
    this.applyClaimsExpiryBandVisibility();
    this.updateClaimsLegend(true);
  }

  setAllClaimExpiryBandsEnabled(enabled) {
    const bands = buildClaimsExpiryBandToggles();
    this.enabledClaimExpiryBands = enabled ? bands.map((b) => b.value) : [];
    this.applyClaimsExpiryBandVisibility();
    this.updateClaimsLegend(true);
  }

  /** ATRIS legend: per-claim checklist so overlapping polygons can be toggled independently. */
  updateAtrisLegend(visible) {
    const name = 'atrisLandClaims';
    const config = LAYER_CONFIG[name];
    const key = `layer-${name}`;
    if (!visible) {
      this.legendPanel.hideLegend(key);
      return;
    }

    const features = this.layerManager.getLoadedFeatures(name);
    const claims = buildAtrisClaimTogglesFromFeatures(features);
    const available = new Set(claims.map((c) => c.value));

    if (this.enabledAtrisClaims == null) {
      this.enabledAtrisClaims = claims.map((c) => c.value);
    } else {
      this.enabledAtrisClaims = this.enabledAtrisClaims.filter((id) => available.has(id));
    }

    this.applyAtrisClaimVisibility();

    const commodityToggles = {
      commodities: claims,
      enabled: [...this.enabledAtrisClaims],
      onChange: (tagId, checked) => this.setAtrisClaimEnabled(tagId, checked),
      onAllOn: () => this.setAllAtrisClaimsEnabled(true),
      onAllOff: () => this.setAllAtrisClaimsEnabled(false)
    };

    this.legendPanel.hideLegend(key);
    this.legendPanel.setLayerLegend(key, true, {
      title: config.legendTitle,
      items: null,
      shape: 'fill',
      note:
        'Asserted comprehensive land claims — consultation / permitting context, not a mineral licence or hard exclusion.',
      commodityToggles
    });
  }

  applyAtrisClaimVisibility() {
    const enabled = this.enabledAtrisClaims || [];
    this.layerManager.setLayerFilter('atrisLandClaims', buildAtrisEnabledFilter(enabled));
    this.refreshKpiBar();
  }

  setAtrisClaimEnabled(tagId, checked) {
    const current = this.enabledAtrisClaims || [];
    if (checked) {
      if (!current.includes(tagId)) {
        this.enabledAtrisClaims = [...current, tagId];
      }
    } else {
      this.enabledAtrisClaims = current.filter((id) => id !== tagId);
    }
    this.applyAtrisClaimVisibility();
  }

  setAllAtrisClaimsEnabled(enabled) {
    const claims = buildAtrisClaimTogglesFromFeatures(
      this.layerManager.getLoadedFeatures('atrisLandClaims')
    );
    this.enabledAtrisClaims = enabled ? claims.map((c) => c.value) : [];
    this.applyAtrisClaimVisibility();
    this.updateAtrisLegend(true);
  }

  /** Land-use legend: per-kind checklist so overlapping constraint types can be toggled. */
  updateLandUseLegend(visible) {
    const name = 'geoatlasLandUse';
    const config = LAYER_CONFIG[name];
    const key = `layer-${name}`;
    if (!visible) {
      this.legendPanel.hideLegend(key);
      return;
    }

    const features = this.layerManager.getLoadedFeatures(name);
    const kinds = buildLandUseKindTogglesFromFeatures(features);
    const available = new Set(kinds.map((k) => k.value));

    if (this.enabledLandUseKinds == null) {
      this.enabledLandUseKinds = kinds.map((k) => k.value);
    } else {
      this.enabledLandUseKinds = this.enabledLandUseKinds.filter((id) => available.has(id));
    }

    this.applyLandUseKindVisibility();

    const commodityToggles = {
      commodities: kinds,
      enabled: [...this.enabledLandUseKinds],
      onChange: (kind, checked) => this.setLandUseKindEnabled(kind, checked),
      onAllOn: () => this.setAllLandUseKindsEnabled(true),
      onAllOff: () => this.setAllLandUseKindsEnabled(false)
    };

    this.legendPanel.hideLegend(key);
    this.legendPanel.setLayerLegend(key, true, {
      title: config.legendTitle,
      items: this.fatalFlawPresetActive
        ? [{ label: 'Hard exclusion (protected water supplies)', color: FATAL_FLAW_MASK_PAINT['fill-color'] }]
        : null,
      shape: 'fill',
      note: this.fatalFlawPresetActive
        ? 'Hard-exclusion mode: public water-supply buffers only (other land-use kinds hidden). Indigenous lands are not included.'
        : config.legendNote,
      commodityToggles
    });
  }

  applyLandUseKindVisibility() {
    const enabled = this.enabledLandUseKinds || [];
    this.layerManager.setLayerFilter('geoatlasLandUse', buildLandUseEnabledFilter(enabled));
    this.refreshKpiBar();
  }

  setLandUseKindEnabled(kind, checked) {
    const current = this.enabledLandUseKinds || [];
    if (checked) {
      if (!current.includes(kind)) {
        this.enabledLandUseKinds = [...current, kind];
      }
    } else {
      this.enabledLandUseKinds = current.filter((id) => id !== kind);
    }
    this.exitHardExclusionsIfLandUseDiverged();
    this.applyLandUseKindVisibility();
  }

  setAllLandUseKindsEnabled(enabled) {
    const kinds = buildLandUseKindTogglesFromFeatures(
      this.layerManager.getLoadedFeatures('geoatlasLandUse')
    );
    this.enabledLandUseKinds = enabled ? kinds.map((k) => k.value) : [];
    this.exitHardExclusionsIfLandUseDiverged();
    this.applyLandUseKindVisibility();
    this.updateLandUseLegend(true);
  }

  /** Legend kind edits that leave the water-supply-only set exit hard-exclusion mode. */
  exitHardExclusionsIfLandUseDiverged() {
    if (!this.fatalFlawPresetActive || this._fatalFlawApplying) return;
    const enabled = [...(this.enabledLandUseKinds || [])].sort().join(',');
    const expected = [...FATAL_FLAW_LAND_USE_KINDS].sort().join(',');
    if (enabled === expected) return;

    this.fatalFlawPresetActive = false;
    this.clearFatalFlawMask();
    this.syncFatalFlawUi();
    FATAL_FLAW_PRESET_LAYERS.forEach((layerName) => {
      const cb = document.getElementById(`layer-${layerName}`);
      if (cb?.checked) this.updateVectorLegend(layerName, true);
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

      checkbox.addEventListener('change', async (e) => {
        const checked = e.target.checked;
        if (checked && name === 'geoatlasBedrock') {
          await this.enforceBedrockMutualExclusion('provincial');
        }
        await this.setLayerEnabled(name, checked);
        this.onFatalFlawLayerManualChange(name, checked);
        this.refreshKpiBar();
      });
    });

    Object.keys(WMS_CONFIG).forEach((name) => {
      const checkbox = document.getElementById(`wms-${name}`);
      if (!checkbox) return;

      const item = checkbox.closest('.layer-item');

      checkbox.addEventListener('change', async (e) => {
        const checked = e.target.checked;
        if (checked && name === 'bedrock') {
          await this.enforceBedrockMutualExclusion('national');
        }
        checkbox.disabled = true;
        item?.classList.add('loading');
        try {
          const ok = await this.layerManager.setWMSLayerVisibility(name, checked);
          if (checked && !ok) {
            checkbox.checked = false;
            this.setDataStatus(
              `Could not load ${WMS_CONFIG[name]?.sidebarLabel || name}. Try again or check your connection.`,
              'error'
            );
            await this.updateWMSLegend(name, false);
            this.refreshKpiBar();
            return;
          }
          if (checked) this.setDataStatus(null);
          await this.updateWMSLegend(name, checkbox.checked);
          this.refreshKpiBar();
        } finally {
          checkbox.disabled = false;
          item?.classList.remove('loading');
        }
      });
    });
  }

  /**
   * Phase 1.4 — only one bedrock layer at a time (provincial 1:1M vs national GSC).
   * @param {'provincial'|'national'} enabling
   */
  async enforceBedrockMutualExclusion(enabling) {
    if (this._bedrockExcluding) return;
    this._bedrockExcluding = true;
    try {
      if (enabling === 'provincial') {
        const wmsCb = document.getElementById('wms-bedrock');
        if (wmsCb?.checked) {
          wmsCb.checked = false;
          await this.layerManager.setWMSLayerVisibility('bedrock', false);
          await this.updateWMSLegend('bedrock', false);
        }
      } else {
        const provCb = document.getElementById('layer-geoatlasBedrock');
        if (provCb?.checked) {
          await this.setLayerEnabled('geoatlasBedrock', false);
        }
      }
      this.setDataStatus(
        'Only one bedrock layer at a time — prefer provincial when zoomed in, national when regional.',
        'info'
      );
    } finally {
      this._bedrockExcluding = false;
    }
  }

  bindInteractions() {
    this.map.on('click', (e) => this.openCombinedPopup(e));

    POPUP_LAYER_IDS.forEach((layerId) => {
      this.map.on('mouseenter', layerId, () => {
        this.map.getCanvas().style.cursor = 'pointer';
      });
      this.map.on('mouseleave', layerId, () => {
        this.map.getCanvas().style.cursor = '';
      });
    });
  }

  /** One popup for everything under the click (points + polygons), not one card per layer. */
  openCombinedPopup(e) {
    const layers = POPUP_LAYER_IDS.filter((id) => this.map.getLayer(id));
    if (!layers.length) return;

    const hits = this.map.queryRenderedFeatures(e.point, { layers });
    if (!hits.length) return;

    // One feature per layer id (topmost), preserve priority order in POPUP_LAYER_IDS.
    const byLayer = new Map();
    for (const feature of hits) {
      const layerId = feature.layer?.id;
      if (!layerId || byLayer.has(layerId)) continue;
      byLayer.set(layerId, feature);
    }

    const sections = [];
    for (const layerId of POPUP_LAYER_IDS) {
      const feature = byLayer.get(layerId);
      if (!feature) continue;
      const html = buildPopupSection(layerId, feature);
      if (html) sections.push(html);
    }
    if (!sections.length) return;

    const modsFeature = byLayer.get('mods-layer');
    if (modsFeature?.properties?.NMINO && this.occurrenceBrowser) {
      this.occurrenceBrowser.selectByNmino(modsFeature.properties.NMINO);
    }

    const body =
      sections.length === 1
        ? sections[0]
        : `<div class="popup-stacked">${sections.join('')}</div>`;

    this.selectedPopup?.remove();
    this.selectedPopup = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: true,
      maxWidth: sections.length > 1 ? '360px' : '300px',
      className: sections.length > 1 ? 'popup-multi' : ''
    })
      .setLngLat(e.lngLat)
      .setHTML(`<div class="popup-content">${body}</div>`)
      .addTo(this.map);
  }
}

export default MineralsMapApp;
