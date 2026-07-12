/**
 * MapLibre SVG icons for infrastructure site layers (ports, airports, generation).
 * Same lazy styleimagemissing registration pattern as facilityIcons.js.
 */

const ICON_PX = 40;
const HALO =
  'stroke="#ffffff" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" paint-order="stroke fill"';

const INFRA_ICON_SVGS = {
  // Anchor — port / marine terminal
  port: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${ICON_PX}" height="${ICON_PX}">
      <g fill="#0369a1" ${HALO}>
        <circle cx="12" cy="5.5" r="2.2"/>
        <rect x="11.1" y="7.5" width="1.8" height="6.5" rx="0.6"/>
        <path d="M6 14.2c0 3.4 2.7 6.2 6 6.2s6-2.8 6-6.2h-2.2c0 2.2-1.7 4-3.8 4s-3.8-1.8-3.8-4z"/>
        <path d="M4.5 14.2h15v2.1H4.5z"/>
      </g>
    </svg>`,
  // Aircraft — airport / airstrip
  airport: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${ICON_PX}" height="${ICON_PX}">
      <g fill="#4f46e5" ${HALO}>
        <path d="M12 3.2l1.4 7.2 6.4 2.1-0.6 1.7-5.8-0.6v4.4l2.8 1.6-0.4 1.4L12 19.8l-3.8 1.2-0.4-1.4 2.8-1.6v-4.4l-5.8 0.6-0.6-1.7 6.4-2.1z"/>
      </g>
    </svg>`,
  // Power plant — building silhouette + lightning bolt (operating)
  hydro: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${ICON_PX}" height="${ICON_PX}">
      <path d="M3.2 20.8V11H7.7V6.8H10.9V11H20.8V20.8Z"
        fill="#b45309" stroke="#ffffff" stroke-width="1.7" stroke-linejoin="round" paint-order="stroke"/>
      <path d="M13.7 7.6l-4.9 6.7h3.3l-1.2 4.9 5.4-7.1h-3.4z"
        fill="#fde047" stroke="#7c2d12" stroke-width="0.9" stroke-linejoin="round" paint-order="stroke"/>
    </svg>`,
  // Proposed power plant — same shape, lighter fill (not yet operating)
  hydroPotential: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${ICON_PX}" height="${ICON_PX}">
      <path d="M3.2 20.8V11H7.7V6.8H10.9V11H20.8V20.8Z"
        fill="#fb923c" fill-opacity="0.65" stroke="#ffffff" stroke-width="1.7" stroke-linejoin="round" paint-order="stroke"/>
      <path d="M13.7 7.6l-4.9 6.7h3.3l-1.2 4.9 5.4-7.1h-3.4z"
        fill="#fed7aa" stroke="#9a3412" stroke-width="0.9" stroke-linejoin="round" paint-order="stroke"/>
    </svg>`
};

export function infraIconDataUri(key) {
  const svg = INFRA_ICON_SVGS[key] || INFRA_ICON_SVGS.port;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function registerInfraIconLoader(map) {
  map.on('styleimagemissing', (e) => {
    if (!INFRA_ICON_SVGS[e.id] || map.hasImage(e.id)) return;
    const img = new Image(ICON_PX, ICON_PX);
    img.onload = () => {
      if (!map.hasImage(e.id)) map.addImage(e.id, img);
    };
    img.src = infraIconDataUri(e.id);
  });
}
