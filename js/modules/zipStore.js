/**
 * Minimal ZIP (STORE / no compression) for browser downloads without JSZip.
 */

function encodeUtf8(str) {
  return new TextEncoder().encode(str);
}

function crc32(data) {
  let c = ~0;
  for (let i = 0; i < data.length; i++) {
    c ^= data[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    }
  }
  return ~c >>> 0;
}

function uIntLE(value, bytes) {
  const out = new Uint8Array(bytes);
  let v = value >>> 0;
  for (let i = 0; i < bytes; i++) {
    out[i] = v & 0xff;
    v >>>= 8;
  }
  return out;
}

function concat(...parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/**
 * @param {Record<string, string | Uint8Array | ArrayBuffer>} files
 * @returns {Blob}
 */
export function buildStoreZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const entries = Object.entries(files).filter(([, v]) => v != null);

  for (const [rawName, content] of entries) {
    const name = encodeUtf8(rawName.replace(/^\/+/, ''));
    let data;
    if (typeof content === 'string') data = encodeUtf8(content);
    else if (content instanceof ArrayBuffer) data = new Uint8Array(content);
    else data = content;

    const crc = crc32(data);
    const size = data.length;
    const localHeader = concat(
      uIntLE(0x04034b50, 4),
      uIntLE(20, 2),
      uIntLE(0, 2),
      uIntLE(0, 2),
      uIntLE(0, 2),
      uIntLE(0, 2),
      uIntLE(crc, 4),
      uIntLE(size, 4),
      uIntLE(size, 4),
      uIntLE(name.length, 2),
      uIntLE(0, 2),
      name
    );
    localParts.push(localHeader, data);

    const central = concat(
      uIntLE(0x02014b50, 4),
      uIntLE(20, 2),
      uIntLE(20, 2),
      uIntLE(0, 2),
      uIntLE(0, 2),
      uIntLE(0, 2),
      uIntLE(0, 2),
      uIntLE(crc, 4),
      uIntLE(size, 4),
      uIntLE(size, 4),
      uIntLE(name.length, 2),
      uIntLE(0, 2),
      uIntLE(0, 2),
      uIntLE(0, 2),
      uIntLE(0, 2),
      uIntLE(0, 4),
      uIntLE(offset, 4),
      name
    );
    centralParts.push(central);
    offset += localHeader.length + data.length;
  }

  const centralDir = concat(...centralParts);
  const end = concat(
    uIntLE(0x06054b50, 4),
    uIntLE(0, 2),
    uIntLE(0, 2),
    uIntLE(entries.length, 2),
    uIntLE(entries.length, 2),
    uIntLE(centralDir.length, 4),
    uIntLE(offset, 4),
    uIntLE(0, 2)
  );

  return new Blob([concat(...localParts, centralDir, end)], { type: 'application/zip' });
}
