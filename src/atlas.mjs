import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { PNG } from 'pngjs';
import { imageSize } from 'image-size';

export const CELL = Object.freeze({ width: 192, height: 208, columns: 8 });
export const STATES = Object.freeze([
  { name: 'idle', row: 0, frames: 6 },
  { name: 'running-right', row: 1, frames: 8 },
  { name: 'running-left', row: 2, frames: 8 },
  { name: 'waving', row: 3, frames: 4 },
  { name: 'jumping', row: 4, frames: 5 },
  { name: 'failed', row: 5, frames: 8 },
  { name: 'waiting', row: 6, frames: 6 },
  { name: 'running', row: 7, frames: 6 },
  { name: 'review', row: 8, frames: 6 },
]);
export const MAX_BYTES = 20 * 1024 * 1024;

let webpDecoder;

/** The WebP decoder is portable WASM, loaded from the installed package only on demand. */
async function decodeWebp(bytes) {
  webpDecoder ??= (async () => {
    const codec = await import('@jsquash/webp/decode.js');
    const wasmBinary = await readFile(new URL(import.meta.resolve('@jsquash/webp/codec/dec/webp_dec.wasm')));
    await codec.init({ wasmBinary });
    return codec.default;
  })();
  return (await webpDecoder)(bytes);
}

/** Normalize an already validated local atlas for the Windows image decoder. */
export async function desktopPng(input) {
  const bytes = Buffer.from(input);
  if (bytes[0] === 0x89) return bytes;
  const report = await validateAtlas(bytes);
  if (!report.ok) throw new Error(report.errors.join('\n'));
  const image = await decodeWebp(bytes);
  return PNG.sync.write({ width: image.width, height: image.height, data: Buffer.from(image.data) });
}

/** Inspect chunks without inflating pixels, including dimensions the decoder will actually use. */
function pngFacts(bytes, dimensions) {
  let offset = 8, headers = 0, ended = false, animated = false, hasAlpha = false;
  const compressed = [];
  while (offset + 12 <= bytes.length) {
    const size = bytes.readUInt32BE(offset);
    const kind = bytes.toString('ascii', offset + 4, offset + 8);
    const end = offset + 12 + size;
    if (end > bytes.length) throw new Error('truncated PNG chunk');
    if (kind === 'IHDR') {
      if (++headers !== 1 || offset !== 8 || size !== 13) throw new Error('invalid PNG header');
      if (bytes.readUInt32BE(offset + 8) !== dimensions.width || bytes.readUInt32BE(offset + 12) !== dimensions.height) throw new Error('PNG dimensions disagree');
      hasAlpha = Boolean(bytes[offset + 17] & 4);
    }
    if (!headers) throw new Error('missing PNG header');
    if (kind === 'acTL' || kind === 'fcTL' || kind === 'fdAT') animated = true;
    if (kind === 'tRNS') hasAlpha = true;
    if (kind === 'IDAT') compressed.push(bytes.subarray(offset + 8, offset + 8 + size));
    offset = end;
    if (kind === 'IEND') { ended = true; break; }
  }
  if (!ended || !compressed.length) throw new Error('incomplete PNG');
  return { hasAlpha, animated, compressed };
}

function validDimensions(width, height) {
  return width === 1536 && [1872, 2288].includes(height);
}

