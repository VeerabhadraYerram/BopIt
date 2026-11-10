import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { validateProfile, validateContext, searchPlan, profileIdentityLabel } from '../packages/contracts/profile.mjs';
import { inspectWithGemini, compareWithGemini } from '../apps/recognition-server/gemini.mjs';
import { searchChannel3, retrieveChannel3, catalogImage } from '../apps/recognition-server/channel3.mjs';
import { fitProfileImage, prepareProfileImages } from '../apps/extension/profile-images.mjs';
import { searchAfterProfileFailure } from '../apps/extension/profile-fallback.mjs';
import { rawProfile, makePng } from './helpers.mjs';
const response = value => new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(value)}]}}]}));
test('profiles retain evidence and unknown measurements, reject fabricated source types',()=>{
 const p=validateProfile(rawProfile());assert.equal(p.identity.status,'unidentified');assert.ok(p.unknowns.includes('Dimensions'));assert.match(p.spokenClaims[0].status,/not independently/);
 const bad=rawProfile();bad.attributes[0].source='manufacturer';assert.throws(()=>validateProfile(bad));
});
test('context bounds captions to the moment and rejects arbitrary remote video URLs',()=>{
 const c=validateContext({timestamp:120,cues:[{start:1,end:2,text:'unrelated'},{start:100,end:110,text:'nearby'}]});assert.equal(c.cues.length,1);
 for(const youtubeUrl of ['http://127.0.0.1/','https://evil.example/watch?v=abcdefghijk','https://youtube.com/redirect?v=abcdefghijk'])assert.throws(()=>validateContext({youtubeUrl}));
 assert.equal(validateContext({youtubeUrl:'https://www.youtube.com/watch?v=abcdefghijk&other=1'}).youtubeUrl,'https://www.youtube.com/watch?v=abcdefghijk');
 assert.throws(()=>validateContext({cues:[{start:2,end:1,text:'bad'}]}));
});
test('intent plans keep function search distinct and budget explicit',()=>{
 assert.equal(searchPlan(rawProfile(),'function').useImage,false);assert.equal(searchPlan(rawProfile(),'look').query,'black compact camera body');
 assert.deepEqual(searchPlan(rawProfile(),'exact',100).filters,{price:{max_price:100}});assert.throws(()=>searchPlan(rawProfile(),'exact',-1));
});
test('profile adapter sends selected crop, scene and provided caption context',async()=>{
 let sent;const p=await inspectWithGemini('crop',{scene:'scene',context:{timestamp:5,cues:[{start:4,end:6,text:'current camera'}]},label:'Camera',apiKey:'test',model:'fixture',fetcher:async(_u,o)=>{sent=JSON.parse(o.body);return response(rawProfile());}});
 assert.equal(p.category,'Camera body');assert.equal(sent.contents[0].parts.filter(p=>p.inlineData).length,2);assert.match(sent.contents[0].parts[0].text,/current camera/);assert.equal(sent.contents[0].parts.some(p=>p.fileData),false);
});
test('profile image preparation preserves in-budget images and resizes only oversized PNG data URLs', async () => {
 const original='data:image/png;base64,AA==';let bitmapCalls=0,drawn;
 const unchanged=await fitProfileImage(original,100,{createBitmap:async()=>{bitmapCalls++;throw new Error('must not decode');}});
 assert.equal(unchanged,original);assert.equal(bitmapCalls,0);
 const large=`data:image/png;base64,${'A'.repeat(1000)}`;
 const resized=await fitProfileImage(large,100,{
  createBitmap:async blob=>{bitmapCalls++;assert.equal(blob.type,'image/png');return {width:1000,height:500,close(){}}},
  createCanvas:()=>({getContext:()=>({drawImage(_image,_x,_y,width,height){drawn={width,height};}}),toDataURL:()=>original})
 });
 assert.equal(resized,original);assert.ok(drawn.width<1000&&drawn.height<500);assert.equal(bitmapCalls,1);
 const images=await prepareProfileImages({crop:original,scene:original,additionalImages:[original]},{createBitmap:async()=>{throw new Error('in-budget images must remain unchanged');}});
 assert.deepEqual(images,{crop:original,scene:original,additionalImages:[original]});
});
test('failed profile investigation falls back once to catalog search without retrying profile analysis', async () => {
 const calls=[];
 const profile=async()=>{calls.push('profile');throw new Error('profile failed');};
 const search=async(query,preserve)=>{calls.push(['search',query,preserve]);};
 try { await profile(); } catch { await searchAfterProfileFailure('camera black',search); }
 assert.deepEqual(calls,['profile',['search','camera black',true]]);
 assert.equal(await searchAfterProfileFailure('  ',search),false);
});
test('comparison sends catalog photos only when actually available',async()=>{
 let sent;const a=await compareWithGemini('crop',validateProfile(rawProfile()),[{id:'camera',title:'Camera'}],{apiKey:'test',model:'fixture',candidateImages:[{id:'camera',mimeType:'image/jpeg',data:'photo'}],fetcher:async(_u,o)=>{sent=JSON.parse(o.body);return response({assessments:[{id:'camera',verdict:'possible_match',matches:['shape'],differences:[],unknowns:['model']}]});}});
 assert.equal(a[0].verdict,'possible_match');assert.equal(sent.contents[0].parts.filter(p=>p.inlineData).length,2);assert.match(sent.contents[0].parts[0].text,/not independently|Never claim exact/);
});
test('hybrid search forwards crop and supported locale without losing query',async()=>{
 let sent;await searchChannel3('camera',{apiKey:'test',image:makePng(),config:{country:'GB',currency:'GBP'},fetcher:async(_u,o)=>{sent=JSON.parse(o.body);return new Response(JSON.stringify({products:[]}));}});
 assert.equal(sent.query,'camera');assert.equal(sent.base64_image,makePng().split(',')[1]);assert.equal(sent.config.currency,'GBP');
});
test('variant details disclose server relaxation and preserve catalog attributes',async()=>{
 const p=await retrieveChannel3('abc',{apiKey:'test',selection:{Color:'Green',Size:'XL'},fetcher:async()=>new Response(JSON.stringify({id:'abc',title:'Shirt',structured_attributes:{material:['Cotton']},variants:{selected:[{name:'Color',label:'Green'},{name:'Size',label:'M'}],options:[]}}))});
 assert.equal(p.selectionChanges[0].requested,'XL');assert.equal(p.selectionChanges[0].actual,'M');assert.deepEqual(p.structuredAttributes.material,['Cotton']);
});
test('catalog image fetch blocks non-CDN destinations and redirected images',async()=>{
 let calls=0;assert.equal(await catalogImage({image:'http://127.0.0.1/secret'},async()=>calls++),null);assert.equal(calls,0);
 const image=await catalogImage({id:'a',image:'https://cdn.trychannel3.com/image.png'},async(_u,o)=>{assert.equal(o.redirect,'error');return new Response(Buffer.from(makePng().split(',')[1],'base64'),{headers:{'content-type':'image/png'}});});assert.equal(image.id,'a');
});
test('video projection accounts for black bars, cover crops and scrolling',async()=>{
 const sandbox={};vm.runInNewContext(await readFile('apps/extension/video-geometry.js','utf8'),sandbox);const g=sandbox.BopitGeometry;
 const r={x:20,y:100,width:800,height:600};const image=g.imageRect(r,1920,1080,'contain');assert.equal(image.y,175);assert.equal(image.height,450);
 const b=g.project({x:0,y:0,width:1,height:1},image,r);assert.equal(b.y,75);assert.equal(b.width,800);
 assert.ok(g.imageRect(r,1920,1080,'cover').x<r.x);
});

