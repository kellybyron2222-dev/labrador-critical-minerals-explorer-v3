/**
 * Build and open a Screen-this-area report for the active AOI.
 */

import bbox from '@turf/bbox';
import { featureIntersectsBounds, normalizeMapBounds } from './KpiEngine.js';
import {
  LAYER_CONFIG,
  LAYER_GROUP_ORDER,
  LAYER_GROUPS,
  WMS_CONFIG
} from '../config/layerConfig.js';
import { escapeHtml } from './htmlEscape.js';

/**
 * @param {GeoJSON.Feature} aoiFeature
 * @returns {{ west: number, south: number, east: number, north: number }|null}
 */
export function boundsFromAoiFeature(aoiFeature) {
  try {
    const box = bbox(aoiFeature);
    if (!box || box.some((n) => !Number.isFinite(n))) return null;
    return { west: box[0], south: box[1], east: box[2], north: box[3] };
  } catch {
    return null;
  }
}

/**
 * @param {object} props
 */
export function featureDisplayName(props = {}) {
  const keys = [
    'name',
    'NAME',
    'Name',
    'DEPNAME',
    'PropertyNameEN',
    'COMMODITY',
    'commodity',
    'LICENSE_NBR',
    'CLIENT_NAME',
    'SITE_NAME',
    'label',
    'TITLE',
    'title'
  ];
  for (const k of keys) {
    if (props[k] != null && String(props[k]).trim()) return String(props[k]).trim();
  }
  return null;
}

/**
 * Canonical layer order matching the sidebar (group → subgroup → declaration order).
 * @returns {{ id: string, kind: 'vector'|'wms', title: string }[]}
 */
export function orderedReportLayers() {
  /** @type {{ id: string, kind: 'vector'|'wms', title: string, group: string, subgroup?: string }[]} */
  const rows = [];

  for (const [id, cfg] of Object.entries(LAYER_CONFIG)) {
    rows.push({
      id,
      kind: 'vector',
      title: cfg.sidebarLabel || cfg.label || cfg.title || id,
      group: cfg.group || 'base',
      subgroup: cfg.subgroup
    });
  }
  for (const [id, cfg] of Object.entries(WMS_CONFIG)) {
    rows.push({
      id,
      kind: 'wms',
      title: cfg.sidebarLabel || cfg.label || id,
      group: cfg.group || 'signals',
      subgroup: cfg.subgroup
    });
  }

  const subgroupIndex = (groupId, subgroupId) => {
    const subs = LAYER_GROUPS[groupId]?.subgroups;
    if (!subs?.length || !subgroupId) return 999;
    const i = subs.findIndex((s) => s.id === subgroupId);
    return i < 0 ? 999 : i;
  };

  rows.sort((a, b) => {
    const ga = LAYER_GROUP_ORDER.indexOf(a.group);
    const gb = LAYER_GROUP_ORDER.indexOf(b.group);
    if (ga !== gb) return (ga < 0 ? 999 : ga) - (gb < 0 ? 999 : gb);
    const sa = subgroupIndex(a.group, a.subgroup);
    const sb = subgroupIndex(b.group, b.subgroup);
    if (sa !== sb) return sa - sb;
    return a.title.localeCompare(b.title);
  });

  return rows.map(({ id, kind, title }) => ({ id, kind, title }));
}

/**
 * @param {{
 *   aoiFeature: GeoJSON.Feature,
 *   aoiLabel: string,
 *   getFeatures: (layerName: string) => object[],
 *   isLayerOn: (layerName: string) => boolean,
 *   modsFiltered?: object[],
 *   wmsOn?: string[]
 * }} opts
 */
