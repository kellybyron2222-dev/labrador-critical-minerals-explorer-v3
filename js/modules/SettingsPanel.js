/**
 * App Settings modal — expandable sections (KPI bar first; more later).
 */

import { KPI_CATALOG } from '../config/kpiCatalog.js';
import { getKpiEnabledIds, setKpiEnabledIds, resetKpiPrefs } from './UserPrefs.js';
import { escapeHtml } from './htmlEscape.js';

export default class SettingsPanel {
  /**
   * @param {{ onChange: () => void }} handlers
   */
  constructor(handlers = {}) {
    this.onChange = handlers.onChange || (() => {});
    this.open = false;
    /** @type {Record<string, boolean>} section id → expanded */
    this.sectionExpanded = { kpi: false };
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
   * @param {{ section?: 'kpi', expandSection?: boolean }} [opts]
   *   - Default open: KPI section stays minimized.
   *   - From KPI bar gear: `{ section: 'kpi', expandSection: true }`.
   */
  show(opts = {}) {
    if (opts.section === 'kpi' && opts.expandSection) {
      this.sectionExpanded.kpi = true;
    } else if (!opts.section) {
      // General Settings entry: keep subcategories collapsed by default.
      this.sectionExpanded.kpi = false;
    }

    this._lastFocus = document.activeElement;
    this.open = true;
    this.render();
    this.backdrop.hidden = false;
    this.panel.hidden = false;
    this.backdrop.classList.add('open');
    this.panel.classList.add('open');
    this.setInertBackground(true);

    if (opts.section === 'kpi') {
      const kpiEl = this.panel.querySelector('#settings-section-kpi');
      kpiEl?.scrollIntoView({ block: 'nearest' });
      this.panel.querySelector('[data-section-toggle="kpi"]')?.focus();
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

  render() {
    const enabled = getKpiEnabledIds();
    const enabledSet = new Set(enabled);
    const kpiExpanded = Boolean(this.sectionExpanded.kpi);

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

    this.panel.innerHTML = `
      <button type="button" class="settings-close" aria-label="Close settings">×</button>
      <h2 id="settings-title" class="settings-title">Settings</h2>
      <p class="settings-intro">App preferences. More sections will appear here over time.</p>

      <section id="settings-section-kpi" class="settings-section${kpiExpanded ? ' expanded' : ''}" aria-labelledby="settings-kpi-heading">
        <button type="button" class="settings-section-toggle" data-section-toggle="kpi" aria-expanded="${kpiExpanded}" aria-controls="settings-kpi-body">
          <svg class="settings-section-chevron" viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="9 6 15 12 9 18"></polyline>
          </svg>
          <span id="settings-kpi-heading" class="settings-section-title">KPI bar</span>
          <span class="settings-section-meta">${enabled.length} on</span>
        </button>
        <div id="settings-kpi-body" class="settings-section-body" ${kpiExpanded ? '' : 'hidden'}>
          ${kpiBody}
        </div>
      </section>
    `;

    this.panel.querySelector('.settings-close')?.addEventListener('click', () => this.close());

    this.panel.querySelector('[data-section-toggle="kpi"]')?.addEventListener('click', () => {
      this.sectionExpanded.kpi = !this.sectionExpanded.kpi;
      this.render();
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
  }
}
