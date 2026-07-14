/**
 * Shareable map view state encoded in the URL hash (#v=1&…).
 * Also persists last view to localStorage so returning visitors resume
 * (no cookies required — same-origin browser storage only).
 */

import { DEFAULT_ZOOM, LABRADOR_CENTER } from '../config/mapConfig.js';
import { APP_PUBLIC_URL } from './launchConfig.js';

const VERSION = '1';
const DEFAULT_LON = LABRADOR_CENTER[0];
const DEFAULT_LAT = LABRADOR_CENTER[1];
const LAST_VIEW_KEY = 'explorer-v3-last-view';

/** @typedef {{
 *   zoom?: number,
 *   lat?: number,
 *   lon?: number,
 *   basemap?: string,
 *   layers?: string[],
 *   mods?: string,
 *   statuses?: string[],
 *   q?: string,
 *   fatalFlaw?: boolean
 * }} ViewState */

/**
 * @param {string | null | undefined} raw
 * @returns {URLSearchParams | null}
 */
function parseHashParams(raw) {
  if (!raw) return null;
  const stripped = raw.replace(/^#/, '').trim();
  if (!stripped.startsWith('v=')) return null;
  return new URLSearchParams(stripped);
}

/**
 * @param {number | undefined} value
 * @param {number} fallback
 * @returns {number | undefined}
 */
function parseNum(value, fallback) {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

/**
 * @param {string | null | undefined} raw
 * @returns {string[] | undefined}
 */
function parseList(raw) {
  if (!raw) return undefined;
  const items = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length ? items : undefined;
}

/**
 * @param {number} a
 * @param {number} b
 * @param {number} [epsilon=1e-6]
 */
function near(a, b, epsilon = 1e-6) {
  return Math.abs(a - b) <= epsilon;
}

/**
 * @param {ViewState} state
 * @returns {URLSearchParams}
 */
function encodeStateToParams(state = {}) {
  const params = new URLSearchParams();
  params.set('v', VERSION);

  if (state.zoom != null && !near(state.zoom, DEFAULT_ZOOM)) {
    params.set('z', String(roundCoord(state.zoom, 2)));
  }
  if (state.lat != null && !near(state.lat, DEFAULT_LAT)) {
    params.set('lat', String(roundCoord(state.lat, 5)));
  }
  if (state.lon != null && !near(state.lon, DEFAULT_LON)) {
    params.set('lon', String(roundCoord(state.lon, 5)));
  }
  if (state.layers?.length) {
    params.set('layers', state.layers.join(','));
  }
  if (state.mods) {
    params.set('mods', state.mods);
  }
  if (state.statuses?.length) {
    params.set('statuses', state.statuses.join(','));
  }
  if (state.q) {
    params.set('q', state.q);
  }
  if (state.fatalFlaw) {
    params.set('ff', '1');
  }
  if (state.basemap && state.basemap !== 'positron') {
    params.set('bm', state.basemap);
  }

  return params;
}

/**
 * @param {number} n
 * @param {number} digits
 */
function roundCoord(n, digits) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/**
 * Read view state from `location.hash`.
 * @returns {ViewState | null} null when hash absent or unsupported
 */
export function readViewState() {
  if (typeof location === 'undefined') return null;
  const params = parseHashParams(location.hash);
  if (!params || params.get('v') !== VERSION) return null;

  /** @type {ViewState} */
  const state = {};

  const zoom = parseNum(params.get('z'), DEFAULT_ZOOM);
  if (zoom != null) state.zoom = zoom;

  const lat = parseNum(params.get('lat'), DEFAULT_LAT);
  if (lat != null) state.lat = lat;

  const lon = parseNum(params.get('lon'), DEFAULT_LON);
  if (lon != null) state.lon = lon;

  const layers = parseList(params.get('layers'));
  if (layers) state.layers = layers;

  const mods = params.get('mods');
  if (mods) state.mods = mods;

  const statuses = parseList(params.get('statuses'));
  if (statuses) state.statuses = statuses;

  const q = params.get('q');
  if (q) state.q = q;

  if (params.get('ff') === '1') state.fatalFlaw = true;

  const basemap = params.get('bm');
  if (basemap) state.basemap = basemap;

  return state;
}

/**
 * Update the URL hash without scrolling the page.
 * Also persists to localStorage for return visits.
 * @param {ViewState} state
 */
export function writeViewState(state) {
  if (typeof history === 'undefined' || typeof location === 'undefined') return;
  const params = encodeStateToParams(state);
  const hash = `#${params.toString()}`;
  const url = `${location.pathname}${location.search}${hash}`;
  history.replaceState(history.state, '', url);
  saveLastView(state);
}

/**
 * Persist last view on this device (localStorage — not cookies).
 * @param {ViewState} state
 */
export function saveLastView(state) {
  try {
    localStorage.setItem(LAST_VIEW_KEY, JSON.stringify(state || {}));
  } catch {
    /* quota / private mode */
  }
}

/**
 * @returns {ViewState | null}
 */
export function loadLastView() {
  try {
    const raw = localStorage.getItem(LAST_VIEW_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Prefer URL hash (shared link); else last saved view on this device.
 * @returns {ViewState | null}
 */
export function resolveBootstrapViewState() {
  return readViewState() || loadLastView();
}

/**
 * Build an absolute share URL for the given view state.
 * @param {ViewState} state
 * @returns {string}
 */
export function buildShareUrl(state) {
  const params = encodeStateToParams(state);
  const base = APP_PUBLIC_URL.replace(/\/?$/, '/');
  return `${base}#${params.toString()}`;
}
