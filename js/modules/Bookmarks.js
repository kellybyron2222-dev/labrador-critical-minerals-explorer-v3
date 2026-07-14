/**
 * Named map view bookmarks persisted in localStorage.
 * Stores full view-state snapshots from `collectViewState` for restore via `applyViewState`.
 */

import { escapeHtml } from './htmlEscape.js';

const STORAGE_KEY = 'explorer-v3-bookmarks';
const MAX_BOOKMARKS = 40;

/** @typedef {import('./viewState.js').ViewState} ViewState */

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   createdAt: string,
 *   state: ViewState
 * }} Bookmark
 */

const STARTER_BOOKMARKS = [
  { name: 'Labrador overview', state: { zoom: 6, lon: -63, lat: 54 } },
  { name: 'Central Labrador', state: { zoom: 8, lon: -61.5, lat: 53.5 } }
];

/**
 * @returns {Bookmark[]}
 */
function loadRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (b) =>
        b &&
        typeof b === 'object' &&
        typeof b.id === 'string' &&
        typeof b.name === 'string' &&
        typeof b.createdAt === 'string' &&
        b.state &&
        typeof b.state === 'object'
    );
  } catch {
    return [];
  }
}

/**
 * @param {Bookmark[]} bookmarks
 */
function persist(bookmarks) {
  const trimmed = bookmarks.slice(0, MAX_BOOKMARKS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    /* quota / private mode */
  }
  return trimmed;
}

/**
 * @returns {string}
 */
