import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {deflateSync,inflateSync} from 'node:zlib';
import {recoverDetection} from '../apps/recognition-server/detection-recovery.mjs';
import {compressDetectionPng} from '../apps/recognition-server/detection-png.mjs';
import {structuredGemini,detectWithGemini} from '../apps/recognition-server/gemini.mjs';
import {createApp} from '../apps/recognition-server/server.mjs';
import {crc32,validateImage} from '../apps/recognition-server/image.mjs';
import {makePng,rawResult} from './helpers.mjs';
const ok=()=>new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(rawResult())}]}}]}));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function inflatePng(bytes){const parts=[];for(let i=8;i<bytes.length;){const n=bytes.readUInt32BE(i);if(bytes.toString('ascii',i+4,i+8)==='IDAT')parts.push(bytes.subarray(i+8,i+8+n));i+=12+n;}return inflateSync(Buffer.concat(parts));}
test('busy primary switches to configured backup with identical pixels, prompt and complete output schema',async()=>{
 const calls=[];let timing;
 const result=await detectWithGemini('full-resolution-original',{apiKey:'fixture',model:'primary',fallbackModel:'backup',onTiming:value=>timing=value,fetcher:async(url,request)=>{calls.push({url,body:JSON.parse(request.body)});return url.includes('/primary:')?new Response('private upstream details',{status:503}):ok();}});
 assert.equal(calls.length,2);assert.deepEqual(calls[0].body,calls[1].body);assert.equal(calls[1].body.contents[0].parts[1].inlineData.data,'full-resolution-original');assert.equal(result.objects.length,2);assert.equal(timing.modelUsed,'backup');assert.equal(timing.totalGeminiAttempts,2);
});
test('slow-primary hedge accepts only validated output, aborts the loser and avoids an unnecessary backup for fast success',async()=>{
 let aborted=false,backupCalls=0;
 const result=await recoverDetection(signal=>new Promise((_,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(new DOMException('cancelled','AbortError'));})),async()=>{backupCalls++;return 'validated-result';},{hedgeAfterMs:5,timeoutMs:100});
 assert.equal(result,'validated-result');assert.equal(aborted,true);assert.equal(backupCalls,1);
 await recoverDetection(async()=> 'fast',async()=>{backupCalls++;return 'backup';},{hedgeAfterMs:20,timeoutMs:100});await wait(25);assert.equal(backupCalls,1);
 let calls=0;const valid=await detectWithGemini('same-image',{apiKey:'fixture',model:'primary',fallbackModel:'backup',hedgeAfterMs:1,fetcher:async url=>{calls++;if(url.includes('/primary:')){await wait(10);return ok();}return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:'{}'}]}}]}));}});assert.equal(valid.objects.length,2);assert.equal(calls,2);
});
test('backup does not hide authentication or quota failures, and total recovery has a deadline',async()=>{
 for(const status of [401,403,429]){let calls=0;await assert.rejects(detectWithGemini('frame',{apiKey:'fixture',model:'primary',fallbackModel:'backup',fetcher:async()=>{calls++;return new Response('private',{status});}}),error=>error.status===status&&!error.message.includes('private'));assert.equal(calls,1);}
 await assert.rejects(recoverDetection(()=>new Promise(()=>{}),()=>new Promise(()=>{}),{hedgeAfterMs:1,timeoutMs:15}),error=>error.name==='TimeoutError');
});
test('PNG optimization preserves dimensions and every decoded pixel without changing small captures',async()=>{
 const width=512,height=512,raw=Buffer.alloc((width*4+1)*height);for(let row=0;row<height;row++){const offset=row*(width*4+1);for(let x=0;x<width;x++){raw[offset+1+x*4]=x%256;raw[offset+4+x*4]=255;}}
 const chunk=(type,payload)=>{const out=Buffer.alloc(payload.length+12);out.writeUInt32BE(payload.length);out.write(type,4);payload.copy(out,8);out.writeUInt32BE(crc32(out.subarray(4,-4)),out.length-4);return out;};
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6;
 const original=Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw,{level:0})),chunk('IEND',Buffer.alloc(0))]);const result=await compressDetectionPng(original.toString('base64'));const parsed=validateImage('data:image/png;base64,'+result.base64);assert.equal(parsed.width,width);assert.equal(parsed.height,height);assert.equal(result.optimized,true);assert.ok(result.outputBytes<result.inputBytes);assert.deepEqual(inflatePng(Buffer.from(result.base64,'base64')),raw);
 const small=makePng().split(',')[1];assert.equal((await compressDetectionPng(small)).base64,small);
});
test('identical concurrent scans share one request and successful cached scans retain the new capture identity',async()=>{
 let calls=0,release;const barrier=new Promise(r=>release=r);const app=createApp({token:'cache-token',apiKey:'fixture',detect:async()=>{calls++;await barrier;return rawNormalized;}});const {validateDetections}=await import('../packages/contracts/recognition.mjs');const rawNormalized=validateDetections(rawResult());await new Promise(r=>app.listen(0,'127.0.0.1',r));
 const request=(id,token='cache-token')=>new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:app.address().port,path:'/api/detect',method:'POST',headers:{host:'127.0.0.1:4317',origin:'chrome-extension://'+'a'.repeat(32),'content-type':'application/json','x-bopit-token':token}},res=>{let text='';res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(text)}));});req.on('error',reject);req.end(JSON.stringify({captureId:id,image:makePng()}));});
 try{const first=request('capture-one');while(!calls)await wait(1);const second=request('capture-two');await wait(15);release();const both=await Promise.all([first,second]);assert.deepEqual(both.map(r=>r.status),[200,200]);assert.equal(calls,1);assert.equal(both[1].body.captureId,'capture-two');assert.equal(both[1].body.timings.sharedRequest,true);const cached=await request('capture-three');assert.equal(cached.body.captureId,'capture-three');assert.equal(cached.body.timings.cacheHit,true);assert.equal(calls,1);assert.equal((await request('foreign','wrong')).status,401);}finally{release();app.closeAllConnections();await new Promise(r=>app.close(r));}
});

