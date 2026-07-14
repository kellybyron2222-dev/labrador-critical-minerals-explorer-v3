/**
 * Privacy-light Plausible analytics — no-op when blocked or unavailable.
 */

/** @typedef {Record<string, string | number | boolean | null | undefined>} TrackProps */

export const PlausibleEvents = {
  WELCOME_SHOW: 'Welcome Show',
  WELCOME_DISMISS: 'Welcome Dismiss',
  WELCOME_EXPLORE: 'Welcome Explore',
  WELCOME_WAITLIST: 'Welcome Waitlist',
  WELCOME_ABOUT: 'Welcome About',
  VIEW_SHARE: 'View Share',
  EXPORT_PACKAGE: 'Export Package',
  WAITLIST_SUBMIT: 'Waitlist Submit',
  FEEDBACK_SUBMIT: 'Feedback Submit',
  LAYER_ON: 'Layer On',
  HARD_EXCLUSIONS_ON: 'Hard Exclusions On',
  SETTINGS_OPEN: 'Settings Open'
};

/**
 * Fire a Plausible custom event when the script is loaded.
 * @param {string} eventName
 * @param {TrackProps} [props]
 */
export function track(eventName, props) {
  if (!eventName) return;
  try {
    const plausible = typeof window !== 'undefined' ? window.plausible : undefined;
    if (typeof plausible !== 'function') return;
    if (props && Object.keys(props).length) {
      plausible(eventName, { props });
    } else {
      plausible(eventName);
    }
  } catch {
    // Ad blockers / CSP — ignore
  }
}
