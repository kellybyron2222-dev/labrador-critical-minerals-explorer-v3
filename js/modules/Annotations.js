/**
 * User markup annotations — pin notes on the map (not measurements).
 * Hollow black squares; data layers keep commodity colors.
 */

export const ANNOTATIONS_SOURCE = 'user-annotations';
export const ANNOTATIONS_STORAGE_KEY = 'explorer-v3-annotations';
export const TOOL_INK = '#111111';
const SQUARE_IMG = 'annotate-vertex-square';

/**
 * @param {GeoJSON.FeatureCollection} fc
 * @returns {string}
 */
export function serializeAnnotations(fc) {
  return JSON.stringify(fc);
}

/**
 * @param {string|null|undefined} raw
 * @returns {GeoJSON.FeatureCollection}
 */
export function parseStoredAnnotations(raw) {
  if (!raw) return { type: 'FeatureCollection', features: [] };
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return { type: 'FeatureCollection', features: [] };
}

export function saveAnnotations(fc) {
  try {
    localStorage.setItem(ANNOTATIONS_STORAGE_KEY, serializeAnnotations(fc));
  } catch {
    /* ignore */
  }
}

export function loadAnnotations() {
  try {
    return parseStoredAnnotations(localStorage.getItem(ANNOTATIONS_STORAGE_KEY));
  } catch {
    return { type: 'FeatureCollection', features: [] };
  }
}

function ensureSquareImage(map) {
  if (map.hasImage(SQUARE_IMG)) return;
  const s = 10;
  const data = new Uint8Array(s * s * 4);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const i = (y * s + x) * 4;
      const edge = x === 0 || y === 0 || x === s - 1 || y === s - 1;
      data[i] = edge ? 17 : 255;
      data[i + 1] = edge ? 17 : 255;
      data[i + 2] = edge ? 17 : 255;
      data[i + 3] = 255;
    }
  }
  map.addImage(SQUARE_IMG, { width: s, height: s, data }, { pixelRatio: 2 });
}

/**
 * Annotate = drop a pin with an optional note. Use Measure for distances.
 */
