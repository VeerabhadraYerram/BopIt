import { resolve } from 'node:path';
import { maskContours } from '../../packages/contracts/mask-contours.mjs';
let runtime;
let queue = Promise.resolve();
async function load() {
  if (!runtime) runtime = (async()=>{
    const lib=await import('@huggingface/transformers');
    lib.env.cacheDir=resolve('.local/models');
    const options={revision:'points-and-boxes',dtype:'fp32',session_options:{intraOpNumThreads:2}};
    const [model,processor]=await Promise.all([lib.SamModel.from_pretrained('Xenova/slimsam-77-uniform',options),lib.AutoProcessor.from_pretrained('Xenova/slimsam-77-uniform',options)]);
    return {...lib,model,processor};
  })().catch(e=>{runtime=null;throw e;});
  return runtime;
}
export async function warmSegmentation() { await load(); }
export function validateRegions(regions) {
  if(!Array.isArray(regions)||!regions.length||regions.length>24)throw new Error('Invalid segmentation regions');
  return regions.map(({id,box})=>{
    if(typeof id!=='string'||id.length>160||!box||['x','y','width','height'].some(k=>!Number.isFinite(box[k]))||box.x<0||box.y<0||box.width<=0||box.height<=0||box.x+box.width>1.00001||box.y+box.height>1.00001)throw new Error('Invalid segmentation region');
    return {id,box};
  });
}
export function segmentObjects(base64,regions) {
  // CPU jobs run serially; reuse image embeddings across all regions in a frame.
  const job=queue.then(()=>run(base64,validateRegions(regions)));
  queue=job.catch(()=>{});return job;
}
async function run(base64,regions) {
  const {RawImage,Tensor,model,processor}=await load();
  const image=await RawImage.fromBlob(new Blob([Buffer.from(base64,'base64')],{type:'image/png'}));
  const base=await processor(image),embeddings=await model.get_image_embeddings(base);
  const results=[];
  try {
    for(const {id,box:b} of regions) {
      const inputs=await processor(image,{input_boxes:[[[b.x*image.width,b.y*image.height,(b.x+b.width)*image.width,(b.y+b.height)*image.height]]]});
      inputs.input_points=new Tensor('float32',new Float32Array(0),[1,1,0,2]);inputs.input_labels=new Tensor('int64',new BigInt64Array(0),[1,1,0]);
      const outputs=await model({...inputs,...embeddings});
      const scores=Array.from(outputs.iou_scores.data);let best=0;for(let i=1;i<scores.length;i++)if(scores[i]>scores[best])best=i;
      const masks=await processor.post_process_masks(outputs.pred_masks,inputs.original_sizes,inputs.reshaped_input_sizes);
      const tensor=masks[0],height=tensor.dims.at(-2),width=tensor.dims.at(-1),offset=best*width*height;
      const gridW=Math.max(4,Math.round(b.width*256)),gridH=Math.max(4,Math.round(b.height*256)),grid=new Uint8Array(gridW*gridH);
      for(let y=0;y<gridH;y++)for(let x=0;x<gridW;x++) {
        const px=Math.min(width-1,Math.floor((b.x+(x+.5)/gridW*b.width)*width)),py=Math.min(height-1,Math.floor((b.y+(y+.5)/gridH*b.height)*height));
        grid[y*gridW+x]=tensor.data[offset+py*width+px]?1:0;
      }
      const fill=grid.reduce((a,b)=>a+b,0)/grid.length;
      results.push({id,contours:fill>.005&&fill<.99?maskContours(grid,gridW,gridH):[],method:'SlimSAM box-prompted segmentation'});
      for(const value of Object.values(inputs))value?.dispose?.();for(const value of Object.values(outputs))value?.dispose?.();masks.forEach(m=>m.dispose?.());
    }
    return {regions:results,method:'Local SlimSAM · predicted masks, not guaranteed exact boundaries'};
  } finally {for(const value of Object.values(base))value?.dispose?.();for(const value of Object.values(embeddings))value?.dispose?.();}
}
