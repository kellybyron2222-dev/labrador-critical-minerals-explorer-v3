/**
 * Soft-launch config — Formspree endpoints, Plausible domain, public URLs.
 */

export const PLAUSIBLE_DOMAIN =
  import.meta.env.VITE_PLAUSIBLE_DOMAIN || 'kellybyron2222-dev.github.io';

export const FORMSPREE_WAITLIST_ID = import.meta.env.VITE_FORMSPREE_WAITLIST || '';

export const FORMSPREE_FEEDBACK_ID = import.meta.env.VITE_FORMSPREE_FEEDBACK || '';

/** Optional mailto fallback when Formspree ids are empty (set in .env). */
export const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL || '';

export const APP_PUBLIC_URL =
  'https://kellybyron2222-dev.github.io/labrador-critical-minerals-explorer-v3/';

export const APP_REPO_URL =
  'https://github.com/kellybyron2222-dev/labrador-critical-minerals-explorer-v3';

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign'];

/**
 * @param {string} id Formspree form id
 * @returns {string}
 */
export function formspreeUrl(id) {
  return `https://formspree.io/f/${id}`;
}

/**
 * Read UTM query params from the current page URL.
 * @returns {Record<string, string>}
 */
export function getUtmParams() {
  const out = {};
  if (typeof window === 'undefined') return out;
  const params = new URLSearchParams(window.location.search);
  for (const key of UTM_KEYS) {
    const val = params.get(key);
    if (val) out[key] = val;
  }
  return out;
}
