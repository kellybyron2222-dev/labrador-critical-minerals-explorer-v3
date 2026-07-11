/** Module: floating legend panel - shows/hides a per-layer legend card in sync with layer visibility */

// Beyond this many rows, the compact card shows a scrollable preview with a
// click-to-enlarge affordance instead of the full list (e.g. bedrock geology
// has ~149 classes - unusable both as a giant sidebar card and as a single
// baked-in image, but fine as real text flowed into columns when enlarged).
const ITEMS_ENLARGE_THRESHOLD = 8;

export default class LegendPanel {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.cards = {};
    this.modal = this._createModal();
  }

  /**
   * Builds the (single, reused) enlarged-legend panel for reading dense
   * legends - either a raster image (WMS GetLegendGraphic) or a long list of
   * {label, icon} rows flowed into columns. Deliberately NOT a full-screen
   * backdrop/overlay - it's pinned in place over the bottom-left corner so the
   * rest of the map stays visible for side-by-side comparison while it's open.
   */
  _createModal() {
    const modal = document.createElement('div');
    modal.className = 'legend-modal';
    modal.innerHTML = `
      <button class="legend-modal-close" type="button" aria-label="Close">&times;</button>
      <h4 class="legend-modal-title"></h4>
      <div class="legend-modal-body"></div>
    `;

    modal.querySelector('.legend-modal-close').addEventListener('click', () => this.closeEnlarged());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeEnlarged();
    });
    // No backdrop to catch outside clicks, so watch the whole document instead -
    // but ignore the clicks that open the modal in the first place.
    document.addEventListener('click', (e) => {
      if (!modal.classList.contains('open')) return;
      if (modal.contains(e.target) || e.target.closest('.legend-image, .legend-items-preview')) return;
      this.closeEnlarged();
    });

    document.body.appendChild(modal);
    return modal;
  }

  /** @param {{title: string, imageUrl?: string, items?: {label:string, color?:string, icon?:string}[], shape?: string}} def */
  openEnlarged({ title, imageUrl, items, shape }) {
    this.modal.querySelector('.legend-modal-title').textContent = title;

    const body = this.modal.querySelector('.legend-modal-body');
    body.innerHTML = '';
    body.classList.toggle('legend-modal-body-items', Boolean(items));

    if (items) {
      body.appendChild(this._buildItemsList(items, shape, true));
    } else if (imageUrl) {
      const img = document.createElement('img');
      img.className = 'legend-modal-image';
      img.src = imageUrl;
      img.alt = `${title} legend`;
      body.appendChild(img);
    }

    this.modal.classList.add('open');
  }

  closeEnlarged() {
    this.modal.classList.remove('open');
  }

  /** Shared row renderer for both the compact card and the enlarged panel. */
  _buildItemsList(items, shape, enlarged) {
    const list = document.createElement('div');
    list.className = enlarged ? 'legend-items legend-items-enlarged' : 'legend-items';

    items.forEach(({ label, color, icon }) => {
      const row = document.createElement('div');
      row.className = 'legend-row';
      const swatchHtml = icon
        ? `<img class="legend-icon" src="${icon}" alt="" />`
        : `<span class="legend-swatch legend-swatch-${shape || 'circle'}" style="background:${color}"></span>`;
      row.innerHTML = `${swatchHtml}<span class="legend-text">${label}</span>`;
      list.appendChild(row);
    });

    return list;
  }

  /**
   * @param {string} key - unique id for this layer's card (e.g. 'layer-deposits', 'wms-bedrock')
   * @param {boolean} visible
   * @param {{title: string, items?: {label:string, color:string}[], shape?: 'circle'|'line'|'fill', imageUrl?: string, note?: string, surfaceToggle?: {label: string, checked: boolean, onChange: (checked: boolean) => void}, commodityToggles?: {commodities: {value:string, label:string, color:string}[], enabled: string[], onChange: (commodity: string, checked: boolean) => void, onAllOn: () => void, onAllOff: () => void}|null}} legendDef
   */
  setLayerLegend(key, visible, legendDef) {
    if (!visible) {
      this.hideLegend(key);
      return;
    }
    if (this.cards[key] || !legendDef) return;

    const card = document.createElement('div');
    card.className = 'legend-card';

    const heading = document.createElement('h4');
    heading.className = 'legend-card-title';
    heading.textContent = legendDef.title;
    card.appendChild(heading);

    if (legendDef.surfaceToggle) {
      const toggleLabel = document.createElement('label');
      toggleLabel.className = 'legend-surface-toggle';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = legendDef.surfaceToggle.checked;
      checkbox.addEventListener('change', (e) => legendDef.surfaceToggle.onChange(e.target.checked));
      toggleLabel.appendChild(checkbox);
      toggleLabel.appendChild(document.createTextNode(legendDef.surfaceToggle.label));
      card.appendChild(toggleLabel);
    }

    if (legendDef.commodityToggles?.commodities?.length) {
      const { commodities, enabled, onChange, onAllOn, onAllOff } = legendDef.commodityToggles;
      const enabledSet = new Set(enabled || []);

      const bulk = document.createElement('div');
      bulk.className = 'legend-commodity-bulk';
      const allOn = document.createElement('button');
      allOn.type = 'button';
      allOn.className = 'legend-commodity-bulk-btn';
      allOn.textContent = 'All on';
      allOn.addEventListener('click', onAllOn);
      const allOff = document.createElement('button');
      allOff.type = 'button';
      allOff.className = 'legend-commodity-bulk-btn';
      allOff.textContent = 'All off';
      allOff.addEventListener('click', onAllOff);
      bulk.appendChild(allOn);
      bulk.appendChild(allOff);
      card.appendChild(bulk);

      const list = document.createElement('div');
      list.className = 'legend-commodity-list';
      commodities.forEach(({ value, label, color }) => {
        const row = document.createElement('label');
        row.className = 'legend-commodity-row';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = enabledSet.has(value);
        checkbox.addEventListener('change', (e) => onChange(value, e.target.checked));
        const swatch = document.createElement('span');
        swatch.className = `legend-swatch legend-swatch-${legendDef.shape || 'circle'}`;
        swatch.style.background = color;
        row.appendChild(checkbox);
        row.appendChild(swatch);
        row.appendChild(document.createTextNode(label));
        list.appendChild(row);
      });
      card.appendChild(list);
    } else if (legendDef.items) {
      const list = this._buildItemsList(legendDef.items, legendDef.shape, false);
      const isLarge = legendDef.items.length > ITEMS_ENLARGE_THRESHOLD;

      if (isLarge) {
        const preview = document.createElement('div');
        preview.className = 'legend-items-preview';
        preview.title = 'Click to enlarge';
        preview.appendChild(list);
        preview.addEventListener('click', () =>
          this.openEnlarged({ title: legendDef.title, items: legendDef.items, shape: legendDef.shape })
        );
        card.appendChild(preview);

        const expandHint = document.createElement('span');
        expandHint.className = 'legend-expand-hint';
        expandHint.textContent = `Click to enlarge (${legendDef.items.length} classes)`;
        card.appendChild(expandHint);
      } else {
        card.appendChild(list);
      }
    } else if (legendDef.imageUrl) {
      const imgWrap = document.createElement('div');
      imgWrap.className = 'legend-image-wrap';
      const img = document.createElement('img');
      img.src = legendDef.imageUrl;
      img.alt = `${legendDef.title} legend`;
      img.className = 'legend-image';
      img.loading = 'lazy';
      img.title = 'Click to enlarge';
      img.addEventListener('click', () =>
        this.openEnlarged({ title: legendDef.title, imageUrl: legendDef.imageUrl })
      );
      imgWrap.appendChild(img);
      card.appendChild(imgWrap);

      const expandHint = document.createElement('span');
      expandHint.className = 'legend-expand-hint';
      expandHint.textContent = 'Click to enlarge';
      card.appendChild(expandHint);
    }

    if (legendDef.note) {
      const note = document.createElement('p');
      note.className = 'legend-note-text';
      note.textContent = legendDef.note;
      card.appendChild(note);
    }

    this.container.appendChild(card);
    this.cards[key] = card;
  }

  hideLegend(key) {
    const card = this.cards[key];
    if (card) {
      card.remove();
      delete this.cards[key];
    }
  }
}
