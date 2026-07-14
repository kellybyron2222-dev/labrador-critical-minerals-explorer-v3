/**
 * Standalone About dialog — sources, CRS, honesty notes (not the welcome tips).
 */

import { escapeHtml } from './htmlEscape.js';
import { APP_PUBLIC_URL, APP_REPO_URL } from './launchConfig.js';
import { PlausibleEvents, track } from './analytics.js';

export default class AboutModal {
  /**
   * @param {{ stats?: { modsCount?: number, vectorLayers?: number, signalLayers?: number } }} [opts]
   */
  constructor(opts = {}) {
    this.stats = opts.stats || {};
    this.open = false;
    this._lastFocus = null;

    this.backdrop = document.createElement('div');
    this.backdrop.className = 'about-backdrop settings-backdrop';
    this.backdrop.hidden = true;

    this.panel = document.createElement('div');
    this.panel.className = 'about-panel settings-panel';
    this.panel.setAttribute('role', 'dialog');
    this.panel.setAttribute('aria-modal', 'true');
    this.panel.setAttribute('aria-labelledby', 'about-dialog-title');
    this.panel.hidden = true;

    document.body.appendChild(this.backdrop);
    document.body.appendChild(this.panel);

    this.backdrop.addEventListener('click', () => this.close());
    this._onKeyDown = (e) => {
      if (!this.open) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      }
    };
    document.addEventListener('keydown', this._onKeyDown);
  }

  setStats(stats) {
    this.stats = { ...this.stats, ...stats };
  }

  setInertBackground(inert) {
    const app = document.querySelector('.app-container');
    if (!app) return;
    if (inert) {
      app.setAttribute('inert', '');
      app.setAttribute('aria-hidden', 'true');
    } else {
      app.removeAttribute('inert');
      app.removeAttribute('aria-hidden');
    }
  }

  show() {
    this._lastFocus = document.activeElement;
    this.open = true;
    this.render();
    this.backdrop.hidden = false;
    this.panel.hidden = false;
    this.backdrop.classList.add('open');
    this.panel.classList.add('open');
    this.setInertBackground(true);
    this.panel.querySelector('.settings-close')?.focus();
    track(PlausibleEvents.SETTINGS_OPEN, { section: 'about-modal' });
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.backdrop.classList.remove('open');
    this.panel.classList.remove('open');
    this.backdrop.hidden = true;
    this.panel.hidden = true;
    this.setInertBackground(false);
    if (this._lastFocus && typeof this._lastFocus.focus === 'function') {
      this._lastFocus.focus();
    }
    this._lastFocus = null;
  }

  render() {
    const mods =
      this.stats.modsCount != null
        ? Number(this.stats.modsCount).toLocaleString()
        : '~3,175';
    const vectors = this.stats.vectorLayers ?? '20+';
    const signals = this.stats.signalLayers ?? 6;

    this.panel.innerHTML = `
      <button type="button" class="settings-close" aria-label="Close about">×</button>
      <h2 id="about-dialog-title" class="settings-title">About this map</h2>
      <p class="settings-intro">A free Labrador critical-minerals explorer built from public government data — one map instead of a dozen atlases.</p>

      <p class="settings-note about-stats" role="note">
        <strong>${escapeHtml(String(mods))}</strong> Labrador MODS points ·
        <strong>${escapeHtml(String(vectors))}</strong> vector layers ·
        <strong>${escapeHtml(String(signals))}</strong> geophysics / WMS signal products
      </p>

      <ul class="settings-about-list">
        <li><strong>Focus:</strong> mainland Labrador — not a thin Canada-wide map.</li>
        <li><strong>Sources:</strong> NL GeoAtlas (MODS, geology, mineral lands, land use, roads/rail/transmission, airborne surveys), NRCan (facilities, prospectivity, national geology, Bouguer gravity), CIRNAC/ISC (Nunatsiavut, ATRIS), MapLibre basemaps.</li>
        <li><strong>Hard exclusions:</strong> parks / conserved areas and public water supplies. Indigenous lands are consultation context, not a blanket block.</li>
        <li><strong>Coordinates:</strong> vector data and exports use WGS&nbsp;84 / EPSG:4326 (CRS84 lon-lat).</li>
        <li><strong>Freshness:</strong> claims and most layers are baked on a cadence (claims ~3 months) — not a live staking feed. Verify against official registries before decisions.</li>
        <li><strong>Honesty:</strong> midstream / processing icons may sit off-island (e.g. Long Harbour); Labrador has primary production, not local critical-mineral refining.</li>
        <li><strong>Privacy:</strong> Plausible analytics (no ad cookies) and optional email forms — see the <a href="./privacy.html" target="_blank" rel="noopener">privacy notice</a>. Last view is stored in localStorage on this device only.</li>
      </ul>

      <p class="settings-note">
        <a href="${escapeHtml(APP_PUBLIC_URL)}" target="_blank" rel="noopener">Public app</a>
        &nbsp;&middot;&nbsp;
        <a href="${escapeHtml(APP_REPO_URL)}" target="_blank" rel="noopener">Source on GitHub</a>
        &nbsp;&middot;&nbsp;
        <a href="./privacy.html" target="_blank" rel="noopener">Privacy</a>
      </p>

      <div class="settings-actions">
        <button type="button" class="settings-primary-btn" data-about-close>Got it</button>
      </div>`;

    this.panel.querySelector('.settings-close')?.addEventListener('click', () => this.close());
    this.panel.querySelector('[data-about-close]')?.addEventListener('click', () => this.close());
  }
}
