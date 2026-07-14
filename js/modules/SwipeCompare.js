/**
 * Swipe compare: Pin A (saved view) vs live map.
 * Left of the handle = pinned snapshot; right = live primary map.
 */

import maplibregl from 'maplibre-gl';
import { BASEMAP_STYLES, DEFAULT_BASEMAP, ESRI_SATELLITE_STYLE } from '../config/mapConfig.js';
import { LAYER_CONFIG } from '../config/layerConfig.js';

const OVERLAY_ID = 'swipe-compare-overlay';
const STYLE_ID = 'swipe-compare-styles';
const PIN_STORAGE_KEY = 'explorer-v3-swipe-pin-a';

/**
 * @param {import('../viewState.js').ViewState|null|undefined} state
 */
function resolveBasemapStyle(state) {
  const name = state?.basemap && state.basemap !== 'topo' ? state.basemap : DEFAULT_BASEMAP;
  return BASEMAP_STYLES[name] || BASEMAP_STYLES[DEFAULT_BASEMAP] || ESRI_SATELLITE_STYLE;
}

/**
 * Clone vector layers from Pin A onto the secondary map (simplified paint).
 * @param {import('maplibre-gl').Map} secondary
 * @param {{ layers?: string[] }} state
 * @param {(name: string) => GeoJSON.Feature[]} getFeatures
 */
export function paintPinnedLayers(secondary, state, getFeatures) {
  const layerIds = (state?.layers || []).filter((id) => !id.startsWith('wms:'));
  for (const name of layerIds) {
    const config = LAYER_CONFIG[name];
    if (!config) continue;
    const features = getFeatures?.(name) || [];
    if (!features.length) continue;

    const sourceId = `swipe-pin-${name}`;
    if (secondary.getSource(sourceId)) {
      secondary.getSource(sourceId).setData({
        type: 'FeatureCollection',
        features
      });
    } else {
      secondary.addSource(sourceId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features }
      });
    }

    const sample = features[0]?.geometry?.type;
    const circlePaint = config.paint?.circle;
    const fillPaint = config.paint?.fill;
    const linePaint = config.paint?.line;

    if (sample === 'Point' || sample === 'MultiPoint' || circlePaint) {
      const lid = `${sourceId}-circle`;
      if (!secondary.getLayer(lid)) {
        secondary.addLayer({
          id: lid,
          type: 'circle',
          source: sourceId,
          paint: {
            'circle-color': circlePaint?.['circle-color'] || '#111111',
            'circle-radius':
              typeof circlePaint?.['circle-radius'] === 'number'
                ? circlePaint['circle-radius']
                : 5,
            'circle-stroke-width': circlePaint?.['circle-stroke-width'] ?? 1,
            'circle-stroke-color': circlePaint?.['circle-stroke-color'] || '#ffffff',
            'circle-opacity': circlePaint?.['circle-opacity'] ?? 0.85
          }
        });
      }
    } else if (sample === 'LineString' || sample === 'MultiLineString' || linePaint) {
      const lid = `${sourceId}-line`;
      if (!secondary.getLayer(lid)) {
        secondary.addLayer({
          id: lid,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': linePaint?.['line-color'] || '#111111',
            'line-width': linePaint?.['line-width'] || 2,
            'line-opacity': linePaint?.['line-opacity'] ?? 0.9
          }
        });
      }
    } else {
      const fillId = `${sourceId}-fill`;
      const lineId = `${sourceId}-outline`;
      if (!secondary.getLayer(fillId)) {
        secondary.addLayer({
          id: fillId,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': fillPaint?.['fill-color'] || '#111111',
            'fill-opacity': fillPaint?.['fill-opacity'] ?? 0.25
          }
        });
      }
      if (!secondary.getLayer(lineId)) {
        secondary.addLayer({
          id: lineId,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': linePaint?.['line-color'] || '#111111',
            'line-width': 1,
            'line-opacity': 0.7
          }
        });
      }
    }
  }
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = `
    #${OVERLAY_ID} {
      position: absolute;
      inset: 0;
      z-index: 4;
      pointer-events: none;
      overflow: hidden;
    }
    #${OVERLAY_ID} .swipe-compare-secondary {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    #${OVERLAY_ID} .swipe-compare-map {
      width: 100%;
      height: 100%;
    }
    #${OVERLAY_ID} .swipe-compare-handle {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 4px;
      margin-left: -2px;
      background: #111;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.85), 0 0 6px rgba(0, 0, 0, 0.25);
      cursor: ew-resize;
      pointer-events: auto;
      z-index: 2;
    }
    #${OVERLAY_ID} .swipe-compare-handle::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 28px;
      height: 28px;
      margin: -14px 0 0 -14px;
      border-radius: 50%;
      background: #fff;
      border: 2px solid #111;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
    }
    #${OVERLAY_ID} .swipe-compare-badge {
      position: absolute;
      top: 10px;
      z-index: 3;
      padding: 4px 8px;
      font: 600 11px/1.2 system-ui, sans-serif;
      background: rgba(255,255,255,0.92);
      border: 1px solid #111;
      border-radius: 4px;
      pointer-events: none;
    }
    #${OVERLAY_ID} .swipe-compare-badge-a { left: 10px; }
    #${OVERLAY_ID} .swipe-compare-badge-live { right: 10px; }
    .swipe-compare-control {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
    }
  `;
  document.head.appendChild(el);
}

