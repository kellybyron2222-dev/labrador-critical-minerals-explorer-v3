/**
 * App Settings modal — expandable sections (KPI, About data, Export).
 */

import { KPI_CATALOG } from '../config/kpiCatalog.js';
import { getKpiEnabledIds, setKpiEnabledIds, resetKpiPrefs } from './UserPrefs.js';
import { escapeHtml } from './htmlEscape.js';

export default class SettingsPanel {
  /**
   * @param {{ onChange: () => void, onExportVisible?: () => void }} handlers
   */
  constructor(handlers = {}) {
    this.onChange = handlers.onChange || (() => {});
    this.onExportVisible = handlers.onExportVisible || (() => {});
    this.open = false;
    /** @type {Record<string, boolean>} section id → expanded */
    this.sectionExpanded = { kpi: false, about: false, export: false };
    this._lastFocus = null;

    this.backdrop = document.createElement('div');
    this.backdrop.className = 'settings-backdrop';
    this.backdrop.hidden = true;

    this.panel = document.createElement('div');
    this.panel.className = 'settings-panel';
    this.panel.setAttribute('role', 'dialog');
    this.panel.setAttribute('aria-modal', 'true');
    this.panel.setAttribute('aria-labelledby', 'settings-title');
    this.panel.hidden = true;

    document.body.appendChild(this.backdrop);
    document.body.appendChild(this.panel);

    this.backdrop.addEventListener('click', () => this.close());
    this._onKeyDown = (e) => {
      if (!this.open) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
        return;
      }
      if (e.key === 'Tab') this.trapFocus(e);
    };
    document.addEventListener('keydown', this._onKeyDown);
  }

  getFocusable() {
    return [
      ...this.panel.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ].filter((el) => el.offsetParent !== null || el === document.activeElement);
  }

  trapFocus(e) {
    const nodes = this.getFocusable();
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
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

  /**
   * @param {{ section?: 'kpi'|'about'|'export', expandSection?: boolean }} [opts]
   */
  show(opts = {}) {
    if (opts.section && opts.expandSection) {
      this.sectionExpanded[opts.section] = true;
    } else if (!opts.section) {
      this.sectionExpanded.kpi = false;
      this.sectionExpanded.about = false;
      this.sectionExpanded.export = false;
    }

    this._lastFocus = document.activeElement;
    this.open = true;
    this.render();
    this.backdrop.hidden = false;
    this.panel.hidden = false;
    this.backdrop.classList.add('open');
    this.panel.classList.add('open');
    this.setInertBackground(true);

    if (opts.section) {
      const el = this.panel.querySelector(`#settings-section-${opts.section}`);
      el?.scrollIntoView({ block: 'nearest' });
      this.panel.querySelector(`[data-section-toggle="${opts.section}"]`)?.focus();
    } else {
      this.panel.querySelector('.settings-close')?.focus();
    }
  }

  close() {
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

  toggle() {
    if (this.open) this.close();
    else this.show();
  }

  setSectionExpanded(id, expanded) {
    this.sectionExpanded[id] = expanded;
  }

  _sectionShell(id, title, meta, bodyHtml) {
    const expanded = Boolean(this.sectionExpanded[id]);
    return `
      <section id="settings-section-${id}" class="settings-section${expanded ? ' expanded' : ''}" aria-labelledby="settings-${id}-heading">
        <button type="button" class="settings-section-toggle" data-section-toggle="${id}" aria-expanded="${expanded}" aria-controls="settings-${id}-body">
          <svg class="settings-section-chevron" viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="9 6 15 12 9 18"></polyline>
          </svg>
          <span id="settings-${id}-heading" class="settings-section-title">${escapeHtml(title)}</span>
          ${meta ? `<span class="settings-section-meta">${escapeHtml(meta)}</span>` : ''}
        </button>
        <div id="settings-${id}-body" class="settings-section-body" ${expanded ? '' : 'hidden'}>
          ${bodyHtml}
        </div>
      </section>`;
  }

  render() {
    const enabled = getKpiEnabledIds();
    const enabledSet = new Set(enabled);

    const ordered = [
      ...enabled.map((id) => KPI_CATALOG.find((m) => m.id === id)).filter(Boolean),
      ...KPI_CATALOG.filter((m) => !enabledSet.has(m.id))
    ];

    const kpiBody = `
      <p class="settings-note">Counts use features intersecting the current map view (true geometry for polygons). Metrics for layers that are off are hidden from the bar.</p>
      <div class="settings-kpi-list" role="list">
        ${ordered
          .map((m) => {
            const on = enabledSet.has(m.id);
            const orderIndex = enabled.indexOf(m.id);
            return `
            <div class="settings-kpi-row" role="listitem" data-id="${m.id}">
              <label class="settings-kpi-check">
                <input type="checkbox" data-kpi-toggle="${m.id}" ${on ? 'checked' : ''} />
                <span class="settings-kpi-text">
                  <span class="settings-kpi-label">${escapeHtml(m.label)}</span>
                  <span class="settings-kpi-desc">${escapeHtml(m.description)}</span>
                </span>
              </label>
              <div class="settings-kpi-order" ${on ? '' : 'hidden'}>
                <button type="button" class="settings-order-btn" data-kpi-up="${m.id}" ${orderIndex <= 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
                <button type="button" class="settings-order-btn" data-kpi-down="${m.id}" ${orderIndex < 0 || orderIndex >= enabled.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
              </div>
            </div>`;
          })
          .join('')}
      </div>
      <div class="settings-actions">
        <button type="button" class="settings-reset-btn" data-kpi-reset>Reset KPI defaults</button>
      </div>`;

    const aboutBody = `
      <p class="settings-note"><strong>Labrador Critical Minerals Explorer</strong> — free, open map integrating public Labrador geoscience, occurrences, rights, and infrastructure.</p>
      <ul class="settings-about-list">
        <li><strong>Focus:</strong> mainland Labrador (not a Canada-wide thin map).</li>
        <li><strong>Load path:</strong> bake-first GeoJSON / WMS under <code>public/data/</code>, then IndexedDB, live ArcGIS only as fallback.</li>
        <li><strong>Sources:</strong> NL GeoAtlas (MODS, bedrock, surficial, mineral lands, land use / CPCAD, roads / rail / transmission, municipal), NRCan (mines / processing / exploration / development facilities, prospectivity WMS, national geology), CIRNAC/ISC (Nunatsiavut, ATRIS), curated Labrador ports / airports / generation / communities.</li>
        <li><strong>Hard exclusions:</strong> parks / conserved + public water supplies only — Indigenous lands are consultation context, not a total block.</li>
        <li><strong>Honesty:</strong> processing/midstream icons may be off-island (e.g. Long Harbour); Labrador has primary production, not local critical-mineral refining.</li>
      </ul>
      <p class="settings-note">Living engineering checklist: see <code>BUILD_PLAN.md</code> in the project repo. Product arc: <code>PRODUCT_PLAN.md</code>.</p>`;

    const exportBody = `
      <p class="settings-note">Download currently filtered MODS points in the map view (and claims if that layer is on) as GeoJSON for GIS / field apps. Shapefile / KMZ come later.</p>
      <div class="settings-actions">
        <button type="button" class="settings-primary-btn" data-export-visible>Download visible GeoJSON</button>
      </div>`;

    this.panel.innerHTML = `
      <button type="button" class="settings-close" aria-label="Close settings">×</button>
      <h2 id="settings-title" class="settings-title">Settings</h2>
      <p class="settings-intro">Preferences, data notes, and exports.</p>
      ${this._sectionShell('kpi', 'KPI bar', `${enabled.length} on`, kpiBody)}
      ${this._sectionShell('about', 'About data', '', aboutBody)}
      ${this._sectionShell('export', 'Export', 'GeoJSON', exportBody)}
    `;

    this.panel.querySelector('.settings-close')?.addEventListener('click', () => this.close());

    this.panel.querySelectorAll('[data-section-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-section-toggle');
        this.sectionExpanded[id] = !this.sectionExpanded[id];
        this.render();
      });
    });

    this.panel.querySelectorAll('[data-kpi-toggle]').forEach((input) => {
      input.addEventListener('change', (e) => {
        const id = e.target.getAttribute('data-kpi-toggle');
        let next = getKpiEnabledIds();
        if (e.target.checked) {
          if (!next.includes(id)) next = [...next, id];
        } else {
          next = next.filter((x) => x !== id);
        }
        if (!next.length) {
          e.target.checked = true;
          return;
        }
        setKpiEnabledIds(next);
        this.onChange();
        this.render();
      });
    });

    this.panel.querySelectorAll('[data-kpi-up]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-kpi-up');
        const next = [...getKpiEnabledIds()];
        const i = next.indexOf(id);
        if (i > 0) {
          [next[i - 1], next[i]] = [next[i], next[i - 1]];
          setKpiEnabledIds(next);
          this.onChange();
          this.render();
        }
      });
    });

    this.panel.querySelectorAll('[data-kpi-down]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-kpi-down');
        const next = [...getKpiEnabledIds()];
        const i = next.indexOf(id);
        if (i >= 0 && i < next.length - 1) {
          [next[i + 1], next[i]] = [next[i], next[i + 1]];
          setKpiEnabledIds(next);
          this.onChange();
          this.render();
        }
      });
    });

    this.panel.querySelector('[data-kpi-reset]')?.addEventListener('click', () => {
      resetKpiPrefs();
      this.onChange();
      this.render();
    });

    this.panel.querySelector('[data-export-visible]')?.addEventListener('click', () => {
      this.onExportVisible();
    });
  }
}
