/**
 * Map extent history stack — back/forward through recent center + zoom states.
 * Records on `moveend` (debounced) and skips re-push when navigating programmatically.
 */

const MAX_ENTRIES = 40;
const DEFAULT_DEBOUNCE_MS = 150;
const COORD_EPS = 1e-5;
const ZOOM_EPS = 0.01;

/**
 * @typedef {{
 *   center: [number, number],
 *   zoom: number
 * }} ExtentEntry
 */

/**
 * @typedef {{
 *   debounceMs?: number,
 *   flyDuration?: number
 * }} ExtentHistoryOptions
 */

/**
 * @typedef {{
 *   back: () => void,
 *   forward: () => void,
 *   canBack: () => boolean,
 *   canForward: () => boolean,
 *   destroy: () => void,
 *   skipNext: () => void
 * }} ExtentHistory
 */

/**
 * @param {ExtentEntry | null | undefined} a
 * @param {ExtentEntry | null | undefined} b
 * @returns {boolean}
 */
function sameExtent(a, b) {
  if (!a || !b) return false;
  return (
    Math.abs(a.center[0] - b.center[0]) <= COORD_EPS &&
    Math.abs(a.center[1] - b.center[1]) <= COORD_EPS &&
    Math.abs(a.zoom - b.zoom) <= ZOOM_EPS
  );
}

/**
 * @param {import('maplibre-gl').Map} map
 * @returns {ExtentEntry}
 */
function readExtent(map) {
  const center = map.getCenter();
  return {
    center: [center.lng, center.lat],
    zoom: map.getZoom()
  };
}

/**
 * @param {import('maplibre-gl').Map} map
 * @param {ExtentHistoryOptions} [opts]
 * @returns {ExtentHistory}
 */
export function createExtentHistory(map, opts = {}) {
  const debounceMs = opts.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const flyDuration = opts.flyDuration ?? 600;

  /** @type {ExtentEntry[]} */
  let stack = [];
  /** Index of the current extent within `stack`. */
  let pointer = -1;
  let skipNextMove = false;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let debounceTimer = null;

  const clearPending = () => {
    if (debounceTimer != null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };

  /**
   * @param {ExtentEntry} extent
   */
  const pushExtent = (extent) => {
    const current = pointer >= 0 ? stack[pointer] : null;
    if (current && sameExtent(current, extent)) return;

    // Drop forward branch when the user pans/zooms after navigating back.
    if (pointer >= 0 && pointer < stack.length - 1) {
      stack = stack.slice(0, pointer + 1);
    }

    stack.push(extent);
    pointer = stack.length - 1;

    if (stack.length > MAX_ENTRIES) {
      const overflow = stack.length - MAX_ENTRIES;
      stack = stack.slice(overflow);
      pointer = stack.length - 1;
    }
  };

  const onMoveEnd = () => {
    if (skipNextMove) {
      skipNextMove = false;
      return;
    }

    clearPending();
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      pushExtent(readExtent(map));
    }, debounceMs);
  };

  /**
   * @param {ExtentEntry} extent
   */
  const flyToExtent = (extent) => {
    clearPending();
    skipNextMove = true;
    map.flyTo({
      center: extent.center,
      zoom: extent.zoom,
      duration: flyDuration,
      essential: true
    });
  };

  const back = () => {
    if (!canBack()) return;
    pointer -= 1;
    flyToExtent(stack[pointer]);
  };

  const forward = () => {
    if (!canForward()) return;
    pointer += 1;
    flyToExtent(stack[pointer]);
  };

  const canBack = () => pointer > 0;

  const canForward = () => pointer >= 0 && pointer < stack.length - 1;

  const skipNext = () => {
    skipNextMove = true;
  };

  const destroy = () => {
    clearPending();
    map.off('moveend', onMoveEnd);
  };

  map.on('moveend', onMoveEnd);

  return { back, forward, canBack, canForward, destroy, skipNext };
}
