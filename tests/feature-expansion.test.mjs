import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {compareCameraMounts} from '../apps/recognition-server/compatibility.mjs';
import {normalizePersonalization,personalizationContext} from '../apps/extension/personalization.mjs';
import {transcribeClip} from '../apps/recognition-server/video-audio.mjs';
import {validateContext} from '../packages/contracts/profile.mjs';
import {createApp} from '../apps/recognition-server/server.mjs';
const camera={id:'camera',title:'Camera body',category:'Digital Cameras',structuredAttributes:{'Lens Mount':['Canon RF']}};
const lens={id:'lens',title:'50mm Lens',category:'Camera Lenses',structuredAttributes:{'Lens Mount':['Sony E']}};
test('mount advisory uses selected catalog evidence and never blocks adding or asserts full compatibility',()=>{
 const different=compareCameraMounts(lens,[camera])[0];assert.equal(different.status,'different_mount');assert.equal(different.blocking,false);assert.deepEqual(different.evidence,['Sony E','Canon RF']);
 const same=compareCameraMounts({...lens,structuredAttributes:{'Lens Mount':['Canon RF']}},[camera])[0];assert.equal(same.status,'mount_match');assert.match(same.message,/still need checking/);
 assert.equal(compareCameraMounts({...lens,structuredAttributes:{},title:'Sony E Lens'},[camera])[0].status,'unknown','Title alone does not verify a mount');
 assert.equal(compareCameraMounts({...lens,variants:{selected:[{name:'Mount',label:'Canon RF'}]}},[camera])[0].status,'mount_match','Selected variant takes precedence');
 assert.equal(compareCameraMounts({...lens,selectionChanges:[{}]},[camera])[0].status,'unknown');
 assert.deepEqual(compareCameraMounts({id:'adapter',title:'Camera lens mount adapter'},[camera]),[]);
});
test('saved personalization is opt-in, bounded, and only uses explicitly supplied fields',()=>{
 assert.equal(personalizationContext(normalizePersonalization({preferences:'Black clothing'})),null);
 const profile=normalizePersonalization({enabled:true,preferences:' Loose fit ',ownedProducts:' Canon R6 ',gender:'inferred'});assert.deepEqual(profile,{version:1,enabled:true,preferences:'Loose fit',ownedProducts:'Canon R6'});assert.equal(personalizationContext(profile).ownedProducts,'Canon R6');assert.equal(normalizePersonalization({preferences:'x'.repeat(2000)}).preferences.length,1000);
});
test('audio transcription preserves actual clip timing and labels speech separately from captions',async()=>{
 let sent;const options={apiKey:'fixture',model:'fixture',fetcher:async(url,request)=>{sent=JSON.parse(request.body);return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({text:'This body uses an RF mount.'})}]}}]}));}};
 const clip={audio:Buffer.alloc(100).toString('base64'),mimeType:'audio/webm',start:30,duration:12};const result=await transcribeClip(clip,options);assert.equal(result.cues[0].start,30);assert.equal(result.cues[0].end,42);assert.equal(sent.contents[0].parts[1].inlineData.mimeType,'audio/webm');
 assert.equal(validateContext({timestamp:42,cues:[{...result.cues[0],source:'video_speech'}]}).cues[0].source,'video_speech');
 await assert.rejects(transcribeClip({...clip,duration:60},options));await assert.rejects(transcribeClip({...clip,audio:'bad-url'},options));
});
async function withServer(options,run){const app=createApp({token:'feature-token',channel3Key:'catalog-fixture',apiKey:'gemini-fixture',...options});await new Promise(r=>app.listen(0,'127.0.0.1',r));const call=(path,body,headers={})=>new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:app.address().port,path,method:'POST',headers:{host:'127.0.0.1:4317',origin:'chrome-extension://'+'a'.repeat(32),'content-type':'application/json','x-bopit-token':'feature-token','x-bopit-user-id':'bopit_00000000-0000-4000-8000-000000000001',...headers}},res=>{let text='';res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(text)}));});req.on('error',reject);req.end(JSON.stringify(body));});try{await run(call);}finally{app.closeAllConnections();await new Promise(r=>app.close(r));}}
test('paired compatibility endpoint retrieves canonical selected variants and rejects unpaired callers',async()=>{
 const seen=[];await withServer({retrieve:async(id,options)=>{seen.push(options);return id==='lens'?lens:camera;}},async call=>{
 const response=await call('/api/products/compatibility',{item:{id:'lens',selection:{Mount:'Sony E'}},others:[{id:'camera',selection:{Mount:'RF'}}]});assert.equal(response.status,200);assert.equal(response.body.advisories[0].blocking,false);assert.deepEqual(seen[0].selection,{Mount:'Sony E'});
 assert.equal((await call('/api/products/compatibility',{}, {'x-bopit-token':'wrong'})).status,401);
 });
});
test('inline payment uses a signed quote and installation ownership, with verified capture and retry protection',async()=>{
 let order,captures=0;const paypal={async createOrder(body){order={...body,id:'INLINE_1',status:'CREATED',links:[{rel:'approve',href:'https://www.sandbox.paypal.com/checkoutnow?token=INLINE_1'}]};return order;},async getOrder(){return order;},async captureOrder(){captures++;order.status='COMPLETED';order.purchase_units[0].payments={captures:[{id:'CAPTURE_INLINE',status:'COMPLETED',amount:order.purchase_units[0].amount}]};},async getCapture(){return {id:'CAPTURE_INLINE',status:'COMPLETED',amount:order.purchase_units[0].amount};}};
 await withServer({paypal,paypalClientId:'fixture',paypalClientSecret:'fixture',retrieve:async()=>({...camera,price:99,currency:'USD',availability:'InStock'})},async call=>{
 const quoted=await call('/api/payments/quotes',{id:'camera'});assert.equal(quoted.status,201);const suffix=new URL(quoted.body.checkoutUrl).search;
 assert.equal((await call('/api/payments/orders',{})).status,400,'Unsigned demo orders cannot be initiated from an extension');
 assert.equal((await call('/api/payments/orders'+suffix,{checkoutId:'inline-checkout-123'})).status,201);assert.equal(order.application_context.return_url,'http://127.0.0.1:4317/approval-return');
 const path='/api/payments/orders/INLINE_1';assert.equal((await call(path+'/status'+suffix,{}, {'x-bopit-user-id':'bopit_00000000-0000-4000-8000-000000000002'})).status,403);
 order.status='APPROVED';assert.equal((await call(path+'/status'+suffix,{})).body.approved,true);const captured=await call(path+'/capture'+suffix,{});assert.equal(captured.body.verified,true);assert.equal(captured.body.captureId,'CAPTURE_INLINE');await call(path+'/capture'+suffix,{});assert.equal(captures,1);
 });
});
