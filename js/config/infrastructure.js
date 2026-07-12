/**
 * Phase 3 Infrastructure — shared constants for bake scripts, layerConfig,
 * LayerManager enrichment, legends, and curated Labrador access points.
 *
 * GeoAtlas Map_Layers (verified 2026-07-12):
 *   12 Regional Road Network (NRN) — highways + collectors (+ Railroad class)
 *   14 Resource Access Roads — forest / resource tracks
 *   15 Nalcor Transmission Line
 *   16 Canvec Transmission Lines
 * Land_Use/6 Municipal Boundaries — communities polygons
 *
 * Ports / airports / generation / settlements: curated Labrador points
 * (CanVec themes not hosted on GeoAtlas REST; curated fills the gap).
 */

import { labradorGeometryQueryParams, LABRADOR_CLIP_BBOX } from './mineralLands.js';

export { labradorGeometryQueryParams, LABRADOR_CLIP_BBOX };

export const MAP_LAYERS_QUERY_BASE =
  'https://dnrmaps.gov.nl.ca/arcgis/rest/services/GeoAtlas/Map_Layers/MapServer';

export const LAND_USE_QUERY_BASE =
  'https://dnrmaps.gov.nl.ca/arcgis/rest/services/GeoAtlas/Land_Use/MapServer';

/** NRN roads used for development-feasibility (exclude local streets + railroad). */
export const ROADS_WHERE =
  "ROADCLASS IN ('Expressway / Highway','Freeway','Arterial','Collector','Ramp')";

export const RAIL_WHERE = "ROADCLASS = 'Railroad'";

export const ROADS_OUT_FIELDS =
  'OBJECTID,ROADCLASS,RTNUMBER1,RTENAME1EN,PAVSTATUS,PAVSURF,NBRLANES';

export const RESOURCE_ROADS_OUT_FIELDS =
  'OBJECTID,ROAD_NAME,ROAD_NETWORK,ROAD_ACCESS,ROAD_TYPE,ROAD_SURFACE,AUTHORITY,MAINTENANCE,COMMENTS';

export const NALCOR_OUT_FIELDS = 'OBJECTID,Id,TL_ID';

export const CANVEC_TX_OUT_FIELDS = 'OBJECTID_12,CODE,TYPE,NOLINES,THEME,DATANAME';

export const MUNICIPAL_OUT_FIELDS = 'OBJECTID,MUNICIPAL_,MUNICIPAL1,MUNICIPA_2';

/** ROADCLASS → display band for paint / legend. */
export const ROAD_CLASS_BANDS = {
  'Expressway / Highway': 'highway',
  Freeway: 'highway',
  Arterial: 'arterial',
  Collector: 'arterial',
  Ramp: 'arterial'
};

export const ROAD_BAND_COLORS = {
  highway: '#1e3a8a',
  arterial: '#64748b'
};

export const ROAD_BAND_WIDTHS = {
  highway: 2.8,
  arterial: 1.4
};

export const ROAD_BAND_LABELS = {
  highway: 'Highway / expressway',
  arterial: 'Arterial / collector'
};

export const RAIL_COLOR = '#7c2d12';

/** Resource access ROAD_ACCESS codes → band. */
export const RESOURCE_ACCESS_BANDS = {
  '1_Open': 'open',
  '2_Limited': 'limited',
  '3_ATV': 'atv',
  '4_NotPassable': 'closed',
  '5_TRailway': 'trailway',
  '6_Unknown': 'unknown'
};

export const RESOURCE_ACCESS_COLORS = {
  open: '#15803d',
  limited: '#ca8a04',
  atv: '#a16207',
  closed: '#94a3b8',
  trailway: '#78716c',
  unknown: '#cbd5e1'
};

export const RESOURCE_ACCESS_LABELS = {
  open: 'Open',
  limited: 'Limited',
  atv: 'ATV',
  closed: 'Not passable',
  trailway: "T'Railway",
  unknown: 'Unknown'
};

export const TRANSMISSION_SOURCE_COLORS = {
  nalcor: '#b45309',
  canvec: '#d97706'
};

export const TRANSMISSION_SOURCE_LABELS = {
  nalcor: 'Nalcor / NL Hydro',
  canvec: 'CanVec transmission'
};

/** Curated site kinds for ports / airports / generation / communities. */
export const SITE_KIND_COLORS = {
  port: '#0369a1',
  airport: '#4f46e5',
  generation: '#c2410c',
  community: '#334155'
};

export const SITE_KIND_LABELS = {
  port: 'Port / marine access',
  airport: 'Airport / airstrip',
  generation: 'Power generation',
  community: 'Community'
};

/** MapLibre icon id by generationType (generation sites). */
export const GENERATION_ICON_BY_TYPE = {
  hydro: 'hydro',
  hydroPotential: 'hydroPotential'
};

export const MUNICIPAL_FILL = '#94a3b8';

/**
 * Curated Nalcor TL_ID → development attributes.
 * GeoAtlas layer 15 only exposes TL_ID; owner/voltage/role are filled here
 * from public Lower Churchill / Churchill Falls system descriptions.
 */
