/**
 * Build a downloadable ZIP export of the current map recipe (vector + raster).
 * Uses in-repo zipStore (no npm dependency). Shapefile via optional shp-write.
 */

import { buildStoreZip } from './zipStore.js';

const CRS_LABEL = 'EPSG:4326';
const CRS_NOTE = 'OGC CRS84 lon-lat WGS84';

function normalizeBounds(bounds) {
  if (!bounds) return null;
  if (typeof bounds.getWest === 'function') {
    return {
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth()
    };
  }
  if (bounds._sw && bounds._ne) {
    const sw = bounds._sw;
    const ne = bounds._ne;
    return {
      west: sw.lng ?? sw[0],
      south: sw.lat ?? sw[1],
      east: ne.lng ?? ne[0],
      north: ne.lat ?? ne[1]
    };
  }
  if (
    Number.isFinite(bounds.west) &&
    Number.isFinite(bounds.south) &&
    Number.isFinite(bounds.east) &&
    Number.isFinite(bounds.north)
  ) {
    return {
      west: bounds.west,
      south: bounds.south,
      east: bounds.east,
      north: bounds.north
    };
  }
  return null;
}

function toExportFeature(feature) {
  return {
    type: 'Feature',
    geometry: feature.geometry,
    properties: { ...(feature.properties || {}) }
  };
}

function toFeatureCollection(features) {
  return {
    type: 'FeatureCollection',
    features: (features || []).map(toExportFeature)
  };
}

function isPointGeometry(geometry) {
  if (!geometry) return false;
  return geometry.type === 'Point' || geometry.type === 'MultiPoint';
}

function pointCoords(geometry) {
  if (!geometry) return null;
  if (geometry.type === 'Point' && Array.isArray(geometry.coordinates)) {
    return [geometry.coordinates[0], geometry.coordinates[1]];
  }
  if (geometry.type === 'MultiPoint' && Array.isArray(geometry.coordinates?.[0])) {
    return [geometry.coordinates[0][0], geometry.coordinates[0][1]];
  }
  return null;
}

