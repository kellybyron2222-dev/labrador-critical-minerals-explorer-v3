import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

const STORAGE_KEY = 'explorer-v3-bookmarks';

describe('Bookmarks', () => {
  /** @type {Record<string, string>} */
  let storage;

  beforeEach(() => {
    storage = {};
    vi.stubGlobal('localStorage', {
      getItem: (key) => (key in storage ? storage[key] : null),
      setItem: (key, value) => {
        storage[key] = String(value);
      },
      removeItem: (key) => {
        delete storage[key];
      },
      clear: () => {
        storage = {};
      }
    });
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function loadModule() {
    return import('./Bookmarks.js');
  }

  it('saveBookmark and listBookmarks round-trip', async () => {
    const { saveBookmark, listBookmarks } = await loadModule();
    const state = { zoom: 7, lon: -62, lat: 54.5, layers: ['modsOccurrences'] };

    const saved = saveBookmark('Test view', state);
    expect(saved).toMatchObject({ name: 'Test view', state });

    const list = listBookmarks();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Test view');
    expect(list[0].state).toEqual(state);
    expect(storage[STORAGE_KEY]).toBeTruthy();
  });

  it('deleteBookmark removes an entry', async () => {
    const { saveBookmark, deleteBookmark, listBookmarks, getBookmark } = await loadModule();
    const a = saveBookmark('Keep', { zoom: 5 });
    const b = saveBookmark('Remove', { zoom: 6 });

    expect(deleteBookmark(b.id)).toBe(true);
    expect(listBookmarks()).toHaveLength(1);
    expect(listBookmarks()[0].id).toBe(a.id);
    expect(getBookmark(b.id)).toBeNull();
    expect(deleteBookmark('missing')).toBe(false);
  });

  it('ensureStarterBookmarks seeds defaults when empty', async () => {
    const { ensureStarterBookmarks, listBookmarks } = await loadModule();
    const seeded = ensureStarterBookmarks();

    expect(seeded).toHaveLength(2);
    expect(seeded.map((b) => b.name)).toEqual(['Labrador overview', 'Central Labrador']);
    expect(seeded[0].state).toEqual({ zoom: 6, lon: -63, lat: 54 });
    expect(seeded[1].state).toEqual({ zoom: 8, lon: -61.5, lat: 53.5 });

    const again = ensureStarterBookmarks();
    expect(again).toHaveLength(2);
    expect(listBookmarks()).toHaveLength(2);
  });

  it('rejects empty bookmark names', async () => {
    const { saveBookmark, listBookmarks } = await loadModule();
    expect(saveBookmark('   ', { zoom: 4 })).toBeNull();
    expect(listBookmarks()).toHaveLength(0);
  });

  it('caps stored bookmarks at 40', async () => {
    const { saveBookmark, listBookmarks } = await loadModule();

    for (let i = 0; i < 45; i++) {
      saveBookmark(`Bookmark ${i}`, { zoom: i });
    }

    const list = listBookmarks();
    expect(list).toHaveLength(40);
    const parsed = JSON.parse(storage[STORAGE_KEY]);
    expect(parsed).toHaveLength(40);
  });
});