export const TRANSMISSION_BY_TL_ID = {
  '3101': {
    corridor: 'Labrador Transmission Assets (LTA)',
    operator: 'Newfoundland and Labrador Hydro',
    owner: 'NL Hydro (ex-Nalcor transmission assets)',
    voltage: '~315 kV AC',
    circuits: 'Twin circuit (line A)',
    capacityNote: 'Interconnects Muskrat Falls and Churchill Falls generation',
    role: 'Generation backbone — Lower Churchill ↔ Churchill Falls'
  },
  '3102': {
    corridor: 'Labrador Transmission Assets (LTA)',
    operator: 'Newfoundland and Labrador Hydro',
    owner: 'NL Hydro (ex-Nalcor transmission assets)',
    voltage: '~315 kV AC',
    circuits: 'Twin circuit (line B)',
    capacityNote: 'Interconnects Muskrat Falls and Churchill Falls generation',
    role: 'Generation backbone — Lower Churchill ↔ Churchill Falls'
  },
  '3501': {
    corridor: 'Labrador–Island Link (LIL)',
    operator: 'Newfoundland and Labrador Hydro',
    owner: 'NL Hydro (ex-Nalcor)',
    voltage: '±350 kV HVDC',
    circuits: 'HVDC bipole',
    capacityNote: '~900 MW nominal export toward Newfoundland Island',
    role: 'Export / island supply — Muskrat Falls → Strait of Belle Isle corridor'
  }
};

/** CanVec TYPE codes on Map_Layers/16 (attribute-poor national geometry). */
export const CANVEC_TX_TYPE_LABELS = {
  1: 'Transmission line',
  2: 'Transmission line (secondary class)'
};

/**
 * Curated Labrador infrastructure points (lon, lat) with development KPIs.
 * Attributes are best-available public/context values for siting — not a
 * live port authority or utility API. status: operating | seasonal | potential
 */
