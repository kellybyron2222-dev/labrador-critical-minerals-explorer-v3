/**
 * Sticky selection / attribute panel for identify results with map highlight.
 */

import bbox from '@turf/bbox';
import { escapeHtml } from './htmlEscape.js';
import { featureDisplayName } from './ScreenReport.js';

const HIGHLIGHT_SOURCE = 'selection-highlight';
const HIGHLIGHT_FILL = 'selection-highlight-fill';
const HIGHLIGHT_LINE = 'selection-highlight-line';
const HIGHLIGHT_CIRCLE = 'selection-highlight-circle';
const HIGHLIGHT_COLOR = '#2563eb';
const STYLE_ID = 'selection-panel-styles';

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .selection-panel {
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      z-index: 12;
      width: min(340px, 92vw);
      display: flex;
      flex-direction: column;
      background: rgba(255, 255, 255, 0.98);
      border-left: 1px solid rgba(15, 23, 42, 0.12);
      box-shadow: -8px 0 24px rgba(15, 23, 42, 0.08);
      transform: translateX(100%);
      transition: transform 0.22s ease;
      pointer-events: auto;
    }
    .selection-panel.open { transform: translateX(0); }
    .selection-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 12px 14px;
      border-bottom: 1px solid rgba(15, 23, 42, 0.08);
    }
    .selection-panel-title {
      margin: 0;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      color: #475569;
    }
    .selection-panel-close {
      border: none;
      background: transparent;
      color: #64748b;
      font-size: 20px;
      line-height: 1;
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .selection-panel-close:hover { background: #f1f5f9; color: #0f172a; }
    .selection-panel-list {
      margin: 0;
      padding: 8px;
      list-style: none;
      overflow-y: auto;
      max-height: 34%;
      border-bottom: 1px solid rgba(15, 23, 42, 0.08);
    }
    .selection-panel-list-item {
      width: 100%;
      display: block;
      text-align: left;
      border: 1px solid transparent;
      border-radius: 6px;
      background: transparent;
      padding: 8px 10px;
      cursor: pointer;
      font: inherit;
      color: #0f172a;
    }
    .selection-panel-list-item:hover { background: #f8fafc; }
    .selection-panel-list-item.focused {
      background: #eff6ff;
      border-color: rgba(37, 99, 235, 0.25);
    }
    .selection-panel-list-item-name {
      display: block;
      font-size: 13px;
      font-weight: 600;
    }
    .selection-panel-list-item-layer {
      display: block;
      margin-top: 2px;
      font-size: 11px;
      color: #64748b;
    }
    .selection-panel-attrs {
      flex: 1;
      overflow-y: auto;
      padding: 10px 14px 12px;
    }
    .selection-panel-attrs-title {
      margin: 0 0 8px;
      font-size: 14px;
      font-weight: 600;
      color: #0f172a;
    }
    .selection-panel-empty {
      margin: 0;
      font-size: 13px;
      color: #64748b;
    }
    .selection-panel-attr-row {
      display: grid;
      grid-template-columns: minmax(0, 42%) minmax(0, 1fr);
      gap: 8px 10px;
      padding: 6px 0;
      border-bottom: 1px solid rgba(15, 23, 42, 0.06);
      font-size: 12px;
      line-height: 1.35;
    }
    .selection-panel-attr-key {
      color: #64748b;
      word-break: break-word;
    }
    .selection-panel-attr-value {
      color: #0f172a;
      word-break: break-word;
    }
    .selection-panel-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 10px 14px 14px;
      border-top: 1px solid rgba(15, 23, 42, 0.08);
    }
    .selection-panel-btn {
      flex: 1 1 calc(50% - 4px);
      min-width: 120px;
      border: 1px solid rgba(15, 23, 42, 0.14);
      border-radius: 6px;
      background: #fff;
      color: #0f172a;
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      padding: 8px 10px;
      cursor: pointer;
    }
    .selection-panel-btn:hover { background: #f8fafc; }
    .selection-panel-btn-primary {
      background: #2563eb;
      border-color: #2563eb;
      color: #fff;
    }
    .selection-panel-btn-primary:hover { background: #1d4ed8; }
  `;
  document.head.appendChild(style);
}

function removeStylesIfUnused() {
  if (!document.getElementById('selection-panel')) {
    document.getElementById(STYLE_ID)?.remove();
  }
}

/**
 * @param {GeoJSON.Feature} feature
 */
function normalizeFeature(feature) {
  const props = { ...(feature.properties || {}) };
  const layerId = props.__layerId || feature.layer?.id || '';
  if (layerId) props.__layerId = layerId;
  return {
    type: 'Feature',
    geometry: feature.geometry,
    properties: props
  };
}

/**
 * @param {object} props
 */
function attributeEntries(props = {}) {
  return Object.entries(props)
    .filter(([k]) => !k.startsWith('_'))
    .sort(([a], [b]) => a.localeCompare(b));
}

/**
 * @param {GeoJSON.Feature[]} features
 */
function featuresToCollection(features) {
  return {
    type: 'FeatureCollection',
    features: features.filter((f) => f?.geometry).map(normalizeFeature)
  };
}

/**
 * @param {object} opts
 * @param {import('maplibre-gl').Map} opts.map
 * @param {HTMLElement} [opts.container]
 * @param {(features: GeoJSON.Feature[]) => void} [opts.onBufferFeatures]
 * @param {(msg: string, tone?: string) => void} [opts.onStatus]
 */
export function createSelectionPanel(opts) {
  const { map, onBufferFeatures, onStatus } = opts;
  const container = opts.container || document.querySelector('.map-container');
  if (!container) {
    console.warn('selection panel container missing');
    return {
      setSelection() {},
      clear() {},
      getSelection: () => [],
      open() {},
      close() {},
      destroy() {}
    };
  }

  ensureStyles();

  /** @type {GeoJSON.Feature[]} */
  let selection = [];
  let focusIndex = 0;
  let isOpen = false;

  const panel = document.createElement('aside');
  panel.id = 'selection-panel';
  panel.className = 'selection-panel';
  panel.setAttribute('aria-label', 'Selection details');
  panel.innerHTML = `
    <header class="selection-panel-header">
      <h2 class="selection-panel-title">Selection</h2>
      <button type="button" class="selection-panel-close" aria-label="Close selection panel">&times;</button>
    </header>
    <ul class="selection-panel-list" data-selection-list></ul>
    <section class="selection-panel-attrs" data-selection-attrs></section>
    <footer class="selection-panel-actions">
      <button type="button" class="selection-panel-btn selection-panel-btn-primary" data-action="zoom">Zoom to</button>
      <button type="button" class="selection-panel-btn" data-action="copy">Copy attributes</button>
      <button type="button" class="selection-panel-btn" data-action="buffer">Set Screen radius</button>
      <button type="button" class="selection-panel-btn" data-action="clear">Clear</button>
      <button type="button" class="selection-panel-btn" data-action="close">Close</button>
    </footer>`;
  container.appendChild(panel);

  const listEl = panel.querySelector('[data-selection-list]');
  const attrsEl = panel.querySelector('[data-selection-attrs]');
  const closeBtn = panel.querySelector('.selection-panel-close');

  const ensureHighlightLayers = () => {
    if (!map.getSource(HIGHLIGHT_SOURCE)) {
      map.addSource(HIGHLIGHT_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
    }

    if (!map.getLayer(HIGHLIGHT_FILL)) {
      map.addLayer({
        id: HIGHLIGHT_FILL,
        type: 'fill',
        source: HIGHLIGHT_SOURCE,
        filter: ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]],
        paint: { 'fill-color': HIGHLIGHT_COLOR, 'fill-opacity': 0.14 }
      });
    }

    if (!map.getLayer(HIGHLIGHT_LINE)) {
      map.addLayer({
        id: HIGHLIGHT_LINE,
        type: 'line',
        source: HIGHLIGHT_SOURCE,
        filter: [
          'in',
          ['geometry-type'],
          ['literal', ['LineString', 'MultiLineString', 'Polygon', 'MultiPolygon']]
        ],
        paint: {
          'line-color': HIGHLIGHT_COLOR,
          'line-width': 2.5,
          'line-opacity': 0.95
        }
      });
    }

    if (!map.getLayer(HIGHLIGHT_CIRCLE)) {
      map.addLayer({
        id: HIGHLIGHT_CIRCLE,
        type: 'circle',
        source: HIGHLIGHT_SOURCE,
        filter: ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]],
        paint: {
          'circle-color': HIGHLIGHT_COLOR,
          'circle-radius': 7,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2
        }
      });
    }
  };

  const paintHighlight = () => {
    if (!map?.getSource) return;
    try {
      ensureHighlightLayers();
      map.getSource(HIGHLIGHT_SOURCE)?.setData(featuresToCollection(selection));
    } catch {
      /* style not ready */
    }
  };

  const removeHighlightLayers = () => {
    for (const id of [HIGHLIGHT_CIRCLE, HIGHLIGHT_LINE, HIGHLIGHT_FILL]) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    if (map.getSource(HIGHLIGHT_SOURCE)) map.removeSource(HIGHLIGHT_SOURCE);
  };

  const renderAttrs = (feature) => {
    if (!feature) {
      attrsEl.innerHTML = `<p class="selection-panel-empty">No feature selected.</p>`;
      return;
    }

    const name = featureDisplayName(feature.properties) || 'Feature';
    const rows = attributeEntries(feature.properties);
    const body = rows.length
      ? rows
          .map(
            ([key, value]) =>
              `<div class="selection-panel-attr-row">
                <span class="selection-panel-attr-key">${escapeHtml(key)}</span>
                <span class="selection-panel-attr-value">${escapeHtml(value)}</span>
              </div>`
          )
          .join('')
      : `<p class="selection-panel-empty">No attributes for this feature.</p>`;

    attrsEl.innerHTML = `
      <h3 class="selection-panel-attrs-title">${escapeHtml(name)}</h3>
      ${body}`;
  };

  const renderList = () => {
    if (!selection.length) {
      listEl.innerHTML = `<li><p class="selection-panel-empty">No features selected.</p></li>`;
      renderAttrs(null);
      return;
    }

    listEl.innerHTML = selection
      .map((feature, index) => {
        const name = featureDisplayName(feature.properties) || `Feature ${index + 1}`;
        const layerId = feature.properties?.__layerId || feature.layer?.id || 'Unknown layer';
        const focused = index === focusIndex ? ' focused' : '';
        return `<li>
          <button type="button" class="selection-panel-list-item${focused}" data-feature-index="${index}">
            <span class="selection-panel-list-item-name">${escapeHtml(name)}</span>
            <span class="selection-panel-list-item-layer">${escapeHtml(layerId)}</span>
          </button>
        </li>`;
      })
      .join('');

    renderAttrs(selection[focusIndex] || null);
  };

  const syncOpenClass = () => {
    panel.classList.toggle('open', isOpen && selection.length > 0);
  };

  const zoomToSelection = () => {
    if (!selection.length) return;
    try {
      const collection = featuresToCollection(selection);
      const box = bbox(collection);
      if (box && box.every((n) => Number.isFinite(n))) {
        map.fitBounds(
          [
            [box[0], box[1]],
            [box[2], box[3]]
          ],
          { padding: 48, maxZoom: 14, duration: 800 }
        );
        return;
      }
    } catch {
      /* fall through */
    }

    const first = selection.find((f) => f.geometry?.type === 'Point');
    if (first?.geometry?.coordinates) {
      const [lon, lat] = first.geometry.coordinates;
      map.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 10), essential: true });
    }
  };

  const copyAttributes = async () => {
    const feature = selection[focusIndex];
    if (!feature) {
      onStatus?.('Nothing selected to copy.', 'error');
      return;
    }

    const name = featureDisplayName(feature.properties) || 'Feature';
    const lines = [`${name}`, ''];
    for (const [key, value] of attributeEntries(feature.properties)) {
      lines.push(`${key}: ${value}`);
    }
    const text = lines.join('\n');

    try {
      await navigator.clipboard.writeText(text);
      onStatus?.('Copied attributes to clipboard.', 'info');
    } catch {
      onStatus?.('Could not copy attributes.', 'error');
    }
  };

  const onListClick = (e) => {
    const btn = e.target.closest('[data-feature-index]');
    if (!btn) return;
    focusIndex = Number(btn.dataset.featureIndex);
    renderList();
  };

  const onActionClick = (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    switch (btn.dataset.action) {
      case 'zoom':
        zoomToSelection();
        break;
      case 'copy':
        copyAttributes();
        break;
      case 'buffer':
        if (selection.length) onBufferFeatures?.(selection.map(normalizeFeature));
        break;
      case 'clear':
        api.clear();
        break;
      case 'close':
        api.close();
        break;
      default:
        break;
    }
  };

  const onStyleData = () => {
    if (!selection.length || !map.isStyleLoaded()) return;
    paintHighlight();
  };

  listEl.addEventListener('click', onListClick);
  panel.addEventListener('click', onActionClick);
  closeBtn.addEventListener('click', () => api.close());
  map.on('styledata', onStyleData);

  const api = {
    /**
     * @param {GeoJSON.Feature[]} features
     */
    setSelection(features) {
      selection = (features || []).map(normalizeFeature);
      focusIndex = 0;
      paintHighlight();
      renderList();
      if (selection.length) {
        isOpen = true;
      }
      syncOpenClass();
    },

    clear() {
      selection = [];
      focusIndex = 0;
      paintHighlight();
      renderList();
      syncOpenClass();
    },

    getSelection() {
      return selection.map(normalizeFeature);
    },

    open() {
      if (!selection.length) return;
      isOpen = true;
      syncOpenClass();
    },

    close() {
      isOpen = false;
      syncOpenClass();
    },

    destroy() {
      map.off('styledata', onStyleData);
      listEl.removeEventListener('click', onListClick);
      panel.removeEventListener('click', onActionClick);
      removeHighlightLayers();
      panel.remove();
      removeStylesIfUnused();
    }
  };

  renderList();
  return api;
}
