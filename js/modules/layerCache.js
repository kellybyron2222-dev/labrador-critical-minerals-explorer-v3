/** IndexedDB cache for live-fallback GeoJSON (not static bake files — those use HTTP ?v=). */

const DB_NAME = 'explorer-v3-layer-cache';
const DB_VERSION = 1;
const STORE = 'layers';

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
  });
}

/**
 * @param {string} id cache key (e.g. geoatlas-bedrock-1m)
 * @param {string} version bump when the baked file is regenerated
 * @returns {Promise<object|null>} FeatureCollection or null on miss/mismatch
 */
export async function getCachedGeoJSON(id, version) {
  try {
    const db = await openDb();
    const record = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });

    if (!record || !record.data?.features?.length) {
      db.close();
      return null;
    }

    if (record.version !== version) {
      // Evict stale version so quota isn't held by obsolete payloads.
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
      return null;
    }

    db.close();
    return record.data;
  } catch (error) {
    console.warn('Layer cache read failed:', error);
    return null;
  }
}

/**
 * @param {string} id
 * @param {string} version
 * @param {object} data FeatureCollection
 */
export async function setCachedGeoJSON(id, version, data) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({
        id,
        version,
        savedAt: Date.now(),
        data
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (error) {
    console.warn('Layer cache write failed:', error);
  }
}

/** Remove a cached layer (e.g. after intentional invalidation). */
export async function deleteCachedGeoJSON(id) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (error) {
    console.warn('Layer cache delete failed:', error);
  }
}