export const CURATED_INFRA_SITES = [
  // ——— Ports / marine ———
  {
    id: 'port-goose-bay',
    name: 'Goose Bay / Happy Valley port',
    siteKind: 'port',
    status: 'operating',
    operator: 'Town / regional harbour users',
    owner: 'Public harbour (multi-user)',
    portType: 'Deep-water regional port',
    maxVessel: 'Ocean-going / deep-draft capable (regional hub)',
    draftNote: 'Deep-water access on Lake Melville / Hamilton Inlet',
    seasonality: 'Year-round with ice management; winter constraints possible',
    roadAccess: 'Trans-Labrador Highway (Route 500 / 510)',
    railAccess: 'None',
    commodities: 'General cargo, fuel, project freight',
    note: 'Primary logistics hub for central Labrador',
    coordinates: [-60.42, 53.3]
  },
  {
    id: 'port-cartwright',
    name: 'Cartwright harbour',
    siteKind: 'port',
    status: 'operating',
    operator: 'Community / coastal shipping',
    owner: 'Public harbour',
    portType: 'Coastal community harbour',
    maxVessel: 'Coastal freighters / supply vessels',
    draftNote: 'Shallower coastal harbour — not a bulk ore terminal',
    seasonality: 'Ice-affected; seasonal shipping window',
    roadAccess: 'Route 516 (Trans-Labrador connector)',
    railAccess: 'None',
    commodities: 'Community resupply, fisheries',
    note: 'South Labrador coast access',
    coordinates: [-57.02, 53.71]
  },
  {
    id: 'port-voiseys',
    name: "Voisey's Bay / Edward's Cove shipping",
    siteKind: 'port',
    status: 'operating',
    operator: 'Vale Newfoundland & Labrador',
    owner: 'Private mine terminal (Vale)',
    portType: 'Private industrial marine terminal',
    maxVessel: 'Concentrate / bulk carriers (mine-dedicated)',
    draftNote: 'Purpose-built for Voisey’s Bay concentrate export',
    seasonality: 'Operated to mine shipping schedule; northern ice risk',
    roadAccess: 'Mine access only (not public highway)',
    railAccess: 'None',
    commodities: 'Nickel / copper / cobalt concentrate',
    note: 'Not a public multi-user port — private mine logistics',
    coordinates: [-62.1, 56.33]
  },
  {
    id: 'port-nain',
    name: 'Nain harbour',
    siteKind: 'port',
    status: 'seasonal',
    operator: 'Community / Nunatsiavut coastal shipping',
    owner: 'Public harbour',
    portType: 'Northern community harbour',
    maxVessel: 'Coastal supply / sealift vessels',
    draftNote: 'Community-scale; not deep-water bulk',
    seasonality: 'Strongly seasonal — winter ice',
    roadAccess: 'No highway; air / marine only',
    railAccess: 'None',
    commodities: 'Community resupply',
    note: 'Nunatsiavut capital marine access',
    coordinates: [-61.69, 56.54]
  },
  {
    id: 'port-makkovik',
    name: 'Makkovik harbour',
    siteKind: 'port',
    status: 'seasonal',
    operator: 'Community / coastal shipping',
    owner: 'Public harbour',
    portType: 'Coastal community harbour',
    maxVessel: 'Coastal supply vessels',
    draftNote: 'Community-scale',
    seasonality: 'Seasonal ice',
    roadAccess: 'No highway; air / marine',
    railAccess: 'None',
    commodities: 'Community resupply, fisheries',
    coordinates: [-59.17, 55.09]
  },
  {
    id: 'port-rigolet',
    name: 'Rigolet harbour',
    siteKind: 'port',
    status: 'seasonal',
    operator: 'Community / coastal shipping',
    owner: 'Public harbour',
    portType: 'Coastal community harbour',
    maxVessel: 'Coastal supply vessels',
    draftNote: 'Community-scale',
    seasonality: 'Seasonal ice',
    roadAccess: 'No highway; air / marine',
    railAccess: 'None',
    commodities: 'Community resupply',
    coordinates: [-58.43, 54.18]
  },
  {
    id: 'port-marys-harbour',
    name: "Mary's Harbour",
    siteKind: 'port',
    status: 'operating',
    operator: 'Community / coastal shipping',
    owner: 'Public harbour',
    portType: 'Coastal community harbour',
    maxVessel: 'Coastal freighters',
    draftNote: 'South Labrador coastal',
    seasonality: 'Ice-affected winters',
    roadAccess: 'Local / coastal road network',
    railAccess: 'None',
    commodities: 'Community resupply, fisheries',
    coordinates: [-55.84, 52.31]
  },
  {
    id: 'port-red-bay',
    name: 'Red Bay',
    siteKind: 'port',
    status: 'operating',
    operator: 'Community / tourism / coastal',
    owner: 'Public harbour',
    portType: 'Coastal harbour (Strait of Belle Isle)',
    maxVessel: 'Small coastal / tourism vessels',
    draftNote: 'Not a heavy industrial terminal',
    seasonality: 'Strait ice / weather windows',
    roadAccess: 'Route 510 (Trans-Labrador south)',
    railAccess: 'None',
    commodities: 'Local / tourism / fisheries',
    note: 'Strait of Belle Isle coast — road-linked',
    coordinates: [-56.43, 51.73]
  },
  {
    id: 'port-hopedale',
    name: 'Hopedale harbour',
    siteKind: 'port',
    status: 'seasonal',
    operator: 'Community / Nunatsiavut coastal shipping',
    owner: 'Public harbour',
    portType: 'Northern community harbour',
    maxVessel: 'Coastal supply / sealift vessels',
    draftNote: 'Community-scale',
    seasonality: 'Strongly seasonal — winter ice',
    roadAccess: 'No highway; air / marine only',
    railAccess: 'None',
    commodities: 'Community resupply',
    note: 'Nunatsiavut — paired with CYHO airstrip',
    coordinates: [-60.22, 55.46]
  },
  {
    id: 'port-black-tickle',
    name: 'Black Tickle harbour',
    siteKind: 'port',
    status: 'seasonal',
    operator: 'Community / coastal shipping',
    owner: 'Public harbour',
    portType: 'Island / coastal community harbour',
    maxVessel: 'Coastal supply / fishing vessels',
    draftNote: 'Community-scale; Island of Ponds',
    seasonality: 'Ice-affected',
    roadAccess: 'Local only (island community)',
    railAccess: 'None',
    commodities: 'Fisheries, community resupply',
    note: 'Southern Labrador coast — paired with CCE4 airstrip',
    coordinates: [-55.7875, 53.47]
  },
  // ——— Airports ———
  {
    id: 'air-goose-bay',
    name: 'Goose Bay (CYYR)',
    siteKind: 'airport',
    status: 'operating',
    icao: 'CYYR',
    operator: 'Goose Bay Airport Corporation / NAV CANADA',
    owner: 'Regional airport authority',
    airportClass: 'Regional jet / transport hub',
    runway: 'Paved — long runways (heavy aircraft capable)',
    runwayLength: '~3,000 m class (main)',
    fuel: 'Jet A / aviation fuel available',
    customs: 'CANPASS / regional gateway',
    yearRound: 'Yes',
    note: 'Primary air logistics gateway for Labrador',
    coordinates: [-60.4166, 53.3192]
  },
  {
    id: 'air-wabush',
    name: 'Wabush (CYWK)',
    siteKind: 'airport',
    status: 'operating',
    icao: 'CYWK',
    operator: 'Transport Canada / regional operators',
    owner: 'Public airport',
    airportClass: 'Regional (Labrador West)',
    runway: 'Paved',
    runwayLength: '~1,800 m class',
    fuel: 'Aviation fuel (confirm seasonally)',
    customs: 'Domestic',
    yearRound: 'Yes',
    note: 'Serves Labrador City / Wabush mining district',
    coordinates: [-66.8654, 52.9219]
  },
  {
    id: 'air-churchill-falls',
    name: 'Churchill Falls (CZUM)',
    siteKind: 'airport',
    status: 'operating',
    icao: 'CZUM',
    operator: 'NL Hydro / community airport',
    owner: 'Company / community field',
    airportClass: 'Community / industrial support',
    runway: 'Paved / maintained for hydro town',
    runwayLength: 'Short–medium community strip',
    fuel: 'Limited — confirm with operator',
    customs: 'Domestic',
    yearRound: 'Yes (weather permitting)',
    note: 'Supports Churchill Falls generating station community',
    coordinates: [-64.1064, 53.5619]
  },
  {
    id: 'air-nain',
    name: 'Nain (CYDP)',
    siteKind: 'airport',
    status: 'operating',
    icao: 'CYDP',
    operator: 'Community / scheduled carriers',
    owner: 'Public community airport',
    airportClass: 'Community airstrip',
    runway: 'Gravel / community',
    runwayLength: 'Short strip — Twin Otter class',
    fuel: 'Limited',
    customs: 'Domestic',
    yearRound: 'Yes (weather / IFR limits)',
    note: 'Nunatsiavut capital air access',
    coordinates: [-61.6803, 56.5492]
  },
  {
    id: 'air-natuashish',
    name: 'Natuashish (YNP)',
    siteKind: 'airport',
    status: 'operating',
    icao: 'CNH2',
    operator: 'Government of Newfoundland and Labrador',
    owner: 'Public community airport',
    airportClass: 'Community airstrip',
    runway: 'Gravel 12/30',
    runwayLength: '~762 m (2,500 ft)',
    fuel: 'Limited',
    customs: 'Domestic',
    yearRound: 'Yes (weather / IFR limits)',
    note: 'Serves Natuashish — north coast between Nain and Hopedale',
    coordSource: 'Wikipedia / CFS (WGS84)',
    coordinates: [-61.18444, 55.91389]
  },
  {
    id: 'air-hopedale',
    name: 'Hopedale (CYHO)',
    siteKind: 'airport',
    status: 'operating',
    icao: 'CYHO',
    operator: 'Community / scheduled carriers',
    owner: 'Public community airport',
    airportClass: 'Community airstrip',
    runway: 'Gravel / community',
    runwayLength: 'Short strip',
    fuel: 'Limited',
    customs: 'Domestic',
    yearRound: 'Yes (weather permitting)',
    coordinates: [-60.2283, 55.4483]
  },
  {
    id: 'air-makkovik',
    name: 'Makkovik (CYFT)',
    siteKind: 'airport',
    status: 'operating',
    icao: 'CYFT',
    operator: 'Community / scheduled carriers',
    owner: 'Public community airport',
    airportClass: 'Community airstrip',
    runway: 'Gravel / community',
    runwayLength: 'Short strip',
    fuel: 'Limited',
    customs: 'Domestic',
    yearRound: 'Yes (weather permitting)',
    coordinates: [-59.1864, 55.0769]
  },
  {
    id: 'air-cartwright',
    name: 'Cartwright (CYCA)',
    siteKind: 'airport',
    status: 'operating',
    icao: 'CYCA',
    operator: 'Community / scheduled carriers',
    owner: 'Public community airport',
    airportClass: 'Community airstrip',
    runway: 'Gravel / community',
    runwayLength: 'Short strip',
    fuel: 'Limited',
    customs: 'Domestic',
    yearRound: 'Yes (weather permitting)',
    coordinates: [-57.0419, 53.6828]
  },
  {
    id: 'air-marys-harbour',
    name: "Mary's Harbour (CYMH)",
    siteKind: 'airport',
    status: 'operating',
    icao: 'CYMH',
    operator: 'Community / scheduled carriers',
    owner: 'Public community airport',
    airportClass: 'Community airstrip',
    runway: 'Gravel / community',
    runwayLength: 'Short strip',
    fuel: 'Limited',
    customs: 'Domestic',
    yearRound: 'Yes (weather permitting)',
    coordinates: [-55.8472, 52.3028]
  },
  {
    id: 'air-black-tickle',
    name: 'Black Tickle (YBI)',
    siteKind: 'airport',
    status: 'operating',
    icao: 'CCE4',
    operator: 'Government of Newfoundland and Labrador',
    owner: 'Public community airport',
    airportClass: 'Community airstrip',
    runway: 'Gravel / community',
    runwayLength: 'Short strip',
    fuel: 'Limited',
    customs: 'Domestic',
    yearRound: 'Yes (weather permitting)',
    note: 'Island of Ponds — southern Labrador coast',
    coordSource: 'Wikipedia / CFS (WGS84)',
    coordinates: [-55.7875, 53.47]
  },
  {
    id: 'air-charlottetown',
    name: 'Charlottetown, Labrador (YHG)',
    siteKind: 'airport',
    status: 'operating',
    icao: 'CCH4',
    operator: 'Government of Newfoundland and Labrador',
    owner: 'Public community airport',
    airportClass: 'Community airstrip',
    runway: 'Gravel / community',
    runwayLength: 'Short strip',
    fuel: 'Limited',
    customs: 'Domestic',
    yearRound: 'Yes (weather permitting)',
    note: 'Southern Labrador town airstrip (not PEI)',
    coordSource: 'Wikipedia / CFS (WGS84)',
    coordinates: [-56.11556, 52.765]
  },
  {
    id: 'air-st-lewis',
    name: "St. Lewis / Fox Harbour (CCK4)",
    siteKind: 'airport',
    status: 'operating',
    icao: 'CCK4',
    operator: 'Government of Newfoundland and Labrador',
    owner: 'Public community airport',
    airportClass: 'Community airstrip',
    runway: 'Gravel / community',
    runwayLength: 'Short strip',
    fuel: 'Limited',
    customs: 'Domestic',
    yearRound: 'Yes (weather permitting)',
    note: 'Southern Labrador — near Mary’s Harbour',
    coordSource: 'Wikipedia / CFS (WGS84)',
    coordinates: [-55.67389, 52.37278]
  },
  {
    id: 'air-voiseys',
    name: "Voisey's Bay Aerodrome",
    siteKind: 'airport',
    status: 'operating',
    icao: 'CVB2',
    operator: 'Vale Newfoundland & Labrador',
    owner: 'Private mine aerodrome',
    airportClass: 'Private industrial airstrip',
    runway: 'Mine field',
    runwayLength: 'Mine logistics class',
    fuel: 'Mine operations',
    customs: 'Private / not public scheduled',
    yearRound: 'Operated to mine schedule',
    note: 'Private — not a public community airport; mine logistics only',
    coordSource: 'Wikipedia / CFS (WGS84)',
    coordinates: [-62.08806, 56.34472]
  },
  {
    id: 'air-rigolet',
    name: 'Rigolet (YRG)',
    siteKind: 'airport',
    status: 'operating',
    icao: 'CCZ2',
    operator: 'Community / scheduled carriers',
    owner: 'Public community airport',
    airportClass: 'Community airstrip',
    runway: 'Gravel / community',
    runwayLength: 'Short strip',
    fuel: 'Limited',
    customs: 'Domestic',
    yearRound: 'Yes (weather permitting)',
    coordinates: [-58.4575, 54.1797]
  },
  {
    id: 'air-port-hope-simpson',
    name: 'Port Hope Simpson (YHA)',
    siteKind: 'airport',
    status: 'operating',
    icao: 'YHA',
    operator: 'Community / scheduled carriers',
    owner: 'Public community airport',
    airportClass: 'Community airstrip',
    runway: 'Gravel / community',
    runwayLength: 'Short strip',
    fuel: 'Limited',
    customs: 'Domestic',
    yearRound: 'Yes (weather permitting)',
    coordinates: [-56.2861, 52.5281]
  },
  {
    id: 'air-postville',
    name: 'Postville (YSO)',
    siteKind: 'airport',
    status: 'operating',
    icao: 'YSO',
    operator: 'Community / scheduled carriers',
    owner: 'Public community airport',
    airportClass: 'Community airstrip',
    runway: 'Gravel / community',
    runwayLength: 'Short strip',
    fuel: 'Limited',
    customs: 'Domestic',
    yearRound: 'Yes (weather permitting)',
    coordinates: [-59.785, 54.9103]
  },
  // ——— Generation ———
  {
    id: 'gen-churchill-falls',
    name: 'Churchill Falls Generating Station',
    siteKind: 'generation',
    status: 'operating',
    generationType: 'hydro',
    operator: 'Churchill Falls (Labrador) Corporation / Hydro-Québec partnership context',
    owner: 'CF(L)Co (Hydro-Québec majority; NL interest)',
    capacityMW: '~5,428 MW',
    inService: '1971–74 (phased)',
    fuel: 'Hydroelectric',
    interconnection: 'Quebec grid + Labrador system; feeds HV export',
    note: 'One of North America’s largest hydro plants — anchors Labrador power',
    coordSource: 'Wikipedia / GEM (WGS84 plant)',
    // Plant switchyard — NOT the Churchill Falls townsite (~23 km west at -64.32).
    coordinates: [-63.9659, 53.5287]
  },
  {
    id: 'gen-muskrat-falls',
    name: 'Muskrat Falls Generating Station',
    siteKind: 'generation',
    status: 'operating',
    generationType: 'hydro',
    operator: 'Newfoundland and Labrador Hydro',
    owner: 'NL Hydro (Lower Churchill Project)',
    capacityMW: '~824 MW',
    inService: '2021 (first power) / fully online thereafter',
    fuel: 'Hydroelectric',
    interconnection: 'LTA to Churchill Falls; LIL HVDC toward Island',
    note: 'Lower Churchill Project — primary new Labrador generation',
    coordSource: 'Wikipedia (WGS84)',
    coordinates: [-60.7728, 53.2456]
  },
  {
    id: 'gen-gull-island',
    name: 'Gull Island (proposed)',
    siteKind: 'generation',
    status: 'potential',
    generationType: 'hydroPotential',
    operator: 'Proposed — NL Hydro / Lower Churchill concept',
    owner: 'Not built',
    capacityMW: '~2,250 MW (historic proposal range)',
    inService: 'Not operating — proposed only',
    fuel: 'Hydroelectric (proposed)',
    interconnection: 'Would tie into Lower Churchill / export system if built',
    note: 'Do not treat as available capacity — potential site only',
    coordSource: 'Global Energy Monitor (proposed site)',
    coordinates: [-61.3728, 52.9646]
  },
  // ——— Communities (lighter context) ———
  {
    id: 'town-happy-valley-goose-bay',
    name: 'Happy Valley-Goose Bay',
    siteKind: 'community',
    status: 'operating',
    region: 'Central Labrador',
    services: 'Regional hospital, airport (CYYR), port, highway hub',
    roadAccess: 'Trans-Labrador Highway',
    note: 'Largest service centre in Labrador',
    coordinates: [-60.33, 53.3]
  },
  {
    id: 'town-labrador-city',
    name: 'Labrador City',
    siteKind: 'community',
    status: 'operating',
    region: 'Labrador West',
    services: 'Mining town services; airport at Wabush (CYWK)',
    roadAccess: 'Trans-Labrador Highway (Route 500)',
    railAccess: 'QNS&L / iron-ore rail to Sept-Îles',
    note: 'Iron-ore mining centre',
    coordinates: [-66.91, 52.95]
  },
  {
    id: 'town-wabush',
    name: 'Wabush',
    siteKind: 'community',
    status: 'operating',
    region: 'Labrador West',
    services: 'Adjacent to Labrador City; CYWK airport',
    roadAccess: 'Trans-Labrador Highway',
    railAccess: 'Iron-ore rail corridor',
    coordinates: [-66.87, 52.9]
  },
  {
    id: 'town-churchill-falls',
    name: 'Churchill Falls',
    siteKind: 'community',
    status: 'operating',
    region: 'Central Labrador (hydro town)',
    services: 'Company town; airport CZUM; hydro plant',
    roadAccess: 'Highway link via Trans-Labrador system',
    note: 'Tied to generating station',
    coordinates: [-64.32, 53.53]
  },
  {
    id: 'town-nain',
    name: 'Nain',
    siteKind: 'community',
    status: 'operating',
    region: 'Nunatsiavut',
    services: 'Nunatsiavut capital; airport CYDP; seasonal harbour',
    roadAccess: 'No highway',
    note: 'Air / marine access only',
    coordinates: [-61.69, 56.54]
  },
  {
    id: 'town-hopedale',
    name: 'Hopedale',
    siteKind: 'community',
    status: 'operating',
    region: 'Nunatsiavut',
    services: 'Community airstrip CYHO; seasonal marine',
    roadAccess: 'No highway',
    coordinates: [-60.22, 55.46]
  },
  {
    id: 'town-makkovik',
    name: 'Makkovik',
    siteKind: 'community',
    status: 'operating',
    region: 'Nunatsiavut',
    services: 'Community airstrip CYFT; seasonal marine',
    roadAccess: 'No highway',
    coordinates: [-59.19, 55.08]
  },
  {
    id: 'town-postville',
    name: 'Postville',
    siteKind: 'community',
    status: 'operating',
    region: 'Nunatsiavut',
    services: 'Community airstrip YSO; seasonal marine',
    roadAccess: 'No highway',
    coordinates: [-59.79, 54.91]
  },
  {
    id: 'town-rigolet',
    name: 'Rigolet',
    siteKind: 'community',
    status: 'operating',
    region: 'Nunatsiavut',
    services: 'Community airstrip YRG; seasonal marine',
    roadAccess: 'No highway',
    coordinates: [-58.43, 54.18]
  },
  {
    id: 'town-cartwright',
    name: 'Cartwright',
    siteKind: 'community',
    status: 'operating',
    region: 'South / coastal Labrador',
    services: 'Harbour + airstrip CYCA; road link',
    roadAccess: 'Route 516',
    coordinates: [-57.02, 53.71]
  },
  {
    id: 'town-port-hope-simpson',
    name: 'Port Hope Simpson',
    siteKind: 'community',
    status: 'operating',
    region: 'South Labrador',
    services: 'Community airstrip YHA',
    roadAccess: 'Coastal / Trans-Labrador south network',
    coordinates: [-56.3, 52.54]
  },
  {
    id: 'town-marys-harbour',
    name: "Mary's Harbour",
    siteKind: 'community',
    status: 'operating',
    region: 'South Labrador',
    services: 'Harbour + airstrip CYMH',
    roadAccess: 'Coastal road network',
    coordinates: [-55.84, 52.31]
  },
  {
    id: 'town-black-tickle',
    name: 'Black Tickle',
    siteKind: 'community',
    status: 'operating',
    region: 'South / coastal Labrador (Island of Ponds)',
    services: 'Community airstrip CCE4; fisheries harbour',
    roadAccess: 'Local / island',
    note: 'Southern Inuit (NunatuKavut) coastal community',
    coordinates: [-55.7875, 53.47]
  },
  {
    id: 'town-charlottetown',
    name: 'Charlottetown (Labrador)',
    siteKind: 'community',
    status: 'operating',
    region: 'South Labrador',
    services: 'Town; community airstrip CCH4',
    roadAccess: 'Coastal / Trans-Labrador south network',
    note: 'Not Charlottetown PEI',
    coordinates: [-56.11556, 52.765]
  },
  {
    id: 'town-st-lewis',
    name: 'St. Lewis',
    siteKind: 'community',
    status: 'operating',
    region: 'South Labrador',
    services: 'Town; airstrip CCK4 (Fox Harbour)',
    roadAccess: 'Coastal road network',
    coordinates: [-55.67389, 52.37278]
  },
  {
    id: 'town-red-bay',
    name: 'Red Bay',
    siteKind: 'community',
    status: 'operating',
    region: 'Strait of Belle Isle',
    services: 'Harbour; UNESCO / tourism context; road-linked',
    roadAccess: 'Route 510',
    coordinates: [-56.43, 51.73]
  },
  {
    id: 'town-north-west-river',
    name: 'North West River',
    siteKind: 'community',
    status: 'operating',
    region: 'Central Labrador',
    services: 'Near Happy Valley-Goose Bay',
    roadAccess: 'Local / highway via HV-GB',
    coordinates: [-60.14, 53.52]
  },
  {
    id: 'town-sheshatshiu',
    name: 'Sheshatshiu',
    siteKind: 'community',
    status: 'operating',
    region: 'Central Labrador',
    services: 'Innu Nation community near HV-GB',
    roadAccess: 'Local / highway via HV-GB',
    note: 'Innu Nation community',
    coordinates: [-60.15, 53.5]
  },
  {
    id: 'town-natuashish',
    name: 'Natuashish',
    siteKind: 'community',
    status: 'operating',
    region: 'North / coastal Labrador',
    services: 'Innu Nation community; air / marine',
    roadAccess: 'No highway',
    note: 'Innu Nation community',
    coordinates: [-61.15, 55.91]
  },
  {
    id: 'town-forteau',
    name: 'Forteau',
    siteKind: 'community',
    status: 'operating',
    region: 'Strait of Belle Isle',
    services: 'Coastal community on Route 510',
    roadAccess: 'Route 510 (Trans-Labrador south)',
    coordinates: [-56.96, 51.47]
  },
  {
    id: 'town-l-anse-au-loup',
    name: "L'Anse-au-Loup",
    siteKind: 'community',
    status: 'operating',
    region: 'Strait of Belle Isle',
    services: 'Coastal community on Route 510',
    roadAccess: 'Route 510',
    coordinates: [-56.83, 51.52]
  }
];