test('new scans briefly prefer a validated backup after the primary is slow or unavailable',async()=>{
 const models=[];const app=createApp({token:'cooldown-token',apiKey:'fixture',model:'primary',fallbackModel:'backup',detect:async(_image,options)=>{models.push(options.model);options.onTiming({modelUsed:'backup',fallbackUsed:true});const {validateDetections}=await import('../packages/contracts/recognition.mjs');return validateDetections(rawResult());}});await new Promise(r=>app.listen(0,'127.0.0.1',r));
 const call=(width)=>new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:app.address().port,path:'/api/detect',method:'POST',headers:{host:'127.0.0.1:4317',origin:'chrome-extension://'+'a'.repeat(32),'content-type':'application/json','x-bopit-token':'cooldown-token'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end(JSON.stringify({captureId:'cooldown-'+width,image:makePng(width,32)}));});
 try{assert.equal(await call(32),200);await wait(1010);assert.equal(await call(33),200);assert.deepEqual(models,['primary','backup']);}finally{app.closeAllConnections();await new Promise(r=>app.close(r));}
});

test('backup credentials are used only for transient failures and are never included in telemetry',async()=>{
 const keys=[];let timing;const result=await detectWithGemini('same-full-frame',{apiKey:'primary-fixture-key',backupApiKey:'backup-fixture-key',model:'same-model',onTiming:value=>timing=value,fetcher:async(_url,request)=>{keys.push(request.headers['x-goog-api-key']);return keys.length===1?new Response('private',{status:503}):ok();}});assert.equal(result.objects.length,2);assert.deepEqual(keys,['primary-fixture-key','backup-fixture-key']);assert.equal(timing.credentialUsed,'backup');assert.ok(!JSON.stringify(timing).includes('fixture-key'));
 let attempts=0;await assert.rejects(detectWithGemini('frame',{apiKey:'primary-fixture-key',backupApiKey:'backup-fixture-key',model:'same-model',fetcher:async()=>{attempts++;return new Response('',{status:429});}}),error=>error.status===429);assert.equal(attempts,1);
 const structuredKeys=[];const value=await structuredGemini([{text:'fixture'}],{type:'object',properties:{text:{type:'string'}},required:['text']},{apiKey:'primary-fixture-key',backupApiKey:'backup-fixture-key',model:'fixture',retryDelayMs:0,fetcher:async(_url,request)=>{structuredKeys.push(request.headers['x-goog-api-key']);return structuredKeys.length===1?new Response('',{status:503}):new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"text":"valid"}'}]}}]}));}});assert.equal(value.text,'valid');assert.deepEqual(structuredKeys,['primary-fixture-key','backup-fixture-key']);
});
