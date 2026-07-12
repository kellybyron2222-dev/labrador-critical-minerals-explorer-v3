/**
 * Safe MapLibre popup HTML builders for vector feature inspect.
 * All attribute values and URLs are escaped / scheme-checked.
 */

import { escapeHtml, safeUrl } from './htmlEscape.js';

function rowsHtml(rows) {
  return rows
    .filter(([, v]) => v != null && String(v).trim() !== '' && String(v) !== 'N/A')
    .map(
      ([label, value]) =>
        `<div class="popup-row"><span class="popup-label">${escapeHtml(label)}:</span> <span class="popup-value">${escapeHtml(value)}</span></div>`
    )
    .join('');
}

function wrap(layerLabel, title, body) {
  return `
      <section class="popup-section">
        <div class="popup-section-label">${escapeHtml(layerLabel)}</div>
        <h3 class="popup-title">${escapeHtml(title)}</h3>
        ${body}
      </section>`;
}

function parseMaybeArray(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v.startsWith('[')) {
    try {
      return JSON.parse(v);
    } catch {
      return [];
    }
  }
  return [];
}

/** MODS deep-link: NMINO plugs into the province occurrence-report lookup. */
export function modsRecordUrl(nmino) {
  if (!nmino) return null;
  return `https://gis.geosurv.gov.nl.ca/mods/ModsCard.asp?NMINOString=${encodeURIComponent(nmino).replace(/%20/g, '+')}`;
}

export function buildModsPopupSection(feature, { standalone = false } = {}) {
  const p = feature.properties || {};
  const list = parseMaybeArray(p.commodityList);
  const primary = p.primaryCommodity || p.COMNAME;
  const secondaries = Array.isArray(p.secondaryCommodities)
    ? p.secondaryCommodities
    : parseMaybeArray(p.secondaryCommodities).length
      ? parseMaybeArray(p.secondaryCommodities)
      : list.filter((c) => c !== primary);
  const commodityRows = [['Primary commodity', primary]];
  if (secondaries.length) commodityRows.push(['Also reported', secondaries.join(', ')]);

  const recordUrl = modsRecordUrl(p.NMINO);
  const linkRow = recordUrl
    ? `<div class="popup-row"><span class="popup-label">MODS record:</span> <span class="popup-value"><a href="${escapeHtml(recordUrl)}" target="_blank" rel="noopener">${escapeHtml(p.NMINO)}</a></span></div>`
    : '';

  const body =
    rowsHtml([
      ...commodityRows,
      ['Status', p.STATUS],
      ['Deposit type', p.DEPDESC],
      ['Ore minerals', p.OREMIN],
      ['Work history', p.WORKING],
      ['NTS sheet', p.NTS]
    ]) + linkRow;

  if (standalone) {
    return `<div class="popup-content"><h3 class="popup-title">${escapeHtml(p.name || 'Unnamed occurrence')}</h3>${body}</div>`;
  }
  return wrap('Mineral occurrence', p.name || 'Occurrence', body);
}

