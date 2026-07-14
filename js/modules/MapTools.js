/**
 * Soft-launch geo toolbox: measure distance (Turf click-measure).
 * Terra Draw can be reintroduced later when the package is installable in this env.
 */

import maplibregl from 'maplibre-gl';
import { point as turfPoint } from '@turf/helpers';
import distance from '@turf/distance';
import bbox from '@turf/bbox';

let coordMarker = null;

/**
 * @param {import('maplibre-gl').Map} map
 * @returns {Promise<{ destroy: () => void, mode: () => string }>}
 */
export async function attachMapTools(map) {
  return attachTurfMeasureFallback(map);
}

/**
 * @param {import('maplibre-gl').Map} map
 */
function attachTurfMeasureFallback(map) {
  const sourceId = 'softlaunch-measure';
  const points = [];
  let active = false;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'maplibregl-ctrl-icon map-tool-measure-btn';
  btn.title = 'Measure distance (click points; Esc clears)';
  btn.setAttribute('aria-label', 'Measure distance');
  btn.textContent = 'Meas.';

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'maplibregl-ctrl-icon map-tool-measure-clear';
  clearBtn.title = 'Clear measure';
  clearBtn.setAttribute('aria-label', 'Clear measure');
  clearBtn.textContent = '✕';

  const wrap = document.createElement('div');
  wrap.className = 'maplibregl-ctrl maplibregl-ctrl-group map-tools-fallback';
  wrap.appendChild(btn);
  wrap.appendChild(clearBtn);

  const control = {
    onAdd() {
      return wrap;
    },
    onRemove() {
      wrap.remove();
    }
  };
  map.addControl(control, 'top-right');

  const ensureSource = () => {
    if (map.getSource(sourceId)) return;
    map.addSource(sourceId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });
    if (!map.getLayer(`${sourceId}-line`)) {
      map.addLayer({
        id: `${sourceId}-line`,
        type: 'line',
        source: sourceId,
        filter: ['==', '$type', 'LineString'],
        paint: { 'line-color': '#d97706', 'line-width': 3 }
      });
    }
    if (!map.getLayer(`${sourceId}-points`)) {
      map.addLayer({
        id: `${sourceId}-points`,
        type: 'circle',
        source: sourceId,
        filter: ['==', '$type', 'Point'],
        paint: { 'circle-radius': 5, 'circle-color': '#d97706' }
      });
    }
  };

  const pathLengthKm = () => {
    let sum = 0;
    for (let i = 0; i < points.length - 1; i++) {
      sum += distance(turfPoint(points[i]), turfPoint(points[i + 1]), { units: 'kilometers' });
    }
    return sum;
  };

  const refresh = () => {
    ensureSource();
    const features = points.map((c) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: c },
      properties: {}
    }));
    if (points.length >= 2) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: points },
        properties: {}
      });
      const km = pathLengthKm();
      const el = document.getElementById('map-measure-hud');
      if (el) el.textContent = km < 10 ? `${km.toFixed(2)} km` : `${Math.round(km)} km`;
    } else {
      const el = document.getElementById('map-measure-hud');
      if (el) el.textContent = active ? 'Click map…' : '';
    }
    map.getSource(sourceId)?.setData({ type: 'FeatureCollection', features });
  };

  const onClick = (e) => {
    if (!active) return;
    points.push([e.lngLat.lng, e.lngLat.lat]);
    refresh();
  };

  const onKey = (e) => {
    if (e.key === 'Escape') {
      points.length = 0;
      active = false;
      btn.classList.remove('active');
      refresh();
    }
  };

  btn.addEventListener('click', () => {
    active = !active;
    btn.classList.toggle('active', active);
    if (active) ensureSource();
    refresh();
  });
  clearBtn.addEventListener('click', () => {
    points.length = 0;
    refresh();
  });
  map.on('click', onClick);
  window.addEventListener('keydown', onKey);

  let hud = document.getElementById('map-measure-hud');
  if (!hud) {
    hud = document.createElement('div');
    hud.id = 'map-measure-hud';
    hud.className = 'map-measure-hud';
    document.querySelector('.map-container')?.appendChild(hud);
  }

  return {
    destroy() {
      map.off('click', onClick);
      window.removeEventListener('keydown', onKey);
      try {
        map.removeControl(control);
      } catch {
        /* ignore */
      }
    },
    mode: () => 'turf-fallback'
  };
}

/**
 * @param {import('maplibre-gl').Map} map
 * @param {GeoJSON.FeatureCollection|GeoJSON.Feature[]} fcOrFeatures
 */
export function zoomToFeatures(map, fcOrFeatures) {
  const features = Array.isArray(fcOrFeatures) ? fcOrFeatures : fcOrFeatures?.features || [];
  if (!features.length) return false;
  try {
    const box = bbox({ type: 'FeatureCollection', features });
    if (!box || box.some((n) => !Number.isFinite(n))) return false;
    const pad = 0.05;
    const west = box[0] === box[2] ? box[0] - pad : box[0];
    const south = box[1] === box[3] ? box[1] - pad : box[1];
    const east = box[0] === box[2] ? box[2] + pad : box[2];
    const north = box[1] === box[3] ? box[3] + pad : box[3];
    map.fitBounds(
      [
        [west, south],
        [east, north]
      ],
      { padding: 48, maxZoom: 12, duration: 800 }
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} raw
 * @returns {[number, number]|null} [lon, lat]
 */
export function parseCoordinatePair(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const m = raw.trim().match(/^(-?\d+\.?\d*)\s*[,;\s]\s*(-?\d+\.?\d*)$/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a >= 45 && a <= 62 && b >= -70 && b <= -50) return [b, a];
  if (b >= 45 && b <= 62 && a >= -70 && a <= -50) return [a, b];
  if (Math.abs(a) <= 180 && Math.abs(b) <= 90) return [a, b];
  return null;
}

export function flyToCoordinate(map, lon, lat) {
  map.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 9), essential: true });
  if (coordMarker) {
    try {
      coordMarker.remove();
    } catch {
      /* ignore */
    }
  }
  coordMarker = new maplibregl.Marker({ color: '#d97706' }).setLngLat([lon, lat]).addTo(map);
}