export function mountAnnotations(opts) {
  const { map, hostEl, onStatus } = opts;

  let active = false;
  /** @type {GeoJSON.FeatureCollection} */
  let data = loadAnnotations();
  /** @type {[number, number]|null} */
  let pendingPoint = null;
  let idSeq = 1;
  const nextId = () => `ann-${idSeq++}`;

  const root = document.createElement('div');
  root.className = 'annotations-control tool-control';
  root.innerHTML = `
    <button type="button" class="map-toolbar-btn" data-annotate-toggle aria-pressed="false"
      title="Drop a pin note on the map (not a measurement)">Annotate</button>
    <input type="text" class="tool-inline-input" data-annotate-text hidden
      placeholder="Optional note — Enter" maxlength="120" autocomplete="off" />
    <button type="button" class="map-toolbar-btn map-toolbar-btn-ghost" data-annotate-clear hidden
      title="Remove all annotations">Clear</button>`;
  hostEl.appendChild(root);

  const toggleBtn = root.querySelector('[data-annotate-toggle]');
  const textInput = /** @type {HTMLInputElement|null} */ (root.querySelector('[data-annotate-text]'));
  const clearBtn = root.querySelector('[data-annotate-clear]');

  const ensureLayers = () => {
    ensureSquareImage(map);
    if (!map.getSource(ANNOTATIONS_SOURCE)) {
      map.addSource(ANNOTATIONS_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
    }
    if (!map.getLayer(`${ANNOTATIONS_SOURCE}-pins`)) {
      map.addLayer({
        id: `${ANNOTATIONS_SOURCE}-pins`,
        type: 'symbol',
        source: ANNOTATIONS_SOURCE,
        filter: ['==', ['get', 'kind'], 'pin'],
        layout: {
          'icon-image': SQUARE_IMG,
          'icon-size': 0.7,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true
        }
      });
    }
    if (!map.getLayer(`${ANNOTATIONS_SOURCE}-labels`)) {
      map.addLayer({
        id: `${ANNOTATIONS_SOURCE}-labels`,
        type: 'symbol',
        source: ANNOTATIONS_SOURCE,
        filter: ['all', ['==', ['get', 'kind'], 'pin'], ['!=', ['get', 'label'], '']],
        layout: {
          'text-field': ['coalesce', ['get', 'label'], ''],
          'text-size': 12,
          'text-anchor': 'bottom',
          'text-offset': [0, -0.6],
          'text-allow-overlap': true,
          'text-ignore-placement': true
        },
        paint: {
          'text-color': TOOL_INK,
          'text-halo-color': 'rgba(255,255,255,0.95)',
          'text-halo-width': 2
        }
      });
    }
  };

  const persist = () => saveAnnotations(data);

  const refresh = () => {
    ensureLayers();
    map.getSource(ANNOTATIONS_SOURCE)?.setData({
      type: 'FeatureCollection',
      features: [...(data.features || [])]
    });
  };

  const hideTextInput = () => {
    pendingPoint = null;
    if (textInput) {
      textInput.hidden = true;
      textInput.value = '';
    }
  };

  const syncUi = () => {
    toggleBtn?.classList.toggle('active', active);
    toggleBtn?.setAttribute('aria-pressed', String(active));
    if (clearBtn) clearBtn.hidden = !active;
    if (!active) hideTextInput();
    map.getCanvas().style.cursor = active ? 'crosshair' : '';
  };

  const commitPendingText = () => {
    if (!pendingPoint || !textInput) return;
    const text = textInput.value.trim();
    const [lon, lat] = pendingPoint;
    data.features.push({
      type: 'Feature',
      id: nextId(),
      properties: { kind: 'pin', label: text },
      geometry: { type: 'Point', coordinates: [lon, lat] }
    });
    persist();
    hideTextInput();
    refresh();
    onStatus?.(text ? `Pin: ${text}` : 'Pin placed', 'info');
  };

  const onClick = (e) => {
    if (!active) return;
    pendingPoint = [e.lngLat.lng, e.lngLat.lat];
    if (textInput) {
      textInput.hidden = false;
      textInput.placeholder = 'Optional note — Enter (blank = pin only)';
      textInput.value = '';
      requestAnimationFrame(() => textInput.focus());
    }
    onStatus?.('Optional note in the toolbar, then Enter', 'info');
  };

  const activate = () => {
    active = true;
    document.querySelector('.maplibregl-popup')?.remove();
    syncUi();
    refresh();
    onStatus?.('Annotate on — click the map to drop a pin', 'info');
  };

  const deactivate = () => {
    active = false;
    hideTextInput();
    syncUi();
  };

  toggleBtn?.addEventListener('click', () => {
    if (active) deactivate();
    else activate();
  });

  textInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitPendingText();
    } else if (e.key === 'Escape') {
      hideTextInput();
      onStatus?.('Cancelled', 'info');
    }
  });

  clearBtn?.addEventListener('click', () => {
    if (!data.features.length) return;
    data = { type: 'FeatureCollection', features: [] };
    hideTextInput();
    persist();
    refresh();
    onStatus?.('Annotations cleared', 'info');
  });

  map.on('click', onClick);
  map.on('style.load', refresh);

  refresh();
  syncUi();

  return {
    destroy() {
      map.off('click', onClick);
      map.off('style.load', refresh);
      deactivate();
      root.remove();
    },
    deactivate,
    isActive: () => active,
    getGeoJSON: () => ({ type: 'FeatureCollection', features: [...(data.features || [])] }),
    setGeoJSON(fc) {
      data =
        fc?.type === 'FeatureCollection'
          ? { type: 'FeatureCollection', features: [...(fc.features || [])] }
          : { type: 'FeatureCollection', features: [] };
      persist();
      refresh();
    },
    clear() {
      data = { type: 'FeatureCollection', features: [] };
      persist();
      refresh();
    }
  };
}
