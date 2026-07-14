/** Module 1: MapLibre base layer — init, controls, HUD, basemap + contour toggle */

import maplibregl from 'maplibre-gl';
import {
  BASEMAP_STYLES,
  DEFAULT_BASEMAP,
  DEFAULT_ZOOM,
  LABRADOR_CENTER,
  MAP_OPTIONS
} from '../config/mapConfig.js';
import { registerFacilityIconLoader } from './facilityIcons.js';
import { registerInfraIconLoader } from './infraIcons.js';
import {
  isContourOverlayOn,
  restoreContourOverlay,
  setContourOverlay
} from './ContourOverlay.js';

export default class MapBase {
  constructor() {
    this.map = null;
    this.currentStyle = DEFAULT_BASEMAP;
    this.onStyleChange = null;
    this._ready = null;
    this._readyResolve = null;
  }

  init() {
    this._ready = new Promise((resolve) => {
      this._readyResolve = resolve;
    });

    const initial =
      BASEMAP_STYLES[this.currentStyle] || BASEMAP_STYLES[DEFAULT_BASEMAP];

    this.map = new maplibregl.Map({
      ...MAP_OPTIONS,
      style: initial
    });

    this.map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: false }),
      'top-right'
    );
    this.geolocateControl = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showAccuracyCircle: true,
      showUserLocation: true
    });
    this.map.addControl(this.geolocateControl, 'top-right');
    this.map.addControl(
      new maplibregl.ScaleControl({ maxWidth: 200, unit: 'metric' }),
      'bottom-right'
    );

    this.map.on('load', () => this._readyResolve(this.map));
    this.map.on('error', (e) => console.error('Map error:', e.error));
    registerFacilityIconLoader(this.map);
    registerInfraIconLoader(this.map);

    this._bindHud();
    this._bindControls();
    this._bindBasemapControls();

    return this._ready;
  }

  whenReady() {
    return this._ready;
  }

  /**
   * @param {string} styleName
   */
  switchBasemap(styleName) {
    // Topo is a contour overlay toggle, not a basemap swap.
    if (styleName === 'topo') {
      this.toggleContours();
      return;
    }

    if (!BASEMAP_STYLES[styleName] || styleName === this.currentStyle) return;

    this.currentStyle = styleName;
    this.map.setStyle(BASEMAP_STYLES[styleName]);

    this.map.once('idle', () => {
      restoreContourOverlay(this.map).then(() => this._syncTopoButton());
      if (typeof this.onStyleChange === 'function') {
        this.onStyleChange(styleName);
      }
    });
  }

  async toggleContours() {
    const next = !isContourOverlayOn();
    const mode = await setContourOverlay(this.map, next);
    this._syncTopoButton();
    if (typeof this.onStyleChange === 'function') {
      // Share state still tracks basemap; contour is orthogonal.
      this.onStyleChange(this.currentStyle);
    }
    return mode;
  }

  /** Re-apply contour overlay after LayerManager.refreshLayers. */
  restoreOverlays() {
    return restoreContourOverlay(this.map).then(() => this._syncTopoButton());
  }

  _syncTopoButton() {
    const topoBtn = document.getElementById('basemap-topo');
    if (!topoBtn) return;
    const on = isContourOverlayOn();
    topoBtn.classList.toggle('active', on);
    topoBtn.setAttribute('aria-pressed', String(on));
    topoBtn.title = on
      ? 'Contour overlay on — click to hide (stays on current basemap)'
      : 'Show contour lines on top of Positron / Dark / Satellite';
  }

  _bindHud() {
    const coordsEl = document.getElementById('coordinates-display');
    const zoomEl = document.getElementById('zoom-display');

    this.map.on('mousemove', (e) => {
      coordsEl.textContent = `Lat: ${e.lngLat.lat.toFixed(4)} | Lon: ${e.lngLat.lng.toFixed(4)}`;
    });

    this.map.on('mouseout', () => {
      coordsEl.textContent = 'Lat: -- | Lon: --';
    });

    this.map.on('zoom', () => {
      zoomEl.textContent = `Zoom: ${this.map.getZoom().toFixed(1)}`;
    });

    this.map.on('load', () => {
      zoomEl.textContent = `Zoom: ${this.map.getZoom().toFixed(1)}`;
    });
  }

  _bindControls() {
    document.getElementById('zoom-in')?.addEventListener('click', () => {
      this.map.zoomIn({ duration: 500 });
    });

    document.getElementById('zoom-out')?.addEventListener('click', () => {
      this.map.zoomOut({ duration: 500 });
    });

    document.getElementById('reset-view')?.addEventListener('click', () => {
      this.map.flyTo({
        center: LABRADOR_CENTER,
        zoom: DEFAULT_ZOOM,
        duration: 1000
      });
    });
  }

  _bindBasemapControls() {
    const buttons = document.querySelectorAll('.basemap-btn');

    buttons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const style = e.currentTarget.dataset.style;

        if (style === 'topo') {
          this.switchBasemap('topo');
          return;
        }

        this.switchBasemap(style);
        buttons.forEach((b) => {
          if (b.dataset.style === 'topo') return; // topo is independent toggle
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        e.currentTarget.classList.add('active');
        e.currentTarget.setAttribute('aria-pressed', 'true');
        this._syncTopoButton();
      });
    });
  }
}
