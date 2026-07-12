/**
 * Download a GeoJSON FeatureCollection as a browser file.
 * @param {GeoJSON.FeatureCollection} collection
 * @param {string} filename
 */
export function downloadGeoJSON(collection, filename = 'export.geojson') {
  const json = JSON.stringify(collection, null, 2);
  const blob = new Blob([json], { type: 'application/geo+json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Build export FC from loaded layer features, optional property predicate.
 * @param {object[]} features
 * @param {(f: object) => boolean} [predicate]
 */
export function featureCollectionFrom(features = [], predicate = null) {
  const list = predicate ? features.filter(predicate) : features;
  return {
    type: 'FeatureCollection',
    features: list.map((f) => ({
      type: 'Feature',
      geometry: f.geometry,
      properties: { ...(f.properties || {}) }
    }))
  };
}