export function resolveRoadBand(roadClass) {
  return ROAD_CLASS_BANDS[roadClass] || 'arterial';
}

export function resolveRoadColor(roadClass) {
  return ROAD_BAND_COLORS[resolveRoadBand(roadClass)] || ROAD_BAND_COLORS.arterial;
}

export function enrichRoadsFeatureProperties(props) {
  const roadClass = props.ROADCLASS || '';
  props.roadBand = resolveRoadBand(roadClass);
  props.lineColor = resolveRoadColor(roadClass);
  const route =
    (props.RTNUMBER1 && props.RTNUMBER1 !== 'None' && String(props.RTNUMBER1).trim()) ||
    (props.RTENAME1EN && props.RTENAME1EN !== 'None' && String(props.RTENAME1EN).trim()) ||
    '';
  props.name = route || roadClass || 'Road';
  const place =
    (props.L_PLACENAM && props.L_PLACENAM !== 'None' && String(props.L_PLACENAM).trim()) ||
    (props.R_PLACENAM && props.R_PLACENAM !== 'None' && String(props.R_PLACENAM).trim()) ||
    '';
  props.placeName = place;
  props.accessRole =
    props.roadBand === 'highway'
      ? 'Primary highway corridor (e.g. Trans-Labrador class)'
      : 'Collector / arterial — regional access';
  return props;
}

