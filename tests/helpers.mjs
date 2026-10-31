import { deflateSync } from 'node:zlib';
import { crc32 } from '../apps/recognition-server/image.mjs';
export function makePng(width = 32, height = 32) {
  const chunk = (type, data) => {
    const payload = Buffer.concat([Buffer.from(type), data]), length = Buffer.alloc(4), crc = Buffer.alloc(4);
    length.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(payload)); return Buffer.concat([length, payload, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  const pixels = Buffer.alloc((width * 4 + 1) * height);
  const bytes = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
  return `data:image/png;base64,${bytes.toString('base64')}`;
}
export const rawResult = () => ({ sceneObservation: 'Camera on a table', possibleActivity: 'Possible filming setup', warnings: [], objects: [
  { label: 'Camera body', box_2d: [200, 100, 600, 500], visibleAttributes: ['black'], visibleText: '', uncertainty: 'Model unknown', relationship: 'Attached lens' },
  { label: 'Camera lens', box_2d: [300, 400, 550, 650], visibleAttributes: [], visibleText: '', uncertainty: 'Mount unknown', relationship: 'Attached to camera' }
] });
