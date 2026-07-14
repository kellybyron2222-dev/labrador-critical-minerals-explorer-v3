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

/** Concatenate Uint8Arrays without call-stack spread limits. */
function concatList(list) {
  let total = 0;
  for (const p of list) total += p.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of list) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function asBytes(content) {
  if (typeof content === 'string') return encodeUtf8(content);
  if (content instanceof ArrayBuffer) return new Uint8Array(content);
  if (content instanceof Uint8Array) return content;
  if (ArrayBuffer.isView(content)) {
    return new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
  }
  throw new Error('Unsupported ZIP entry type');
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
    const name = encodeUtf8(String(rawName).replace(/^\/+/, ''));
    const data = asBytes(content);
    const crc = crc32(data);
    const size = data.length;
    const localHeader = concatList([
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
    ]);
    localParts.push(localHeader, data);

    const central = concatList([
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
    ]);
    centralParts.push(central);
    offset += localHeader.length + data.length;
  }

  const centralDir = concatList(centralParts);
  const end = concatList([
    uIntLE(0x06054b50, 4),
    uIntLE(0, 2),
    uIntLE(0, 2),
    uIntLE(entries.length, 2),
    uIntLE(entries.length, 2),
    uIntLE(centralDir.length, 4),
    uIntLE(offset, 4),
    uIntLE(0, 2)
  ]);

  const bytes = concatList([...localParts, centralDir, end]);
  return new Blob([bytes], { type: 'application/zip' });
}