export function enrichRailFeatureProperties(props) {
  props.lineColor = RAIL_COLOR;
  props.name =
    (props.RTENAME1EN && props.RTENAME1EN !== 'None' && String(props.RTENAME1EN).trim()) ||
    (props.RTNUMBER1 && props.RTNUMBER1 !== 'None' && String(props.RTNUMBER1).trim()) ||
    'Railway';
  // GeoAtlas NRN only carries ROADCLASS=Railroad — no owner/operator fields.
  // Do not invent operator/owner as if they came from the source.
  props.role =
    'NRN railroad geometry (Labrador). Typically QNS&L / IOC heavy-haul context in Labrador West — confirm ownership separately.';
  return props;
}

export function enrichResourceRoadProperties(props) {
  const access = props.ROAD_ACCESS || '6_Unknown';
  props.accessBand = RESOURCE_ACCESS_BANDS[access] || 'unknown';
  props.lineColor = RESOURCE_ACCESS_COLORS[props.accessBand] || RESOURCE_ACCESS_COLORS.unknown;
  props.name =
    (props.ROAD_NAME && String(props.ROAD_NAME).trim()) ||
    (props.ROAD_NETWORK && String(props.ROAD_NETWORK).trim()) ||
    RESOURCE_ACCESS_LABELS[props.accessBand] ||
    'Resource access road';
  props.accessLabel = RESOURCE_ACCESS_LABELS[props.accessBand] || access;
  props.role = 'Forest / resource track — verify current passability before relying for heavy haul';
  return props;
}

