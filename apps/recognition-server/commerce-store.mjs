import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {createHmac,timingSafeEqual} from 'node:crypto';
export function createCommerceStore(path){
  let data={watches:[],events:[],deliveries:[]},queue=Promise.resolve();
  const ready=(async()=>{if(path)try{const saved=JSON.parse(await readFile(path,'utf8'));for(const key of Object.keys(data))if(Array.isArray(saved[key]))data[key]=saved[key];}catch(error){if(error.code!=='ENOENT')throw new Error('Saved commerce data could not be loaded.');}})();
  return {
    read:async()=>{await ready;await queue;return structuredClone(data);},
    update:fn=>{const work=queue.then(async()=>{await ready;const next=structuredClone(data),result=await fn(next);next.events=next.events.slice(-3000);next.deliveries=next.deliveries.slice(-1000);if(path){await mkdir(dirname(path),{recursive:true,mode:0o700});await writeFile(path+'.tmp',JSON.stringify(next),{mode:0o600});await rename(path+'.tmp',path);}data=next;return result;});queue=work.catch(()=>{});return work;}
  };
}
export function verifyWebhook(raw,headers,secret,now=Date.now()){
  const id=headers['webhook-id']||headers['svix-id'],timestamp=headers['webhook-timestamp']||headers['svix-timestamp'],signature=headers['webhook-signature']||headers['svix-signature'];
  if(!secret||typeof id!=='string'||typeof timestamp!=='string'||typeof signature!=='string'||!/^[0-9]+$/.test(timestamp)||Math.abs(now/1000-Number(timestamp))>300)throw new Error('Invalid webhook signature.');
  const key=Buffer.from(secret.startsWith('whsec_')?secret.slice(6):secret,'base64');
  const expected=createHmac('sha256',key).update(`${id}.${timestamp}.${raw}`).digest();
  const valid=signature.split(' ').some(part=>{const [version,value]=part.split(',');if(version!=='v1'||!value)return false;const supplied=Buffer.from(value,'base64');return supplied.length===expected.length&&timingSafeEqual(supplied,expected);});
  if(!valid)throw new Error('Invalid webhook signature.');return id;
}
