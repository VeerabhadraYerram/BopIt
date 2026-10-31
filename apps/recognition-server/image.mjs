import { inflateSync } from 'node:zlib';
const table = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
export function validateImage(data) {
  if (typeof data !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(data)) throw new Error('Use a PNG capture from the extension.');
  const base64 = data.slice('data:image/png;base64,'.length), bytes = Buffer.from(base64, 'base64');
  const invalid = () => { throw new Error('Invalid or oversized PNG. Capture the image again.'); };
  if (bytes.length > 8 * 1024 * 1024 || bytes.length < 45 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || bytes.toString('ascii', 12, 16) !== 'IHDR') invalid();
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  if (width < 16 || height < 16 || width > 8192 || height > 8192 || width * height > 16_000_000) throw new Error('Image must be at least 16 pixels per side and at most 16 megapixels.');
  if (bytes[24] !== 8 || ![2, 6].includes(bytes[25]) || bytes[26] || bytes[27] || bytes[28]) throw new Error('Use a non-interlaced RGB/RGBA PNG exported by the inspector.');
  const channels = bytes[25] === 6 ? 4 : 3, compressed = [];
  let offset = 8, ended = false, chunks = 0;
  while (offset + 12 <= bytes.length) {
    if (++chunks > 10000) invalid();
    const length = bytes.readUInt32BE(offset), end = offset + length + 12;
    if (end > bytes.length) invalid();
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    if (crc32(bytes.subarray(offset + 4, end - 4)) !== bytes.readUInt32BE(end - 4)) invalid();
    if (type === 'IHDR' && (offset !== 8 || length !== 13)) invalid();
    if (type === 'IDAT') compressed.push(bytes.subarray(offset + 8, end - 4));
    if (type === 'IEND') { if (length !== 0 || end !== bytes.length) invalid(); ended = true; break; }
    offset = end;
  }
  if (!ended || !compressed.length) invalid();
  const stride = width * channels + 1, expected = stride * height;
  let decoded;
  try { decoded = inflateSync(Buffer.concat(compressed), { maxOutputLength: expected }); } catch { invalid(); }
  if (decoded.length !== expected) invalid();
  for (let row = 0; row < height; row++) if (decoded[row * stride] > 4) invalid();
  return { base64, width, height };
}
