/**
 * Print the current map view in an in-app modal (same pattern as Screen report).
 */

import { escapeHtml } from './htmlEscape.js';

/**
 * @param {import('maplibre-gl').Map} map
 * @returns {Promise<void>}
 */
function waitMapIdle(map) {
  return new Promise((resolve) => {
    if (map.loaded() && !map.isMoving() && map.areTilesLoaded()) {
      resolve();
      return;
    }
    map.once('idle', () => resolve());
  });
}

/**
 * @param {string} html
 */
function openPrintModal(html) {
  let root = document.getElementById('print-map-modal');
  if (!root) {
    root = document.createElement('div');
    root.id = 'print-map-modal';
    root.className = 'screen-report-modal';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Print map');
    root.innerHTML = `
      <div class="screen-report-modal-backdrop" data-print-close></div>
      <div class="screen-report-modal-panel">
        <div class="screen-report-modal-chrome">
          <h2 class="screen-report-modal-title">Print map</h2>
          <div class="screen-report-modal-actions">
            <button type="button" class="map-toolbar-btn" data-print-go>Print</button>
            <button type="button" class="map-toolbar-btn map-toolbar-btn-ghost" data-print-close>Close</button>
          </div>
        </div>
        <iframe class="screen-report-frame" title="Print preview" sandbox="allow-same-origin allow-modals"></iframe>
      </div>`;
    document.body.appendChild(root);
    root.addEventListener('click', (e) => {
      const t = /** @type {HTMLElement} */ (e.target);
      if (t.closest('[data-print-close]')) {
        closePrintModal();
        return;
      }
      if (t.closest('[data-print-go]')) {
        const frame = /** @type {HTMLIFrameElement|null} */ (root.querySelector('iframe'));
        try {
          frame?.contentWindow?.print();
        } catch (err) {
          console.error(err);
        }
      }
    });
  }
  const frame = /** @type {HTMLIFrameElement} */ (root.querySelector('iframe'));
  frame.srcdoc = html;
  root.classList.add('open');
}

export function closePrintModal() {
  const root = document.getElementById('print-map-modal');
  if (!root) return;
  root.classList.remove('open');
  const frame = root.querySelector('iframe');
  if (frame) frame.srcdoc = '';
}

/**
 * @param {{
 *   map: import('maplibre-gl').Map,
 *   title?: string,
 *   getLegendHtml?: () => string,
 *   attribution?: string,
 *   aoiLabel?: string
 * }} opts
 * @returns {Promise<void>}
 */
export async function printCurrentMap(opts) {
  const { map, title, getLegendHtml, attribution, aoiLabel } = opts;
  if (!map) throw new Error('printCurrentMap requires a map instance');

  await waitMapIdle(map);

  const canvas = map.getCanvas();
  const dataUrl = canvas.toDataURL('image/png');
  const zoom = map.getZoom();
  const scaleText = `Zoom level ${zoom.toFixed(1)}`;
  const dateText = new Date().toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const legendHtml =
    typeof getLegendHtml === 'function' ? getLegendHtml() || '' : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title || 'Map print')}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      color: #111;
      line-height: 1.45;
    }
    h1 {
      margin: 0 0 4px;
      font-size: 1.35rem;
      font-weight: 600;
    }
    .print-meta {
      margin: 0 0 16px;
      font-size: 0.9rem;
      color: #444;
    }
    .print-map-img {
      display: block;
      max-width: 100%;
      height: auto;
      border: 1px solid #ccc;
    }
    .print-scale {
      margin: 10px 0 0;
      font-size: 0.85rem;
      color: #555;
    }
    .print-legend {
      margin-top: 18px;
      font-size: 0.85rem;
    }
    .print-legend h2 {
      margin: 0 0 8px;
      font-size: 0.95rem;
      font-weight: 600;
    }
    .print-attribution,
    .print-aoi {
      margin-top: 12px;
      font-size: 0.75rem;
      color: #666;
    }
    @media print {
      body { padding: 12px; }
      .print-map-img { max-width: 100%; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(title || 'Map')}</h1>
  <p class="print-meta">${escapeHtml(dateText)}</p>
  <img class="print-map-img" src="${dataUrl}" alt="Map snapshot" />
  <p class="print-scale">${escapeHtml(scaleText)}</p>
  ${
    legendHtml
      ? `<section class="print-legend"><h2>Legend</h2>${legendHtml}</section>`
      : ''
  }
  ${
    aoiLabel
      ? `<p class="print-aoi"><strong>Area:</strong> ${escapeHtml(aoiLabel)}</p>`
      : ''
  }
  ${
    attribution
      ? `<p class="print-attribution">${escapeHtml(attribution)}</p>`
      : ''
  }
</body>
</html>`;

  openPrintModal(html);
}

/**
 * @param {{
 *   map: import('maplibre-gl').Map,
 *   hostEl: HTMLElement,
 *   title?: string,
 *   getLegendHtml?: () => string,
 *   attribution?: string,
 *   aoiLabel?: string,
 *   onStatus?: (msg: string) => void,
 *   onError?: (err: Error) => void
 * }} opts
 * @returns {{ destroy: () => void }}
 */
export function mountPrintControl(opts) {
  const { map, hostEl, onStatus, onError, ...printOpts } = opts;
  if (!map || !hostEl) {
    throw new Error('mountPrintControl requires map and hostEl');
  }

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'map-toolbar-btn';
  btn.textContent = 'Print';
  btn.title = 'Preview and print the current map view';
  hostEl.appendChild(btn);

  const onClick = async () => {
    btn.disabled = true;
    try {
      if (typeof onStatus === 'function') onStatus('Preparing print…');
      await printCurrentMap({ map, ...printOpts });
      if (typeof onStatus === 'function') onStatus('Print preview ready — use Print in the panel');
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (typeof onError === 'function') onError(error);
      else console.error(error);
      if (typeof onStatus === 'function') onStatus(error.message);
    } finally {
      btn.disabled = false;
    }
  };

  btn.addEventListener('click', onClick);

  return {
    destroy() {
      btn.removeEventListener('click', onClick);
      btn.remove();
      closePrintModal();
    }
  };
}