function csvEscape(value) {
  if (value == null) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function xmlEscape(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function featuresToCsv(features) {
  const points = (features || []).filter((f) => isPointGeometry(f.geometry));
  if (!points.length) return '';

  const propKeys = new Set();
  for (const f of points) {
    Object.keys(f.properties || {}).forEach((k) => propKeys.add(k));
  }
  const keys = ['longitude', 'latitude', ...Array.from(propKeys).sort()];
  const lines = [keys.join(',')];

  for (const f of points) {
    const coords = pointCoords(f.geometry);
    const row = keys.map((k) => {
      if (k === 'longitude') return coords ? String(coords[0]) : '';
      if (k === 'latitude') return coords ? String(coords[1]) : '';
      return csvEscape(f.properties?.[k]);
    });
    lines.push(row.join(','));
  }
  return lines.join('\r\n');
}

function geometryToKmlCoordinates(geometry) {
  if (!geometry) return '';
  const { type, coordinates } = geometry;
  if (type === 'Point') return `${coordinates[0]},${coordinates[1]},0`;
  if (type === 'MultiPoint') {
    return coordinates.map((c) => `${c[0]},${c[1]},0`).join(' ');
  }
  if (type === 'LineString') {
    return coordinates.map((c) => `${c[0]},${c[1]},0`).join(' ');
  }
  if (type === 'MultiLineString') {
    return coordinates.map((line) => line.map((c) => `${c[0]},${c[1]},0`).join(' ')).join(' ');
  }
  if (type === 'Polygon') {
    return coordinates.map((ring) => ring.map((c) => `${c[0]},${c[1]},0`).join(' ')).join(' ');
  }
  if (type === 'MultiPolygon') {
    return coordinates
      .flatMap((poly) => poly.map((ring) => ring.map((c) => `${c[0]},${c[1]},0`).join(' ')))
      .join(' ');
  }
  return '';
}

function featureToKmlPlacemark(feature) {
  const coords = geometryToKmlCoordinates(feature.geometry);
  if (!coords) return '';
  const name =
    feature.properties?.DEPNAME ||
    feature.properties?.PropertyNameEN ||
    feature.properties?.name ||
    feature.properties?.NAME ||
    feature.properties?.LICENSE_NBR ||
    '';
  const desc = Object.entries(feature.properties || {})
    .slice(0, 12)
    .map(([k, v]) => `${xmlEscape(k)}: ${xmlEscape(v)}`)
    .join('<br/>');
  const t = feature.geometry?.type;
  const geomTag =
    t === 'Point' || t === 'MultiPoint'
      ? `<Point><coordinates>${coords}</coordinates></Point>`
      : t === 'LineString' || t === 'MultiLineString'
        ? `<LineString><coordinates>${coords}</coordinates></LineString>`
        : `<Polygon><outerBoundaryIs><LinearRing><coordinates>${coords}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;

  return `<Placemark>
  ${name ? `<name>${xmlEscape(name)}</name>` : ''}
  ${desc ? `<description><![CDATA[${desc}]]></description>` : ''}
  ${geomTag}
</Placemark>`;
}

export function featuresToKml(features, name = 'Layer') {
  const placemarks = (features || []).map(featureToKmlPlacemark).filter(Boolean).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${xmlEscape(name)}</name>
    ${placemarks}
  </Document>
</kml>`;
}

function buildWorldFile(west, south, east, north, width, height) {
  if (!width || !height) return '';
  const pixelWidth = (east - west) / width;
  const pixelHeight = -((north - south) / height);
  const upperLeftX = west + pixelWidth / 2;
  const upperLeftY = north + pixelHeight / 2;
  return [
    pixelWidth.toPrecision(12),
    '0',
    '0',
    pixelHeight.toPrecision(12),
    upperLeftX.toPrecision(12),
    upperLeftY.toPrecision(12),
    ''
  ].join('\n');
}

function readImageDimensions(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read raster dimensions'));
    };
    img.src = url;
  });
}

function exportFilename(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `labrador-explorer-export-${y}-${m}-${d}.zip`;
}

/**
 * @param {object} opts
 * @returns {Promise<{ filename: string, blob: Blob, summary: string }>}
 */
