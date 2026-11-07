import { warmSegmentation } from '../apps/recognition-server/segmentation.mjs';
console.log('Preparing object outlines. First run downloads public SlimSAM weights; later runs use .local/models.');
await warmSegmentation();
console.log('Outline model ready.');
