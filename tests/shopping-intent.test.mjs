import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {resolveShoppingIntent,assessShoppingResults,mergeIntentFilters} from '../apps/recognition-server/shopping-intent.mjs';
import {createApp} from '../apps/recognition-server/server.mjs';
import {budgetSetup} from '../apps/extension/setup-budget.mjs';
import {cartSource} from '../packages/contracts/cart.mjs';
const jsonResponse=value=>new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(value)}]}}]}));

test('preference filter precedence generalizes across product types and changed properties',()=>{
 const old={colors:{palette:[{hex:'#ff8800'}]},dimensions:{width:{min:100,unit:'cm'}},attributes:{material:['Wood']},category_ids:['chairs'],brand_ids:['old'],price:{max_price:500}};
 for(const change of ['colour','size','material','category','brand','seller','budget','condition','availability','function']){
  const result=mergeIntentFilters(old,{action:'refine',changes:[change],filters:{}});assert.notEqual(result,old);
  if(change==='colour')assert.equal(result.colors,undefined);
  if(change==='size')assert.equal(result.dimensions,undefined);
  if(change==='material')assert.equal(result.attributes,undefined);
  if(change==='category')assert.equal(result.category_ids,undefined);
  if(change==='brand')assert.equal(result.brand_ids,undefined);
 }
 assert.deepEqual(mergeIntentFilters(old,{action:'new',changes:['category'],filters:{price:{max_price:80}}}),{price:{max_price:80}});
 assert.deepEqual(mergeIntentFilters(old,{action:'refine',changes:['colour'],filters:{colors:{palette:[{hex:'#000000'}]}}}).colors,{palette:[{hex:'#000000'}]});
 assert.equal(old.colors.palette[0].hex,'#ff8800','the original observation is not rewritten');
});

test('intent output cannot introduce catalog IDs or arbitrary filters',async()=>{
 const plan={action:'refine',tool:'search',query:'small steel table',categoryQuery:'tables',changes:['size','material'],filtersJson:'{"dimensions":{"width":{"max":60,"unit":"cm"}}}',summary:'Finding smaller steel tables.'};
 const parsed=await resolveShoppingIntent({request:'smaller and metal'},{apiKey:'fixture',model:'fixture',fetcher:async()=>jsonResponse(plan)});assert.equal(parsed.query,'small steel table');
 await assert.rejects(resolveShoppingIntent({}, {apiKey:'fixture',model:'fixture',fetcher:async()=>jsonResponse({...plan,filtersJson:'{"category_ids":["invented"]}'})}));
 await assert.rejects(resolveShoppingIntent({}, {apiKey:'fixture',model:'fixture',fetcher:async()=>jsonResponse({...plan,filtersJson:'{"dimensions":{"width":{"max":60}}}'})}),/unit/);
 const products=[{id:'table',title:'Steel table',category:'Tables'}];
 await assert.rejects(assessShoppingResults(plan,products,{apiKey:'fixture',model:'fixture',fetcher:async()=>jsonResponse({assessments:[{id:'invented',verdict:'match',reason:'x'}]})}));
});

test('paired preference pipeline uses grounded categories, removes conflicting context and excludes rejected/unknown listings',async()=>{
 const candidates=[{id:'shirt',title:'Black polo shirt'},{id:'sock',title:'Orange/black socks'},{id:'unknown',title:'Top, colour unspecified'}];let searched;
 const app=createApp({token:'fixture-token',apiKey:'gemini-fixture',channel3Key:'catalog-fixture',resolvePreference:async()=>({action:'refine',tool:'search',query:'black polo shirt',categoryQuery:'polo shirts',changes:['colour'],filters:{colors:{palette:[{hex:'#000000'}]}},summary:'Finding black polo shirts.'}),searchCategories:async()=>({categories:[{slug:'real-polo-category',title:'Polo shirts'}]}),searchProducts:async(query,options)=>{searched={query,options};return {products:candidates};},reviewPreference:async()=>[{id:'shirt',verdict:'match',reason:'Black polo in title.'},{id:'sock',verdict:'reject',reason:'Wrong product type.'},{id:'unknown',verdict:'unknown',reason:'Colour unavailable.'}]});
 await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
 try{
  const response=await new Promise((resolve,reject)=>{const request=http.request(`http://127.0.0.1:${app.address().port}/api/products/preferences`,{method:'POST',headers:{host:'127.0.0.1:4317',origin:'chrome-extension://'+'a'.repeat(32),'content-type':'application/json','x-bopit-token':'fixture-token'}},res=>{let body='';res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(body)}));});request.on('error',reject);request.end(JSON.stringify({query:'Same shirt but black',context:{object:{label:'Orange polo shirt'}},filters:{colors:{palette:[{hex:'#ff8800'}]}},config:{country:'US',currency:'USD'}}));});
  assert.equal(response.status,200);assert.deepEqual(response.body.products.map(p=>p.id),['shirt']);assert.equal(response.body.unverifiedCount,1);assert.equal(searched.options.image,undefined);assert.deepEqual(searched.options.filters.colors.palette,[{hex:'#000000'}]);assert.deepEqual(searched.options.filters.category_ids,['real-polo-category']);
 }finally{app.closeAllConnections();await new Promise(resolve=>app.close(resolve));}
});

test('setup selection enforces one currency, distinct products and total budget, with partial results',()=>{
 const product=(id,price,currency='USD')=>({id,price,currency,title:id,availability:'InStock'});
 const roles=[{label:'Camera',products:[product('camera',80),product('eu',1,'EUR')]},{label:'Tripod',products:[product('tripod',30),product('camera',80)]}];
 assert.equal(budgetSetup(roles,120,'USD').total,110);assert.equal(budgetSetup(roles,120,'USD').complete,true);
 const partial=budgetSetup(roles,90,'USD');assert.equal(partial.complete,false);assert.ok(partial.total<=90);assert.equal(partial.items.filter(i=>i.product).length,1);
 assert.throws(()=>budgetSetup(roles,-1,'USD'));
});

test('cart source links preserve the moment while dropping unsafe links and unrelated query data',()=>{
 assert.deepEqual(cartSource({url:'https://www.youtube.com/watch?v=abcdefghijk&private=omit',timestamp:42,label:'Chair'}),{url:'https://www.youtube.com/watch?v=abcdefghijk',timestamp:42,label:'Chair'});
 assert.equal(cartSource({url:'javascript:alert(1)'}),null);assert.equal(cartSource({url:'https://user:secret@example.com'}),null);
});
