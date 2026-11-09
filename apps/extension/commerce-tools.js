import {formatProductPrice,safeProductUrl} from './product-display.js';
const $=s=>document.querySelector(s);
export const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
let identityPromise;
export function shoppingIdentity(){
  return identityPromise ||= (async()=>{const data=await chrome.storage.local.get('bopitIdentity');if(data.bopitIdentity)return data.bopitIdentity;const id='bp_'+crypto.randomUUID();await chrome.storage.local.set({bopitIdentity:id});return id;})();
}
function button(label,action,cls='secondary'){const b=el('button',label,cls);b.type='button';b.onclick=action;return b;}
function field(label,input){const wrap=el('label',label);input.setAttribute('aria-label',label);wrap.append(input);return wrap;}
function input(type='text',placeholder=''){const n=el('input');n.type=type;n.placeholder=placeholder;if(placeholder)n.setAttribute('aria-label',placeholder);return n;}
function select(options){const n=el('select');for(const [value,label]of options){const option=el('option',label);option.value=value;n.append(option);}return n;}
function details(label){const node=el('details');node.append(el('summary',label));return node;}
let currentMomentId = null;
function source(getContext){const c=getContext();return {url:c.capture?.source?.documentUrl,timestamp:c.capture?.source?.timestamp||0,objectId:c.object?.id,label:c.object?.label,momentId:currentMomentId||undefined};}
export function createCommerceTools({api,getContext,getMarket,onResults,onRefine,getObjects}){
  let version=0,conversationId=null,filterValue={},cart=[],cartReviewed=[],cartBusy=false;
  const originalApi=api;
  api=async(path,body)=>{const stamp=version,result=await originalApi(path,body);if(stamp!==version&&['commerce/similar','commerce/browse','commerce/lookup','commerce/categories','commerce/category','commerce/history','commerce/conversation','commerce/scene-plan','products/search'].includes(path))throw new DOMException('Selection changed','AbortError');return result;};
  const caches=new Map();
  const panel=el('section',undefined,'commerce-tools panel');panel.id='commerce-tools';
  const notice=el('p','','muted');notice.id='commerce-notice';notice.setAttribute('role','status');
  const status=(message)=>{notice.textContent=message;};
  const searchBody=()=>({config:getMarket(),filters:filterValue});
  async function execute(action,run,target=notice){
    const stamp=version;action.disabled=true;target.textContent='Working on your request…';
    try{const result=await run();if(stamp!==version)return;return result;}
    catch(error){if(stamp===version)target.textContent=error.message;}
    finally{action.disabled=false;}
  }
  async function event(kind,productId,context=source(getContext)){
    try{await api('commerce/event',{kind,productId,source:context,eventId:crypto.randomUUID()});}catch{/* Analytics never blocks shopping. */}
  }
  function showProducts(data,label){onResults(data.products||[]);status(label);}
  function relevantFilters(){return structuredClone(filterValue);}

  // Progressive refinement: only explicit inputs become catalog constraints.
  const refine=details('Refine matches');refine.id='catalog-refinements';
  const categoryQuery=input('search','Find a category'),category=select([['','Any category']]),attributes=el('div');
  const categoryButton=button('Find categories',()=>execute(categoryButton,async()=>{
    const data=await api('commerce/categories',{query:categoryQuery.value||getContext().profile?.category||getContext().object?.label||'products'});
    category.replaceChildren(new Option('Any category',''));for(const c of data.categories||[])category.add(new Option(c.title,c.slug));status('Choose a category to see its supported refinements.');
  }));categoryButton.id='find-categories';
  let attributeInputs=[];
  category.onchange=async()=>{
    attributeInputs=[];attributes.replaceChildren();if(!category.value)return;
    try{const stamp=version,slug=category.value,data=await api('commerce/category',{slug});if(stamp!==version||category.value!==slug)return;
      for(const a of (data.attributes||[]).filter(a=>a.slug!=='color'&&a.values?.length).slice(0,5)){
        const control=select([['','Any'],...a.values.slice(0,100).map(v=>[v,v])]);attributes.append(field(a.name,control));attributeInputs.push({slug:a.slug,control});
      }
    }catch(e){status(e.message);}
  };
  const colors=input('text','#c8b59a, #f1eadc');colors.id='palette-filter';
  const condition=select([['','Any condition'],['new','New'],['used','Pre-owned']]);
  const width=input('number','Maximum width'),height=input('number','Maximum height'),unit=select([['cm','cm'],['in','in']]);
  width.min=height.min='0.1';width.step=height.step='0.1';
  const paletteButton=button('Use object colours',()=>execute(paletteButton,async()=>{
    const value=getContext().image,data=typeof value==='function'?value():value;if(!data)throw new Error('Select an object first.');const image=new Image();image.src=data;await image.decode();const canvas=document.createElement('canvas');canvas.width=canvas.height=48;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,48,48);const pixels=ctx.getImageData(0,0,48,48).data,counts=new Map();
    for(let i=0;i<pixels.length;i+=4){const hex='#'+[pixels[i],pixels[i+1],pixels[i+2]].map(v=>Math.min(255,Math.round(v/32)*32).toString(16).padStart(2,'0')).join('');counts.set(hex,(counts.get(hex)||0)+1);}
    colors.value=[...counts].sort((a,b)=>b[1]-a[1]).slice(0,2).map(([hex])=>hex).join(', ');status('Colours sampled from the crop; edit them to exclude background colours before applying.');
  }));
  const apply=button('Apply refinements',()=>{
    try{
      const f={conditions:condition.value?[condition.value]:['new','used']};
      if(category.value)f.category_ids=[category.value];
      const palette=colors.value.split(',').map(v=>v.trim()).filter(Boolean);if(palette.some(v=>!/^#[0-9a-f]{6}$/i.test(v))||palette.length>5)throw new Error('Use up to five comma-separated hex colours.');if(palette.length)f.colors={palette:palette.map(hex=>({hex}))};
      const selected=attributeInputs.filter(a=>a.control.value);if(selected.length)f.attributes=Object.fromEntries(selected.map(a=>[a.slug,[a.control.value]]));
      for(const [key,control]of [['width',width],['height',height]])if(control.value){const n=Number(control.value);if(!Number.isFinite(n)||n<=0)throw new Error('Enter a positive measurement.');(f.dimensions||={})[key]={max:n,unit:unit.value};}
      filterValue=f;status('Applying your preferences. Missing measurements cannot satisfy a size filter.');onRefine();
    }catch(e){status(e.message);}
  });apply.id='apply-catalog-filters';
  const reset=button('Clear refinements',()=>{filterValue={};colors.value=width.value=height.value='';condition.value=category.value='';attributes.replaceChildren();attributeInputs=[];onRefine();status('Catalog refinements cleared.');});
  refine.append(categoryQuery,categoryButton,field('Category',category),attributes,field('Colour palette',colors),paletteButton,field('Condition',condition),el('small','Listing condition and availability can be unknown. Filters do not independently verify them.'),field('Fits my space',width),height,unit,apply,reset);

  const explore=details('Explore a collection');explore.id='collection-tools';
  const brandQuery=input('search','Find a brand'),brand=select([['','Choose a brand']]);
  const findBrand=button('Find brands',()=>execute(findBrand,async()=>{const data=await api('commerce/brands',{query:brandQuery.value});brand.replaceChildren(new Option('Choose a brand',''));for(const b of data.brands||[])brand.add(new Option(b.name||b.title,b.id));status('Choose a brand, then open its collection.');}));
  const browse=button('Open collection',()=>execute(browse,async()=>{const f=relevantFilters();if(brand.value)f.brand_ids=[brand.value];if(!f.category_ids?.length&&!f.brand_ids?.length)throw new Error('Choose a category in Refine matches, or find a brand.');const data=await api('commerce/browse',{...searchBody(),filters:f});showProducts(data,'Collection from Channel3. Select an item to inspect its exact configuration.');}));browse.id='browse-collection';explore.append(brandQuery,findBrand,brand,browse);

  const lookup=details('Know the actual product?');lookup.id='product-link-tools';const url=input('url','Paste the merchant product link');url.id='lookup-url';
  const resolve=button('Find linked product',()=>execute(resolve,async()=>{const data=await api('commerce/lookup',{url:url.value});showProducts({products:[data.product]},data.identitySource);await event('identity_linked',data.product.id);}));resolve.id='lookup-product';lookup.append(el('p','Use a product link to resolve a mystery item. Your link is a supplied association, not proof of what appears in the video.'),url,resolve);

  const assistant=details('Tell us what matters');assistant.id='conversation-tools';const message=el('textarea');message.rows=3;message.maxLength=2500;message.placeholder='Same style, smaller, suitable for outdoor use…';message.id='shopping-request';const reply=el('div');reply.id='shopping-reply';reply.setAttribute('role','status');
  const converse=button('Find my version',()=>execute(converse,async()=>{
    if(!message.value.trim())throw new Error('Tell us what matters before searching.');const c=getContext(),context=[c.profile?.summary||c.object?.label||'Selected item',...(c.profile?.attributes||[]).map(a=>`${a.name}: ${a.value} (${a.source})`)].join('\n').slice(0,1200);const data=await api('commerce/conversation',{message:`Product context (unverified observations): ${context}\nViewer request: ${message.value}`,conversationId,filters:filterValue});conversationId=data.conversationId;reply.textContent=data.text||'No written answer returned.';if(data.products?.length)onResults(data.products);status('Refined through Channel3. Review listing facts and unknowns before choosing.');
  },reply));converse.id='refine-with-channel3';assistant.append(message,converse,reply);
  const deep=button('Search with full context',()=>execute(deep,async()=>{const c=getContext(),query=[message.value,c.profile?.summary||c.object?.label,...(c.profile?.attributes||[]).map(a=>`${a.name}: ${a.value} (${a.source})`)].filter(Boolean).join('\n').slice(0,4000);const data=await api('products/search',{query,limit:12,filters:filterValue,config:{...getMarket(),mode:'agentic'}});showProducts(data,'Context-aware catalog results. Exact identity and suitability still need review.');}));deep.id='agentic-search';assistant.append(deep);

  const setup=details('Recreate this setup');setup.id='scene-tools';const roles=el('div'),sceneBudget=input('number','Total budget');sceneBudget.min='1';sceneBudget.id='scene-budget';const sceneOutput=el('div');sceneOutput.id='scene-results';
  const refreshRoles=button('Choose items from this moment',()=>{roles.replaceChildren();for(const object of getObjects().slice(0,12)){const check=input('checkbox');check.value=object.label;check.dataset.objectId=object.id;roles.append(field(object.label,check));}});
  const plan=button('Build a budget setup',()=>execute(plan,async()=>{
    const chosen=[...roles.querySelectorAll('input:checked')].map(i=>({label:i.value}));const data=await api('commerce/scene-plan',{roles:chosen,budget:Number(sceneBudget.value),...searchBody()});sceneOutput.replaceChildren(el('p',`${data.complete?'Candidate setup':'Partial setup'} · ${formatProductPrice(data.total,data.currency)} of ${formatProductPrice(data.budget,data.currency)}`),el('small',data.message));
    for(const item of data.items){const row=el('div',undefined,'scene-role');row.append(el('strong',item.role),el('p',item.product?`${item.product.title} · ${formatProductPrice(item.product.price,item.product.currency)}`:'No candidate within the remaining budget.'));if(item.product)row.append(button('Inspect option',()=>showProducts({products:[item.product]},'Setup candidate. Review its role, variant and compatibility.')));sceneOutput.append(row);}status('Review each option before adding it to your cart.');
  },sceneOutput));plan.id='build-scene';setup.append(refreshRoles,roles,sceneBudget,plan,sceneOutput);
  const extras=details('Explore more');extras.id='catalog-extras';extras.append(explore,lookup,setup);
  panel.append(refine,assistant,extras,notice);$('#products-panel').insertBefore(panel,$('#products-container'));

  // Cart is local, durable and serialized in the extension's service worker.
  const cartPanel=el('section',undefined,'panel commerce-drawer');cartPanel.id='cart-panel';cartPanel.hidden=true;cartPanel.setAttribute('aria-label','Your cart');
  const cartList=el('div'),cartNotice=el('p','Prices are refreshed before payment.','muted'),cartReview=el('div');cartReview.id='cart-review';cartNotice.setAttribute('role','status');
  const cartToggle=button('Cart · 0',()=>{cartPanel.hidden=!cartPanel.hidden;if(!cartPanel.hidden){renderCart();cartPanel.scrollIntoView({block:'start',behavior:'smooth'});}});cartToggle.id='cart-toggle';$('header nav').prepend(cartToggle);
  const closeCart=button('← Keep exploring',()=>{cartPanel.hidden=true;});
  async function updateCart(action,fields={}){
    const result=await chrome.runtime.sendMessage({type:'BOPIT_CART',action,...fields});if(result?.error)throw new Error(result.error);cart=result?.cart||[];cartReviewed=[];renderCart();return cart;
  }
  function renderCart(){
    cartToggle.textContent=`Cart · ${cart.reduce((sum,p)=>sum+p.quantity,0)}`;cartList.replaceChildren();cartReview.replaceChildren();
    if(!cart.length){cartList.append(el('p','Your cart is empty. Add a find to keep exploring.'));return;}
    const totals=new Map();
    for(const item of cart){const row=el('article',undefined,'cart-line');row.append(el('strong',item.title),el('small',`${item.retailer||'Seller'} · ${Object.entries(item.selection).map(([k,v])=>`${k}: ${v}`).join(' · ')||'Listing default variant'}`),el('p',formatProductPrice(item.price,item.currency)));
      if(item.price!=null&&item.currency)totals.set(item.currency,(totals.get(item.currency)||0)+Math.round(item.price*100)*item.quantity);
      const qty=select(Array.from({length:10},(_,i)=>[String(i+1),String(i+1)]));qty.value=String(item.quantity);qty.onchange=()=>updateCart('quantity',{key:item.key,quantity:Number(qty.value)}).catch(e=>cartNotice.textContent=e.message);row.append(field('Quantity',qty),button('Remove',()=>updateCart('remove',{key:item.key}).catch(e=>cartNotice.textContent=e.message)));
      const url=(()=>{try{const u=new URL(item.source?.url);return ['http:','https:'].includes(u.protocol)?u.href:null;}catch{return null;}})();if(url){const link=el('a','Back to this moment ↗');const u=new URL(url);if(item.source.timestamp)u.searchParams.set('t',String(Math.floor(item.source.timestamp)));link.href=u.href;link.target='_blank';link.rel='noopener noreferrer';row.append(link);}cartList.append(row);
    }
    for(const [currency,cents]of totals)cartList.append(el('p',`${formatProductPrice(cents/100,currency)} · estimated item subtotal`));
    if(totals.size>1)cartList.append(el('p','Multiple currencies are kept separate. A single payment requires one currency.','variant-warning'));
  }
  function cartPayload(){return cart.map(({id,selection,quantity})=>({id,selection,quantity}));}
  const reviewCart=button('Review current prices',async()=>{
    if(cartBusy||!cart.length)return;cartBusy=true;reviewCart.disabled=true;cartNotice.textContent='Checking prices, variants and availability…';
    try{const data=await api('commerce/cart-review',{items:cartPayload(),config:getMarket()});cartReviewed=data.lines;cartReview.replaceChildren(el('p',data.message));
      for(const line of data.lines){const p=line.product;cartReview.append(el('p',`${p.title} × ${line.quantity}: ${formatProductPrice(p.price,p.currency)} · ${p.availability||'Availability unknown'}`));if(p.selectionChanges?.length)cartReview.append(el('p','Requested variant changed. Update this cart line before payment.','variant-warning'));}
      const mounts=data.lines.map(l=>({title:l.product.title,mount:Object.entries(l.product.structuredAttributes||{}).filter(([k])=>/mount/i.test(k)).flatMap(([,v])=>Array.isArray(v)?v:[v]).join(', ')})).filter(p=>p.mount);
      if(new Set(mounts.map(p=>p.mount.toLowerCase())).size>1)cartReview.append(el('p',`Compatibility note: listed mounts differ (${mounts.map(p=>`${p.title}: ${p.mount}`).join('; ')}). Confirm an adapter or intended use. You can keep these items in your cart.`,'variant-warning'));
      cartNotice.textContent='Current listings loaded. Review changes before paying.';
    }catch(e){cartNotice.textContent=e.message;}finally{cartBusy=false;reviewCart.disabled=false;}
  });reviewCart.id='review-cart';
  const payCart=button('Continue with PayPal',async()=>{
    if(cartBusy||!cart.length)return;const page=window.open('about:blank','_blank');if(!page){cartNotice.textContent='Allow the checkout tab, then try again.';return;}page.opener=null;cartBusy=true;payCart.disabled=true;cartNotice.textContent='Preparing a fresh cart quote…';
    try{const data=await api('payments/quotes',{items:cartPayload(),config:getMarket()});const url=new URL(data.checkoutUrl);if(url.origin!=='http://127.0.0.1:4317'||url.pathname!=='/checkout')throw new Error('Invalid checkout address.');page.location.replace(url.href);cartNotice.textContent='Review the fresh itemized quote before approving payment. Your cart stays here.';}
    catch(e){page.close();cartNotice.textContent=e.message;}finally{cartBusy=false;payCart.disabled=false;}
  });payCart.id='pay-cart';cartPanel.append(closeCart,el('h2','Your cart'),cartNotice,cartList,reviewCart,cartReview,payCart);$('main').prepend(cartPanel);
  updateCart('read').catch(e=>cartNotice.textContent=e.message);
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.bopitCart){cart=changes.bopitCart.newValue||[];cartReviewed=[];renderCart();}});

  const watchPanel=details('Tracked moments');watchPanel.id='tracked-moments';const watchList=el('div'),watchNotice=el('p','','muted');
  async function loadWatches(){
    const data=await api('commerce/watches',{});watchList.replaceChildren();watchNotice.textContent=data.webhookConfigured?'Offer tracking is active. Provider refreshes are periodic; confirm seller stock before buying.':'Tracking is saved with Channel3. Automatic delivery needs a configured public webhook; you can refresh prices here.';
    if(!data.watches.length)watchList.append(el('p','Track a product to follow its price or availability.'));
    for(const watch of data.watches){const row=el('article',undefined,'watch-line');row.append(el('strong',watch.title),el('small',watch.maxPrice?`Target: ${formatProductPrice(watch.maxPrice,watch.currency)}`:'Watching price and availability'),el('p',watch.updatePending?'Offer changed — refresh this listing.':watch.message||'No confirmed update yet.'));
      if(watch.source?.label)row.append(el('small',`${watch.source.label} · ${Math.floor(watch.source.timestamp||0)}s`));
      row.append(button('Find alternatives',async()=>{try{const data=await api('commerce/similar',{id:watch.productId,config:watch.config||getMarket(),filters:watch.maxPrice?{price:{max_price:watch.maxPrice}}:{}});showProducts(data,'Alternatives to your tracked item. The original video association is preserved on the saved moment.');}catch(e){watchNotice.textContent=e.message;}}),button('Check now',async()=>{try{watchNotice.textContent='Checking this variant…';await api('commerce/watch-refresh',{watchId:watch.id});await loadWatches();}catch(e){watchNotice.textContent=e.message;}}),button('Stop tracking',async()=>{try{await api('commerce/watch-remove',{watchId:watch.id});await loadWatches();}catch(e){watchNotice.textContent=e.message;}}));watchList.append(row);
    }
  }
  const refreshWatches=button('Refresh tracked moments',()=>{watchNotice.textContent='Loading your tracked moments…';loadWatches().catch(e=>watchNotice.textContent=e.message);});refreshWatches.id='refresh-watches';const notify=button('Enable Chrome notifications',async()=>{try{const granted=await chrome.permissions.request({permissions:['notifications']});if(!granted){watchNotice.textContent='Notifications remain off. You can check tracked moments here.';return;}await chrome.runtime.sendMessage({type:'BOPIT_TRACKING_ENABLE'});watchNotice.textContent='Chrome notifications enabled. Automatic offer updates also require the server webhook connection.';}catch(e){watchNotice.textContent=e.message;}});notify.id='enable-watch-notifications';watchPanel.append(watchNotice,refreshWatches,notify,watchList);$('#wishlist-panel').after(watchPanel);

  const activity=details('Shopping activity & attribution');activity.id='commerce-activity';const activityOutput=el('div');
  const loadActivity=button('Load activity',()=>execute(loadActivity,async()=>{
    const data=await api('commerce/reporting',{});activityOutput.replaceChildren(el('p',data.attributionNote));
    const counts=new Map();for(const event of data.events){const label=event.source?.label||'Catalog browsing',key=`${label} · ${event.kind.replaceAll('_',' ')}`;counts.set(key,(counts.get(key)||0)+1);}
    for(const [label,count]of counts)activityOutput.append(el('p',`${label}: ${count}`));
    const providerRows=(raw,key)=>raw?.[key]||raw?.items||raw?.data||[];
    const clicks=providerRows(data.clicks,'clicks'),transactions=providerRows(data.transactions,'transactions');activityOutput.append(el('p',`Provider records loaded: ${clicks.length} retailer clicks · ${transactions.length} transactions (up to 100 per type).`));
    for(const transaction of transactions.slice(0,20))activityOutput.append(el('p',`Transaction ${String(transaction.id||'').slice(0,80)} · ${transaction.status||'Status unknown'} · publisher commission ${typeof transaction.commission_amount==='object'?JSON.stringify(transaction.commission_amount):String(transaction.commission_amount??'not supplied')}`));
    for(const error of data.errors)activityOutput.append(el('p',error));
    const audit=details('Channel3 request evidence');for(const call of data.usage) audit.append(el('p',`${call.method} ${call.path} · HTTP ${call.status||'network error'} · ${call.elapsedMs}ms`));activityOutput.append(audit);status('Activity loaded. This is observed BopIt activity, not total video audience or creator earnings.');
  },activityOutput));loadActivity.id='load-commerce-activity';activity.append(loadActivity,activityOutput);watchPanel.after(activity);

  function productTools(getProduct){
    const container=el('div',undefined,'commerce-product-tools');
    const add=button('Add to cart',async()=>{try{const p=getProduct();await updateCart('add',{item:{...p,selection:Object.fromEntries((p.variants?.selected||[]).map(v=>[v.name,v.label])),source:source(getContext)}});add.textContent='Added ✓';await event('cart_added',p.id);}catch(e){status(e.message);}});add.dataset.action='add-to-cart';container.append(add);
    const more=details('Price, alerts & alternatives'),output=el('div');output.setAttribute('role','status');
    const history=button('Price history',()=>execute(history,async()=>{
      const p=getProduct(),key='history:'+p.id;let data=caches.get(key);if(!data){data=await api('commerce/history',{id:p.id});caches.set(key,data);}output.replaceChildren();
      const currency=data.statistics?.currency||p.currency,points=(data.history||[]).filter(x=>Number.isFinite(x.price)&&x.currency===currency&&Number.isFinite(Date.parse(x.timestamp))).sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp));
      if(!points.length){output.append(el('p','No price history is available for this item.'));return;}
      output.append(el('p',`${points.length} recorded prices · ${currency}. Listing history excludes shipping and tax.`));
      if(data.statistics?.current_status)output.append(el('p',`Current recorded price: ${data.statistics.current_status} relative to available history.`));
      const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 320 100');svg.setAttribute('role','img');svg.setAttribute('aria-label',`Price history from ${points[0].timestamp} to ${points.at(-1).timestamp}`);const min=Math.min(...points.map(p=>p.price)),max=Math.max(...points.map(p=>p.price)),start=Date.parse(points[0].timestamp),span=Date.parse(points.at(-1).timestamp)-start||1,path=document.createElementNS(ns,'polyline');path.setAttribute('points',points.map(p=>`${10+300*(Date.parse(p.timestamp)-start)/span},${85-70*(p.price-min)/(max-min||1)}`).join(' '));path.setAttribute('fill','none');path.setAttribute('stroke','#52775c');path.setAttribute('stroke-width','2');svg.append(path);output.append(svg,el('small',`${formatProductPrice(min,currency)}–${formatProductPrice(max,currency)}`));
      const list=details('Recorded prices');for(const point of points.slice(-12))list.append(el('p',`${new Date(point.timestamp).toLocaleDateString()} · ${formatProductPrice(point.price,point.currency)}`));output.append(list);
    },output));history.dataset.action='price-history';
    const similar=button('More like this',()=>execute(similar,async()=>{const p=getProduct(),data=await api('commerce/similar',{id:p.id,...searchBody()});showProducts(data,'Similar catalog products. Review the differences before choosing.');}));similar.dataset.action='similar-products';
    const seller=button('More from this seller',()=>execute(seller,async()=>{const p=getProduct(),domain=p.retailer;if(!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain))throw new Error('Seller domain is unavailable for browsing.');const data=await api('commerce/browse',{...searchBody(),filters:{...filterValue,website_ids:[domain]}});showProducts(data,`Collection from ${domain}.`);}));seller.dataset.action='browse-seller';
    const watch=details('Track this moment'),target=input('number','Optional target price');target.min='0.01';target.step='0.01';
    const track=button('Track price & availability',()=>execute(track,async()=>{const p=getProduct(),data=await api('commerce/watch',{id:p.id,selection:Object.fromEntries((p.variants?.selected||[]).map(v=>[v.name,v.label])),maxPrice:target.value||null,config:getMarket(),source:source(getContext)});output.textContent=data.webhookConfigured?'Tracking saved. Offer changes will appear under Tracked moments.':'Tracking saved. Automatic delivery needs webhook setup; use Check now under Tracked moments.';},output));track.dataset.action='track-product';watch.append(target,track);
    more.append(history,similar,seller,watch,output);container.append(more);return container;
  }
  return {
    filters:relevantFilters,productTools,event,
    onSelect(){version++;conversationId=null;currentMomentId='mom_'+crypto.randomUUID();reply.replaceChildren();categoryQuery.value=getContext().object?.label||'';status('');},
    reset(){version++;conversationId=null;filterValue={};reply.replaceChildren();status('');}
  };
}
