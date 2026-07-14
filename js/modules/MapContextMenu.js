/**
 * Right-click and long-press (~500 ms) map context menu.
 */

const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 10;
const STYLE_ID = 'map-context-menu-styles';

const MENU_ITEMS = [
  { id: 'copy', label: 'Copy lon, lat' },
  { id: 'pin', label: 'Drop pin' },
  { id: 'buffer', label: 'Screen radius here' },
  { id: 'whats', label: "What's here?" },
  { id: 'zoom', label: 'Zoom here' }
];

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .map-context-menu {
      position: fixed;
      z-index: 1200;
      min-width: 188px;
      padding: 4px 0;
      margin: 0;
      list-style: none;
      background: rgba(255, 255, 255, 0.98);
      border: 1px solid rgba(15, 23, 42, 0.12);
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.14);
      backdrop-filter: blur(6px);
    }
    .map-context-menu[hidden] { display: none; }
    .map-context-menu-item {
      display: block;
      width: 100%;
      padding: 8px 14px;
      border: none;
      background: transparent;
      color: #0f172a;
      font: inherit;
      font-size: 13px;
      text-align: left;
      cursor: pointer;
    }
    .map-context-menu-item:hover,
    .map-context-menu-item:focus-visible {
      background: #f1f5f9;
      outline: none;
    }
  `;
  document.head.appendChild(style);
}

function removeStylesIfUnused() {
  if (!document.querySelector('.map-context-menu')) {
    document.getElementById(STYLE_ID)?.remove();
  }
}

/**
 * @param {object} opts
 * @param {import('maplibre-gl').Map} opts.map
 * @param {(lon: number, lat: number) => void} [opts.onCopyCoords]
 * @param {(lon: number, lat: number) => void} [opts.onDropPin]
 * @param {(lon: number, lat: number) => void} [opts.onBuffer]
 * @param {(lon: number, lat: number, point: { x: number, y: number }) => void} [opts.onWhatsHere]
 * @param {(lon: number, lat: number) => void} [opts.onZoomHere]
 * @param {() => boolean} [opts.isBlocked]
 * @returns {{ destroy: () => void }}
 */
export function mountMapContextMenu(opts) {
  const {
    map,
    onCopyCoords,
    onDropPin,
    onBuffer,
    onWhatsHere,
    onZoomHere,
    isBlocked = () => false
  } = opts;

  ensureStyles();

  const menu = document.createElement('ul');
  menu.className = 'map-context-menu';
  menu.setAttribute('role', 'menu');
  menu.hidden = true;

  for (const item of MENU_ITEMS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'map-context-menu-item';
    btn.setAttribute('role', 'menuitem');
    btn.dataset.action = item.id;
    btn.textContent = item.label;
    menu.appendChild(document.createElement('li')).appendChild(btn);
  }

  document.body.appendChild(menu);

  /** @type {{ lon: number, lat: number, point: { x: number, y: number } } | null} */
  let context = null;
  let pressTimer = null;
  /** @type {{ x: number, y: number } | null} */
  let pressStart = null;

  const close = () => {
    menu.hidden = true;
    context = null;
  };

  const positionMenu = (clientX, clientY) => {
    menu.hidden = false;
    const pad = 8;
    const rect = menu.getBoundingClientRect();
    let left = clientX;
    let top = clientY;
    if (left + rect.width + pad > window.innerWidth) {
      left = Math.max(pad, window.innerWidth - rect.width - pad);
    }
    if (top + rect.height + pad > window.innerHeight) {
      top = Math.max(pad, window.innerHeight - rect.height - pad);
    }
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  };

  const openAt = (clientX, clientY, lon, lat, point) => {
    context = { lon, lat, point };
    positionMenu(clientX, clientY);
  };

  const runAction = (action) => {
    if (!context) return;
    const { lon, lat, point } = context;
    close();
    switch (action) {
      case 'copy':
        onCopyCoords?.(lon, lat);
        break;
      case 'pin':
        onDropPin?.(lon, lat);
        break;
      case 'buffer':
        onBuffer?.(lon, lat);
        break;
      case 'whats':
        onWhatsHere?.(lon, lat, point);
        break;
      case 'zoom':
        onZoomHere?.(lon, lat);
        break;
      default:
        break;
    }
  };

  const onContextMenu = (e) => {
    if (isBlocked()) return;
    e.preventDefault();
    const ev = e.originalEvent;
    openAt(ev.clientX, ev.clientY, e.lngLat.lng, e.lngLat.lat, e.point);
  };

  const onTouchStart = (e) => {
    if (isBlocked()) return;
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    pressStart = { x: t.clientX, y: t.clientY };
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      pressTimer = null;
      const canvas = map.getCanvas();
      const rect = canvas.getBoundingClientRect();
      const point = { x: t.clientX - rect.left, y: t.clientY - rect.top };
      const lngLat = map.unproject([point.x, point.y]);
      openAt(t.clientX, t.clientY, lngLat.lng, lngLat.lat, point);
    }, LONG_PRESS_MS);
  };

  const onTouchMove = (e) => {
    if (!pressStart || !pressTimer || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - pressStart.x;
    const dy = t.clientY - pressStart.y;
    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  };

  const onTouchEnd = () => {
    clearTimeout(pressTimer);
    pressTimer = null;
    pressStart = null;
  };

  const onMenuClick = (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn || !menu.contains(btn)) return;
    e.preventDefault();
    runAction(btn.dataset.action);
  };

  const onDocPointerDown = (e) => {
    if (menu.hidden) return;
    if (menu.contains(e.target)) return;
    close();
  };

  const onKeyDown = (e) => {
    if (menu.hidden) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  menu.addEventListener('click', onMenuClick);
  map.on('contextmenu', onContextMenu);

  const canvas = map.getCanvas();
  canvas.addEventListener('touchstart', onTouchStart, { passive: true });
  canvas.addEventListener('touchmove', onTouchMove, { passive: true });
  canvas.addEventListener('touchend', onTouchEnd);
  canvas.addEventListener('touchcancel', onTouchEnd);
  document.addEventListener('mousedown', onDocPointerDown);
  document.addEventListener('touchstart', onDocPointerDown, { passive: true });
  document.addEventListener('keydown', onKeyDown);

  return {
    destroy() {
      close();
      clearTimeout(pressTimer);
      menu.removeEventListener('click', onMenuClick);
      map.off('contextmenu', onContextMenu);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
      document.removeEventListener('mousedown', onDocPointerDown);
      document.removeEventListener('touchstart', onDocPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      menu.remove();
      removeStylesIfUnused();
    }
  };
}
