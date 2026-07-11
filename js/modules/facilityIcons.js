/**
 * Module: uncontained silhouette SVG icons for the Critical Mineral
 * Facilities layer, one per OperationGroupEN category. Deliberately NOT
 * badged in a circle - the mineral deposits layer already uses colored
 * circles, so a distinct tool/building silhouette (with a white halo for
 * legibility on any basemap) is what actually separates the two layers
 * at a glance, rather than color alone.
 *
 * Registered lazily via MapLibre's `styleimagemissing` event - this fires
 * whenever a symbol layer references an icon id that isn't loaded,
 * including right after a basemap switch (setStyle wipes previously-added
 * images), so a single registration at startup is enough for the lifetime
 * of the map.
 */

const ICON_PX = 40;
const HALO = 'stroke="#ffffff" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" paint-order="stroke fill"';

const FACILITY_ICON_SVGS = {
  // Mines and other primary producing sites - crossed pickaxes
  mine: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${ICON_PX}" height="${ICON_PX}">
      <g fill="#f59e0b" ${HALO}>
        <g transform="rotate(-45 12 12)">
          <rect x="11" y="4" width="2" height="16" rx="1"/>
          <path d="M7 4h10l-2 3h-6z"/>
        </g>
        <g transform="rotate(45 12 12)">
          <rect x="11" y="4" width="2" height="16" rx="1"/>
          <path d="M7 4h10l-2 3h-6z"/>
        </g>
      </g>
    </svg>`,
  // Processing - industrial facility (sawtooth-roof building + smokestacks)
  processing: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${ICON_PX}" height="${ICON_PX}">
      <g fill="#ef4444" ${HALO}>
        <rect x="4" y="4" width="2" height="7"/>
        <rect x="9.5" y="2" width="2" height="9"/>
        <path d="M3 20V11l4 3v-3l4 3v-3l4 3v-3l4 3v6z"/>
      </g>
    </svg>`,
  // Advanced processing project - flask (pilot / lab-scale metallurgical work)
  advancedProcessing: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${ICON_PX}" height="${ICON_PX}">
      <g fill="#a855f7" ${HALO}>
        <rect x="9.2" y="2" width="5.6" height="2" rx="0.6"/>
        <path d="M10 3.5h4v4.3l4.3 8.6a1.8 1.8 0 0 1-1.6 2.6H7.3a1.8 1.8 0 0 1-1.6-2.6l4.3-8.6z"/>
      </g>
    </svg>`,
  // Advanced exploration project - geologist's rock hammer
  advancedExploration: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${ICON_PX}" height="${ICON_PX}">
      <g fill="#38bdf8" ${HALO} transform="rotate(-30 12 12)">
        <rect x="10.8" y="9.5" width="2.4" height="12" rx="1"/>
        <path d="M6 5.5h9v4H6a2 2 0 0 1 0-4z"/>
        <path d="M15 5.5h2.3l3.2 2-3.2 2H15z"/>
      </g>
    </svg>`,
  // Fallback for any unmapped OperationGroupEN value
  default: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${ICON_PX}" height="${ICON_PX}">
      <path d="M12 3 L20.5 19.5 H3.5 Z" fill="#94a3b8" ${HALO}/>
    </svg>`
};

export function facilityIconDataUri(key) {
  const svg = FACILITY_ICON_SVGS[key] || FACILITY_ICON_SVGS.default;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function registerFacilityIconLoader(map) {
  map.on('styleimagemissing', (e) => {
    if (!FACILITY_ICON_SVGS[e.id] || map.hasImage(e.id)) return;

    const img = new Image(ICON_PX, ICON_PX);
    img.onload = () => {
      if (!map.hasImage(e.id)) map.addImage(e.id, img);
    };
    img.src = facilityIconDataUri(e.id);
  });
}
