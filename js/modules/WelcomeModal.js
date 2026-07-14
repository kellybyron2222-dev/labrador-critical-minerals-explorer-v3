/**
 * First-visit welcome modal — soft-launch orientation and CTAs.
 */

import { escapeHtml } from './htmlEscape.js';
import { PlausibleEvents, track } from './analytics.js';

const STORAGE_KEY = 'explorer-v3-welcome-dismissed';

export default class WelcomeModal {
  /**
   * @param {{ onExplore?: () => void, onOpenAbout?: () => void, onOpenWaitlist?: () => void }} handlers
   */
  constructor(handlers = {}) {
    this.onExplore = handlers.onExplore || (() => {});
    this.onOpenAbout = handlers.onOpenAbout || (() => {});
    this.onOpenWaitlist = handlers.onOpenWaitlist || (() => {});
    this.open = false;
    this._lastFocus = null;

    this.backdrop = document.createElement('div');
    this.backdrop.className = 'welcome-backdrop settings-backdrop';
    this.backdrop.hidden = true;

    this.panel = document.createElement('div');
    this.panel.className = 'welcome-panel settings-panel';
    this.panel.setAttribute('role', 'dialog');
    this.panel.setAttribute('aria-modal', 'true');
    this.panel.setAttribute('aria-labelledby', 'welcome-title');
    this.panel.hidden = true;

    document.body.appendChild(this.backdrop);
    document.body.appendChild(this.panel);

    this.backdrop.addEventListener('click', () => this.dismiss({ remember: false }));
    this._onKeyDown = (e) => {
      if (!this.open) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        this.dismiss({ remember: false });
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

  /** Show on first visit when the dismiss flag is not stored. */
  maybeShow() {
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') return;
    } catch {
      // private mode — still show once per session
    }
    this.show();
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
    this.panel.querySelector('[data-welcome-explore]')?.focus();
    track(PlausibleEvents.WELCOME_SHOW);
  }

  /**
   * @param {{ remember?: boolean }} [opts]
   */
  dismiss(opts = {}) {
    if (!this.open) return;
    this.open = false;
    this.backdrop.classList.remove('open');
    this.panel.classList.remove('open');
    this.backdrop.hidden = true;
    this.panel.hidden = true;
    this.setInertBackground(false);
    if (opts.remember) {
      try {
        localStorage.setItem(STORAGE_KEY, '1');
      } catch {
        // ignore
      }
    }
    track(PlausibleEvents.WELCOME_DISMISS, { remember: Boolean(opts.remember) });
    if (this._lastFocus && typeof this._lastFocus.focus === 'function') {
      this._lastFocus.focus();
    }
    this._lastFocus = null;
  }

  render() {
    this.panel.innerHTML = `
      <button type="button" class="settings-close welcome-close" data-welcome-dismiss aria-label="Close welcome">×</button>
      <h2 id="welcome-title" class="settings-title welcome-title">${escapeHtml('Labrador Critical Minerals Explorer')}</h2>
      <p class="settings-intro welcome-intro">
        A free, open map for exploring Labrador critical-mineral context — geology, occurrences,
        rights, constraints, and infrastructure from public sources.
      </p>
      <ul class="settings-about-list welcome-points">
        <li><strong>Labrador-focused</strong> — not a thin Canada-wide map.</li>
        <li><strong>Public data</strong> — GeoAtlas, NRCan, CIRNAC/ISC, and curated infrastructure.</li>
        <li><strong>Not AI discovery</strong> — no black-box prospecting scores; layers show what agencies publish.</li>
        <li><strong>Baked claims</strong> — refreshed on a ~3-month cadence, not a live staking feed.</li>
      </ul>
      <ol class="welcome-tips settings-about-list">
        <li><strong>Click the map</strong> for occurrence / claim detail and nearest infrastructure.</li>
        <li><strong>Open Rights</strong> for claims, tenure, and Hard exclusions (parks &amp; water).</li>
        <li><strong>Settings → Export</strong> downloads your current view as a multi-format ZIP (WGS&nbsp;84).</li>
      </ol>
      <div class="welcome-actions settings-actions">
        <button type="button" class="settings-primary-btn" data-welcome-explore>Explore map</button>
        <button type="button" class="settings-reset-btn" data-welcome-waitlist>Stay updated</button>
        <button type="button" class="settings-reset-btn" data-welcome-about>About</button>
      </div>
      <label class="welcome-remember">
        <input type="checkbox" data-welcome-remember />
        <span>Don&rsquo;t show again</span>
      </label>`;

    this.panel.querySelector('[data-welcome-dismiss]')?.addEventListener('click', () => {
      const remember = this.panel.querySelector('[data-welcome-remember]')?.checked;
      this.dismiss({ remember });
    });

    this.panel.querySelector('[data-welcome-explore]')?.addEventListener('click', () => {
      track(PlausibleEvents.WELCOME_EXPLORE);
      const remember = this.panel.querySelector('[data-welcome-remember]')?.checked;
      this.dismiss({ remember });
      this.onExplore();
    });

    this.panel.querySelector('[data-welcome-waitlist]')?.addEventListener('click', () => {
      track(PlausibleEvents.WELCOME_WAITLIST);
      const remember = this.panel.querySelector('[data-welcome-remember]')?.checked;
      this.dismiss({ remember });
      this.onOpenWaitlist();
    });

    this.panel.querySelector('[data-welcome-about]')?.addEventListener('click', () => {
      track(PlausibleEvents.WELCOME_ABOUT);
      const remember = this.panel.querySelector('[data-welcome-remember]')?.checked;
      this.dismiss({ remember });
      this.onOpenAbout();
    });
  }
}
