/**
 * Persistent user preferences (localStorage).
 * v1: KPI bar metric selection + order.
 */

import { DEFAULT_KPI_ENABLED_IDS, KPI_CATALOG_BY_ID } from '../config/kpiCatalog.js';

const STORAGE_KEY = 'explorer-v3-prefs';
const PREFS_VERSION = 1;

export function defaultPrefs() {
  return {
    version: PREFS_VERSION,
    kpi: {
      enabledIds: [...DEFAULT_KPI_ENABLED_IDS]
    }
  };
}

function sanitizeKpiIds(ids) {
  if (!Array.isArray(ids)) return [...DEFAULT_KPI_ENABLED_IDS];
  const seen = new Set();
  const out = [];
  for (const id of ids) {
    if (typeof id !== 'string' || !KPI_CATALOG_BY_ID[id] || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out.length ? out : [...DEFAULT_KPI_ENABLED_IDS];
}

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPrefs();
    const parsed = JSON.parse(raw);
    return {
      version: PREFS_VERSION,
      kpi: {
        enabledIds: sanitizeKpiIds(parsed?.kpi?.enabledIds)
      }
    };
  } catch {
    return defaultPrefs();
  }
}

export function savePrefs(prefs) {
  const next = {
    version: PREFS_VERSION,
    kpi: {
      enabledIds: sanitizeKpiIds(prefs?.kpi?.enabledIds)
    }
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode — ignore */
  }
  return next;
}

export function getKpiEnabledIds(prefs = loadPrefs()) {
  return sanitizeKpiIds(prefs?.kpi?.enabledIds);
}

export function setKpiEnabledIds(enabledIds) {
  const prefs = loadPrefs();
  prefs.kpi.enabledIds = sanitizeKpiIds(enabledIds);
  return savePrefs(prefs);
}

export function resetKpiPrefs() {
  return setKpiEnabledIds(DEFAULT_KPI_ENABLED_IDS);
}