export function enrichTransmissionProperties(props, sourceTag) {
  props.txSource = sourceTag;
  props.lineColor = TRANSMISSION_SOURCE_COLORS[sourceTag] || TRANSMISSION_SOURCE_COLORS.canvec;

  if (sourceTag === 'nalcor') {
    const tl = String(props.TL_ID || props.Id || '').trim();
    const curated = TRANSMISSION_BY_TL_ID[tl];
    if (curated) {
      // Curated KPI overlay — NOT present on GeoAtlas layer 15 (TL_ID only).
      Object.assign(props, curated);
      props.name = curated.corridor;
      props.attributeProvenance = 'curated-context';
    } else {
      props.name = tl ? `NL Hydro line ${tl}` : 'NL Hydro transmission';
      props.attributeProvenance = 'source-only';
      props.role = 'Nalcor / NL Hydro mapped corridor (GeoAtlas attributes: TL_ID only)';
    }
    props.circuits = props.circuits || (props.TL_ID ? `TL_ID ${props.TL_ID}` : null);
  } else {
    const typeNum = Number(props.TYPE);
    props.lineClass = CANVEC_TX_TYPE_LABELS[typeNum] || `CanVec type ${props.TYPE ?? 'unknown'}`;
    props.circuits = props.NOLINES != null ? `${props.NOLINES} circuit(s)` : null;
    props.attributeProvenance = 'source-only';
    props.role = 'CanVec transmission geometry — owner/voltage not in attributes';
    props.name =
      (props.DATANAME && `Transmission (${props.DATANAME})`) ||
      props.lineClass ||
      'CanVec transmission';
  }
  return props;
}

