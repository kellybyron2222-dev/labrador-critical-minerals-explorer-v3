/**
 * Responsive chrome: map-first layout with an overlay sidebar drawer and a
 * collapsed-by-default legend on narrow viewports. Desktop keeps the fixed
 * left sidebar + always-visible legend.
 */

const DRAWER_MQ = '(max-width: 768px)';

export default class MobileChrome {
  /**
   * @param {{ onLayoutChange?: () => void }} [options]
   */
  constructor(options = {}) {
    this.onLayoutChange = options.onLayoutChange || null;
    this.root = document.querySelector('.app-container');
    this.sidebar = document.getElementById('sidebar');
    this.openBtn = document.getElementById('sidebar-open');
    this.closeBtn = document.getElementById('sidebar-close');
    this.backdrop = document.getElementById('sidebar-backdrop');
    this.legendPanel = document.getElementById('legend-panel');
    this.legendToggle = document.getElementById('legend-toggle');
    this.mq = window.matchMedia(DRAWER_MQ);
    this._onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (this.isLegendExpanded) this.collapseLegend();
      else this.close();
    };
  }

  init() {
    if (!this.root || !this.sidebar) return;

    this.openBtn?.addEventListener('click', () => this.open());
    this.closeBtn?.addEventListener('click', () => this.close());
    this.backdrop?.addEventListener('click', () => this.close());
    this.legendToggle?.addEventListener('click', () => this.toggleLegend());

    const onMq = () => {
      if (!this.mq.matches) {
        this.close({ silent: true });
        this.expandLegend({ silent: true });
      } else {
        this.collapseLegend({ silent: true });
      }
      this.syncChrome();
      this.notifyLayout();
    };
    if (typeof this.mq.addEventListener === 'function') {
      this.mq.addEventListener('change', onMq);
    } else {
      this.mq.addListener(onMq);
    }

    if (this.isDrawerMode) this.collapseLegend({ silent: true });
    this.syncChrome();
  }

  get isDrawerMode() {
    return this.mq.matches;
  }

  get isOpen() {
    return this.root?.classList.contains('sidebar-open') ?? false;
  }

  get isLegendExpanded() {
    return this.root?.classList.contains('legend-expanded') ?? false;
  }

  open() {
    if (!this.isDrawerMode) return;
    this.collapseLegend({ silent: true });
    this.root.classList.add('sidebar-open');
    this.backdrop?.setAttribute('aria-hidden', 'false');
    document.addEventListener('keydown', this._onKeyDown);
    this.openBtn?.setAttribute('aria-expanded', 'true');
    this.sidebar?.setAttribute('aria-hidden', 'false');
    this.sidebar?.removeAttribute('inert');
    // Keep map chrome from receiving focus while drawer is open.
    document.querySelector('.map-container')?.setAttribute('inert', '');
    this.notifyLayout();
  }

  close({ silent = false } = {}) {
    this.root?.classList.remove('sidebar-open');
    this.backdrop?.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', this._onKeyDown);
    this.openBtn?.setAttribute('aria-expanded', 'false');
    document.querySelector('.map-container')?.removeAttribute('inert');
    if (this.isDrawerMode) {
      this.sidebar?.setAttribute('aria-hidden', 'true');
      this.sidebar?.setAttribute('inert', '');
    } else {
      this.sidebar?.removeAttribute('aria-hidden');
      this.sidebar?.removeAttribute('inert');
    }
    if (!silent) this.openBtn?.focus?.();
    this.notifyLayout();
  }

  expandLegend({ silent = false } = {}) {
    this.root?.classList.add('legend-expanded');
    this.legendToggle?.setAttribute('aria-expanded', 'true');
    this.legendToggle?.setAttribute('aria-label', 'Hide legend');
    const label = this.legendToggle?.querySelector('span');
    if (label) label.textContent = 'Hide';
    if (!silent) this.legendPanel?.focus?.();
  }

  collapseLegend({ silent = false } = {}) {
    this.root?.classList.remove('legend-expanded');
    this.legendToggle?.setAttribute('aria-expanded', 'false');
    this.legendToggle?.setAttribute('aria-label', 'Show legend');
    const label = this.legendToggle?.querySelector('span');
    if (label) label.textContent = 'Legend';
    if (!silent && this.isDrawerMode) this.legendToggle?.focus?.();
  }

  toggleLegend() {
    if (!this.isDrawerMode) return;
    if (this.isLegendExpanded) this.collapseLegend();
    else {
      this.close({ silent: true });
      this.expandLegend();
    }
  }

  syncChrome() {
    if (this.isDrawerMode) {
      this.openBtn?.classList.remove('hidden');
      this.closeBtn?.classList.remove('hidden');
      this.legendToggle?.classList.remove('hidden');
      if (!this.isOpen) {
        this.sidebar?.setAttribute('aria-hidden', 'true');
        this.sidebar?.setAttribute('inert', '');
        document.querySelector('.map-container')?.removeAttribute('inert');
      }
    } else {
      this.openBtn?.classList.add('hidden');
      this.closeBtn?.classList.add('hidden');
      this.legendToggle?.classList.add('hidden');
      this.sidebar?.removeAttribute('aria-hidden');
      this.sidebar?.removeAttribute('inert');
      document.querySelector('.map-container')?.removeAttribute('inert');
      this.root?.classList.add('legend-expanded');
    }
  }

  notifyLayout() {
    // MapLibre needs a resize after the map pane's visible size changes.
    requestAnimationFrame(() => this.onLayoutChange?.());
  }
}
