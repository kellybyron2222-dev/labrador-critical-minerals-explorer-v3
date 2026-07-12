/**
 * Light occurrence browser: status filters, search, list + detail.
 * KPI strip lives in KpiBar (map-wide, multi-layer).
 */

import {
  MODS_STATUS_BUCKETS,
  OCCURRENCE_LIST_CAP,
  countByStatusBucket
} from '../config/modsFilters.js';
import { escapeHtml, escapeAttr } from './htmlEscape.js';

export default class OccurrenceBrowser {
  /**
   * @param {{
   *   onChange: () => void,
   *   onSelect: (feature: object|null) => void
   * }} handlers
   */
  constructor(handlers = {}) {
    this.onChange = handlers.onChange || (() => {});
    this.onSelect = handlers.onSelect || (() => {});

    this.statuses = new Set();
    this.query = '';
    this.selectedId = null;
    this.filtered = [];
    this.commodityScoped = [];
    this.inViewCount = null;

    this.els = {
      search: document.getElementById('occ-search'),
      status: document.getElementById('occ-status-filters'),
      list: document.getElementById('occ-list'),
      count: document.getElementById('occ-list-count'),
      clear: document.getElementById('occ-clear-filters')
    };

    this.bind();
    this.renderStatusToggles();
  }

  bind() {
    this._searchTimer = null;
    this.els.search?.addEventListener('input', (e) => {
      this.query = e.target.value;
      clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => this.onChange(), 200);
    });

    this.els.clear?.addEventListener('click', () => {
      this.statuses = new Set();
      this.query = '';
      if (this.els.search) this.els.search.value = '';
      clearTimeout(this._searchTimer);
      this.renderStatusToggles();
      this.onChange();
    });

    this.els.listToggle = document.getElementById('occ-list-toggle');
    this.els.listWrap = document.getElementById('occ-list-wrap');
    this.els.listToggleLabel = document.getElementById('occ-list-toggle-label');
    // Collapsed by default — sidebar stays compact until the user opens a list.
    this.listExpanded = false;

    this.els.listToggle?.addEventListener('click', () => {
      this.listExpanded = !this.listExpanded;
      this.els.listWrap?.classList.toggle('collapsed', !this.listExpanded);
      this.els.listToggle?.classList.toggle('collapsed', !this.listExpanded);
      this.els.listToggle?.setAttribute('aria-expanded', String(this.listExpanded));
      if (this.els.listToggleLabel) {
        this.els.listToggleLabel.textContent = this.listExpanded ? 'Hide list' : 'Show list';
      }
    });

