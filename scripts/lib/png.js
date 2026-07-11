/**
 * Minimal PNG decode/encode (8-bit RGB / RGBA, no interlacing) using Node zlib.
 * Enough for NRCan WMS GetMap bakes — avoids a native/registry dependency.
 */

import { deflateSync, inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function readChunks(buffer) {
  if (!buffer.subarray(0, 8).equals(PNG_SIG)) {
    throw new Error('Not a PNG');
  }
  const chunks = [];
  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    chunks.push({ type, data });
    offset += 12 + length;
  }
  return chunks;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function unfilter(width, height, bpp, inflated) {
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  let inOffset = 0;
  for (let row = 0; row < height; row++) {
    const filter = inflated[inOffset++];
    const rowStart = row * stride;
    const prevStart = (row - 1) * stride;
    for (let i = 0; i < stride; i++) {
      const x = inflated[inOffset++];
      const a = i >= bpp ? out[rowStart + i - bpp] : 0;
      const b = row > 0 ? out[prevStart + i] : 0;
      const c = row > 0 && i >= bpp ? out[prevStart + i - bpp] : 0;
      let val;
      switch (filter) {
        case 0:
          val = x;
          break;
        case 1:
          val = (x + a) & 255;
          break;
        case 2:
          val = (x + b) & 255;
          break;
        case 3:
          val = (x + ((a + b) >> 1)) & 255;
          break;
        case 4:
          val = (x + paeth(a, b, c)) & 255;
          break;
        default:
          throw new Error(`Unsupported PNG filter ${filter}`);
      }
      out[rowStart + i] = val;
    }
  }
  return out;
}

/**
 * @returns {{ width: number, height: number, channels: 3|4, data: Buffer }}
 *   data is tightly packed RGB or RGBA (no filter bytes).
 */
export function decodePng(buffer) {
  const chunks = readChunks(buffer);
  const ihdr = chunks.find((c) => c.type === 'IHDR');
  if (!ihdr) throw new Error('PNG missing IHDR');
  const width = ihdr.data.readUInt32BE(0);
  const height = ihdr.data.readUInt32BE(4);
  const bitDepth = ihdr.data[8];
  const colorType = ihdr.data[9];
  const interlace = ihdr.data[12];
  if (bitDepth !== 8) throw new Error(`Unsupported PNG bit depth ${bitDepth}`);
  if (interlace !== 0) throw new Error('Interlaced PNG not supported');
  if (colorType !== 2 && colorType !== 6) {
    throw new Error(`Unsupported PNG color type ${colorType}`);
  }
  const channels = colorType === 6 ? 4 : 3;
  const idat = Buffer.concat(chunks.filter((c) => c.type === 'IDAT').map((c) => c.data));
  const inflated = inflateSync(idat);
  const data = unfilter(width, height, channels, inflated);
  return { width, height, channels, data };
}

function filterNone(width, height, channels, data) {
  const stride = width * channels;
  const out = Buffer.alloc(height * (1 + stride));
  for (let row = 0; row < height; row++) {
    const dest = row * (1 + stride);
    out[dest] = 0;
    data.copy(out, dest + 1, row * stride, row * stride + stride);
  }
  return out;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

/** Encode 8-bit RGB or RGBA raw pixels to a PNG buffer. */
export function encodePng({ width, height, channels, data }) {
  if (channels !== 3 && channels !== 4) throw new Error('channels must be 3 or 4');
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = channels === 4 ? 6 : 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const filtered = filterNone(width, height, channels, data);
  const compressed = deflateSync(filtered, { level: 9 });
  return Buffer.concat([PNG_SIG, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
}

export function contentHash(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}