export function buildPopupSection(layerId, feature) {
  const p = feature.properties || {};

  if (layerId === 'mods-layer') {
    return buildModsPopupSection(feature);
  }

  if (layerId === 'critical-minerals-layer') {
    const href = safeUrl(p.Website);
    const website = href
      ? `<div class="popup-row"><span class="popup-label">Website:</span> <span class="popup-value"><a href="${escapeHtml(href)}" target="_blank" rel="noopener">Visit site</a></span></div>`
      : '';
    const coords = feature.geometry?.coordinates;
    const lat = Array.isArray(coords) ? Number(coords[1]) : NaN;
    // Mainland Labrador clip starts ~51.5°N; sites south are island NL midstream/context.
    const offIsland = Number.isFinite(lat) && lat < 51.5;
    const locationNote = offIsland
      ? rowsHtml([['Location note', 'Off-island (Newfoundland) — not Labrador refining capacity']])
      : '';
    return wrap(
      'Critical mineral facility',
      p.name || 'Facility',
      rowsHtml([
        ['Operator', p.OperatorOwnersEN],
        ['Commodities', p.CommoditiesEN],
        ['Province', p.ProvincesEN],
        ['Group', p.OperationGroupEN],
        ['Stage', p.DevelopmentStageEN],
        ['Status', p.ActivityStatusEN]
      ]) +
        locationNote +
        website
    );
  }

  if (layerId === 'geoatlas-claims-fill') {
    const filenum = p.FILENUM && String(p.FILENUM).trim();
    const filenumRows = filenum
      ? rowsHtml([['File #', filenum]]) +
        `<div class="popup-row"><span class="popup-value"><a href="https://gis.geosurv.gov.nl.ca/minesen/geofiles/" target="_blank" rel="noopener">Open GeoFiles search</a></span></div>`
      : '';
    return wrap(
      'Map-staked claim',
      p.LICENSE_NBR || p.name || 'Mineral claim',
      rowsHtml([
        ['Holder', p.CLIENT_NAME],
        ['Status', p.STATUS],
        ['Location', p.LOCATION],
        ['# claims', p.NUMCLAIMS],
        ['Issued', p.ISSDATE],
        ['Expiry', p.EXPIRYDATE],
        ['Report due', p.RPTDUE],
        ['Mapsheets', p.MAPSHEETS],
        ['Total expenditure', p.TOTAL_EXP]
      ]) + filenumRows
    );
  }

  if (layerId === 'geoatlas-tenure-fill') {
    return wrap(
      'Mineral tenure',
      p.FEATURENAME || p.name || p.TYPEDESC || 'Mineral tenure',
      rowsHtml([
        ['Type', p.TYPEDESC],
        ['Company', p.COMPANY_NAME],
        ['Comments', p.COMMENTS],
        ['NTS', p.NTSMAP]
      ])
    );
  }

  if (layerId === 'inuit-nunatsiavut-fill') {
    return wrap(
      'Nunatsiavut (Inuit settlement area)',
      p.REGION || p.name || 'Nunatsiavut',
      rowsHtml([
        ['Region', p.REGION],
        ['Inuktitut', p.REGION_INUKTITUT]
      ]) +
        `<div class="popup-row"><span class="popup-value">Labrador Inuit Settlement Area (Inuit Nunangat). Boundaries approximate (CIRNAC/ISC).</span></div>`
    );
  }

  if (layerId === 'atris-claims-fill') {
    const desc = p.claimDescription
      ? `<div class="popup-row"><span class="popup-value">${escapeHtml(p.claimDescription)}</span></div>`
      : '';
    return wrap(
      'ATRIS land claim (not a mineral licence)',
      p.name || p.ENAME || 'Land claim',
      desc +
        rowsHtml([
          ['Category', p.CATEGORY_TYPE_EN],
          ['Provinces', p.PROVINCES_EN],
          ['Tag ID', p.TAG_ID],
          ['Claim ID', p.CLAIM_ID]
        ])
    );
  }

  if (layerId === 'geoatlas-cpcad-fill') {
    return wrap(
      'Protected / conserved area',
      p.NAME_E || p.name || 'Protected area',
      rowsHtml([
        ['Type', p.TYPE_E],
        ['Status', p.STATUS],
        ['Biome', p.BIOME],
        ['IUCN category', p.IUCN_CAT],
        ['Established', p.ESTYEAR],
        ['Mechanism', p.MECH_E],
        ['Owner', p.OWNER_E],
        ['Manager', p.MGMT_E],
        ['Area (ha)', p.O_AREA_HA]
      ]) +
        `<div class="popup-row"><span class="popup-value">CPCAD via NL GeoAtlas Land_Use. Boundaries approximate.</span></div>`
    );
  }

  if (layerId === 'geoatlas-landuse-fill') {
    const desc = p.landUseDescription
      ? `<div class="popup-row"><span class="popup-value">${escapeHtml(p.landUseDescription)}</span></div>`
      : '';
    const kind = p.landUseKind;
    const extraRows =
      kind === 'protectedAreasPlan'
        ? [
            ['Status', p.NASP_Statu],
            ['Label', p.Label],
            ['Region', p.region]
          ]
        : kind === 'specifiedMaterialLands'
          ? [
              ['Parcel', p.PARCEL_ID],
              ['Title', p.TITLE],
              ['Area (km²)', p.AREA_SQKM],
              ['Comments', p.COMMENTS]
            ]
          : kind === 'publicWaterSupplies'
            ? [
                ['Community', p.COMMUNITY_],
                ['Source', p.SOURCENAME],
                ['Description', p.DESCRIPTIO],
                ['Supply status', p.SUPPLYSTAT],
                ['Protected', p.PROTECTED]
              ]
            : kind === 'planningAreas'
              ? [
                  ['Municipality', p.MUNICIPALI],
                  ['Registry', p.OLR_LINK],
                  ['Legislation', p.GOV_LEG]
                ]
              : kind === 'windEnergyReserve'
                ? [
                    ['Area name', p.AreaName],
                    ['Area (ha)', p.Area_ha],
                    ['Comments', p.Comments],
                    ['URL', p.URL]
                  ]
                : [];
    return wrap(
      'Land use constraint',
      p.name || p.landUseKindLabel || 'Land use',
      desc +
        rowsHtml([['Kind', p.landUseKindLabel || p.landUseKind], ...extraRows])
    );
  }

  if (layerId === 'geoatlas-bedrock-fill') {
    return wrap(
      'Bedrock geology',
      p.name || p.LABEL || 'Bedrock unit',
      rowsHtml([
        ['Unit label', p.LABEL || p.name],
        ['Lithology', p.LITHOLOGY],
        ['Age', p.AGE],
        ['Tectonic setting', p.TECTONIC],
        ['Reference', p.REFERENCE]
      ])
    );
  }

  if (layerId === 'geoatlas-surficial-fill') {
    return wrap(
      'Surficial geology',
      p.name || p.GENETIC1MA || p.GENETIC250 || 'Surficial unit',
      rowsHtml([
        ['Genetic unit (1:1M)', p.GENETIC1MA],
        ['Genetic detail', p.GENETIC250],
        ['Source', p.SOURCE],
        ['Reference', p.REFERENCE]
      ])
    );
  }

  return null;
}
