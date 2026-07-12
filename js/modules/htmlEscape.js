/** Shared HTML / URL escaping for popups, lists, and settings. */

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

/** Allow https: (and relative / same-origin) URLs only; block javascript: etc. */
export function safeUrl(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || s === 'N/A') return null;
  try {
    if (s.startsWith('/') && !s.startsWith('//')) return s;
    const url = new URL(s, 'https://example.invalid');
    if (url.protocol === 'https:') return url.href;
    return null;
  } catch {
    return null;
  }
}
