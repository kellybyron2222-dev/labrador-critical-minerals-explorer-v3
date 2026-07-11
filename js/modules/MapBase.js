/** Module 1: MapLibre base layer — init, controls, HUD, basemap switching */

import maplibregl from 'maplibre-gl';
import {
  BASEMAP_STYLES,
  DEFAULT_BASEMAP,
  DEFAULT_ZOOM,
  LABRADOR_CENTER,
  MAP_OPTIONS
} from '../config/mapConfig.js';
import { registerFacilityIconLoader } from './facilityIcons.js';

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

    this.map = new maplibregl.Map({
      ...MAP_OPTIONS,
      style: BASEMAP_STYLES[this.currentStyle]
    });

    this.map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: false }),
      'top-right'
    );
    this.map.addControl(
      new maplibregl.ScaleControl({ maxWidth: 200, unit: 'metric' }),
      'bottom-right'
    );

    this.map.on('load', () => this._readyResolve(this.map));
    this.map.on('error', (e) => console.error('Map error:', e.error));
    registerFacilityIconLoader(this.map);

    this._bindHud();
    this._bindControls();
    this._bindBasemapControls();

    return this._ready;
  }

  whenReady() {
    return this._ready;
  }

  switchBasemap(styleName) {
    if (!BASEMAP_STYLES[styleName] || styleName === this.currentStyle) return;

    this.currentStyle = styleName;
    this.map.setStyle(BASEMAP_STYLES[styleName]);

    // NOTE: `setStyle()` diffs the incoming style against the current one
    // (default `diff: true`) and, when it can, patches sources/layers in
    // place instead of doing a full reload - in which case `style.load`
    // never fires again (only `styledata`, repeatedly, as each diff op
    // applies). Waiting on `style.load` here previously meant every runtime
    // layer (MODS, facilities, occurrence-density surfaces, ...) silently
    // disappeared on basemap switch and never got restored, since the diff
    // strips our custom sources/layers (they're not part of either style's
    // spec) but the restore callback below was never invoked. `idle` fires
    // once rendering settles regardless of which path setStyle took, so it's
    // the one signal that reliably means "safe to re-add our layers now".
    this.map.once('idle', () => {
      if (typeof this.onStyleChange === 'function') {
        this.onStyleChange(styleName);
      }
    });
  }

  _bindHud() {
    const coordsEl = document.getElementById('coordinates-display');
    const zoomEl = document.getElementById('zoom-display');

    this.map.on('mousemove', (e) => {
      coordsEl.textContent =
        `Lat: ${e.lngLat.lat.toFixed(4)} | Lon: ${e.lngLat.lng.toFixed(4)}`;
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
        this.switchBasemap(style);
        buttons.forEach((b) => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
      });
    });
  }
}
