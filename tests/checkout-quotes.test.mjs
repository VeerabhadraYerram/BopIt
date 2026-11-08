import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../apps/recognition-server/server.mjs';
import { signQuote, readQuote, catalogQuote } from '../apps/recognition-server/checkout-quotes.mjs';
const token='quote-test-token', extension='chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const listing={id:'lens-1', title:'Black lens', price:149.95,currency:'USD',availability:'InStock',variants:{selected:[{name:'Mount',label:'E'}]}};
const cookie='bopit_demo_session='+'a'.repeat(64);

test('signed catalog quote rejects tampering and expires new orders while preserving capture recovery',()=>{
 const product=catalogQuote(listing),quote=signQuote(product,token,1000);
 assert.equal(readQuote(quote,token,{now:2000}).product.price,'149.95');
 assert.throws(()=>readQuote(quote,token,{now:601000}),/expired/);
 assert.equal(readQuote(quote,token,{now:601000,allowExpired:true}).product.id,product.id);
 assert.throws(()=>readQuote(quote+'x',token),/Invalid/);
 assert.throws(()=>readQuote(quote,'other-secret'),/Invalid/);
 for(const change of [{price:null},{price:0},{price:1.234},{currency:null},{currency:'XYZ'},{availability:'OutOfStock'},{selectionChanges:[{name:'Mount'}]}]) assert.throws(()=>catalogQuote({...listing,...change}));
});

async function start(options, run) {
 const app=createApp({token,channel3Key:'fixture-channel3',paypalClientId:'test-id',paypalClientSecret:'test-secret',...options});
 await new Promise(r=>app.listen(0,'127.0.0.1',r));
 const url=`http://127.0.0.1:${app.address().port}`;
 const call=(path,{origin=extension,body,session=cookie,headers={}}={})=>new Promise((resolve,reject)=>{
  const req=http.request(url+path,{method:body?'POST':'GET',headers:{host:'127.0.0.1:4317',origin,cookie:session,'x-bopit-token':token,'content-type':'application/json',...headers}},res=>{const chunks=[];res.on('data',x=>chunks.push(x));res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(Buffer.concat(chunks))}));});req.on('error',reject);req.end(body?JSON.stringify(body):undefined);
 });
 try{await run(call);}finally{app.closeAllConnections();await new Promise(r=>app.close(r));}
}

test('selected Channel3 variant → signed server quote → approved PayPal order → verified capture and reload',async()=>{
 let order,captures=0,selected;
 const paypal={
  async createOrder(body){order={...body,id:'CATALOG_ORDER',status:'CREATED',links:[{rel:'approve',href:'https://www.sandbox.paypal.com/checkoutnow?token=CATALOG_ORDER'}]};return order;},
  async getOrder(){return order;},
  async captureOrder(){captures++;order.status='COMPLETED';order.purchase_units[0].payments={captures:[{id:'CAPTURE_1',status:'COMPLETED',amount:order.purchase_units[0].amount}]};},
  async getCapture(){return {id:'CAPTURE_1',status:'COMPLETED',amount:order.purchase_units[0].amount};}
 };
 await start({paypal,retrieve:async(id,options)=>{assert.equal(id,'lens-1');selected=options.selection;assert.equal(options.userId,'bopit_00000000-0000-4000-8000-000000000001');return listing;}},async call=>{
  assert.equal((await call('/api/payments/quotes',{origin:'http://127.0.0.1:4317',body:{id:'lens-1'}})).status,401);
  assert.equal((await call('/api/payments/quotes',{body:{id:'lens-1',price:1}})).status,400);
  const quoted=await call('/api/payments/quotes',{body:{id:'lens-1',selection:{Mount:'E'}},headers:{'x-bopit-user-id':'bopit_00000000-0000-4000-8000-000000000001'}});assert.equal(quoted.status,201);assert.deepEqual(selected,{Mount:'E'});
  const suffix=new URL(quoted.body.checkoutUrl).search;
  assert.equal(quoted.body.product.price,'149.95');assert.match(quoted.body.product.fulfillment,/Concierge \(Sandbox\)/);
  const created=await call('/api/payments/orders'+suffix,{origin:'http://127.0.0.1:4317',body:{checkoutId:'fixture-checkout-123'}});assert.equal(created.status,201);
  assert.equal(order.purchase_units[0].amount.value,'149.95');assert.equal(order.purchase_units[0].reference_id,quoted.body.product.id);
  assert.match(order.application_context.return_url,/quote=/);
  const route='/api/payments/orders/CATALOG_ORDER/capture'+suffix;
  assert.equal((await call(route,{origin:'http://127.0.0.1:4317',body:{}})).status,409);assert.equal(captures,0);
  order.status='APPROVED';
  const result=await call(route,{origin:'http://127.0.0.1:4317',body:{}});assert.equal(result.body.state,'success');assert.equal(result.body.product.catalogId,'lens-1');assert.equal(captures,1);
  assert.equal((await call(route,{origin:'http://127.0.0.1:4317',body:{}})).body.state,'success');assert.equal(captures,1);
  assert.equal((await call(route,{origin:'http://127.0.0.1:4317',body:{},session:'bopit_demo_session='+'b'.repeat(64)})).status,403);
  const other=signQuote(catalogQuote({...listing,price:5}),token);
  assert.equal((await call('/api/payments/orders/CATALOG_ORDER/capture?quote='+other,{origin:'http://127.0.0.1:4317',body:{}})).status,403);
 });
});

 test('checkout quote pins the selected seller, variant and locale and refuses a changed offer',async()=>{
  const product={...listing,retailer:'shop.example',offers:[
   {retailer:'shop.example',price:149.95,currency:'USD',condition:'new',availability:'InStock',purchaseUrl:'https://shop.example/item'},
   {retailer:'store.example',price:129.95,currency:'USD',condition:'new',availability:'InStock',purchaseUrl:'https://store.example/item'}
  ]};
  let options;
  await start({retrieve:async(_id,request)=>{options=request;return product;}},async call=>{
   const expectedOffer={retailer:'shop.example',price:149.95,currency:'USD',condition:'new',availability:'InStock',purchaseUrl:'https://shop.example/item'};
   const quoted=await call('/api/payments/quotes',{body:{id:'lens-1',selection:{Mount:'E'},websiteIds:['shop.example'],config:{country:'GB',currency:'GBP'},expectedOffer}});
   assert.equal(quoted.status,201);
   assert.deepEqual(options.selection,{Mount:'E'});
   assert.deepEqual(options.websiteIds,['shop.example']);
   assert.deepEqual(options.config,{country:'GB',currency:'GBP'});
   assert.equal(quoted.body.product.retailer,'shop.example');
   assert.equal(quoted.body.product.price,'149.95');
   const changed=await call('/api/payments/quotes',{body:{id:'lens-1',selection:{Mount:'E'},websiteIds:['shop.example'],expectedOffer:{...expectedOffer,price:139.95}}});
   assert.equal(changed.status,409);
   assert.match(changed.body.error,/changed since it was displayed/);
  });
});
