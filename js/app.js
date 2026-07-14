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
  SIGNAL_RASTER_KEYS,
  buildSignalsLegendRamp,
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
import {
  combineMODSFilters,
  filterMODSFeatures,
  featureMatchesBrowserFilters,
  modsUsesPrimaryOnlyFilter
} from './config/modsFilters.js';
import { buildSurveyFootprintFilter } from './config/surveyFootprints.js';
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
import { computeNearestInfraDistances, ensureInfraDistanceData } from './modules/infraDistance.js';
import WelcomeModal from './modules/WelcomeModal.js';
import { buildExportPackage, downloadBlob } from './modules/exportPackage.js';
import { readViewState, writeViewState, buildShareUrl } from './modules/viewState.js';
import { track, PlausibleEvents } from './modules/analytics.js';

const POPUP_LAYER_IDS = [
  'mods-layer',
  'infra-mines-layer',
  'infra-processing-layer',
  'infra-exploration-layer',
  'infra-development-layer',
  'infra-ports-layer',
  'infra-airports-layer',
  'infra-generation-layer',
  'infra-communities-layer',
  'geoatlas-transmission-layer',
  'geoatlas-rail-layer',
  'geoatlas-roads-layer',
  'geoatlas-resource-roads-layer',
  'geoatlas-municipal-fill',
  'geoatlas-claims-fill',
  'geoatlas-tenure-fill',
  'inuit-nunatsiavut-fill',
  'atris-claims-fill',
  'geoatlas-cpcad-fill',
  'geoatlas-landuse-fill',
  'geoatlas-survey-footprints-fill',
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
    /** Phase 4.1 — desaturate signal rasters (aeromag / 1VD / gravity). */
    this.signalsGrayscale = false;
    /** Stage B0 soft launch — welcome modal, shareable view state. */
    this.welcomeModal = null;
    this._viewStateTimer = null;
    this._bootStatusCleared = false;
    this.init();
  }

  async init() {
    const map = await this.mapBase.init();

    this.layerManager = new LayerManager(map);
    this.mapBase.onStyleChange = () => {
      this.layerManager.refreshLayers();
      this.applyMODSCommodityVisibility();
    };

    this.setDataStatus('Loading occurrences…', 'info');
    await this.layerManager.loadAllLayers().then((result) => {
      if (result?.failed?.length) {
        this.setDataStatus(
          `Failed to load: ${result.failed.join(', ')}. Check network or try refreshing.`,
          'error'
        );
      } else {
        this.setDataStatus(null);
      }
      this._bootStatusCleared = true;
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
      onExportPackage: (formats) => this.exportPackage(formats),
      onCopyShareLink: () => this.copyShareLink()
    });
    document.getElementById('settings-open')?.addEventListener('click', () => {
      track(PlausibleEvents.SETTINGS_OPEN);
      this.settingsPanel?.show();
    });
    document.getElementById('settings-open-sidebar')?.addEventListener('click', () => {
      this.mobileChrome?.close({ silent: true });
      track(PlausibleEvents.SETTINGS_OPEN, { from: 'sidebar' });
      this.settingsPanel?.show();
    });
    document.getElementById('about-open')?.addEventListener('click', () => {
      track(PlausibleEvents.SETTINGS_OPEN, { section: 'about' });
      this.settingsPanel?.show({ section: 'about', expandSection: true });
    });

    this.mobileChrome.init();
    this.renderLayerSidebar();
    this.bindLayerControls();
    // Applies the default commodity filter/color + legend before the initial
    // legend sync below, so MODS renders its default (critical-minerals
    // preset) legend on the first paint rather than a generic one that
    // immediately gets replaced.
    this.bindMODSCommodityPicker();
    this.bindSurveyFootprintPicker();
    this.bindFatalFlawPreset();
    this.bindInteractions();
    this.bindKpiMapEvents();
    this.syncInitialLegends();
    this.refreshKpiBar();
    // Warm nearest-infra distance cache (Phase 3.4) without blocking UI.
    ensureInfraDistanceData().catch(() => {});

    // Stage B0 soft launch — restore a shared view (if any) before wiring
    // sync, then welcome first-time visitors once the map has settled.
    this.welcomeModal = new WelcomeModal({
      onExplore: () => {},
      onOpenAbout: () => this.settingsPanel?.show({ section: 'about', expandSection: true }),
      onOpenWaitlist: () => this.settingsPanel?.show({ section: 'updates', expandSection: true })
    });
    await this.applyViewState(readViewState());
    this.bindViewStateSync();
    requestAnimationFrame(() => this.welcomeModal?.maybeShow());
  }

  /** Above this feature count, confirm before building the export package (can be slow/large). */
  static EXPORT_FEATURE_WARN_THRESHOLD = 25000;

  /**
   * Stage B0 export: every checked + loaded vector/raster layer, filtered to
   * the current map view (and MODS/claims filters), packaged as a ZIP by
   * {@link buildExportPackage}.
   * @param {Record<string, boolean>} formats
   */
  async exportPackage(formats = {}) {
    const bounds = this.map?.getBounds?.();
    const vectorLayers = [];
    const rasterLayers = [];
    const skippedUnloaded = [];

    const value = this.currentMODSPickerValue;
    const resolved = resolveMODSCommodities(value);
    const primaryOnly = modsUsesPrimaryOnlyFilter(resolved);
    const browser = this.occurrenceBrowser?.getFilterState() || { statuses: new Set(), query: '' };

    Object.entries(LAYER_CONFIG).forEach(([key, config]) => {
      const checkbox = document.getElementById(`layer-${key}`);
      if (!checkbox?.checked) return;

      let features = this.layerManager.getLoadedFeatures(key);
      if (!features.length) {
        skippedUnloaded.push(key);
        return;
      }

      if (key === 'modsOccurrences') {
        features = filterMODSFeatures(features, {
          pickerCommodities: resolved,
          enabledCommodities: this.enabledCommodities?.length
            ? this.enabledCommodities
            : resolveMODSLegendCommodities(value),
          primaryOnly,
          statuses: browser.statuses,
          query: browser.query
        });
      } else if (key === 'geoatlasClaims') {
        const bands = this.enabledClaimExpiryBands;
        if (bands?.length) {
          features = features.filter((f) => bands.includes(f.properties?.expiryBand));
        }
      }

      const inView = bounds ? features.filter((f) => featureIntersectsBounds(f, bounds)) : features;
      if (!inView.length) return;

      vectorLayers.push({
        id: key,
        label: config.sidebarLabel || key,
        features: inView,
        source: config.dataUrl || config.paginatedQuery?.url || null
      });
    });

    Object.entries(WMS_CONFIG).forEach(([key, config]) => {
      const checkbox = document.getElementById(`wms-${key}`);
      if (!checkbox?.checked) return;
      if (!config.imageUrl || !config.bounds) return;

      const imageUrl = config.cacheVersion
        ? `${config.imageUrl}?v=${encodeURIComponent(config.cacheVersion)}`
        : config.imageUrl;
      rasterLayers.push({
        id: key,
        label: config.sidebarLabel || config.label || key,
        imageUrl,
        bounds: config.bounds
      });
    });

    if (!vectorLayers.length && !rasterLayers.length) {
      this.setDataStatus(
        'Nothing to export — turn on a layer that has loaded data in the current view.',
        'error'
      );
      return;
    }

    const totalFeatures = vectorLayers.reduce((sum, l) => sum + l.features.length, 0);
    if (totalFeatures > MineralsMapApp.EXPORT_FEATURE_WARN_THRESHOLD) {
      const proceed = window.confirm(
        `This export includes ${totalFeatures.toLocaleString()} features and may take a while to build. Continue?`
      );
      if (!proceed) {
        this.setDataStatus('Export cancelled.', 'info');
        return;
      }
    }

    this.setDataStatus('Building export package…', 'info');
    try {
      const { filename, blob, notes } = await buildExportPackage({
        bounds,
        vectorLayers,
        rasterLayers,
        formats,
        meta: {
          filters: {
            mods: value,
            statuses: [...browser.statuses],
            query: browser.query || undefined,
            fatalFlaw: this.fatalFlawPresetActive,
            skippedUnloaded: skippedUnloaded.length ? skippedUnloaded : undefined
          }
        }
      });
      downloadBlob(blob, filename);
      track(PlausibleEvents.EXPORT_PACKAGE, formats);
      this.setDataStatus(
        `Exported ${totalFeatures.toLocaleString()} feature(s) across ${
          vectorLayers.length + rasterLayers.length
        } layer(s).${notes?.length ? ' See README for notes.' : ''}`,
        'info'
      );
    } catch (err) {
      this.setDataStatus(`Export failed: ${err?.message || err}`, 'error');
      throw err;
    }
  }

  /** Fallback clipboard copy for browsers/contexts without navigator.clipboard (e.g. non-HTTPS). */
  copyToClipboardFallback(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
    } finally {
      textarea.remove();
    }
  }

  /** Copies a link that restores the current layers/filters/map position (see viewState.js). */
  async copyShareLink() {
    const state = this.collectViewState();
    const url = buildShareUrl(state);
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        track(PlausibleEvents.VIEW_SHARE);
        return url;
      } catch {
        // Fall through to the legacy textarea copy below.
      }
    }
    this.copyToClipboardFallback(url);
    track(PlausibleEvents.VIEW_SHARE);
    return url;
  }

  /** Snapshot of everything `applyViewState` can restore, for the URL hash / share link. */
  collectViewState() {
    const center = this.map?.getCenter?.();
    const browser = this.occurrenceBrowser?.getFilterState() || { statuses: new Set(), query: '' };

    const layers = [];
    Object.keys(LAYER_CONFIG).forEach((name) => {
      if (document.getElementById(`layer-${name}`)?.checked) layers.push(name);
    });
    Object.keys(WMS_CONFIG).forEach((name) => {
      if (document.getElementById(`wms-${name}`)?.checked) layers.push(`wms:${name}`);
    });

    return {
      zoom: this.map?.getZoom?.(),
      lat: center?.lat,
      lon: center?.lng,
      layers,
      mods: this.currentMODSPickerValue || undefined,
      statuses: [...browser.statuses],
      q: browser.query || undefined,
      fatalFlaw: this.fatalFlawPresetActive
    };
  }

  /**
   * Restores a view state (from the URL hash or a share link) — map position,
   * layer checkboxes, MODS picker, status filters/search, and hard exclusions.
   * Reuses the same checkbox change events the sidebar UI fires, so lazy
   * loading / mutual-exclusion / legend logic stays in one place.
   * @param {import('./modules/viewState.js').ViewState | null} state
   */
  async applyViewState(state) {
    if (!state) return;

    if (this.map && (state.zoom != null || state.lat != null || state.lon != null)) {
      const center = this.map.getCenter();
      this.map.jumpTo({
        center: [state.lon ?? center.lng, state.lat ?? center.lat],
        zoom: state.zoom ?? this.map.getZoom()
      });
    }

    if (state.mods) {
      const picker = document.getElementById('modsOccurrences-commodity-picker');
      if (picker && picker.value !== state.mods) {
        picker.value = state.mods;
        picker.dispatchEvent(new Event('change'));
      }
    }

    if (this.occurrenceBrowser) {
      if (state.statuses?.length) {
        this.occurrenceBrowser.statuses = new Set(state.statuses);
        this.occurrenceBrowser.renderStatusToggles();
      }
      if (state.q) {
        this.occurrenceBrowser.query = state.q;
        if (this.occurrenceBrowser.els.search) this.occurrenceBrowser.els.search.value = state.q;
      }
      if (state.statuses?.length || state.q) this.applyMODSCommodityVisibility();
    }

    if (state.layers?.length) {
      for (const id of state.layers) {
        const isWms = id.startsWith('wms:');
        const checkbox = document.getElementById(isWms ? `wms-${id.slice(4)}` : `layer-${id}`);
        if (checkbox && !checkbox.checked) {
          checkbox.checked = true;
          checkbox.dispatchEvent(new Event('change'));
        }
      }
    }

    if (state.fatalFlaw) {
      const checkbox = document.getElementById('fatal-flaw-preset-toggle');
      if (checkbox && !checkbox.checked) {
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change'));
      }
    }
  }

  /** Debounced URL-hash sync so the current view stays shareable/bookmarkable. */
  bindViewStateSync() {
    const scheduleWrite = () => {
      clearTimeout(this._viewStateTimer);
      this._viewStateTimer = setTimeout(() => {
        writeViewState(this.collectViewState());
      }, 400);
    };

    this.map?.on('moveend', scheduleWrite);
    document.getElementById('layer-groups')?.addEventListener('change', (e) => {
      if (e.target?.matches?.('input[type="checkbox"]')) scheduleWrite();
    });
    document.getElementById('occ-status-filters')?.addEventListener('click', scheduleWrite);
    document.getElementById('occ-search')?.addEventListener('input', scheduleWrite);
    document.getElementById('fatal-flaw-preset-toggle')?.addEventListener('change', scheduleWrite);
    document.getElementById('modsOccurrences-commodity-picker')?.addEventListener('change', scheduleWrite);
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
          if (type === 'vector' && config.surveyFilterPicker) {
            list.appendChild(
              this.buildCommodityPicker(name, config.surveyFilterPicker, 'type-picker')
            );
          }
          if (type === 'vector' && config.surveyDigitalPicker) {
            list.appendChild(
              this.buildCommodityPicker(name, config.surveyDigitalPicker, 'digital-picker')
            );
          }
        });

        body.appendChild(list);
      });

      if (groupId === 'signals') {
        body.appendChild(this.buildSignalsOpacityControl());
      }

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

  /** Phase 4.1 — shared opacity + grayscale controls for signal rasters. */
  buildSignalsOpacityControl() {
    const wrap = document.createElement('div');
    wrap.className = 'signals-opacity-wrap';
    wrap.innerHTML = `
      <label class="signals-opacity-label" for="signals-raster-opacity">
        Raster opacity
        <span class="signals-opacity-value" id="signals-opacity-value">70%</span>
      </label>
      <input type="range" id="signals-raster-opacity" class="signals-opacity-range"
        min="15" max="100" step="5" value="70" />
      <label class="signals-grayscale-toggle" for="signals-grayscale">
        <input type="checkbox" id="signals-grayscale" />
        <span>Grayscale color mode</span>
      </label>
    `;
    const range = wrap.querySelector('#signals-raster-opacity');
    const valueEl = wrap.querySelector('#signals-opacity-value');
    const grayCb = wrap.querySelector('#signals-grayscale');
    grayCb.checked = this.signalsGrayscale;
    range.addEventListener('input', () => {
      const pct = Number(range.value);
      valueEl.textContent = `${pct}%`;
      const opacity = pct / 100;
      SIGNAL_RASTER_KEYS.forEach((name) => {
        if (WMS_CONFIG[name]) {
          this.layerManager.setWMSLayerOpacity(name, opacity);
        }
      });
    });
    grayCb.addEventListener('change', () => {
      this.signalsGrayscale = grayCb.checked;
      this.layerManager.setSignalRasterGrayscale(this.signalsGrayscale);
      this.refreshActiveSignalsLegends();
    });
    return wrap;
  }

  /** Refresh legend cards for any currently checked signal rasters (color ↔ gray). */
  refreshActiveSignalsLegends() {
    SIGNAL_RASTER_KEYS.forEach((name) => {
      const cb = document.getElementById(`wms-${name}`);
      if (cb?.checked) this.updateWMSLegend(name, true);
    });
  }

  /** Builds a sidebar `<select>` under a layer row (MODS commodity, survey type/digital, …). */
  buildCommodityPicker(name, pickerConfig, idSuffix = 'commodity-picker') {
    const wrap = document.createElement('div');
    wrap.className = 'commodity-picker-wrap';

    const select = document.createElement('select');
    select.id = `${name}-${idSuffix}`;
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
        if (active) track(PlausibleEvents.HARD_EXCLUSIONS_ON);
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
      if (name === 'surveyFootprints') {
        this.applySurveyFootprintFilters();
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

  /** Survey footprints: type (PARAMETERS family) + digital availability filters. */
  bindSurveyFootprintPicker() {
    const typePicker = document.getElementById('surveyFootprints-type-picker');
    const digitalPicker = document.getElementById('surveyFootprints-digital-picker');
    if (!typePicker && !digitalPicker) return;

    const onChange = () => this.applySurveyFootprintFilters();
    typePicker?.addEventListener('change', onChange);
    digitalPicker?.addEventListener('change', onChange);
    onChange();
  }

  applySurveyFootprintFilters() {
    const typeValue =
      document.getElementById('surveyFootprints-type-picker')?.value || 'all';
    const digitalValue =
      document.getElementById('surveyFootprints-digital-picker')?.value || 'all';
    this.layerManager.setLayerFilter(
      'surveyFootprints',
      buildSurveyFootprintFilter(typeValue, digitalValue)
    );
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

    const token = (this._popupToken = (this._popupToken || 0) + 1);
    this.selectedPopup = new maplibregl.Popup({ closeButton: true, closeOnClick: true })
      .setLngLat([lon, lat])
      .setHTML(buildModsPopupSection(feature, { standalone: true, distances: 'pending' }))
      .addTo(this.map);

    this.fillModsInfraDistances(feature, token, { standalone: true });
  }

  /**
   * Async Phase 3.4 distances into an open MODS popup (map click or list select).
   * @param {object} modsFeature
   * @param {number} token
   * @param {{ standalone?: boolean, rebuildStacked?: () => string }} opts
   */
  async fillModsInfraDistances(modsFeature, token, opts = {}) {
    let distances;
    try {
      distances = await computeNearestInfraDistances(modsFeature);
    } catch {
      distances = 'error';
    }
    if (token !== this._popupToken || !this.selectedPopup) return;

    if (opts.rebuildStacked) {
      this.selectedPopup.setHTML(opts.rebuildStacked(distances));
      return;
    }

    this.selectedPopup.setHTML(
      buildModsPopupSection(modsFeature, {
        standalone: Boolean(opts.standalone),
        distances
      })
    );
  }

  /** One popup for everything under the click (points + polygons), not one card per layer. */
  openCombinedPopup(e) {
    const layers = POPUP_LAYER_IDS.filter((id) => this.map.getLayer(id));
    if (!layers.length) return;

    // Query a small box around the click, not a single pixel, so thin line
    // layers (resource-access roads, transmission, rail) are easy to hit.
    const r = 6;
    const box = [
      [e.point.x - r, e.point.y - r],
      [e.point.x + r, e.point.y + r]
    ];
    const hits = this.map.queryRenderedFeatures(box, { layers });
    if (!hits.length) return;

    // One feature per layer id (topmost), preserve priority order in POPUP_LAYER_IDS.
    const byLayer = new Map();
    for (const feature of hits) {
      const layerId = feature.layer?.id;
      if (!layerId || byLayer.has(layerId)) continue;
      byLayer.set(layerId, feature);
    }

    const buildBody = (distances) => {
      const sections = [];
      for (const layerId of POPUP_LAYER_IDS) {
        const feature = byLayer.get(layerId);
        if (!feature) continue;
        const html = buildPopupSection(
          layerId,
          feature,
          layerId === 'mods-layer' ? { distances } : {}
        );
        if (html) sections.push(html);
      }
      if (!sections.length) return null;
      return sections.length === 1
        ? sections[0]
        : `<div class="popup-stacked">${sections.join('')}</div>`;
    };

    const pendingBody = buildBody(byLayer.has('mods-layer') ? 'pending' : null);
    if (!pendingBody) return;

    const modsFeature = byLayer.get('mods-layer');
    if (modsFeature?.properties?.NMINO && this.occurrenceBrowser) {
      this.occurrenceBrowser.selectByNmino(modsFeature.properties.NMINO);
    }

    const sectionCount = [...byLayer.keys()].filter((id) => POPUP_LAYER_IDS.includes(id)).length;
    const token = (this._popupToken = (this._popupToken || 0) + 1);

    this.selectedPopup?.remove();
    this.selectedPopup = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: true,
      maxWidth: sectionCount > 1 || modsFeature ? '360px' : '300px',
      className: sectionCount > 1 ? 'popup-multi' : ''
    })
      .setLngLat(e.lngLat)
      .setHTML(`<div class="popup-content">${pendingBody}</div>`)
      .addTo(this.map);

    if (modsFeature) {
      this.fillModsInfraDistances(modsFeature, token, {
        rebuildStacked: (distances) => {
          const body = buildBody(distances);
          return `<div class="popup-content">${body}</div>`;
        }
      });
    }
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

    // One combined Infrastructure card — items only for layers currently on.
    if (config.group === 'infrastructure') {
      this.updateInfrastructureLegend();
      return;
    }

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

  /**
   * Single Infrastructure legend card. Shows only symbols for layers that are
   * currently toggled on; hides the card when none are on. Default collapsed.
   */
  updateInfrastructureLegend() {
    const key = 'layer-infrastructure';
    const existing = this.legendPanel.cards[key];
    const keepCollapsed = existing ? existing.classList.contains('collapsed') : true;

    const active = Object.entries(LAYER_CONFIG).filter(([name, config]) => {
      if (config.group !== 'infrastructure') return false;
      const cb = document.getElementById(`layer-${name}`);
      return cb ? cb.checked : Boolean(config.visible);
    });

    this.legendPanel.hideLegend(key);
    // Drop any leftover per-layer infrastructure cards from earlier sessions.
    Object.keys(LAYER_CONFIG).forEach((name) => {
      if (LAYER_CONFIG[name].group === 'infrastructure') {
        this.legendPanel.hideLegend(`layer-${name}`);
      }
    });

    if (!active.length) return;

    const items = [];
    for (const [, config] of active) {
      const shape = config.legendShape === 'icon' ? 'circle' : config.legendShape || 'circle';
      for (const item of config.legend || []) {
        items.push({
          label: item.label,
          color: item.color,
          icon: item.icon,
          shape: item.icon ? undefined : shape
        });
      }
    }

    // Prefer a short shared note over stacking every layer note.
    const note =
      'HV transmission is GeoAtlas only (no distribution feeders). Facility sites are NRCan; ports/airports/generation/communities are curated Labrador points.';

    this.legendPanel.setLayerLegend(key, true, {
      title: 'Infrastructure',
      items,
      shape: 'circle',
      note,
      collapsed: keepCollapsed
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
    if (!config) return;

    // Signal rasters: curated color-bar legends (ArcGIS raster legends are often empty/useless).
    if (SIGNAL_RASTER_KEYS.includes(name) && config.legendRamp) {
      const ramp = buildSignalsLegendRamp(config, this.signalsGrayscale);
      const modeNote = this.signalsGrayscale ? ' Grayscale display mode on.' : '';
      this.legendPanel.setLayerLegend(key, true, {
        title: config.label,
        ramp,
        note: `${config.legendNote || ''}${modeNote}`.trim()
      });
      return;
    }

    const items = await this.layerManager.getWMSLegendItems(name);

    this.legendPanel.setLayerLegend(key, visible, items
      ? { title: config.label, items, shape: 'icon', note: config.legendNote }
      : { title: config.label, imageUrl: config.legendUrl, note: config.legendNote });
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
        if (checked) track(PlausibleEvents.LAYER_ON, { layer: name });
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
        if (checked && SIGNAL_RASTER_KEYS.includes(name)) {
          await this.enforceSignalsRasterMutualExclusion(name);
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
          if (checked) {
            this.setDataStatus(null);
            track(PlausibleEvents.LAYER_ON, { layer: `wms:${name}` });
          }
          await this.updateWMSLegend(name, checkbox.checked);
          this.syncSignalsOpacityControl(name);
          if (checked && SIGNAL_RASTER_KEYS.includes(name) && this.signalsGrayscale) {
            this.layerManager.setSignalRasterGrayscale(true);
          }
          this.refreshKpiBar();
        } finally {
          checkbox.disabled = false;
          item?.classList.remove('loading');
        }
      });
    });
  }

  /**
   * Phase 4.1 — only one signals raster at a time (aeromag / 1VD / gravity).
   * Survey footprints stay independently toggleable.
   */
  async enforceSignalsRasterMutualExclusion(enabling) {
    if (this._signalsExcluding) return;
    this._signalsExcluding = true;
    try {
      for (const name of SIGNAL_RASTER_KEYS) {
        if (name === enabling || !WMS_CONFIG[name]) continue;
        const cb = document.getElementById(`wms-${name}`);
        if (cb?.checked) {
          cb.checked = false;
          await this.layerManager.setWMSLayerVisibility(name, false);
          await this.updateWMSLegend(name, false);
        }
      }
      this.setDataStatus(
        'Only one geophysics raster at a time — radiometrics & 1VD are survey-limited; keep Survey footprints on for coverage.',
        'info'
      );
    } finally {
      this._signalsExcluding = false;
    }
  }

  /** Keep the signals opacity slider in sync with the active raster's config opacity. */
  syncSignalsOpacityControl(name) {
    if (!SIGNAL_RASTER_KEYS.includes(name)) return;
    const range = document.getElementById('signals-raster-opacity');
    const valueEl = document.getElementById('signals-opacity-value');
    const config = WMS_CONFIG[name];
    if (!range || !config) return;
    const pct = Math.round((config.opacity ?? 0.7) * 100);
    range.value = String(pct);
    if (valueEl) valueEl.textContent = `${pct}%`;
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
}

export default MineralsMapApp;
