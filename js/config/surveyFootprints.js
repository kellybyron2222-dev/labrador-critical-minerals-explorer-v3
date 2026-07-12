/**
 * Airborne survey footprint helpers (GeoAtlas Indexes/6).
 *
 * Footprints = full inventory of recorded surveys.
 * Signal rasters = only a few published GeoAtlas/NRCan image products.
 * Families are derived from PARAMETERS and are mutually exclusive.
 */

export const SURVEY_FAMILY_LABELS = {
  'mag+em': 'Mag + EM',
  'mag+radio': 'Mag + radiometric',
  mag: 'Magnetic only',
  radio: 'Radiometric only',
  em: 'EM only',
  other: 'Unknown / other'
};

/** Counts from Labrador bake (~1236); labels only — filters use surveyFamily. */
export const SURVEY_FOOTPRINT_PICKER = {
  defaultValue: 'all',
  groups: [
    {
      label: 'Survey type (PARAMETERS)',
      options: [
        { value: 'all', label: 'All recorded surveys' },
        { value: 'mag+em', label: 'Mag + EM (~880)' },
        { value: 'mag+radio', label: 'Mag + radiometric (~198)' },
        { value: 'mag', label: 'Magnetic only (~80)' },
        { value: 'radio', label: 'Radiometric only (~43)' },
        { value: 'em', label: 'EM only (~3)' },
        { value: 'other', label: 'Unknown / other (~32)' }
      ]
    }
  ]
};

/** GeoAtlas DIGITAL flag — Yes ≈ digital grids/line data flagged available. */
export const SURVEY_DIGITAL_PICKER = {
  defaultValue: 'all',
  groups: [
    {
      label: 'Digital data',
      options: [
        { value: 'all', label: 'Any digital status' },
        { value: 'yes', label: 'Digital available (~1,068)' },
        { value: 'no', label: 'No digital (~168)' }
      ]
    }
  ]
};

export const SURVEY_AIRBORNE_DETAIL_BASE =
  'https://www.geosurv.gov.nl.ca/airborne/disp_airborne.asp';

/**
 * Classify PARAMETERS text into coarse survey families.
 * @param {string|null|undefined} parameters
 * @returns {{ hasMagnetic: boolean, hasEm: boolean, hasRadiometric: boolean, surveyFamily: string }}
 */
export function classifySurveyParameters(parameters) {
  const p = String(parameters || '').toLowerCase();
  const hasMagnetic = /mag|magnetic|magnetometer|tfm|total field/.test(p);
  const hasEm = /\bem\b|electromag|vtem|helitem|megatem|skytem|\baem\b/.test(p);
  const hasRadiometric =
    /radio|spectrom|gamma|potassium|thorium|uranium|\beu\b|\beth\b/.test(p);

  let surveyFamily = 'other';
  if (hasRadiometric && (hasMagnetic || hasEm)) surveyFamily = 'mag+radio';
  else if (hasRadiometric) surveyFamily = 'radio';
  else if (hasMagnetic && hasEm) surveyFamily = 'mag+em';
  else if (hasMagnetic) surveyFamily = 'mag';
  else if (hasEm) surveyFamily = 'em';

  return { hasMagnetic, hasEm, hasRadiometric, surveyFamily };
}

export function surveyHasDigital(digital) {
  return String(digital || '')
    .trim()
    .toLowerCase()
    .startsWith('y');
}

export function surveyDigitalLabel(digital) {
  if (surveyHasDigital(digital)) {
    return 'Yes — digital data flagged in GeoAtlas (grids/line data may be on the NL survey page)';
  }
  if (String(digital || '').trim()) {
    return 'No — not flagged as digital (report/geofile may still exist)';
  }
  return 'Unknown';
}

export function surveyFamilyLabel(family) {
  return SURVEY_FAMILY_LABELS[family] || SURVEY_FAMILY_LABELS.other;
}

export function surveyAirborneDetailUrl(surveyId) {
  const id = String(surveyId || '').trim();
  if (!id) return null;
  return `${SURVEY_AIRBORNE_DETAIL_BASE}?SURVEY_ID=${encodeURIComponent(id)}`;
}

/** Mutates feature properties with display name + classification flags. */
export function enrichSurveyFootprintProperties(props) {
  if (!props || typeof props !== 'object') return props;
  const surveyId = props.SURVEY_ID?.toString().trim();
  const company = props.COMPANY?.toString().trim();
  const year =
    props.SURV_YEAR != null && Number(props.SURV_YEAR) > 0
      ? String(props.SURV_YEAR)
      : '';
  props.name =
    [surveyId, year && `(${year})`, company].filter(Boolean).join(' ') ||
    'Airborne survey';

  const classified = classifySurveyParameters(props.PARAMETERS);
  props.hasMagnetic = classified.hasMagnetic;
  props.hasEm = classified.hasEm;
  props.hasRadiometric = classified.hasRadiometric;
  props.surveyFamily = classified.surveyFamily;
  props.surveyFamilyLabel = surveyFamilyLabel(classified.surveyFamily);
  props.hasDigital = surveyHasDigital(props.DIGITAL);
  props.digitalLabel = surveyDigitalLabel(props.DIGITAL);
  props.surveyDetailUrl = surveyAirborneDetailUrl(surveyId);
  return props;
}

/** MapLibre filter for survey type (mutually exclusive families). */
export function buildSurveyTypeFilter(value) {
  if (!value || value === 'all') return null;
  return ['==', ['get', 'surveyFamily'], value];
}

/** MapLibre filter for GeoAtlas DIGITAL flag. */
export function buildSurveyDigitalFilter(value) {
  if (value === 'yes') return ['==', ['get', 'hasDigital'], true];
  if (value === 'no') return ['==', ['get', 'hasDigital'], false];
  return null;
}

/** Combine type + digital filters (AND). */
export function buildSurveyFootprintFilter(typeValue, digitalValue = 'all') {
  const parts = [buildSurveyTypeFilter(typeValue), buildSurveyDigitalFilter(digitalValue)].filter(
    Boolean
  );
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return ['all', ...parts];
}
