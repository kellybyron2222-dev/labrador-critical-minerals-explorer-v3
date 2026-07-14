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
  CONTACT_EMAIL,
  getUtmParams
} from './launchConfig.js';
import { track, PlausibleEvents } from './analytics.js';
import { submitLead, isLeadCaptureConfigured } from './leadCapture.js';

const SECTION_IDS = ['kpi', 'about', 'export', 'updates', 'feedback', 'share'];

export default class SettingsPanel {
  /**
   * @param {{
   *   onChange?: () => void,
   *   onExportPackage?: (formats: Record<string, boolean>) => void | Promise<any>,
   *   onCopyShareLink?: () => void | Promise<any>,
   *   onOpenAbout?: () => void,
   *   onReplayHelp?: () => void,
   *   onEnableExportLayers?: () => void | Promise<any>,
   *   getFeedbackContext?: () => Record<string, string>
   * }} handlers
   */
  constructor(handlers = {}) {
    this.onChange = handlers.onChange || (() => {});
    this.onExportPackage = handlers.onExportPackage || (() => {});
    this.onCopyShareLink = handlers.onCopyShareLink || (() => {});
    this.onOpenAbout = handlers.onOpenAbout || (() => {});
    this.onReplayHelp = handlers.onReplayHelp || (() => {});
    this.onEnableExportLayers = handlers.onEnableExportLayers || (() => {});
    this.getFeedbackContext = handlers.getFeedbackContext || (() => ({}));
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
      <p class="settings-note">Data sources, coordinate reference, and honesty notes live in the About panel.</p>
      <div class="settings-actions">
        <button type="button" class="settings-primary-btn" data-open-about-modal>Open About</button>
        <button type="button" class="settings-reset-btn" data-replay-help>Replay welcome tips</button>
      </div>
      <p class="settings-note"><a href="./privacy.html" target="_blank" rel="noopener">Privacy notice</a></p>`;
  }

  _renderExportBody() {
    return `
      <p class="settings-note">Downloads layers that are on and loaded, intersecting the current map view, as a single ZIP: GeoJSON, CSV (point layers), KML, Shapefile tip, and display rasters (if on). Coordinate reference: WGS 84 (EPSG:4326).</p>
      <p class="settings-note">For a fuller package, enable Claims, Roads, Rail, Transmission, Bedrock, and Signals — or use the button below.</p>
      <div class="settings-actions">
        <button type="button" class="settings-reset-btn" data-export-enable-layers>Enable recommended layers for export</button>
      </div>
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
    const configured = isLeadCaptureConfigured('waitlist');
    return `
      <p class="settings-note">Join the list for new layers and data refreshes. Submissions are emailed to the project operator inbox via FormSubmit (or Formspree if configured) — nothing is stored in this app.</p>
      ${
        configured
          ? CONTACT_EMAIL && !FORMSPREE_WAITLIST_ID
            ? `<p class="settings-note">Delivered to <code>${escapeHtml(CONTACT_EMAIL)}</code>. First submit may send a FormSubmit <strong>Activate</strong> link — open it once. If delivery fails, your email app opens as backup.</p>`
            : FORMSPREE_WAITLIST_ID
              ? `<p class="settings-note">Delivered via Formspree form <code>${escapeHtml(FORMSPREE_WAITLIST_ID)}</code>.</p>`
              : ''
          : `<p class="settings-note settings-note-warn">Backend not configured yet — set <code>VITE_CONTACT_EMAIL</code> in <code>.env</code> and restart the dev server.</p>`
      }
      <form class="settings-form" data-waitlist-form novalidate>
        <input type="hidden" name="_subject" value="Labrador Explorer — waitlist signup" />
        ${this._hiddenUtmFieldsHtml()}
        <label class="settings-field">
          <span class="settings-field-label">Email <span aria-hidden="true">*</span></span>
          <input type="email" name="email" required autocomplete="email" placeholder="you@example.com" />
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
          <button type="submit" class="settings-primary-btn" data-waitlist-submit>Join the list</button>
        </div>
      </form>
      <p class="settings-form-status settings-note" data-waitlist-status hidden></p>`;
  }

