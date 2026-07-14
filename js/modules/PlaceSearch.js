/**
 * Soft-launch place / claim / coordinate search (local index + optional Nominatim).
 */

import { parseCoordinatePair, flyToCoordinate } from './MapTools.js';

/**
 * @param {object} opts
 * @param {import('maplibre-gl').Map} opts.map
 * @param {() => GeoJSON.Feature[]} opts.getCommunityFeatures
 * @param {() => GeoJSON.Feature[]} [opts.getClaimFeatures]
 * @param {(msg: string, tone?: string) => void} [opts.onStatus]
 * @param {(lon: number, lat: number) => void} [opts.onFocus]
 */
export function mountPlaceSearch(opts) {
  const { map, getCommunityFeatures, getClaimFeatures, onStatus, onFocus } = opts;
  const container = document.querySelector('.map-container');
  if (!container || document.getElementById('place-search-bar')) return null;

  const bar = document.createElement('div');
  bar.id = 'place-search-bar';
  bar.className = 'place-search-bar';
  bar.innerHTML = `
    <label class="place-search-label" for="place-search-input">Go to</label>
    <input id="place-search-input" class="place-search-input" type="search"
      placeholder="Place, claim #, or lon,lat" autocomplete="off" />
    <button type="button" class="place-search-btn" data-place-go>Go</button>
    <ul class="place-search-results" hidden data-place-results></ul>`;
  container.appendChild(bar);

  const input = bar.querySelector('#place-search-input');
  const results = bar.querySelector('[data-place-results]');
  const goBtn = bar.querySelector('[data-place-go]');

  const runSearch = async () => {
    const q = (input.value || '').trim();
    if (!q) return;

    const coords = parseCoordinatePair(q);
    if (coords) {
      flyToCoordinate(map, coords[0], coords[1]);
      onFocus?.(coords[0], coords[1]);
      results.hidden = true;
      onStatus?.(`Flew to ${coords[1].toFixed(4)}, ${coords[0].toFixed(4)}`, 'info');
      return;
    }

    const qLower = q.toLowerCase();
    const hits = [];

    for (const f of getCommunityFeatures?.() || []) {
      const name = f.properties?.name || f.properties?.NAME || '';
      if (name && name.toLowerCase().includes(qLower) && f.geometry?.type === 'Point') {
        hits.push({
          label: name,
          kind: 'community',
          center: f.geometry.coordinates
        });
      }
    }

    for (const f of getClaimFeatures?.() || []) {
      const nbr = String(f.properties?.LICENSE_NBR || f.properties?.name || '');
      const client = String(f.properties?.CLIENT_NAME || '');
      if (
        (nbr && nbr.toLowerCase().includes(qLower)) ||
        (client && client.toLowerCase().includes(qLower))
      ) {
        const c = centroidOf(f);
        if (c) hits.push({ label: `Claim ${nbr || client}`, kind: 'claim', center: c });
      }
    }

    if (!hits.length) {
      try {
        const nom = await nominatimSearch(q);
        hits.push(...nom);
      } catch {
        /* offline / blocked */
      }
    }

    if (!hits.length) {
      results.hidden = true;
      onStatus?.('No places matched that search.', 'error');
      return;
    }

    results.innerHTML = hits
      .slice(0, 8)
      .map(
        (h, i) =>
          `<li><button type="button" data-hit="${i}">${escape(h.label)} <span class="place-search-kind">${escape(
            h.kind
          )}</span></button></li>`
      )
      .join('');
    results.hidden = false;
    results.querySelectorAll('[data-hit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const hit = hits[Number(btn.getAttribute('data-hit'))];
        if (!hit?.center) return;
        flyToCoordinate(map, hit.center[0], hit.center[1]);
        onFocus?.(hit.center[0], hit.center[1]);
        results.hidden = true;
        input.value = hit.label;
      });
    });

    if (hits.length === 1) {
      flyToCoordinate(map, hits[0].center[0], hits[0].center[1]);
      onFocus?.(hits[0].center[0], hits[0].center[1]);
      results.hidden = true;
    }
  };

  goBtn.addEventListener('click', () => runSearch());
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runSearch();
    }
  });

  return { destroy: () => bar.remove() };
}

function centroidOf(feature) {
  const g = feature?.geometry;
  if (!g) return null;
  if (g.type === 'Point') return g.coordinates;
  const coords =
    g.type === 'Polygon'
      ? g.coordinates[0]
      : g.type === 'MultiPolygon'
        ? g.coordinates[0]?.[0]
        : null;
  if (!coords?.length) return null;
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const c of coords) {
    if (c?.length >= 2) {
      sx += c[0];
      sy += c[1];
      n += 1;
    }
  }
  return n ? [sx / n, sy / n] : null;
}

async function nominatimSearch(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=ca&q=${encodeURIComponent(
    `${q} Labrador Newfoundland`
  )}`;
  const resp = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'LabradorCriticalMineralsExplorer/3.0' }
  });
  if (!resp.ok) return [];
  const json = await resp.json();
  return (json || [])
    .map((row) => ({
      label: row.display_name,
      kind: 'place',
      center: [Number(row.lon), Number(row.lat)]
    }))
    .filter((h) => Number.isFinite(h.center[0]) && Number.isFinite(h.center[1]));
}

function escape(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
