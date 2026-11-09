import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createHmac} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../apps/recognition-server/server.mjs';
import {createChannel3Client} from '../apps/recognition-server/channel3-client.mjs';
import {createCommerceStore,verifyWebhook} from '../apps/recognition-server/commerce-store.mjs';
import {filters,locale,cartItems,productUrl} from '../packages/contracts/commerce.mjs';
import {cartQuote,signQuote,readQuote} from '../apps/recognition-server/checkout-quotes.mjs';
const origin='chrome-extension://'+'a'.repeat(32),token='commerce-test-token',userId='bp_test';
const raw={id:'headphones',title:'Studio headphones',brands:[{id:'sony',name:'Sony'}],offers:[{domain:'example.com',price:{price:100,currency:'USD'},availability:'InStock',url:'https://example.com/headphones'}],variants:{selected:[{name:'Color',label:'Black'}]}};
const product={id:'headphones',title:'Studio headphones',price:100,currency:'USD',availability:'InStock',variants:raw.variants,selectionChanges:[]};
async function withApp(options,run){const app=createApp({token,channel3Key:'test-key',...options});await new Promise(r=>app.listen(0,'127.0.0.1',r));
 const call=(path,body={},headers={})=>new Promise((resolve,reject)=>{const req=http.request(`http://127.0.0.1:${app.address().port}${path}`,{method:'POST',headers:{host:'127.0.0.1:4317',origin,'content-type':'application/json','x-bopit-token':token,...headers}},res=>{let text='';res.on('data',x=>text+=x);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(text)}));});req.on('error',reject);req.end(JSON.stringify({userId,...body}));});
 try{await run(call);}finally{app.closeAllConnections();await new Promise(r=>app.close(r));}}

test('catalog filters validate palettes, dimensions, locale and safe product URLs',()=>{
 assert.deepEqual(filters({colors:{palette:[{hex:'#aabbcc',percentage:.2}]},dimensions:{width:{max:120,unit:'cm'}},conditions:['used']}),{conditions:['used'],colors:{palette:[{hex:'#aabbcc',percentage:.2}]},dimensions:{width:{max:120,unit:'cm'}}});
 for(const value of [{attributes:{color:['Red']}},{colors:{palette:[{hex:'red'}]}},{dimensions:{width:{max:-1,unit:'cm'}}},{conditions:['refurbished']},{secret:'x'}])assert.throws(()=>filters(value));
 assert.throws(()=>locale({country:'IN',currency:'INR'}));assert.equal(locale({country:'GB',currency:'GBP',mode:'agentic'}).mode,'agentic');
 for(const url of ['http://example.com/x','https://127.0.0.1/x','https://192.168.1.1/x','https://localhost/x','https://localhost.local./x','https://[::ffff:127.0.0.1]/x','https://user:password@example.com/x'])assert.throws(()=>productUrl(url));
 assert.equal(productUrl('https://shop.example.com/x#fragment'),'https://shop.example.com/x');
});

test('cart quotes use integer-cent totals, reject mixed currency and retain itemized signed receipt',()=>{
 const quote=cartQuote([{product:{...product,price:19.99},quantity:3},{product:{...product,id:'adapter',price:.1},quantity:2}]);assert.equal(quote.price,'60.17');assert.equal(quote.items.length,2);assert.equal(readQuote(signQuote(quote,token),token).product.items[0].quantity,3);
 assert.throws(()=>cartQuote([{product,quantity:1},{product:{...product,currency:'EUR'},quantity:1}]),/one currency/);
 assert.throws(()=>cartItems([{id:'headphones',quantity:1},{id:'headphones',quantity:1}]),/duplicate/);
 assert.throws(()=>cartItems([{id:'headphones',quantity:11}]));
});

test('Channel3 adapter uses actual endpoint families, attribution, filters and buffered conversations',async()=>{
 const calls=[];const client=createChannel3Client({apiKey:'key',fetcher:async(url,options)=>{calls.push({url,options});return Response.json(url.includes('similar')||url.includes('browse')?{products:[raw]}:url.includes('lookup')?{product:raw}:{});}});
 const similar=await client.similar({product_id:'headphones',filters:{price:{max_price:120}}},{userId});assert.equal(similar.products[0].price,100);assert.equal(similar.products[0].brandIds[0],'sony');
 await client.browse({filters:{website_ids:['example.com']}});await client.lookup('https://example.com/product');await client.history('headphones');await client.converse({message:{parts:[{type:'text',text:'under $120'}]}});
 assert.match(calls[0].url,/\/v1\/similar$/);assert.equal(calls[0].options.headers['x-user-id'],userId);assert.match(calls[3].url,/\/v0\/price-tracking\/history\/headphones/);assert.equal(JSON.parse(calls[4].options.body).stream,false);
});

test('commerce routes enforce pairing and return normalized tools, owned conversations and provider failures',async()=>{
 const client={similar:async()=>({products:[product]}),browse:async()=>({products:[product]}),lookup:async()=>({product}),categories:async()=>({categories:[]}),converse:async()=>({conversation_id:'conv_1',message:{parts:[{type:'text',text:'A suitable option'},{type:'tool',output:{products:[raw]}}]}}),history:async()=>{throw new Error('History unavailable');}};
 await withApp({commerceClient:client},async call=>{
  assert.equal((await call('/api/commerce/similar',{id:'headphones'},{'x-bopit-token':'wrong'})).status,401);
  assert.equal((await call('/api/commerce/similar',{id:'headphones'})).body.products[0].id,'headphones');
  assert.equal((await call('/api/commerce/browse',{})).status,400);
  assert.equal((await call('/api/commerce/browse',{filters:{website_ids:['example.com']}})).status,200);
  assert.equal((await call('/api/commerce/lookup',{url:'https://localhost/x'})).status,400);
  assert.equal((await call('/api/commerce/history',{id:'headphones'})).status,502);
  const chat=await call('/api/commerce/conversation',{message:'Find headphones'});assert.equal(chat.body.text,'A suitable option');assert.equal(chat.body.products[0].id,'headphones');
  assert.equal((await call('/api/commerce/conversation',{message:'continue',conversationId:'conv_1',userId:'foreign'})).status,400);
 });
});