export function buildScreenReportIndex(opts) {
  const bounds = boundsFromAoiFeature(opts.aoiFeature);
  if (!bounds) return { ok: false, message: 'Could not read AOI bounds.' };

  const wmsOn = new Set(opts.wmsOn || []);

  /** @type {{ id: string, title: string, count: number, items: { name: string, detail?: string }[] }[]} */
  const inArea = [];
  /** @type {{ id: string, title: string, reason: string }[]} */
  const notInArea = [];

  for (const layer of orderedReportLayers()) {
    if (layer.kind === 'wms') {
      const on = wmsOn.has(layer.id) || opts.isLayerOn?.(`wms-${layer.id}`);
      // Rasters: treat as "in area" when enabled (coverage is continuous); else not in area.
      if (on) {
        inArea.push({
          id: layer.id,
          title: layer.title,
          count: 1,
          items: [
            {
              name: layer.title,
              detail: 'Raster / signal layer enabled — inspect coverage on the map within the AOI'
            }
          ]
        });
      } else {
        notInArea.push({
          id: layer.id,
          title: layer.title,
          reason: 'Not enabled'
        });
      }
      continue;
    }

    const features =
      layer.id === 'modsOccurrences'
        ? opts.modsFiltered || opts.getFeatures(layer.id) || []
        : opts.getFeatures(layer.id) || [];

    const hits = (features || []).filter((f) => featureIntersectsBounds(f, bounds));
    const title =
      layer.id === 'modsOccurrences' ? 'Mineral occurrences (MODS)' : layer.title;

    if (hits.length > 0) {
      const items = hits.slice(0, 80).map((f) => {
        let name = featureDisplayName(f.properties) || 'Feature';
        if (layer.id === 'modsOccurrences') {
          const c = f.properties?.COMMODITY || f.properties?.commodity || '';
          if (c && name !== c) name = `${name} (${c})`;
        }
        return { name, detail: summarizeProps(f.properties) };
      });
      inArea.push({
        id: layer.id,
        title,
        count: hits.length,
        items
      });
    } else {
      const loaded = (features || []).length > 0;
      const on = opts.isLayerOn(layer.id);
      notInArea.push({
        id: layer.id,
        title,
        reason: !on
          ? 'Not enabled'
          : !loaded
            ? 'Enabled but not loaded / no features yet'
            : 'No features intersecting this AOI'
      });
    }
  }

  const totalFeatures = inArea.reduce(
    (s, sec) => s + (WMS_CONFIG[sec.id] ? 0 : sec.count),
    0
  );

  return {
    ok: true,
    bounds,
    aoiLabel: opts.aoiLabel,
    generatedAt: new Date().toISOString(),
    totalFeatures,
    sectionCount: inArea.length,
    sections: inArea,
    inArea,
    notInArea
  };
}

function summarizeProps(props) {
  if (!props) return '';
  const skip = new Set([
    'name',
    'NAME',
    'Name',
    'DEPNAME',
    'COMMODITY',
    'commodity',
    'LICENSE_NBR',
    'CLIENT_NAME',
    'SITE_NAME',
    'label',
    'TITLE',
    'title'
  ]);
  const bits = [];
  for (const [k, v] of Object.entries(props)) {
    if (skip.has(k) || v == null || v === '') continue;
    if (typeof v === 'object') continue;
    bits.push(`${k}: ${v}`);
    if (bits.length >= 3) break;
  }
  return bits.join(' · ');
}

/**
 * @param {ReturnType<typeof buildScreenReportIndex>} report
 * @returns {string}
 */