export async function buildExportPackage(opts) {
  const {
    bounds,
    vectorLayers = [],
    rasterLayers = [],
    formats = {},
    meta = {}
  } = opts;

  const fmt = {
    geojson: formats.geojson !== false,
    csv: formats.csv !== false,
    kml: formats.kml !== false,
    shapefile: formats.shapefile === true,
    rasters: formats.rasters !== false
  };

  /** @type {Record<string, string | Uint8Array | ArrayBuffer>} */
  const files = {};
  const notes = [];
  const manifestLayers = [];
  const box = normalizeBounds(bounds);
  const generatedAt = new Date().toISOString();

  if (fmt.geojson) {
    for (const layer of vectorLayers) {
      const fc = toFeatureCollection(layer.features);
      if (!fc.features.length) continue;
      files[`geojson/${layer.id}.geojson`] = JSON.stringify(fc, null, 2);
      manifestLayers.push({
        id: layer.id,
        label: layer.label,
        type: 'vector',
        source: layer.source || null,
        featureCount: fc.features.length,
        files: [`geojson/${layer.id}.geojson`]
      });
    }
  }

  if (fmt.csv) {
    for (const layer of vectorLayers) {
      const csv = featuresToCsv(layer.features);
      if (!csv) continue;
      files[`csv/${layer.id}.csv`] = csv;
      const entry = manifestLayers.find((l) => l.id === layer.id);
      if (entry) entry.files.push(`csv/${layer.id}.csv`);
      else {
        manifestLayers.push({
          id: layer.id,
          label: layer.label,
          type: 'vector',
          featureCount: layer.features?.length || 0,
          files: [`csv/${layer.id}.csv`]
        });
      }
    }
  }

  if (fmt.kml && vectorLayers.some((l) => l.features?.length)) {
    const folders = vectorLayers
      .filter((l) => l.features?.length)
      .map(
        (layer) => `<Folder><name>${xmlEscape(layer.label || layer.id)}</name>
${(layer.features || []).map(featureToKmlPlacemark).join('\n')}
</Folder>`
      )
      .join('\n');
    files['kml/view.kml'] = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Labrador Explorer Export</name>
    ${folders}
  </Document>
</kml>`;
  }

  if (fmt.shapefile) {
    notes.push(
      'Shapefile not generated in-browser. Open geojson/*.geojson in QGIS (Layer → Export → Save Features As → ESRI Shapefile) or use ogr2ogr.'
    );
  }

  if (fmt.rasters) {
    for (const layer of rasterLayers) {
      const [west, south, east, north] = layer.bounds || [];
      if (!layer.imageUrl) {
        notes.push(`Raster skipped for ${layer.id}: missing imageUrl.`);
        continue;
      }
      try {
        const resp = await fetch(layer.imageUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const base = `rasters/${layer.id}`;
        files[`${base}.png`] = arrayBuffer;
        files[`${base}.bounds.json`] = JSON.stringify(
          {
            id: layer.id,
            label: layer.label,
            crs: CRS_LABEL,
            note: 'Display bake PNG — not a survey-grade GeoTIFF',
            bounds: { west, south, east, north }
          },
          null,
          2
        );
        try {
          const { width, height } = await readImageDimensions(blob);
          const pgw = buildWorldFile(west, south, east, north, width, height);
          if (pgw) files[`${base}.pgw`] = pgw;
        } catch {
          notes.push(`World file skipped for ${layer.id}.`);
        }
        manifestLayers.push({
          id: layer.id,
          label: layer.label,
          type: 'raster',
          files: [
            `${base}.png`,
            `${base}.bounds.json`,
            ...(files[`${base}.pgw`] ? [`${base}.pgw`] : [])
          ]
        });
      } catch (err) {
        notes.push(`Raster failed for ${layer.id}: ${err?.message || err}`);
      }
    }
  }

  const manifest = {
    generated: generatedAt,
    crs: CRS_LABEL,
    crsNote: CRS_NOTE,
    bounds: box,
    formats: fmt,
    layers: manifestLayers,
    meta,
    notes
  };
  files['manifest.json'] = JSON.stringify(manifest, null, 2);

  const readmeLines = [
    'Labrador Critical Minerals Explorer — map export',
    `Generated: ${generatedAt}`,
    `Coordinate reference: ${CRS_LABEL} (${CRS_NOTE})`,
    '',
    box
      ? `Extent (WGS84): west ${box.west}, south ${box.south}, east ${box.east}, north ${box.north}`
      : 'Extent: not specified',
    '',
    'Contents:',
    ...(manifestLayers.length
      ? manifestLayers.map(
          (l) =>
            `- ${l.label || l.id} (${l.type}${l.featureCount != null ? `, ${l.featureCount} features` : ''})`
        )
      : ['- (no layers exported)']),
    '',
    ...(meta.filters ? [`Filters: ${JSON.stringify(meta.filters)}`] : []),
    ...(notes.length ? ['Notes:', ...notes.map((n) => `- ${n}`), ''] : []),
    'Public data only — verify against source agencies before decisions.'
  ];
  files['README.txt'] = readmeLines.join('\r\n');

  if (!manifestLayers.length && !files['kml/view.kml']) {
    throw new Error('Nothing to export in the current view / filters.');
  }

  const blob = buildStoreZip(files);
  const filename = exportFilename(new Date(generatedAt));
  const summary = `${manifestLayers.length} layer(s)`;
  return { filename, blob, summary, notes };
}

export function downloadBlob(blob, filename) {
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