test('raster-mask tracing preserves holes instead of filling the object bounding rectangle',async()=>{
 const {maskContours}=await import('../packages/contracts/mask-contours.mjs');
 const mask=new Uint8Array(100);for(let y=1;y<9;y++)for(let x=1;x<9;x++)if(x<3||x>6||y<3||y>6)mask[y*10+x]=1;
 const rings=maskContours(mask,10,10);assert.equal(rings.length,2);assert.ok(rings.flat().every(([x,y])=>x>=0&&y>=0&&x<=1&&y<=1));
});

 test('unidentified products use clear wording while partial identities remain useful',()=>{
 const raw=rawProfile();raw.identity.brand='unknown';raw.identity.model='UNKNOWN';
 const profile=validateProfile(raw);assert.equal(profile.identity.brand,'');assert.equal(profile.identity.model,'');
 assert.equal(profileIdentityLabel(raw.identity),'Brand and model couldn’t be identified from this frame.');
 assert.equal(profileIdentityLabel({brand:'Sony',model:'N/A'}),'Possible brand: Sony. Model not identified.');
 assert.equal(profileIdentityLabel({brand:'',model:'A7 IV'}),'Possible model: A7 IV. Brand not identified.');
 assert.equal(profileIdentityLabel({brand:'Sony',model:'A7 IV'}),'Possible product: Sony A7 IV');
 });