export function renderScreenReportHtml(report) {
  if (!report?.ok) {
    return `<!doctype html><html><body><p>${escapeHtml(report?.message || 'No report')}</p></body></html>`;
  }
  const { bounds } = report;
  const inArea = report.inArea || report.sections || [];
  const notInArea = report.notInArea || [];

  const toc = inArea
    .map(
      (s) =>
        `<li><a href="#sec-${escapeHtml(s.id)}">${escapeHtml(s.title)}</a> <span class="n">${s.count}</span></li>`
    )
    .join('');

  const bodies = inArea
    .map((s) => {
      const rows =
        s.items.length === 0
          ? `<p class="empty">None listed.</p>`
          : `<ol>${s.items
              .map(
                (it) =>
                  `<li><strong>${escapeHtml(it.name)}</strong>${
                    it.detail ? `<span class="d"> — ${escapeHtml(it.detail)}</span>` : ''
                  }</li>`
              )
              .join('')}${
              s.count > s.items.length
                ? `<li class="more">…and ${s.count - s.items.length} more</li>`
                : ''
            }</ol>`;
      return `<section id="sec-${escapeHtml(s.id)}">
        <h2>${escapeHtml(s.title)} <span class="n">${s.count}</span></h2>
        ${rows}
      </section>`;
    })
    .join('');

  const notList = notInArea
    .map(
      (s) =>
        `<li><strong>${escapeHtml(s.title)}</strong> <span class="d">— ${escapeHtml(s.reason)}</span></li>`
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Screen report — Labrador Explorer</title>
  <style>
    :root { color-scheme: light; }
    body { font: 15px/1.45 system-ui, Segoe UI, sans-serif; margin: 0; color: #111; background: #f7f7f5; }
    header { background: #1c1917; color: #fafaf9; padding: 1.25rem 1.5rem; }
    header p { margin: 0.35rem 0 0; opacity: 0.85; font-size: 0.92rem; }
    main { max-width: 860px; margin: 0 auto; padding: 1.25rem 1.5rem 3rem; }
    nav, .block { background: #fff; border: 1px solid #e7e5e4; border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 1.25rem; }
    nav ol, .block ol { margin: 0.4rem 0 0; padding-left: 1.2rem; }
    nav .n, h2 .n { font-weight: 600; color: #57534e; font-size: 0.9em; }
    h1.part { font-size: 1.15rem; margin: 0 0 0.75rem; }
    section { background: #fff; border: 1px solid #e7e5e4; border-radius: 8px; padding: 0.9rem 1.1rem; margin-bottom: 0.9rem; }
    h2 { margin: 0 0 0.5rem; font-size: 1.05rem; }
    ol { margin: 0; padding-left: 1.2rem; }
    li { margin: 0.25rem 0; }
    .d, .empty, .more { color: #57534e; font-size: 0.92em; }
    footer { margin-top: 1.5rem; font-size: 0.85rem; color: #78716c; }
  </style>
</head>
<body>
  <header>
    <h1>Screen this area — report</h1>
    <p>${escapeHtml(report.aoiLabel)}</p>
    <p>Bounds W ${bounds.west.toFixed(3)}, S ${bounds.south.toFixed(3)}, E ${bounds.east.toFixed(3)}, N ${bounds.north.toFixed(3)}
      · ${report.totalFeatures} features in AOI across ${inArea.length} layers
      · ${escapeHtml(new Date(report.generatedAt).toLocaleString())}</p>
  </header>
  <main>
    <h1 class="part">1. In this area</h1>
    <nav>
      <strong>Index</strong>
      <ol>${toc || '<li class="empty">No intersecting features in loaded layers.</li>'}</ol>
    </nav>
    ${bodies || '<p class="empty">No data points or layers intersect this AOI yet. Enable more layers and Screen again.</p>'}

    <h1 class="part">2. Not in this area</h1>
    <div class="block">
      <p class="d" style="margin-top:0">Same layer order as the sidebar. These have no features intersecting the AOI (or are off / not loaded).</p>
      <ol>${notList || '<li class="empty">All catalog layers appear in the AOI.</li>'}</ol>
    </div>

    <footer>Generated by Labrador Critical Minerals Explorer. Zoom in and load more layers, then Screen again for a fuller inventory.</footer>
  </main>
</body>
</html>`;
}

/**
 * @param {Parameters<typeof buildScreenReportIndex>[0]} opts
 * @returns {{ ok: boolean, message?: string }}
 */
export function openScreenReport(opts) {
  const report = buildScreenReportIndex(opts);
  if (!report.ok) return { ok: false, message: report.message };
  const html = renderScreenReportHtml(report);
  showScreenReportModal(html);
  return { ok: true };
}

/**
 * @param {string} html
 */
export function showScreenReportModal(html) {
  let root = document.getElementById('screen-report-modal');
  if (!root) {
    root = document.createElement('div');
    root.id = 'screen-report-modal';
    root.className = 'screen-report-modal';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Screen this area report');
    root.innerHTML = `
      <div class="screen-report-modal-backdrop" data-report-close></div>
      <div class="screen-report-modal-panel">
        <div class="screen-report-modal-chrome">
          <h2 class="screen-report-modal-title">Screen report</h2>
          <div class="screen-report-modal-actions">
            <button type="button" class="map-toolbar-btn" data-report-print>Print</button>
            <button type="button" class="map-toolbar-btn map-toolbar-btn-ghost" data-report-close aria-label="Close">Close</button>
          </div>
        </div>
        <iframe class="screen-report-frame" title="Screen report" sandbox="allow-same-origin allow-modals"></iframe>
      </div>`;
    document.body.appendChild(root);
    root.addEventListener('click', (e) => {
      const t = /** @type {HTMLElement} */ (e.target);
      if (t.closest('[data-report-close]')) hideScreenReportModal();
      if (t.closest('[data-report-print]')) {
        const frame = root.querySelector('iframe');
        try {
          frame?.contentWindow?.print();
        } catch {
          /* ignore */
        }
      }
    });
  }
  const frame = /** @type {HTMLIFrameElement} */ (root.querySelector('iframe'));
  frame.srcdoc = html;
  root.classList.add('open');
  document.body.classList.add('screen-report-open');
}

export function hideScreenReportModal() {
  const root = document.getElementById('screen-report-modal');
  if (!root) return;
  root.classList.remove('open');
  document.body.classList.remove('screen-report-open');
  const frame = root.querySelector('iframe');
  if (frame) frame.srcdoc = '';
}

export { normalizeMapBounds };