/** Reject animated WebP and oversized embedded bitstreams before entering the WASM decoder. */
function webpFacts(bytes, dimensions) {
  if (bytes.length < 20 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') throw new Error('invalid WebP');
  const containerEnd = bytes.readUInt32LE(4) + 8;
  if (containerEnd > bytes.length || containerEnd < 20) throw new Error('truncated WebP');
  let offset = 12, images = 0, extended = 0, animated = false, hasAlpha = false;
  while (offset + 8 <= containerEnd) {
    const kind = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const start = offset + 8, end = start + size;
    if (end > containerEnd) throw new Error('truncated WebP chunk');
    if (kind === 'ANIM' || kind === 'ANMF') animated = true;
    if (kind === 'ALPH') hasAlpha = true;
    if (kind === 'VP8X') {
      if (++extended !== 1 || size !== 10) throw new Error('invalid WebP extended header');
      animated ||= Boolean(bytes[start] & 2);
      hasAlpha ||= Boolean(bytes[start] & 16);
      const width = bytes.readUIntLE(start + 4, 3) + 1, height = bytes.readUIntLE(start + 7, 3) + 1;
      if (width !== dimensions.width || height !== dimensions.height) throw new Error('WebP canvas dimensions disagree');
    }
    if (kind === 'VP8 ' || kind === 'VP8L') {
      if (++images !== 1) throw new Error('multiple WebP image payloads');
      let width, height;
      if (kind === 'VP8L') {
        if (size < 5 || bytes[start] !== 0x2f) throw new Error('invalid lossless WebP header');
        const bits = bytes.readUInt32LE(start + 1);
        width = (bits & 0x3fff) + 1;
        height = ((bits >>> 14) & 0x3fff) + 1;
        hasAlpha ||= Boolean((bits >>> 28) & 1);
        if (bits >>> 29) throw new Error('unsupported lossless WebP version');
      } else {
        if (size < 10 || bytes.toString('hex', start + 3, start + 6) !== '9d012a') throw new Error('invalid lossy WebP header');
        width = bytes.readUInt16LE(start + 6) & 0x3fff;
        height = bytes.readUInt16LE(start + 8) & 0x3fff;
      }
      if (!validDimensions(width, height) || width !== dimensions.width || height !== dimensions.height) throw new Error('WebP payload dimensions disagree');
    }
    offset = end + (size & 1);
  }
  if (!animated && images !== 1) throw new Error('missing WebP image payload');
  if (offset !== containerEnd) throw new Error('invalid WebP chunk alignment');
  return { hasAlpha, animated };
}

export async function validateAtlas(input, expectedVersion) {
  const errors = [];
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (!bytes.length || bytes.length > MAX_BYTES) return { ok: false, errors: ['图集为空或超过 20 MiB。'] };
  let decoded;
  try {
    // image-size only reads headers. All pixel allocation/decompression follows this limit.
    const metadata = imageSize(bytes);
    if (!['png', 'webp'].includes(metadata.type)) return { ok: false, errors: ['仅支持 PNG 或 WebP 图集。'] };
    if (!validDimensions(metadata.width, metadata.height)) return { ok: false, errors: ['图集必须为 1536×1872 (v1) 或 1536×2288 (v2)。'] };
    const facts = metadata.type === 'png' ? pngFacts(bytes, metadata) : webpFacts(bytes, metadata);
    if (facts.animated) errors.push('请使用静态图集，不能使用动态图片。');
    if (!facts.hasAlpha) errors.push('图集需要透明通道。');
    if (errors.length) return { ok: false, errors };
    if (metadata.type === 'png') {
      // pngjs bounds ordinary PNG inflation internally; also bound its interlaced path.
      // Eight bytes per pixel covers the largest supported 16-bit RGBA input.
      inflateSync(Buffer.concat(facts.compressed), { maxOutputLength: metadata.width * metadata.height * 8 + metadata.height * 8 + 1024 });
      const png = PNG.sync.read(bytes, { checkCRC: true });
      decoded = { data: png.data, info: { width: png.width, height: png.height } };
    } else {
      const webp = await decodeWebp(bytes);
      decoded = { data: webp.data, info: { width: webp.width, height: webp.height } };
    }
    if (decoded.info.width !== metadata.width || decoded.info.height !== metadata.height || decoded.data.length !== metadata.width * metadata.height * 4) throw new Error('decoded dimensions disagree');
  } catch {
    return { ok: false, errors: ['无法解码图片，文件可能损坏或尺寸过大。'] };
  }
  const { data, info } = decoded;
  const version = info.height === 2288 ? 2 : 1;
  if (expectedVersion && expectedVersion !== version) errors.push('声明版本与图集尺寸不一致。');
  const cells = [];
  const frameCounts = [...STATES.map(s => s.frames), ...(version === 2 ? [8, 8] : [])];
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] === 0) transparent++;
  if (!transparent) errors.push('背景不透明。请先去除背景。');
  for (let row = 0; row < frameCounts.length; row++) {
    for (let col = 0; col < 8; col++) {
      let visible = 0, minX = 192, minY = 208, maxX = -1, maxY = -1;
      for (let y = 0; y < 208; y++) for (let x = 0; x < 192; x++) {
        const alpha = data[((row * 208 + y) * 1536 + col * 192 + x) * 4 + 3];
        if (alpha > 8) { visible++; minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
      }
      const required = col < frameCounts[row];
      if (required && visible < 64) errors.push(`第 ${row + 1} 行第 ${col + 1} 帧缺失。`);
      if (!required && visible > 0) errors.push(`第 ${row + 1} 行第 ${col + 1} 格应透明留空。`);
      cells.push({ row, col, required, visible, bounds: visible ? { minX, minY, maxX, maxY } : null });
    }
  }
  return { ok: errors.length === 0, spriteVersion: version, width: 1536, height: info.height, sha256: createHash('sha256').update(bytes).digest('hex'), errors, cells, note: '结构校验不证明动作语义、视线方向或画面连续性；请逐项预览。' };
}

export function gazeFrame(dx, dy) {
  const angle = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
  const direction = Math.round(angle / 22.5) % 16;
  return { direction, row: 9 + Math.floor(direction / 8), column: direction % 8 };
}