function newId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `bm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * @param {string} name
 * @returns {string}
 */
function normalizeName(name) {
  return String(name ?? '').trim();
}

/**
 * @returns {Bookmark[]}
 */
export function listBookmarks() {
  return loadRaw()
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

/**
 * @param {string} name
 * @param {ViewState} state
 * @returns {Bookmark | null} null when name empty or storage fails
 */
export function saveBookmark(name, state) {
  const label = normalizeName(name);
  if (!label) return null;

  const bookmarks = loadRaw();
  const entry = {
    id: newId(),
    name: label,
    createdAt: new Date().toISOString(),
    state: { ...state }
  };

  bookmarks.unshift(entry);
  const saved = persist(bookmarks);
  return saved.find((b) => b.id === entry.id) || null;
}

/**
 * @param {string} id
 * @returns {boolean}
 */
export function deleteBookmark(id) {
  if (!id) return false;
  const bookmarks = loadRaw();
  const next = bookmarks.filter((b) => b.id !== id);
  if (next.length === bookmarks.length) return false;
  persist(next);
  return true;
}

/**
 * @param {string} id
 * @returns {Bookmark | null}
 */
export function getBookmark(id) {
  if (!id) return null;
  return loadRaw().find((b) => b.id === id) || null;
}

/**
 * Seed default Labrador bookmarks when storage is empty.
 * @returns {Bookmark[]}
 */
export function ensureStarterBookmarks() {
  const existing = loadRaw();
  if (existing.length) return existing;

  const seeded = STARTER_BOOKMARKS.map((starter) => ({
    id: newId(),
    name: starter.name,
    createdAt: new Date().toISOString(),
    state: { ...starter.state }
  }));
  return persist(seeded);
}

let bookmarksStylesInjected = false;

function injectBookmarksStyles() {
  if (bookmarksStylesInjected || document.getElementById('bookmarks-control-styles')) return;
  bookmarksStylesInjected = true;
  const style = document.createElement('style');
  style.id = 'bookmarks-control-styles';
  style.textContent = `
    .bookmarks-control {
      position: relative;
      display: inline-flex;
      align-items: center;
    }
    .bookmarks-popover {
      position: absolute;
      bottom: calc(100% + 8px);
      left: 0;
      z-index: 40;
      min-width: 260px;
      max-width: min(340px, 92vw);
      padding: 10px;
      background: rgba(255, 255, 255, 0.98);
      border: 1px solid var(--card-light-border, #ccc);
      border-radius: var(--radius, 6px);
      box-shadow: var(--shadow, 0 4px 12px rgba(0, 0, 0, 0.12));
    }
    .bookmarks-save-row {
      display: flex;
      gap: 6px;
      margin-bottom: 8px;
    }
    .bookmarks-name-input {
      flex: 1;
      min-width: 0;
      padding: 6px 8px;
      border: 1px solid var(--card-light-border, #ccc);
      border-radius: 4px;
      font: inherit;
      font-size: 12px;
    }
    .bookmarks-list {
      list-style: none;
      margin: 0;
      padding: 0;
      max-height: 240px;
      overflow-y: auto;
    }
    .bookmarks-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 0;
      border-top: 1px solid rgba(0, 0, 0, 0.06);
    }
    .bookmarks-item:first-child { border-top: none; }
    .bookmarks-item-name {
      flex: 1;
      min-width: 0;
      font-size: 12px;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .bookmarks-item-actions { display: flex; gap: 4px; flex-shrink: 0; }
    .bookmarks-empty {
      margin: 0;
      font-size: 12px;
      color: var(--card-light-text-muted, #666);
    }
    .bookmarks-hint {
      margin: 0 0 8px;
      font-size: 11px;
      color: var(--card-light-text-muted, #666);
      line-height: 1.35;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Mount a Bookmarks toolbar control with save + restore/delete popover.
 * @param {{
 *   getState: () => ViewState,
 *   applyState: (state: ViewState) => void | Promise<void>,
 *   hostEl: HTMLElement
 * }} opts
 * @returns {{ destroy: () => void } | null}
 */
export function mountBookmarksControl(opts) {
  const { getState, applyState, hostEl } = opts || {};
  if (!hostEl || typeof getState !== 'function' || typeof applyState !== 'function') {
    return null;
  }

  injectBookmarksStyles();
  ensureStarterBookmarks();

  const root = document.createElement('div');
  root.className = 'bookmarks-control';
  root.innerHTML = `
    <button type="button" class="map-toolbar-btn" data-bookmarks-toggle
      title="Save and restore named map views — click again to open your list"
      aria-haspopup="true" aria-expanded="false" aria-controls="bookmarks-popover">
      Bookmarks
    </button>
    <div id="bookmarks-popover" class="bookmarks-popover" hidden data-bookmarks-popover role="dialog" aria-label="Bookmarks">
      <p class="bookmarks-hint">Saved views stay on this device. Restore jumps the map back.</p>
      <div class="bookmarks-save-row">
        <input type="text" class="bookmarks-name-input" data-bookmarks-name
          placeholder="Name this view" maxlength="80" autocomplete="off" />
        <button type="button" class="map-toolbar-btn" data-bookmarks-save>Save</button>
      </div>
      <ul class="bookmarks-list" data-bookmarks-list></ul>
      <p class="bookmarks-empty" hidden data-bookmarks-empty>No bookmarks yet — type a name and Save.</p>
    </div>`;

  hostEl.appendChild(root);

  const toggleBtn = root.querySelector('[data-bookmarks-toggle]');
  const popover = root.querySelector('[data-bookmarks-popover]');
  const nameInput = root.querySelector('[data-bookmarks-name]');
  const saveBtn = root.querySelector('[data-bookmarks-save]');
  const listEl = root.querySelector('[data-bookmarks-list]');
  const emptyEl = root.querySelector('[data-bookmarks-empty]');

  const setOpen = (open) => {
    popover.hidden = !open;
    toggleBtn.setAttribute('aria-expanded', String(open));
    if (open) renderList();
  };

  const renderList = () => {
    const bookmarks = listBookmarks();
    listEl.innerHTML = bookmarks
      .map(
        (b) => `
      <li class="bookmarks-item" data-bookmark-id="${escapeHtml(b.id)}">
        <span class="bookmarks-item-name" title="${escapeHtml(b.name)}">${escapeHtml(b.name)}</span>
        <span class="bookmarks-item-actions">
          <button type="button" class="map-toolbar-btn map-toolbar-btn-ghost" data-bookmark-restore>Restore</button>
          <button type="button" class="map-toolbar-btn map-toolbar-btn-ghost" data-bookmark-delete>Delete</button>
        </span>
      </li>`
      )
      .join('');
    emptyEl.hidden = bookmarks.length > 0;
    listEl.hidden = bookmarks.length === 0;
  };

  const onSave = () => {
    const name = normalizeName(nameInput.value);
    if (!name) {
      nameInput.focus();
      return;
    }
    const current = loadRaw();
    if (current.length >= MAX_BOOKMARKS) {
      current.pop();
      persist(current);
    }
    saveBookmark(name, getState());
    nameInput.value = '';
    renderList();
  };

  const onListClick = async (e) => {
    const item = e.target.closest('[data-bookmark-id]');
    if (!item) return;
    const id = item.getAttribute('data-bookmark-id');
    if (!id) return;

    if (e.target.closest('[data-bookmark-restore]')) {
      const bookmark = getBookmark(id);
      if (bookmark) {
        await applyState(bookmark.state);
        setOpen(false);
      }
      return;
    }

    if (e.target.closest('[data-bookmark-delete]')) {
      deleteBookmark(id);
      renderList();
    }
  };

  const onDocClick = (e) => {
    if (!popover.hidden && !root.contains(e.target)) setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape' && !popover.hidden) {
      e.preventDefault();
      setOpen(false);
      toggleBtn.focus();
    }
  };

  toggleBtn.addEventListener('click', () => setOpen(popover.hidden));
  saveBtn.addEventListener('click', onSave);
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSave();
    }
  });
  listEl.addEventListener('click', onListClick);
  document.addEventListener('click', onDocClick);
  document.addEventListener('keydown', onKeyDown);

  renderList();

  return {
    destroy: () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
      root.remove();
    }
  };
}