function loadPinnedState() {
  try {
    const raw = sessionStorage.getItem(PIN_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function savePinnedState(state) {
  try {
    sessionStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

/**
 * @param {{
 *   map: import('maplibre-gl').Map,
 *   hostEl: HTMLElement,
 *   collectViewState: () => object,
 *   getFeatures?: (name: string) => GeoJSON.Feature[],
 *   onStatus?: (msg: string, tone?: string) => void
 * }} opts
 */
export function mountSwipeCompare(opts) {
  const { map, hostEl, collectViewState, getFeatures, onStatus } = opts;
  if (!map || !hostEl || typeof collectViewState !== 'function') {
    throw new Error('mountSwipeCompare requires map, hostEl, collectViewState');
  }

  ensureStyles();

  let active = false;
  /** @type {object|null} */
  let pinA = loadPinnedState();
  /** @type {import('maplibre-gl').Map | null} */
  let secondary = null;
  /** @type {HTMLElement | null} */
  let overlay = null;
  /** @type {HTMLElement | null} */
  let secondaryWrap = null;
  /** @type {HTMLElement | null} */
  let handle = null;
  /** @type {ResizeObserver | null} */
  let resizeObserver = null;
  let splitPct = 50;
  let dragging = false;

  const mapContainer =
    document.querySelector('.map-container') || map.getContainer().parentElement;

  const status = (msg, tone) => {
    if (typeof onStatus === 'function') onStatus(msg, tone);
  };

  const root = document.createElement('div');
  root.className = 'swipe-compare-control tool-control';
  root.innerHTML = `
    <button type="button" class="map-toolbar-btn" data-swipe-pin
      title="Save the current view (layers + basemap + camera) as side A">Pin A</button>
    <button type="button" class="map-toolbar-btn" data-swipe-compare aria-pressed="false"
      title="Swipe pinned A (left) against the live map (right)">Compare</button>
    <button type="button" class="map-toolbar-btn map-toolbar-btn-ghost" data-swipe-update hidden
      title="Replace Pin A with the live view">Update A</button>
    <button type="button" class="map-toolbar-btn map-toolbar-btn-ghost" data-swipe-exit hidden
      title="Exit compare">Exit</button>`;
  hostEl.appendChild(root);

  const pinBtn = root.querySelector('[data-swipe-pin]');
  const compareBtn = root.querySelector('[data-swipe-compare]');
  const updateBtn = root.querySelector('[data-swipe-update]');
  const exitBtn = root.querySelector('[data-swipe-exit]');

  const syncUi = () => {
    pinBtn?.classList.toggle('active', Boolean(pinA) && !active);
    compareBtn?.classList.toggle('active', active);
    compareBtn?.setAttribute('aria-pressed', String(active));
    compareBtn?.toggleAttribute('disabled', !pinA && !active);
    if (updateBtn) updateBtn.hidden = !active;
    if (exitBtn) exitBtn.hidden = !active;
  };

  const syncCamera = () => {
    if (!secondary) return;
    secondary.jumpTo({
      center: map.getCenter(),
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch()
    });
  };

  const setSplit = (pct) => {
    splitPct = Math.min(98, Math.max(2, pct));
    if (secondaryWrap) secondaryWrap.style.clipPath = `inset(0 0 0 ${splitPct}%)`;
    if (handle) handle.style.left = `${splitPct}%`;
  };

  const onPointerMove = (e) => {
    if (!dragging || !overlay) return;
    const rect = overlay.getBoundingClientRect();
    setSplit(((e.clientX - rect.left) / rect.width) * 100);
  };

  const stopDrag = () => {
    dragging = false;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', stopDrag);
    window.removeEventListener('pointercancel', stopDrag);
  };

  const onHandlePointerDown = (e) => {
    e.preventDefault();
    dragging = true;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);
  };

  const teardownOverlay = () => {
    map.off('move', syncCamera);
    stopDrag();
    resizeObserver?.disconnect();
    resizeObserver = null;
    if (secondary) {
      try {
        secondary.remove();
      } catch {
        /* ignore */
      }
      secondary = null;
    }
    overlay?.remove();
    overlay = null;
    secondaryWrap = null;
    handle = null;
  };

  const enable = () => {
    if (active || !mapContainer || !pinA) return;
    active = true;
    status('Compare on — left is Pin A, right is live. Drag the handle.', 'info');

    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.setAttribute('aria-hidden', 'true');

    secondaryWrap = document.createElement('div');
    secondaryWrap.className = 'swipe-compare-secondary';
    const mapEl = document.createElement('div');
    mapEl.className = 'swipe-compare-map';
    secondaryWrap.appendChild(mapEl);

    const badgeA = document.createElement('div');
    badgeA.className = 'swipe-compare-badge swipe-compare-badge-a';
    badgeA.textContent = 'A (pinned)';
    const badgeLive = document.createElement('div');
    badgeLive.className = 'swipe-compare-badge swipe-compare-badge-live';
    badgeLive.textContent = 'Live';

    handle = document.createElement('div');
    handle.className = 'swipe-compare-handle';
    handle.setAttribute('role', 'separator');
    handle.setAttribute('aria-orientation', 'vertical');
    handle.title = 'Drag to compare';
    handle.addEventListener('pointerdown', onHandlePointerDown);

    overlay.appendChild(secondaryWrap);
    overlay.appendChild(handle);
    overlay.appendChild(badgeA);
    overlay.appendChild(badgeLive);
    mapContainer.appendChild(overlay);
    setSplit(splitPct);

    const style = resolveBasemapStyle(pinA);
    secondary = new maplibregl.Map({
      container: mapEl,
      style,
      center: [pinA.lon ?? map.getCenter().lng, pinA.lat ?? map.getCenter().lat],
      zoom: pinA.zoom ?? map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch(),
      interactive: false,
      attributionControl: false,
      fadeDuration: 0
    });

    secondary.on('load', () => {
      try {
        paintPinnedLayers(secondary, pinA, getFeatures || (() => []));
      } catch (err) {
        console.warn('Swipe pin layers:', err);
      }
      syncCamera();
      secondary?.resize();
      const missing = (pinA.layers || []).filter((id) => {
        if (id.startsWith('wms:')) return true;
        return !(getFeatures?.(id) || []).length;
      });
      if (missing.length) {
        status(
          `Compare: some Pin A layers not loaded on live map (${missing.slice(0, 3).join(', ')}${
            missing.length > 3 ? '…' : ''
          })`,
          'info'
        );
      }
    });

    map.on('move', syncCamera);
    resizeObserver = new ResizeObserver(() => {
      map.resize();
      secondary?.resize();
    });
    resizeObserver.observe(mapContainer);
    requestAnimationFrame(() => {
      map.resize();
      secondary?.resize();
    });
    syncUi();
  };

  const disable = () => {
    if (!active) return;
    active = false;
    teardownOverlay();
    status('Compare off', 'info');
    syncUi();
  };

  pinBtn?.addEventListener('click', () => {
    pinA = collectViewState();
    savePinnedState(pinA);
    const n = pinA.layers?.length || 0;
    status(`Pin A saved (${n} layer${n === 1 ? '' : 's'} + basemap). Change the map, then Compare.`, 'info');
    syncUi();
  });

  compareBtn?.addEventListener('click', () => {
    if (active) {
      disable();
      return;
    }
    if (!pinA) {
      status('Pin A first — save a view, then change the map, then Compare.', 'error');
      return;
    }
    enable();
  });

  updateBtn?.addEventListener('click', () => {
    pinA = collectViewState();
    savePinnedState(pinA);
    if (secondary) {
      secondary.setStyle(resolveBasemapStyle(pinA));
      secondary.once('style.load', () => {
        paintPinnedLayers(secondary, pinA, getFeatures || (() => []));
        syncCamera();
      });
    }
    status('Pin A updated from live view', 'info');
    syncUi();
  });

  exitBtn?.addEventListener('click', () => disable());

  syncUi();

  return {
    destroy() {
      disable();
      root.remove();
    },
    isActive: () => active,
    getPinA: () => pinA
  };
}