export function enrichMunicipalProperties(props) {
  props.name =
    (props.MUNICIPAL_ && String(props.MUNICIPAL_).trim()) ||
    (props.MUNICIPAL1 && String(props.MUNICIPAL1).trim()) ||
    (props.MUNICIPA_2 && String(props.MUNICIPA_2).trim()) ||
    'Municipal area';
  props.fillColor = MUNICIPAL_FILL;
  props.role = 'Incorporated municipal boundary — local land-use / permitting context';
  return props;
}

export function enrichSiteProperties(props) {
  const kind = props.siteKind || 'community';
  props.circleColor = SITE_KIND_COLORS[kind] || SITE_KIND_COLORS.community;
  props.siteKindLabel = SITE_KIND_LABELS[kind] || kind;

  if (kind === 'port') {
    props.iconId = 'port';
  } else if (kind === 'airport') {
    props.iconId = 'airport';
  } else if (kind === 'generation') {
    const gType = props.generationType || (props.status === 'potential' ? 'hydroPotential' : 'hydro');
    props.generationType = gType;
    props.iconId = GENERATION_ICON_BY_TYPE[gType] || 'hydro';
    props.generationTypeLabel =
      gType === 'hydroPotential' ? 'Hydroelectric (proposed)' : 'Hydroelectric';
  }
  return props;
}

