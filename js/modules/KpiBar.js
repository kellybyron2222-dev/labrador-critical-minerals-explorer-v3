/**
 * Bottom map HUD for configurable KPI metrics.
 */

const GEAR_SVG = `
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>`;

export default class KpiBar {
  /**
   * @param {{ onOpenSettings: (opts?: { section?: string, expandSection?: boolean }) => void }} handlers
   */
  constructor(handlers = {}) {
    this.onOpenSettings = handlers.onOpenSettings || (() => {});
    this.el = document.getElementById('occ-kpi');
  }

  /**
   * @param {{ id: string, kind: string, label: string, value?: number, bits?: {label:string,count:number}[], flag?: boolean }[]} metrics
   */
  render(metrics = []) {
    const el = this.el;
    if (!el) return;

    const settingsBtn = `
      <button type="button" class="occ-kpi-settings" title="Customize KPI bar" aria-label="Customize KPI bar">
        ${GEAR_SVG}
      </button>`;

    if (!metrics.length) {
      el.innerHTML = `
        <span class="occ-kpi-empty">No KPIs for current layers</span>
        <button type="button" class="occ-kpi-link" data-open-settings>Open KPI settings</button>
        ${settingsBtn}
      `;
      this.bindChrome();
      return;
    }

    const parts = metrics
      .map((m) => {
        if (m.kind === 'bits') {
          return (m.bits || [])
            .map(
              (b) =>
                `<span class="occ-kpi-bit"><em>${b.count.toLocaleString()}</em> ${escapeHtml(b.label)}</span>`
            )
            .join('');
        }
        if (m.kind === 'flag') {
          return `<span class="occ-kpi-main"><strong>${m.flag ? 'Yes' : 'No'}</strong><span class="occ-kpi-label">${escapeHtml(m.label)}</span></span>`;
        }
        return `<span class="occ-kpi-main"><strong>${Number(m.value || 0).toLocaleString()}</strong><span class="occ-kpi-label">${escapeHtml(m.label)}</span></span>`;
      })
      .join('');

    el.innerHTML = `${parts}${settingsBtn}`;
    this.bindChrome();
  }

  bindChrome() {
    const openKpi = () => this.onOpenSettings({ section: 'kpi', expandSection: true });
    this.el?.querySelector('.occ-kpi-settings')?.addEventListener('click', openKpi);
    this.el?.querySelector('[data-open-settings]')?.addEventListener('click', openKpi);
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
