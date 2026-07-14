/**
 * App Settings modal — expandable sections (KPI, About, Export, Updates,
 * Feedback, Share) for the Stage B0 soft launch.
 */

import { KPI_CATALOG } from '../config/kpiCatalog.js';
import { getKpiEnabledIds, setKpiEnabledIds, resetKpiPrefs } from './UserPrefs.js';
import { escapeHtml } from './htmlEscape.js';
import {
  FORMSPREE_WAITLIST_ID,
  FORMSPREE_FEEDBACK_ID,
  formspreeUrl,
  getUtmParams,
  APP_PUBLIC_URL,
  APP_REPO_URL
} from './launchConfig.js';
import { track, PlausibleEvents } from './analytics.js';

const SECTION_IDS = ['kpi', 'about', 'export', 'updates', 'feedback', 'share'];

export default class SettingsPanel {
  /**
   * @param {{
   *   onChange?: () => void,
   *   onExportPackage?: (formats: Record<string, boolean>) => void | Promise<any>,
   *   onCopyShareLink?: () => void | Promise<any>
   * }} handlers
   */
  constructor(handlers = {}) {
    this.onChange = handlers.onChange || (() => {});
    this.onExportPackage = handlers.onExportPackage || (() => {});
    this.onCopyShareLink = handlers.onCopyShareLink || (() => {});
    this.open = false;
    /** @type {Record<string, boolean>} section id → expanded */
    this.sectionExpanded = SECTION_IDS.reduce((acc, id) => ({ ...acc, [id]: false }), {});
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
   * @param {{ section?: 'kpi'|'about'|'export'|'updates'|'feedback'|'share', expandSection?: boolean }} [opts]
   */
  show(opts = {}) {
    if (opts.section && opts.expandSection) {
      this.sectionExpanded[opts.section] = true;
    } else if (!opts.section) {
      SECTION_IDS.forEach((id) => {
        this.sectionExpanded[id] = false;
      });
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

  _renderKpiBody() {
    const enabled = getKpiEnabledIds();
    const enabledSet = new Set(enabled);

    const ordered = [
      ...enabled.map((id) => KPI_CATALOG.find((m) => m.id === id)).filter(Boolean),
      ...KPI_CATALOG.filter((m) => !enabledSet.has(m.id))
    ];

    return `
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
  }

  _renderAboutBody() {
    return `
      <p class="settings-note"><strong>Labrador Critical Minerals Explorer</strong> is a free, open map built entirely from public data — no logins, no paywalls.</p>
      <ul class="settings-about-list">
        <li><strong>Focus:</strong> mainland Labrador — not a thin Canada-wide map.</li>
        <li><strong>Sources:</strong> NL GeoAtlas, Natural Resources Canada (NRCan), Crown-Indigenous Relations and Northern Affairs Canada / Indigenous Services Canada (CIRNAC / ISC), and MapLibre for the base map.</li>
        <li><strong>Hard exclusions:</strong> parks / conserved areas and public water supplies are excluded outright. Indigenous lands are shown as consultation context, not a blanket exclusion.</li>
        <li><strong>Coordinate reference:</strong> vector exports use WGS 84 / EPSG:4326 (CRS84 lon-lat ordering).</li>
        <li><strong>Claims data:</strong> mineral claims are baked roughly every ~3 months, not a live staking feed — always verify against the official registry before making decisions.</li>
      </ul>
      <p class="settings-note">
        <a href="${escapeHtml(APP_PUBLIC_URL)}" target="_blank" rel="noopener">Open the public app</a>
        &nbsp;&middot;&nbsp;
        <a href="${escapeHtml(APP_REPO_URL)}" target="_blank" rel="noopener">View source on GitHub</a>
      </p>`;
  }

  _renderExportBody() {
    return `
      <p class="settings-note">Downloads layers that are on and loaded, intersecting the current map view, as a single ZIP: GeoJSON, CSV (point layers), KML, Shapefile, and display rasters (if on). Coordinate reference: WGS 84 (EPSG:4326).</p>
      <div class="settings-form settings-export-formats">
        <label class="settings-field settings-field-checkbox">
          <input type="checkbox" data-export-fmt="geojson" checked />
          <span>GeoJSON</span>
        </label>
        <label class="settings-field settings-field-checkbox">
          <input type="checkbox" data-export-fmt="csv" checked />
          <span>CSV (points)</span>
        </label>
        <label class="settings-field settings-field-checkbox">
          <input type="checkbox" data-export-fmt="kml" checked />
          <span>KML</span>
        </label>
        <label class="settings-field settings-field-checkbox">
          <input type="checkbox" data-export-fmt="shapefile" />
          <span>Shapefile tip (adds README note; use QGIS from GeoJSON)</span>
        </label>
        <label class="settings-field settings-field-checkbox">
          <input type="checkbox" data-export-fmt="rasters" checked />
          <span>Display rasters (if on)</span>
        </label>
      </div>
      <div class="settings-actions">
        <button type="button" class="settings-primary-btn" data-export-package>Download export package</button>
        <p class="export-status settings-note" data-export-status></p>
      </div>`;
  }

  _hiddenUtmFieldsHtml() {
    const utm = getUtmParams();
    return Object.entries(utm)
      .map(([key, value]) => `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(value)}" />`)
      .join('');
  }

  _renderUpdatesBody() {
    if (!FORMSPREE_WAITLIST_ID) {
      return `<p class="settings-note">Waitlist form not configured yet. Set <code>VITE_FORMSPREE_WAITLIST</code> in <code>.env</code>.</p>`;
    }

    return `
      <p class="settings-note">Get notified about new layers, data refreshes, and major changes. No spam.</p>
      <form class="settings-form" data-waitlist-form novalidate>
        <input type="hidden" name="_subject" value="Labrador Explorer — waitlist signup" />
        ${this._hiddenUtmFieldsHtml()}
        <label class="settings-field">
          <span class="settings-field-label">Email <span aria-hidden="true">*</span></span>
          <input type="email" name="email" required autocomplete="email" />
        </label>
        <label class="settings-field">
          <span class="settings-field-label">Name (optional)</span>
          <input type="text" name="name" autocomplete="name" />
        </label>
        <fieldset class="settings-field settings-field-group">
          <legend class="settings-field-label">I&rsquo;m interested in&hellip;</legend>
          <label class="settings-field-checkbox">
            <input type="checkbox" name="intent" value="updates" checked />
            <span>Product updates</span>
          </label>
          <label class="settings-field-checkbox">
            <input type="checkbox" name="intent" value="changelog" />
            <span>Changelog / new layers</span>
          </label>
          <label class="settings-field-checkbox">
            <input type="checkbox" name="intent" value="other" />
            <span>Other</span>
          </label>
        </fieldset>
        <div class="settings-actions">
          <button type="submit" class="settings-primary-btn" data-waitlist-submit>Join the waitlist</button>
        </div>
      </form>
      <p class="settings-form-status settings-note" data-waitlist-status hidden></p>`;
  }

  _renderFeedbackBody() {
    if (!FORMSPREE_FEEDBACK_ID) {
      return `<p class="settings-note">Feedback form not configured yet. Set <code>VITE_FORMSPREE_FEEDBACK</code> in <code>.env</code>.</p>`;
    }

    return `
      <p class="settings-note">Spot a bug, missing layer, or bad data? Tell us.</p>
      <form class="settings-form" data-feedback-form novalidate>
        <input type="hidden" name="_subject" value="Labrador Explorer — feedback" />
        ${this._hiddenUtmFieldsHtml()}
        <label class="settings-field">
          <span class="settings-field-label">Message <span aria-hidden="true">*</span></span>
          <textarea name="message" rows="4" required></textarea>
        </label>
        <label class="settings-field">
          <span class="settings-field-label">Email (optional — so we can follow up)</span>
          <input type="email" name="email" autocomplete="email" />
        </label>
        <div class="settings-actions">
          <button type="submit" class="settings-primary-btn" data-feedback-submit>Send feedback</button>
        </div>
      </form>
      <p class="settings-form-status settings-note" data-feedback-status hidden></p>`;
  }

  _renderShareBody() {
    return `
      <p class="settings-note">Copies a link that restores your current layers, filters, and map position.</p>
      <div class="settings-actions">
        <button type="button" class="settings-primary-btn" data-copy-share>Copy link to this view</button>
        <p class="settings-note" data-share-status role="status"></p>
      </div>`;
  }

  render() {
    const enabled = getKpiEnabledIds();

    this.panel.innerHTML = `
      <button type="button" class="settings-close" aria-label="Close settings">×</button>
      <h2 id="settings-title" class="settings-title">Settings</h2>
      <p class="settings-intro">Preferences, data notes, exports, and ways to stay in touch.</p>
      ${this._sectionShell('kpi', 'KPI bar', `${enabled.length} on`, this._renderKpiBody())}
      ${this._sectionShell('about', 'About data', '', this._renderAboutBody())}
      ${this._sectionShell('export', 'Export', '', this._renderExportBody())}
      ${this._sectionShell('updates', 'Stay updated', FORMSPREE_WAITLIST_ID ? '' : 'not set', this._renderUpdatesBody())}
      ${this._sectionShell('feedback', 'Feedback', FORMSPREE_FEEDBACK_ID ? '' : 'not set', this._renderFeedbackBody())}
      ${this._sectionShell('share', 'Share this view', '', this._renderShareBody())}
    `;

    this.panel.querySelector('.settings-close')?.addEventListener('click', () => this.close());

    this.panel.querySelectorAll('[data-section-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-section-toggle');
        this.sectionExpanded[id] = !this.sectionExpanded[id];
        this.render();
      });
    });

    this._bindKpiSection();
    this._bindExportSection();
    this._bindFormspreeForm(this.panel.querySelector('[data-waitlist-form]'), {
      statusSelector: '[data-waitlist-status]',
      formId: FORMSPREE_WAITLIST_ID,
      eventName: PlausibleEvents.WAITLIST_SUBMIT,
      successText: 'Thanks — you\u2019re on the list. We\u2019ll be in touch.'
    });
    this._bindFormspreeForm(this.panel.querySelector('[data-feedback-form]'), {
      statusSelector: '[data-feedback-status]',
      formId: FORMSPREE_FEEDBACK_ID,
      eventName: PlausibleEvents.FEEDBACK_SUBMIT,
      successText: 'Thanks for the feedback — we read every note.'
    });
    this._bindShareSection();
  }

  _bindKpiSection() {
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

  _bindExportSection() {
    const btn = this.panel.querySelector('[data-export-package]');
    const status = this.panel.querySelector('[data-export-status]');
    if (!btn) return;

    const originalLabel = btn.textContent;
    btn.addEventListener('click', async () => {
      const formats = {};
      this.panel.querySelectorAll('[data-export-fmt]').forEach((input) => {
        formats[input.getAttribute('data-export-fmt')] = input.checked;
      });

      btn.disabled = true;
      btn.textContent = 'Preparing…';
      if (status) status.textContent = 'Building export package…';

      try {
        await this.onExportPackage(formats);
        if (status) status.textContent = 'Export downloaded.';
      } catch (err) {
        if (status) status.textContent = `Export failed: ${err?.message || err}`;
      } finally {
        btn.disabled = false;
        btn.textContent = originalLabel;
      }
    });
  }

  /**
   * @param {HTMLFormElement | null} form
   * @param {{ statusSelector: string, formId: string, eventName: string, successText: string }} opts
   */
  _bindFormspreeForm(form, opts) {
    if (!form) return;
    const status = this.panel.querySelector(opts.statusSelector);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!opts.formId) return;

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalLabel = submitBtn?.textContent;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending…';
      }
      if (status) {
        status.hidden = false;
        status.textContent = 'Sending…';
      }

      try {
        const resp = await fetch(formspreeUrl(opts.formId), {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: new FormData(form)
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        track(opts.eventName);
        form.hidden = true;
        if (status) status.textContent = opts.successText;
      } catch (err) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalLabel;
        }
        if (status) status.textContent = `Something went wrong — please try again. (${err?.message || err})`;
      }
    });
  }

  _bindShareSection() {
    const btn = this.panel.querySelector('[data-copy-share]');
    const status = this.panel.querySelector('[data-share-status]');
    if (!btn) return;

    btn.addEventListener('click', async () => {
      track(PlausibleEvents.VIEW_SHARE);
      try {
        await this.onCopyShareLink();
        if (status) status.textContent = 'Link copied to clipboard.';
      } catch (err) {
        if (status) status.textContent = `Could not copy link: ${err?.message || err}`;
      }
    });
  }
}