export function buildRoadsLegendItems() {
  return Object.entries(ROAD_BAND_LABELS).map(([band, label]) => ({
    label,
    color: ROAD_BAND_COLORS[band]
  }));
}

export function buildResourceRoadsLegendItems() {
  return Object.entries(RESOURCE_ACCESS_LABELS).map(([band, label]) => ({
    label,
    color: RESOURCE_ACCESS_COLORS[band]
  }));
}

export function buildTransmissionLegendItems() {
  return Object.entries(TRANSMISSION_SOURCE_LABELS).map(([id, label]) => ({
    label,
    color: TRANSMISSION_SOURCE_COLORS[id]
  }));
}

export function buildSitesLegendItems(kinds) {
  return kinds.map((kind) => ({
    label: SITE_KIND_LABELS[kind],
    color: SITE_KIND_COLORS[kind]
  }));
}

/** Copy curated site fields into GeoJSON properties (all KPI keys). */
const SITE_PROP_KEYS = [
  'id',
  'name',
  'siteKind',
  'status',
  'note',
  'operator',
  'owner',
  'portType',
  'maxVessel',
  'draftNote',
  'seasonality',
  'roadAccess',
  'railAccess',
  'commodities',
  'icao',
  'airportClass',
  'runway',
  'runwayLength',
  'fuel',
  'customs',
  'yearRound',
  'generationType',
  'capacityMW',
  'inService',
  'interconnection',
  'region',
  'services',
  'coordSource'
];

export function curatedSitesFeatureCollection(kinds = null) {
  const allow = kinds ? new Set(kinds) : null;
  const features = CURATED_INFRA_SITES.filter((s) => !allow || allow.has(s.siteKind)).map((s) => {
    const raw = {};
    for (const key of SITE_PROP_KEYS) {
      if (s[key] != null && s[key] !== '') raw[key] = s[key];
    }
    const props = enrichSiteProperties(raw);
    return {
      type: 'Feature',
      properties: props,
      geometry: { type: 'Point', coordinates: s.coordinates }
    };
  });
  return { type: 'FeatureCollection', features };
}

/** MapLibre paint helpers */
export function roadsLineColorExpression() {
  return ['coalesce', ['get', 'lineColor'], ROAD_BAND_COLORS.arterial];
}

export function roadsLineWidthExpression() {
  return [
    'match',
    ['get', 'roadBand'],
    'highway',
    ROAD_BAND_WIDTHS.highway,
    ROAD_BAND_WIDTHS.arterial
  ];
}
