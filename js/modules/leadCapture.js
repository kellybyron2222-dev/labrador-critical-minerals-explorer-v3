/**
 * Submit waitlist / feedback from in-app forms.
 *
 * Order:
 * 1. Formspree (if VITE_FORMSPREE_* set)
 * 2. FormSubmit.co via CONTACT_EMAIL (FormData — more reliable than JSON)
 * 3. mailto: fallback so the user always has a path that works
 */

import {
  CONTACT_EMAIL,
  FORMSPREE_FEEDBACK_ID,
  FORMSPREE_WAITLIST_ID,
  formspreeUrl,
  getUtmParams
} from './launchConfig.js';

/**
 * @param {'waitlist' | 'feedback'} kind
 * @param {FormData | Record<string, string>} data
 */
export async function submitLead(kind, data) {
  const formId = kind === 'waitlist' ? FORMSPREE_WAITLIST_ID : FORMSPREE_FEEDBACK_ID;
  const formData = data instanceof FormData ? data : objectToFormData(data);
  const payload = formDataToObject(formData);
  Object.assign(payload, getUtmParams());
  payload._form = kind;
  if (payload.email) payload._replyto = payload.email;

  const subject =
    payload._subject ||
    (kind === 'waitlist'
      ? 'Labrador Explorer — stay updated'
      : 'Labrador Explorer — feedback');
  payload._subject = subject;

  if (formId) {
    try {
      const resp = await fetch(formspreeUrl(formId), {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: objectToFormData(payload)
      });
      if (!resp.ok) throw new Error(await readError(resp));
      return { channel: 'formspree' };
    } catch (err) {
      // Fall through to FormSubmit / mailto
      if (!CONTACT_EMAIL) throw err;
    }
  }

  if (CONTACT_EMAIL) {
    try {
      // FormData (multipart) — FormSubmit's AJAX JSON path often returns 500
      // until the inbox is activated or when JSON bodies are rejected.
      const body = objectToFormData({
        ...payload,
        _template: 'table',
        _honey: '' // honeypot empty
      });
      const resp = await fetch(
        `https://formsubmit.co/ajax/${encodeURIComponent(CONTACT_EMAIL)}`,
        {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body
        }
      );
      if (resp.ok) return { channel: 'formsubmit' };

      const detail = await readError(resp);
      // First-time / activation / upstream failure → still deliver via mailto
      openMailtoFallback(CONTACT_EMAIL, subject, payload);
      return {
        channel: 'mailto',
        warning:
          resp.status === 500
            ? 'FormSubmit returned an error (check your inbox for an Activate link from FormSubmit on first use). Your email app was opened as a backup.'
            : `Delivery service error (${detail}). Your email app was opened as a backup.`
      };
    } catch {
      openMailtoFallback(CONTACT_EMAIL, subject, payload);
      return {
        channel: 'mailto',
        warning: 'Network error reaching the form service. Your email app was opened as a backup.'
      };
    }
  }

  throw new Error(
    'Email capture is not configured. Set VITE_CONTACT_EMAIL in .env and restart the dev server.'
  );
}

export function isLeadCaptureConfigured(kind = 'waitlist') {
  if (kind === 'feedback') return Boolean(FORMSPREE_FEEDBACK_ID || CONTACT_EMAIL);
  return Boolean(FORMSPREE_WAITLIST_ID || CONTACT_EMAIL);
}

async function readError(resp) {
  try {
    const json = await resp.json();
    return json?.message || json?.error || `HTTP ${resp.status}`;
  } catch {
    return `HTTP ${resp.status}`;
  }
}

function openMailtoFallback(email, subject, payload) {
  const lines = Object.entries(payload)
    .filter(([k]) => !k.startsWith('_') || k === '_form')
    .map(([k, v]) => `${k}: ${v}`);
  const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(lines.join('\n'))}`;
  globalThis.location.href = mailto;
}

function objectToFormData(obj) {
  const fd = new FormData();
  Object.entries(obj || {}).forEach(([k, v]) => {
    if (v == null || v === '') return;
    if (Array.isArray(v)) v.forEach((item) => fd.append(k, String(item)));
    else fd.append(k, String(v));
  });
  return fd;
}

function formDataToObject(formData) {
  const out = {};
  formData.forEach((value, key) => {
    if (out[key]) out[key] = `${out[key]}, ${value}`;
    else out[key] = String(value);
  });
  return out;
}