test('watches persist, isolate sessions, verify variant and distinguish unknown stock',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bopit-commerce-'));let current=product,deletes=0;
 const client={retrieve:async()=>current,subscribe:async()=>({subscription_id:'sub_1'}),unsubscribe:async()=>{deletes++;}};
 const path=join(dir,'state.json');
 try{await withApp({commerceClient:client,commerceStorePath:path},async call=>{
  const saved=await call('/api/commerce/watch',{id:'headphones',selection:{Color:'Black'},maxPrice:90,source:{url:'https://www.youtube.com/watch?v=abcdefghijk',timestamp:12,label:'Headphones'}});assert.equal(saved.status,200);const id=saved.body.watch.id;
  assert.equal((await call('/api/commerce/watches',{userId:'foreign'})).body.watches.length,0);
  assert.equal((await call('/api/commerce/watch-remove',{watchId:id,userId:'foreign'})).status,400);
  current={...product,price:80,availability:null};const unknown=await call('/api/commerce/watch-refresh',{watchId:id});assert.equal(unknown.body.watch.eligible,false);assert.match(unknown.body.watch.message,/unknown/);
  current={...product,price:80};assert.equal((await call('/api/commerce/watch-refresh',{watchId:id})).body.watch.eligible,true);
  assert.equal((await createCommerceStore(path).read()).watches[0].product.price,80);
  await call('/api/commerce/watch-remove',{watchId:id});assert.equal(deletes,1);assert.equal((await call('/api/commerce/watches')).body.watches.length,0);
 });}finally{await rm(dir,{recursive:true,force:true});}
});

test('signed offer webhooks reject tampering and deduplicate delivery IDs',async()=>{
 const secret='whsec_'+Buffer.from('test-secret').toString('base64'),rawPayload=JSON.stringify({type:'offer.price.changed',data:{product_id:'headphones'}}),timestamp=String(Math.floor(Date.now()/1000)),id='msg_test';
 const signature='v1,'+createHmac('sha256',Buffer.from('test-secret')).update(`${id}.${timestamp}.${rawPayload}`).digest('base64');
 assert.equal(verifyWebhook(rawPayload,{'svix-id':id,'svix-timestamp':timestamp,'svix-signature':signature},secret),id);
 assert.throws(()=>verifyWebhook(rawPayload+'x',{'svix-id':id,'svix-timestamp':timestamp,'svix-signature':signature},secret));
 await withApp({webhookSecret:secret},async call=>{
  const body={type:'offer.price.changed',data:{product_id:'headphones'}},bodyRaw=JSON.stringify({userId,...body}),sig='v1,'+createHmac('sha256',Buffer.from('test-secret')).update(`${id}.${timestamp}.${bodyRaw}`).digest('base64');
  const headers={'svix-id':id,'svix-timestamp':timestamp,'svix-signature':sig};assert.equal((await call('/api/channel3/webhook',body,headers)).body.applied,true);assert.equal((await call('/api/channel3/webhook',body,headers)).body.applied,false);
 });
});

test('scene planning respects total budget and marks missing roles rather than inventing products',async()=>{
 await withApp({commerceClient:{search:async()=>({products:[product,{...product,id:'other',price:60}]})}},async call=>{
  const result=await call('/api/commerce/scene-plan',{roles:[{label:'Camera'},{label:'Light'}],budget:100});assert.equal(result.status,200);assert.equal(result.body.total,60);assert.equal(result.body.complete,false);assert.equal(result.body.items[1].product,null);
 });
});

test('local interaction events deduplicate and provider reporting errors stay distinguishable',async()=>{
 await withApp({commerceClient:{reporting:async(kind)=>{if(kind==='transactions')throw new Error('Provider reports unavailable');return {clicks:[]};}}},async call=>{
  const body={eventId:'event-1',kind:'object_selected',source:{label:'Lamp'}};
  assert.equal((await call('/api/commerce/event',body)).body.recorded,true);assert.equal((await call('/api/commerce/event',body)).body.recorded,false);
  const result=await call('/api/commerce/reporting');assert.equal(result.body.events.length,1);assert.equal(result.body.transactions,null);assert.equal(result.body.errors.length,1);assert.match(result.body.attributionNote,/No creator royalty/);
 });
});

test('concurrent tracking creates one watch and shared subscriptions remain until the last owner stops',async()=>{
 let subscribes=0,removes=0;
 const client={retrieve:async()=>product,subscribe:async()=>{subscribes++;await new Promise(r=>setTimeout(r,5));return {subscription_id:'shared_subscription'};},unsubscribe:async()=>{removes++;}};
 await withApp({commerceClient:client},async call=>{
  const [a,b]=await Promise.all([call('/api/commerce/watch',{id:'headphones'}),call('/api/commerce/watch',{id:'headphones'})]);assert.equal(a.body.watch.id,b.body.watch.id);assert.equal(subscribes,1);
  const other=await call('/api/commerce/watch',{id:'headphones',userId:'other'});await call('/api/commerce/watch-remove',{watchId:a.body.watch.id});assert.equal(removes,0);await call('/api/commerce/watch-remove',{watchId:other.body.watch.id,userId:'other'});assert.equal(removes,1);
 });
});
