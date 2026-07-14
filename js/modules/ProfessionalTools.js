/**
 * Mount everyday professional GIS tools onto the bottom toolbar + map chrome.
 */

import { mountBookmarksControl, ensureStarterBookmarks } from './Bookmarks.js';
import { createExtentHistory } from './ExtentHistory.js';
import { mountMapContextMenu } from './MapContextMenu.js';
import { createSelectionPanel } from './SelectionPanel.js';
import { mountAnnotations } from './Annotations.js';
import { mountSwipeCompare } from './SwipeCompare.js';
import { mountPrintControl } from './PrintMap.js';
import { isMapToolDrawing } from './MapTools.js';
import {
  placeScreenRadius,
  DEFAULT_RADIUS_KM
} from './ScreenAoi.js';

/**
 * @param {{
 *   map: import('maplibre-gl').Map,
 *   mapBase: object,
 *   collectViewState: () => object,
 *   applyViewState: (state: object) => Promise<void>|void,
 *   onStatus?: (msg: string, tone?: string) => void,
 *   queryWhatsHere?: (point: {x:number,y:number}, lngLat: {lng:number,lat:number}) => object[],
 *   getLegendHtml?: () => string,
 *   getAoiLabel?: () => string,
 *   getFeatures?: (name: string) => GeoJSON.Feature[]
 * }} opts
 */
export function mountProfessionalTools(opts) {
  const {
    map,
    mapBase,
    collectViewState,
    applyViewState,
    onStatus,
    queryWhatsHere,
    getLegendHtml,
    getAoiLabel,
    getFeatures
  } = opts;

  const host = document.getElementById('map-toolbar-tools');
  if (!host) {
    console.warn('map-toolbar-tools missing — professional tools not mounted');
    return { destroy() {} };
  }

  ensureStarterBookmarks();

  const extentHistory = createExtentHistory(map);

  const syncExtentButtons = () => {
    const back = document.getElementById('extent-back');
    const fwd = document.getElementById('extent-forward');
    if (back) back.disabled = !extentHistory.canBack();
    if (fwd) fwd.disabled = !extentHistory.canForward();
  };
  map.on('moveend', syncExtentButtons);
  syncExtentButtons();

  document.getElementById('extent-back')?.addEventListener('click', () => {
    extentHistory.back();
    syncExtentButtons();
  });
  document.getElementById('extent-forward')?.addEventListener('click', () => {
    extentHistory.forward();
    syncExtentButtons();
  });
  document.getElementById('locate-me')?.addEventListener('click', () => {
    try {
      mapBase?.geolocateControl?.trigger();
    } catch (err) {
      onStatus?.(`Location unavailable: ${err?.message || err}`, 'error');
    }
  });

  /** @type {ReturnType<typeof mountAnnotations>|null} */
  let annotations = null;

  const selectionPanel = createSelectionPanel({
    map,
    onStatus,
    onBufferFeatures: (features) => {
      const f = features?.[0];
      const g = f?.geometry;
      if (!g) return;
      let lon;
      let lat;
      if (g.type === 'Point') {
        [lon, lat] = g.coordinates;
      } else {
        const c = map.getCenter();
        lon = c.lng;
        lat = c.lat;
        try {
          const coords =
            g.type === 'Polygon'
              ? g.coordinates[0]
              : g.type === 'LineString'
                ? g.coordinates
                : null;
          if (coords?.length) {
            let sx = 0;
            let sy = 0;
            let n = 0;
            for (const p of coords) {
              sx += p[0];
              sy += p[1];
              n += 1;
            }
            if (n) {
              lon = sx / n;
              lat = sy / n;
            }
          }
        } catch {
          /* keep center */
        }
      }
      placeScreenRadius(lon, lat, map, DEFAULT_RADIUS_KM);
      onStatus?.(
        `Screen radius ${DEFAULT_RADIUS_KM} km set — adjust chips under Screen, then Screen this area`,
        'info'
      );
    }
  });

  const isBlocked = () => isMapToolDrawing() || Boolean(annotations?.isActive?.());

  annotations = mountAnnotations({
    map,
    hostEl: host,
    onStatus
  });

  mountSwipeCompare({
    map,
    hostEl: host,
    collectViewState,
    getFeatures: (name) => getFeatures?.(name) || [],
    onStatus
  });

  mountPrintControl({
    map,
    hostEl: host,
    title: 'Labrador Critical Minerals Explorer',
    getLegendHtml,
    getAoiLabel,
    attribution: 'Public data · WGS 84',
    onStatus
  });

  mountBookmarksControl({
    hostEl: host,
    getState: () => {
      const state = collectViewState();
      try {
        state.annotations = annotations?.getGeoJSON?.();
      } catch {
        /* ignore */
      }
      return state;
    },
    applyState: async (state) => {
      extentHistory.skipNext?.();
      await applyViewState(state);
      if (state.annotations) annotations?.setGeoJSON?.(state.annotations);
    }
  });

  const contextMenu = mountMapContextMenu({
    map,
    isBlocked,
    onCopyCoords: async (lon, lat) => {
      const text = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      try {
        await navigator.clipboard.writeText(text);
        onStatus?.(`Copied ${text}`, 'info');
      } catch {
        onStatus?.(`Coordinates: ${text}`, 'info');
      }
    },
    onDropPin: (lon, lat) => {
      placeScreenRadius(lon, lat, map);
      onStatus?.('Pin dropped — Screen Radius ready', 'info');
    },
    onBuffer: (lon, lat) => {
      placeScreenRadius(lon, lat, map, DEFAULT_RADIUS_KM);
      onStatus?.(
        `Screen radius ${DEFAULT_RADIUS_KM} km — change size under Screen, then Screen this area`,
        'info'
      );
    },
    onWhatsHere: (lon, lat, point) => {
      const hits = queryWhatsHere?.(point, { lng: lon, lat }) || [];
      if (!hits.length) {
        onStatus?.('Nothing under the cursor in enabled layers.', 'info');
        selectionPanel.clear();
        return;
      }
      const features = hits.map((f) => {
        const copy = {
          type: 'Feature',
          properties: { ...(f.properties || {}), __layerId: f.layer?.id },
          geometry: f.geometry
        };
        return copy;
      });
      selectionPanel.setSelection(features);
      selectionPanel.open();
    },
    onZoomHere: (lon, lat) => {
      extentHistory.skipNext?.();
      map.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 10), essential: true });
    }
  });

  return {
    selectionPanel,
    annotations,
    extentHistory,
    isBlocked,
    destroy() {
      contextMenu?.destroy?.();
      selectionPanel?.destroy?.();
      extentHistory?.destroy?.();
    }
  };
}
