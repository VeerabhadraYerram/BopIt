import {timingSafeEqual,randomUUID} from 'node:crypto';
import {catalogId,text,identity,selection,locale,filters,productUrl,sourceContext,cartItems} from '../../packages/contracts/commerce.mjs';
import {normalizeChannel3Product} from '../../packages/contracts/discovery.mjs';
import {verifyWebhook} from './commerce-store.mjs';

async function jsonBody(req,limit=65536){let size=0;const parts=[];for await(const chunk of req){size+=chunk.length;if(size>limit)throw new Error('Request too large.');parts.push(chunk);}let body;try{body=JSON.parse(Buffer.concat(parts));}catch{throw new Error('Invalid JSON.');}if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('Invalid request.');return body;}
function conversationResult(result){
  const products=[],ids=new Set();let visits=0;
  function walk(value,depth=0){if(!value||depth>12||++visits>10000)return;if(Array.isArray(value)){for(const x of value)walk(x,depth+1);return;}if(typeof value!=='object')return;
    if(typeof value.id==='string'&&typeof value.title==='string'&&Array.isArray(value.offers)&&!ids.has(value.id)){ids.add(value.id);products.push(normalizeChannel3Product(value));}
    for(const v of Object.values(value))walk(v,depth+1);
  }walk(result.message);
  const reply=(result.message?.parts||[]).filter(p=>p.type==='text'&&typeof p.text==='string').map(p=>p.text).join('\n').slice(0,12000);
  return {conversationId:result.conversation_id,text:reply,products:products.slice(0,20)};
}
export function createCommerceHandler({token,client,store,webhookSecret='',usage=[]}){
  const threads=new Map();let running=0;
  return async(req,res,{send,extensionOrigin})=>{
    const path=new URL(req.url,'http://127.0.0.1:4317').pathname;
    if(path==='/api/channel3/webhook'&&req.method==='POST'){
      if(!webhookSecret){send(503,{error:'Offer updates need webhook configuration.'});return true;}
      try{let bytes=0,chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>1024*1024)throw new Error('Webhook too large.');chunks.push(chunk);}const raw=Buffer.concat(chunks).toString(),delivery=verifyWebhook(raw,req.headers,webhookSecret),event=JSON.parse(raw);
        const types=['offer.price.changed','offer.availability.changed','offer.created','offer.deleted'];
        const applied=await store.update(data=>{if(data.deliveries.includes(delivery))return false;data.deliveries.push(delivery);if(!types.includes(event.type))return false;const id=event.data?.product_id||event.data?.product?.id||event.product_id;for(const watch of data.watches)if(watch.productId===id&&watch.active){watch.updatePending=true;watch.lastEvent=event.type;watch.updatedAt=new Date().toISOString();}return true;});send(200,{received:true,applied});
      }catch{send(401,{error:'Offer update could not be authenticated.'});}return true;
    }
    if(!path.startsWith('/api/commerce/'))return false;
    const supplied=Buffer.from(String(req.headers['x-bopit-token']||'')),expected=Buffer.from(token||'');
    if(!extensionOrigin||!expected.length||supplied.length!==expected.length||!timingSafeEqual(supplied,expected)){send(401,{error:'Pair the extension first.'});return true;}
    if(req.method!=='POST'){send(405,{error:'Use a JSON POST request.'});return true;}
    if(!req.headers['content-type']?.startsWith('application/json')){send(415,{error:'JSON required.'});return true;}
    if(running>=4){send(429,{error:'Please wait for the current shopping requests.'});return true;}
    running++;
    try{
      const body=await jsonBody(req),userId=identity(body.userId),options={userId};let result;
      const config=()=>locale(body.config),searchFilters=()=>filters(body.filters),id=()=>catalogId(body.id);
      switch(path){
        case '/api/commerce/similar':result=await client.similar({product_id:id(),limit:12,filters:searchFilters(),config:config()},options);break;
        case '/api/commerce/browse':{const f=searchFilters();if(!['brand_ids','category_ids','website_ids'].some(k=>f[k]?.length))throw new Error('Choose a brand, category or seller.');result=await client.browse({filters:f,config:config(),limit:12},options);break;}
        case '/api/commerce/lookup':result=await client.lookup(productUrl(body.url),options);result.identitySource='Viewer-supplied product link; association with the video is not independently verified.';break;
        case '/api/commerce/categories':result=await client.categories(text(body.query,160));break;
        case '/api/commerce/category':result=await client.category(text(body.slug,160,/^[\w-]+$/));break;
        case '/api/commerce/brands':result=await client.brands(text(body.query,160));break;
        case '/api/commerce/history':result=await client.history(id(),90);break;
        case '/api/commerce/conversation':{
          if(!userId)throw new Error('Shopping session missing.');const message=text(body.message,4000);
          if(body.conversationId&&threads.get(body.conversationId)!==userId)throw new Error('This shopping conversation is unavailable. Start a new request.');
          const raw=await client.converse({message:{role:'user',parts:[{type:'text',text:message}]},...(body.conversationId?{conversation_id:text(body.conversationId,160,/^[\w-]+$/)}:{}),filters:searchFilters()},options);
          result=conversationResult(raw);if(result.conversationId){threads.set(result.conversationId,userId);if(threads.size>500)threads.delete(threads.keys().next().value);}break;
        }
        case '/api/commerce/details':result={product:await client.retrieve(id(),{selection:selection(body.selection),config:config(),userId})};break;
        case '/api/commerce/cart-review':{
          const items=cartItems(body.items),lines=[];for(const item of items){const product=await client.retrieve(item.id,{selection:item.selection,config:config(),userId});lines.push({...item,product});}result={lines,reviewedAt:new Date().toISOString(),message:'Current listing prices. Taxes, shipping and compatibility require seller confirmation.'};break;
        }
        case '/api/commerce/scene-plan':{
          if(!Array.isArray(body.roles)||!body.roles.length||body.roles.length>6)throw new Error('Choose one to six items for your setup.');
          const budget=Number(body.budget);if(!Number.isFinite(budget)||budget<1||budget>100000)throw new Error('Enter a valid setup budget.');
          const roles=body.roles.map(r=>({label:text(r.label,160),query:text(r.query||r.label,500)})),f=searchFilters(),cfg=config();
          const searches=await Promise.all(roles.map(role=>client.search({query:role.query,filters:{...f,price:{max_price:budget}},config:cfg,limit:6},options)));
          let remaining=Math.round(budget*100);const used=new Set(),items=[];
          for(let i=0;i<roles.length;i++){const candidates=searches[i].products.filter(p=>p.currency===cfg.currency&&p.price!=null&&p.price>0&&p.availability!=='OutOfStock'&&!used.has(p.id)).sort((a,b)=>a.price-b.price);const match=candidates.find(p=>Math.round(p.price*100)<=remaining);if(match){used.add(match.id);remaining-=Math.round(match.price*100);}items.push({role:roles[i].label,product:match||null,alternatives:candidates.slice(0,3)});}
          result={items,currency:cfg.currency,budget,total:(Math.round(budget*100)-remaining)/100,complete:items.every(i=>i.product),message:'Budget-constrained listing candidates, not a verified compatibility or outcome guarantee. Review every role and variant.'};break;
        }
        case '/api/commerce/watch':{
          if(!userId)throw new Error('Shopping session missing.');const productId=id(),chosen=selection(body.selection),source=sourceContext(body.source);const maxPrice=body.maxPrice==null||body.maxPrice===''?null:Number(body.maxPrice);if(maxPrice!==null&&(!Number.isFinite(maxPrice)||maxPrice<=0||maxPrice>100000))throw new Error('Invalid alert price.');
          const product=await client.retrieve(productId,{selection:chosen,config:config(),userId});if(product.selectionChanges?.length)throw new Error('The selected variant changed. Review it before tracking.');
          const watch=await store.update(async data=>{
            const existing=data.watches.find(w=>w.userId===userId&&w.productId===productId&&JSON.stringify(w.selection)===JSON.stringify(chosen)&&w.active);if(existing)return existing;
            if(data.watches.filter(w=>w.userId===userId&&w.active).length>=30)throw new Error('Track at most 30 items.');
            const subscription=await client.subscribe({product_id:productId,events:['offer.price.changed','offer.availability.changed','offer.created','offer.deleted'],...(Object.keys(chosen).length?{selection:Object.entries(chosen).map(([name,label])=>({name,label}))}:{})});
            if(!subscription.subscription_id)throw new Error('Channel3 did not confirm tracking.');
            const saved={id:randomUUID(),userId,productId,selection:chosen,source,maxPrice,currency:product.currency,config:config(),title:product.title,subscriptionId:subscription.subscription_id,active:true,createdAt:new Date().toISOString(),product,updatePending:false};data.watches.push(saved);return saved;
          });result={watch,webhookConfigured:Boolean(webhookSecret)};break;
        }
        case '/api/commerce/watches':{
          if(!userId)throw new Error('Shopping session missing.');const data=await store.read();result={watches:data.watches.filter(w=>w.userId===userId&&w.active),webhookConfigured:Boolean(webhookSecret)};break;
        }
        case '/api/commerce/watch-refresh':{
          if(!userId)throw new Error('Shopping session missing.');const data=await store.read(),watch=data.watches.find(w=>w.id===body.watchId&&w.userId===userId&&w.active);if(!watch)throw new Error('Tracked item not found.');
          const product=await client.retrieve(watch.productId,{selection:watch.selection,config:watch.config,userId});
          const eligible=(!product.selectionChanges?.length&&product.availability==='InStock'&&product.currency===watch.currency&&product.price!=null&&(watch.maxPrice==null||product.price<=watch.maxPrice));
          result=await store.update(d=>{const target=d.watches.find(w=>w.id===watch.id);Object.assign(target,{product,lastCheckedAt:new Date().toISOString(),updatePending:false,eligible,message:eligible?'Your tracked variant meets the requested conditions.':product.selectionChanges?.length?'Requested variant changed; review the listing.':product.currency!==watch.currency?'Listing currency changed; review your target price.':product.availability==null?'Availability is unknown; confirm with seller.':'Your requested conditions are not met.'});return {watch:target};});break;
        }
        case '/api/commerce/watch-remove':{
          if(!userId)throw new Error('Shopping session missing.');
          await store.update(async data=>{const watch=data.watches.find(w=>w.id===body.watchId&&w.userId===userId&&w.active);if(!watch)throw new Error('Tracked item not found.');if(!data.watches.some(w=>w.id!==watch.id&&w.active&&w.subscriptionId===watch.subscriptionId))await client.unsubscribe(watch.subscriptionId);watch.active=false;});result={removed:true};break;
        }
        case '/api/commerce/event':{
          if(!userId)throw new Error('Shopping session missing.');const eventId=text(body.eventId,80,/^[\w-]+$/),kind=text(body.kind,40,/^(object_selected|product_opened|product_link|cart_added|identity_linked)$/),source=sourceContext(body.source),productId=body.productId?catalogId(body.productId):null;
          result=await store.update(d=>{if(d.events.some(e=>e.eventId===eventId&&e.userId===userId))return {recorded:false};d.events.push({eventId,userId,kind,source,productId,at:new Date().toISOString()});return {recorded:true};});break;
        }
        case '/api/commerce/reporting':{
          if(!userId)throw new Error('Shopping session missing.');const data=await store.read();const settled=await Promise.allSettled(['clicks','transactions'].map(kind=>client.reporting(kind,{user_id:userId,limit:'100'})));
          result={events:data.events.filter(e=>e.userId===userId),clicks:settled[0].status==='fulfilled'?settled[0].value:null,transactions:settled[1].status==='fulfilled'?settled[1].value:null,errors:settled.filter(r=>r.status==='rejected').map(r=>r.reason.message),usage:usage.slice(-100),attributionNote:'Retailer transactions are provider-reported, may be delayed and cannot be assigned to a video from timing alone. No creator royalty or payout is implied.'};break;
        }
        default:send(404,{error:'Unknown shopping action.'});return true;
      }
      send(200,result);
    }catch(error){send(error.status||(/Invalid|Choose|Enter|Use |Unsupported|Unknown|missing|not found|Track at|changed|Start a/.test(error.message)?400:502),{error:error.name==='TimeoutError'?'Shopping request timed out. Your selection is preserved.':error.message||'Shopping request failed.'});}
    finally{running--;}
    return true;
  };
}