  _renderFeedbackBody() {
    const configured = isLeadCaptureConfigured('feedback');
    return `
      <p class="settings-note">Bug, missing layer, or idea? Messages are emailed to the project operator (same inbox as Stay updated) via FormSubmit / Formspree — nothing is stored in this app.</p>
      ${
        configured
          ? CONTACT_EMAIL && !FORMSPREE_FEEDBACK_ID
            ? `<p class="settings-note">Delivered to <code>${escapeHtml(CONTACT_EMAIL)}</code>. First submit may send a FormSubmit <strong>Activate</strong> link — open it once. If delivery fails, your email app opens as backup.</p>`
            : FORMSPREE_FEEDBACK_ID
              ? `<p class="settings-note">Delivered via Formspree form <code>${escapeHtml(FORMSPREE_FEEDBACK_ID)}</code>.</p>`
              : ''
          : `<p class="settings-note settings-note-warn">Backend not configured yet — set <code>VITE_CONTACT_EMAIL</code> in <code>.env</code> and restart the dev server.</p>`
      }
      <form class="settings-form" data-feedback-form novalidate>
        <input type="hidden" name="_subject" value="Labrador Explorer — feedback" />
        ${this._hiddenUtmFieldsHtml()}
        <label class="settings-field">
          <span class="settings-field-label">Message <span aria-hidden="true">*</span></span>
          <textarea name="message" rows="4" required placeholder="What should we improve?"></textarea>
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
      ${this._sectionShell('updates', 'Stay updated', FORMSPREE_WAITLIST_ID || CONTACT_EMAIL ? '' : 'setup', this._renderUpdatesBody())}
      ${this._sectionShell('feedback', 'Feedback', FORMSPREE_FEEDBACK_ID || CONTACT_EMAIL ? '' : 'setup', this._renderFeedbackBody())}
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
    this.panel.querySelector('[data-open-about-modal]')?.addEventListener('click', () => {
      this.close();
      this.onOpenAbout();
    });
    this.panel.querySelector('[data-replay-help]')?.addEventListener('click', () => {
      track(PlausibleEvents.HELP_REPLAY);
      this.close();
      this.onReplayHelp();
    });
    this._bindFormspreeForm(this.panel.querySelector('[data-waitlist-form]'), {
      statusSelector: '[data-waitlist-status]',
      kind: 'waitlist',
      eventName: PlausibleEvents.WAITLIST_SUBMIT,
      successText: 'Thanks — you\u2019re on the list.'
    });
    this._bindFormspreeForm(this.panel.querySelector('[data-feedback-form]'), {
      statusSelector: '[data-feedback-status]',
      kind: 'feedback',
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
    const enableBtn = this.panel.querySelector('[data-export-enable-layers]');
    enableBtn?.addEventListener('click', async () => {
      const status = this.panel.querySelector('[data-export-status]');
      if (status) status.textContent = 'Enabling recommended layers…';
      try {
        await this.onEnableExportLayers();
        if (status) status.textContent = 'Recommended layers enabled — wait for loads, then download.';
      } catch (err) {
        if (status) status.textContent = `Could not enable layers: ${err?.message || err}`;
      }
    });

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
        const result = await this.onExportPackage(formats);
        if (status) {
          status.textContent = result?.filename
            ? `Downloaded ${result.filename}. Check your Downloads folder.`
            : 'Export downloaded. Check your Downloads folder.';
        }
        // Soft ask for feedback after a successful export.
        const ask = document.createElement('button');
        ask.type = 'button';
        ask.className = 'settings-reset-btn';
        ask.textContent = 'Send feedback on export?';
        ask.style.marginTop = '8px';
        ask.addEventListener('click', () => {
          this.sectionExpanded.feedback = true;
          this.sectionExpanded.export = true;
          this.render();
          this.panel.querySelector('#settings-section-feedback')?.scrollIntoView({ block: 'nearest' });
        });
        status?.parentElement?.appendChild(ask);
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
   * @param {{ statusSelector: string, kind: 'waitlist'|'feedback', eventName: string, successText: string }} opts
   */
  _bindFormspreeForm(form, opts) {
    if (!form) return;
    const status = this.panel.querySelector(opts.statusSelector);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

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
        const fd = new FormData(form);
        if (opts.kind === 'feedback') {
          const ctx = this.getFeedbackContext() || {};
          Object.entries(ctx).forEach(([k, v]) => {
            if (v != null && v !== '' && !fd.has(k)) fd.append(k, String(v));
          });
        }
        const result = await submitLead(opts.kind, fd);
        track(opts.eventName, { channel: result.channel });
        form.hidden = true;
        if (status) {
          if (result.channel === 'mailto') {
            status.textContent =
              result.warning ||
              `${opts.successText} (your email app should open to finish sending.)`;
          } else {
            status.textContent = opts.successText;
          }
        }
      } catch (err) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalLabel;
        }
        if (status) status.textContent = err?.message || 'Something went wrong — please try again.';
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
