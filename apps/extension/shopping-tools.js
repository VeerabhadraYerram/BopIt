import { normalizeSavedProducts, toggleSavedProduct, compareSavedOffer, applySavedOffer, buildProductComparison, filterDiscoveryProducts, resolveBudgetMaximum, rankDiscoveryProducts } from './contracts/discovery.mjs';
import { formatProductPrice, safeProductUrl } from './product-display.js';
import { availableReplacementVariantValues, retrieveReplacementVariant, persistSavedOfferUpdate } from './saved-offer-recovery.mjs';
const $=s=>document.querySelector(s);
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
export function createShoppingTools(onChange, api, market, makeCheckoutAction, getCartContext = () => ({}),makePriceHistory) {
  let saved=[],ready=false,queue=Promise.resolve(),lastProducts=[],lastKey='';
  let cart=[],cartBusy=false;
  const catalog=new Map(),comparison=new Set(),pending=new Set();
  const initialized=chrome.storage.local.get('savedProducts').then(async data=>{
    saved=normalizeSavedProducts(data.savedProducts);ready=true;
    if(JSON.stringify(saved)!==JSON.stringify(data.savedProducts||[]))await chrome.storage.local.set({savedProducts:saved});
    renderSaved();syncButtons();
  }).catch(()=>{$('#wishlist-notice').textContent='Saved items could not be loaded. Reload before changing saved items.';});
  function syncButtons() {
    document.querySelectorAll('[data-save-product]').forEach(b=>{const id=b.dataset.saveProduct;b.textContent=saved.some(p=>p.id===id)?'Saved ♥':'♡ Save';b.setAttribute('aria-pressed',String(saved.some(p=>p.id===id)));b.disabled=pending.has(id);});
    document.querySelectorAll('[data-compare-product]').forEach(b=>{const id=b.dataset.compareProduct;b.textContent=comparison.has(id)?'Remove from comparison':'Compare';b.setAttribute('aria-pressed',String(comparison.has(id)));b.disabled=!comparison.has(id)&&comparison.size>=3;});
    $('#saved-count').textContent=String(saved.length);
  }
  const cartPanel=el('section',undefined,'panel cart-panel');cartPanel.id='cart-panel';cartPanel.hidden=true;
  const cartList=el('div'),cartReview=el('div');cartReview.id='cart-review';
  const cartStatus=el('p','Prices are refreshed before payment.','muted');cartStatus.setAttribute('role','status');
  const cartToggle=el('button','Cart · 0','secondary');cartToggle.id='cart-toggle';cartToggle.setAttribute('aria-live','polite');cartToggle.setAttribute('aria-pressed','false');cartToggle.onclick=()=>{const page=document.body.dataset.workspace==='cart'?'explore':'cart';window.dispatchEvent(new CustomEvent('bopit:navigate',{detail:page}));if(page==='cart')renderCart();};
  $('header nav').prepend(cartToggle);
  async function updateCart(action,fields={}) {
    const result=await chrome.runtime.sendMessage({type:'BOPIT_CART',action,...fields});if(result?.error)throw new Error(result.error);
    cart=result.cart||[];renderCart();return cart;
  }
  function cartPayload(){return cart.map(({id,selection,websiteIds,expectedOffer,quantity})=>({id,selection,websiteIds,expectedOffer,quantity}));}
  function renderCart(){
    reviewCart.disabled=cartBusy||!cart.length;payCart.disabled=cartBusy||!cart.length;
    cartToggle.textContent=`Cart · ${cart.reduce((n,item)=>n+item.quantity,0)}`;cartList.replaceChildren();cartReview.replaceChildren();
    if(!cart.length){cartList.append(el('p','Your cart is empty. Add a product to keep exploring.'));return;}
    const totals=new Map();
    for(const item of cart){const row=el('article',undefined,'cart-line');row.append(el('strong',item.title),el('small',`${item.retailer||'Seller'} · ${Object.entries(item.selection||{}).map(([k,v])=>`${k}: ${v}`).join(' · ')||'Default variant'}`),el('p',formatProductPrice(item.price,item.currency)));
      if(item.price!=null&&item.currency)totals.set(item.currency,(totals.get(item.currency)||0)+Math.round(item.price*100)*item.quantity);
      const qty=document.createElement('select');for(let n=1;n<=10;n++)qty.add(new Option(String(n),String(n)));qty.value=String(item.quantity);qty.setAttribute('aria-label',`Quantity for ${item.title}`);qty.onchange=()=>updateCart('quantity',{key:item.key,quantity:Number(qty.value)}).catch(e=>cartStatus.textContent=e.message);row.append(qty);
      const remove=el('button','Remove','secondary');remove.onclick=()=>updateCart('remove',{key:item.key}).catch(e=>cartStatus.textContent=e.message);row.append(remove);
      const source=item.source?.url;try{const url=new URL(source);if(['http:','https:'].includes(url.protocol)){if(item.source.timestamp)url.searchParams.set('t',String(Math.floor(item.source.timestamp)));const link=el('a','Back to this moment ↗');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';row.append(link);}}catch{}
      if(makePriceHistory)row.append(makePriceHistory(item));cartList.append(row);
    }
    for(const [currency,cents]of totals)cartList.append(el('p',`${formatProductPrice(cents/100,currency)} · estimated item subtotal`));
    if(totals.size>1)cartList.append(el('p','A single payment requires items in one currency.','variant-warning'));
  }
  const reviewCart=el('button','Review current prices','secondary');reviewCart.id='review-cart';reviewCart.onclick=async()=>{
    if(cartBusy||!cart.length)return;cartBusy=true;reviewCart.disabled=true;cartStatus.textContent='Checking current prices, variants and availability…';
    try{const reviewed=await Promise.all(cart.map(async item=>({item,product:(await api('products/details',{id:item.id,selection:item.selection,websiteIds:item.websiteIds,config:market()})).product})));
      const updates=[];let blocked=false;cartReview.replaceChildren();
      for(const line of reviewed){
        const offer=line.product.offers?.find(offer=>line.item.websiteIds?.includes(offer.retailer));
        if(!offer||line.product.selectionChanges?.length){blocked=true;cartReview.append(el('p',`${line.product.title}: the selected seller or variant changed. Remove and re-add your intended option.`,'variant-warning'));continue;}
        cartReview.append(el('p',`${line.product.title} × ${line.item.quantity}: ${formatProductPrice(offer.price,offer.currency)} · ${offer.retailer} · ${offer.availability||'Availability unknown'}`));
        const snapshot=Object.fromEntries(['retailer','price','currency','condition','availability','purchaseUrl'].map(key=>[key,offer[key]??null]));
        if(Object.keys(snapshot).some(key=>snapshot[key]!==((line.item.expectedOffer||{})[key]??null)))updates.push({key:line.item.key,offer:snapshot});
        if(['OutOfStock','out_of_stock'].includes(offer.availability))blocked=true;
      }
      if(updates.length&&!blocked){const accept=el('button','Use these updated prices','secondary');accept.id='accept-cart-prices';accept.onclick=async()=>{accept.disabled=true;try{await updateCart('refresh-offers',{items:updates});cartStatus.textContent='Updated prices saved. Your quantities and video links are unchanged. Checkout will verify them again.';}catch(error){cartStatus.textContent=error.message;accept.disabled=false;}};cartReview.append(accept);}
      payCart.disabled=blocked||updates.length>0;
      cartStatus.textContent=blocked?'A seller, variant or availability changed. Review the affected item before paying.':updates.length?'Prices or seller details changed. Review them, then choose Use these updated prices.':'Current seller prices and variants are unchanged. You can continue to payment.';
    }catch(e){cartStatus.textContent=e.message;}finally{cartBusy=false;reviewCart.disabled=false;}
  };
  const payCart=el('button','Continue with PayPal');payCart.id='pay-cart';payCart.onclick=async()=>{
    if(cartBusy||!cart.length)return;const page=window.open('about:blank','_blank');if(!page){cartStatus.textContent='Allow the checkout tab, then try again.';return;}
    page.opener=null;cartBusy=true;payCart.disabled=true;cartStatus.textContent='Preparing a fresh itemized quote…';
    try{const data=await api('payments/quotes',{items:cartPayload(),config:market()});const url=new URL(data.checkoutUrl);if(url.origin!=='http://127.0.0.1:4317'||url.pathname!=='/checkout')throw new Error('Invalid checkout address.');page.location.replace(url.href);cartStatus.textContent='Review the fresh itemized quote before approving payment.';}
    catch(e){page.close();cartStatus.textContent=e.message;}finally{cartBusy=false;payCart.disabled=false;}
  };
  cartPanel.append(el('h2','Your cart'),cartStatus,cartList,reviewCart,cartReview,payCart);$('main').prepend(cartPanel);
  updateCart('read').catch(e=>cartStatus.textContent=e.message);
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.bopitCart){cart=changes.bopitCart.newValue||[];renderCart();}});
  async function save(product) {
    if(pending.has(product.id))return;pending.add(product.id);syncButtons();
    try {await initialized;if(!ready)throw new Error('Saved items are unavailable');
      const savedProduct={...product,variantSelection:product.variantSelection||Object.fromEntries((product.variants?.selected||[]).map(v=>[v.name,v.label]))};
      const next=queue.then(async()=>{const updated=toggleSavedProduct(saved,savedProduct);await chrome.storage.local.set({savedProducts:updated});saved=updated;});queue=next.catch(()=>{});await next;renderSaved();
    }catch(e){$('#wishlist-notice').textContent=`Could not save: ${e.message}`;}
    finally{pending.delete(product.id);syncButtons();}
  }
  async function persistSavedOffer(product, current, offer, result) {
    const next=queue.then(async()=>{
      saved=await persistSavedOfferUpdate(saved,product,current,offer,updated=>chrome.storage.local.set({savedProducts:updated}),applySavedOffer);
    });
    queue=next.catch(()=>{});
    try { await next; renderSaved(); }
    catch(error) { result.append(el('p',`Could not save the selected offer: ${error.message}`,'variant-warning')); throw error; }
  }
  function renderCurrentOffers(product,current,result,variantSwitch=false) {
    const same=compareSavedOffer(product,current).status==='current'&&!variantSwitch;
    const variantSummary=(current.variants?.selected||[]).map(item=>`${item.name}: ${item.label}`).join(' · ');
    result.append(el('p',same?'The saved seller offer still matches the current catalog details.':'The saved offer or variant changed. Review an offer below; BopIt will not switch sellers or variants automatically.',same?'muted':'variant-warning'));
    if(variantSwitch)result.append(el('p',`Channel3 confirmed this variant: ${variantSummary}. Nothing has been saved yet.`,'muted'));
    for(const offer of current.offers||[]) {
      const row=el('div',undefined,'seller-offer');
      row.append(el('span',`${offer.retailer||'Seller not supplied'} · ${formatProductPrice(offer.price,offer.currency)} · ${offer.condition||'Condition unknown'} · ${offer.availability||'Availability unknown'}`));
      const url=safeProductUrl(offer.purchaseUrl);
      if(url){const link=el('a','View seller ↗');link.href=url;link.target='_blank';link.rel='noopener noreferrer';row.append(link);}
      if(offer.retailer) {
        const confirm=el('button',variantSwitch?`Confirm variant & use ${offer.retailer}`:`Confirm and use ${offer.retailer}`,'secondary');
        confirm.dataset.confirmSavedOffer='true';
        confirm.onclick=async()=>{
          const changedSeller=offer.retailer!==product.retailer;
          const effectiveVariant=Object.fromEntries((current.variants?.selected||[]).map(v=>[v.name,v.label]));
          const changedVariant=JSON.stringify(product.variantSelection||{})!==JSON.stringify(effectiveVariant);
          const summary=`Update saved product to ${variantSwitch||changedVariant?`${variantSummary||'the confirmed replacement variant'} and `:''}${offer.retailer} at ${formatProductPrice(offer.price,offer.currency)} · ${offer.availability||'availability unknown'}${offer.condition?` · ${offer.condition}`:''}${changedSeller?` instead of ${product.retailer||'the saved seller'}`:''}?`;
          if(!window.confirm(summary)||pending.has(product.id))return;
          pending.add(product.id);result.querySelectorAll('[data-confirm-saved-offer]').forEach(button=>{button.disabled=true;});
          try { await persistSavedOffer(product,current,offer,result); }
          catch { result.querySelectorAll('[data-confirm-saved-offer]').forEach(button=>{button.disabled=false;}); }
          finally { pending.delete(product.id);syncButtons(); }
        };
        row.append(confirm);
      }
      result.append(row);
    }
    if(!(current.offers||[]).length)result.append(el('p','Channel3 did not return current seller offers. No replacement is available.','muted'));
  }
  function renderVariantRecovery(product,substitutedProduct,result) {
    const options=substitutedProduct.variants?.options||[];
    result.append(el('p',`Saved variant unavailable or substituted: ${substitutedProduct.selectionChanges.map(v=>`${v.name}: ${v.requested} → ${v.actual}`).join('; ')}. No alternative was selected.`,'variant-warning'));
    if(!options.length) {
      result.append(el('p','Channel3 did not supply replacement variant options. The saved variant cannot be changed here.','muted'));
      return;
    }
    const controls=el('div',undefined,'saved-variant-controls'),selects=new Map();
    for(const option of options) {
      const label=el('label',option.name),select=document.createElement('select');
      select.add(new Option(`Choose ${option.name}…`,''));
      for(const value of availableReplacementVariantValues(option)) {
        const stock=value.available==='InStock'?' · in stock':' · stock unknown';
        select.add(new Option(`${value.label}${stock}`,value.label));
      }
      selects.set(option.name,select);
      label.append(select);controls.append(label);
    }
    const review=el('button','Review selected variant','secondary'),status=el('p','Choose every available option, then review the current seller offers.','muted');
    review.type='button';
    review.onclick=async()=>{
      review.disabled=true;selects.forEach(select=>{select.disabled=true;});
      status.textContent='Refreshing details and offers for the explicitly selected variant…';
      try {
        const selectedValues=Object.fromEntries([...selects].map(([name,select])=>[name,select.value]));
        const current=await retrieveReplacementVariant({product:substitutedProduct,selectedValues,api,config:market()});
        result.replaceChildren(el('p','Replacement variant and current offers were re-fetched. Nothing has been saved; choose an offer and confirm the update.','muted'));
        renderCurrentOffers(product,current,result,true);
      } catch(error) {
        status.textContent=`Could not verify replacement variant: ${error.message}`;
        review.disabled=false;selects.forEach(select=>{select.disabled=false;});
      }
    };
    result.append(controls,review,status);
  }
  async function refreshSaved(product, result) {
    if(!api){result.textContent='Offer refresh is unavailable in this extension session.';return;}
    result.replaceChildren(el('p','Refreshing saved product and current seller offers…','muted'));
    try {
      const data=await api('products/details',{id:product.id,selection:product.variantSelection||{},config:market()});
      const current=data.product;
      if(current.selectionChanges?.length) {
        result.replaceChildren();
        renderVariantRecovery(product,current,result);
        return;
      }
      result.replaceChildren();
      renderCurrentOffers(product,current,result);
    } catch(error) {
      result.replaceChildren(el('p',`Offer refresh failed: ${error.message}`,'variant-warning'));
    }
  }
  function renderSaved() {
    const target=$('#wishlist-container');target.replaceChildren();$('#wishlist-notice').textContent=saved.length?`${saved.length} product${saved.length===1?'':'s'} saved on this device. Prices and availability may have changed.`:'Save products you want to revisit. Saved products stay on this device.';
    for(const product of saved){
      const card=el('article',undefined,'wishlist-item');
      card.append(el('strong',product.title||'Saved product'),el('small',`${formatProductPrice(product.price,product.currency)} · ${product.retailer||'Seller unknown'} · ${product.availability||'Availability unknown'}`));
      const url=safeProductUrl(product.purchaseUrl);if(url){const link=el('a','View retailer ↗');link.href=url;link.target='_blank';link.rel='noopener noreferrer';card.append(link);}
      const more=el('details',undefined,'saved-more');more.append(el('summary','More options'));card.append(more);
      if(makeCheckoutAction)more.append(makeCheckoutAction(product));
      const refresh=el('button','Refresh offers','secondary'),result=el('div',undefined,'saved-offer-refresh');
      refresh.onclick=()=>{refresh.disabled=true;refreshSaved(product,result).finally(()=>{refresh.disabled=false;});};
      const remove=el('button','Remove','secondary');remove.onclick=()=>save(product);
      more.append(refresh,remove);if(makePriceHistory)card.append(makePriceHistory(product));card.append(result);target.append(card);
    }
    syncButtons();
  }
  function renderComparison() {
    const products=[...comparison].map(id=>catalog.get(id)).filter(Boolean),panel=$('#comparison-panel'),target=$('#comparison-container');panel.hidden=!products.length;target.replaceChildren();if(!products.length)return;
    const data=buildProductComparison(products);$('#comparison-notice').textContent=data.pricesComparable?'Prices use one supplied currency. Retailer totals may differ.':'Different or missing currencies: prices are not directly comparable. No currency conversion is applied.';
    const table=el('table',undefined,'comparison-table'),head=el('tr');head.append(el('th','Detail'));for(const p of products){const th=el('th',p.title),remove=el('button','Remove','secondary');remove.onclick=()=>{comparison.delete(p.id);renderComparison();syncButtons();};th.append(remove);head.append(th);}const thead=el('thead');thead.append(head);table.append(thead);
    const body=el('tbody');for(const [label,value] of [['Price',p=>formatProductPrice(p.price,p.currency)],['Brand',p=>p.brand||'Not supplied'],['Retailer',p=>p.retailer||'Not supplied'],['Availability',p=>p.availability||'Not supplied'],['Category',p=>p.category||'Not supplied'],['Attributes',p=>p.attributes?.join(' · ')||p.condition||'Not supplied']]){const row=el('tr');row.append(el('th',label));products.forEach(p=>row.append(el('td',value(p))));body.append(row);}table.append(body);target.append(table);
  }
  function actions(product,getSelection=()=>({id:product.id,selection:product.variantSelection||Object.fromEntries((product.variants?.selected||[]).map(v=>[v.name,v.label])),websiteIds:product.retailer?[product.retailer]:[]})) {
    catalog.set(product.id,product);const row=el('div',undefined,'product-actions');const add=el('button','Add to cart','secondary');add.dataset.action='add-to-cart';add.onclick=async()=>{try{const chosen={...getSelection()};if(!chosen.websiteIds?.length)delete chosen.expectedOffer;const snapshot=chosen.expectedOffer;await updateCart('add',{item:{...chosen,title:product.title,price:snapshot?.price??product.price,currency:snapshot?.currency??product.currency,retailer:snapshot?.retailer||product.retailer,source:getCartContext()}});add.textContent='Added ✓';}catch(e){cartStatus.textContent=e.message;}};row.append(add);const saveButton=el('button','Save product','save-product secondary');saveButton.dataset.saveProduct=product.id;saveButton.onclick=()=>save(product);
    const compareButton=el('button','Compare sellers','compare-product secondary');compareButton.dataset.compareProduct=product.id;compareButton.onclick=()=>{if(comparison.has(product.id))comparison.delete(product.id);else if(comparison.size<3)comparison.add(product.id);renderComparison();syncButtons();};row.append(saveButton,compareButton);queueMicrotask(syncButtons);return row;
  }
  function prepare(products,selection,mode,{ignoreListingFilters=false}={}) {
    if(ignoreListingFilters){products.forEach(p=>catalog.set(p.id,p));return {products,priceSorted:false};}
    lastProducts=products;products.forEach(p=>catalog.set(p.id,p));const key=products.map(p=>`${p.id}:${p.price}:${p.currency}`).join('|');
    if(key!==lastKey){lastKey=key;for(const [selector,values,caption] of [['#budget-currency',[...new Set(products.map(p=>p.currency).filter(Boolean))],'Any currency'],['#brand-filter',[...new Set(products.map(p=>p.brand).filter(Boolean))],'Any brand']]){const input=$(selector),old=input.value;input.replaceChildren(new Option(caption,''));values.sort().forEach(v=>input.add(new Option(v,v)));input.value=values.includes(old)?old:'';}}
    const maxPrice=resolveBudgetMaximum(products,$('#budget-preset').value,$('#budget-currency').value,$('#budget-filter').value);
    const filtered=filterDiscoveryProducts(products,{maxPrice,currency:$('#budget-currency').value,brand:$('#brand-filter').value});
    const sort=$('#product-sort').value==='auto'?(mode==='cheaper'?'price-asc':'relevance'):$('#product-sort').value;
    const ranked=rankDiscoveryProducts(filtered,selection,mode==='look'?'similar':mode==='function'?'similar':mode,sort);
    return {products:ranked,priceSorted:sort!=='relevance'};
  }
  for(const selector of ['#budget-preset','#budget-filter','#budget-currency','#brand-filter','#product-sort'])$(selector).addEventListener('change',()=>{ $('#budget-custom-controls').hidden=$('#budget-preset').value!=='custom';onChange();});
  return {actions,prepare,ready:initialized};
}