    this.els.listWrap?.classList.toggle('collapsed', !this.listExpanded);
    this.els.listToggle?.classList.toggle('collapsed', !this.listExpanded);
    this.els.listToggle?.setAttribute('aria-expanded', String(this.listExpanded));
    if (this.els.listToggleLabel) {
      this.els.listToggleLabel.textContent = this.listExpanded ? 'Hide list' : 'Show list';
    }
  }

  getFilterState() {
    return {
      statuses: new Set(this.statuses),
      query: this.query
    };
  }

  renderStatusToggles(counts = new Map()) {
    const el = this.els.status;
    if (!el) return;

    el.innerHTML = MODS_STATUS_BUCKETS.map((bucket) => {
      const active = this.statuses.has(bucket);
      const n = counts.get(bucket) || 0;
      return `
        <button type="button" class="occ-chip${active ? ' active' : ''}" data-status="${bucket}" ${n === 0 && !active ? 'disabled' : ''}>
          <span>${bucket}</span>
          <span class="occ-chip-count">${n}</span>
        </button>`;
    }).join('');

    el.querySelectorAll('[data-status]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const s = btn.getAttribute('data-status');
        if (this.statuses.has(s)) this.statuses.delete(s);
        else this.statuses.add(s);
        this.renderStatusToggles(counts);
        this.onChange();
      });
    });

    const any = this.statuses.size > 0 || this.query.trim() !== '';
    this.els.clear?.classList.toggle('hidden', !any);
  }

  /**
   * @param {object[]} commodityScoped
   * @param {object[]} filtered
   * @param {{ inViewCount?: number|null }} [extra]
   */
  update(commodityScoped, filtered, extra = {}) {
    this.commodityScoped = commodityScoped;
    this.filtered = filtered;
    this.inViewCount = extra.inViewCount ?? null;

    const counts = countByStatusBucket(commodityScoped);
    this.renderStatusToggles(counts);
    this.renderList();
  }

  renderList() {
    const el = this.els.list;
    if (!el) return;

    if (this.els.count) {
      const base = this.filtered.length.toLocaleString();
      this.els.count.textContent =
        this.inViewCount != null
          ? `${base} (${this.inViewCount.toLocaleString()} in view)`
          : base;
    }

    const selected = this.selectedId
      ? this.filtered.find((f) => f.properties?.NMINO === this.selectedId)
      : null;

    if (selected) {
      el.innerHTML = this.renderDetail(selected);
      el.querySelector('[data-back]')?.addEventListener('click', () => {
        this.selectedId = null;
        this.renderList();
        this.onSelect(null);
      });
      return;
    }

    if (!this.filtered.length) {
      el.innerHTML = `<p class="occ-empty">No occurrences match the current filters.</p>`;
      return;
    }

    const sorted = [...this.filtered].sort((a, b) => {
      const na = a.properties?.name || '';
      const nb = b.properties?.name || '';
      return na.localeCompare(nb);
    });

    const slice = sorted.slice(0, OCCURRENCE_LIST_CAP);
    el.innerHTML =
      slice
        .map((f) => {
          const p = f.properties;
          const id = escapeAttr(p.NMINO || '');
          return `
          <button type="button" class="occ-row${p.NMINO === this.selectedId ? ' selected' : ''}" data-id="${id}">
            <span class="occ-row-name">${escapeHtml(p.name || 'Unnamed')}</span>
            <span class="occ-row-meta">${escapeHtml(
              [p.statusBucket || p.STATUS, p.primaryCommodity].filter(Boolean).join(' · ')
            )}</span>
          </button>`;
        })
        .join('') +
      (sorted.length > OCCURRENCE_LIST_CAP
        ? `<p class="occ-hint">Showing ${OCCURRENCE_LIST_CAP} of ${sorted.length.toLocaleString()}. Narrow filters or search.</p>`
        : '');

    el.querySelectorAll('[data-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const feature = this.filtered.find((f) => f.properties?.NMINO === id) || null;
        this.selectedId = id;
        this.renderList();
        this.onSelect(feature);
      });
    });
  }

  renderDetail(feature) {
    const p = feature.properties || {};
    const secondaries = (p.secondaryCommodities || []).join(', ');
    const rows = [
      ['Status', p.STATUS || p.statusBucket],
      ['Primary commodity', p.primaryCommodity],
      secondaries ? ['Also reported', secondaries] : null,
      p.DEPDESC ? ['Deposit type', p.DEPDESC] : null,
      p.NTS ? ['NTS', p.NTS] : null,
      p.NMINO ? ['NMINO', p.NMINO] : null
    ]
      .filter(Boolean)
      .map(
        ([k, v]) =>
          `<div class="occ-kv"><span class="occ-k">${escapeHtml(k)}</span><span class="occ-v">${escapeHtml(String(v))}</span></div>`
      )
      .join('');

    const link = p.NMINO
      ? `<a class="occ-mods-link" href="https://gis.geosurv.gov.nl.ca/mods/ModsCard.asp?NMINOString=${encodeURIComponent(p.NMINO).replace(/%20/g, '+')}" target="_blank" rel="noopener">Open MODS record</a>`
      : '';

    return `
      <button type="button" class="occ-back" data-back>← List</button>
      <h3 class="occ-detail-title">${escapeHtml(p.name || 'Unnamed')}</h3>
      ${rows}
      ${link}
    `;
  }

  selectByNmino(nmino) {
    this.selectedId = nmino || null;
    if (nmino && !this.listExpanded) {
      this.listExpanded = true;
      this.els.listWrap?.classList.remove('collapsed');
      this.els.listToggle?.classList.remove('collapsed');
      this.els.listToggle?.setAttribute('aria-expanded', 'true');
      if (this.els.listToggleLabel) this.els.listToggleLabel.textContent = 'Hide list';
    }
    this.renderList();
  }
}
