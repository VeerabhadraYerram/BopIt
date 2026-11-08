import { formatProductPrice, safeProductUrl } from './product-display.js';
import { createShoppingTools } from './shopping-tools.js';
import { createCommerceTools, shoppingIdentity } from './commerce-tools.js';
import { searchPlan } from './contracts/profile.mjs';
const $ = s => document.querySelector(s);
const node = (tag, text, className) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; };
const sourceLabel = { visible: 'Seen in frame', caption: 'Caption claim', video_speech: 'Video speech claim', viewer_note: 'Viewer-provided · unverified', inferred: 'Inference · unverified' };
export function createInvestigator({ getCapture, crop, getSelected, getObjects = () => [] }) {
  let generation = 0, controller = null, selected = null, intent = 'exact', current = null;
  let lastRendered = { products: [], assessments: [] };
  const shopping = createShoppingTools(() => renderProducts(lastRendered.products,lastRendered.assessments),{openSeller:async product=>{const page=window.open('about:blank','_blank');if(!page)throw new Error('Allow the seller tab to open.');page.opener=null;try{const data=await api('commerce/details',{id:product.id,selection:Object.fromEntries((product.variants?.selected||[]).map(v=>[v.name,v.label])),config:market()});if(data.product.selectionChanges?.length)throw new Error('Saved variant changed. Inspect the listing before buying.');const url=safeProductUrl(data.product.purchaseUrl);if(!url)throw new Error('No current seller link is available.');page.location.replace(url);}catch(e){page.close();throw e;}}});
  const cache = new Map(), searches = new Map(), views = new Map();
  const commerce=createCommerceTools({api,getContext:()=>({capture:getCapture(),object:selected,profile:current?.profile,image:()=>selected?crop(selected.box):null}),getMarket:market,getObjects,onResults:products=>{renderProducts(products);$('#products-notice').textContent=`${products.length} catalog options. Review identity, configuration and seller facts. We may earn a commission from retailer links.`;},onRefine:changeSearch});
  function cancel() { lastRendered = { products: [], assessments: [] };generation++; controller?.abort(); controller = null; $('#search-products-btn').disabled = false; }
  function reset() { cancel(); cache.clear(); searches.clear(); views.clear(); selected = null; current = null; commerce.reset(); $('#profile-summary').replaceChildren(); $('#profile-evidence').replaceChildren(); $('#context-note').value = ''; $('#use-youtube').checked = false; }
  async function api(path, body, signal) {
    const { pairingToken } = await chrome.storage.local.get('pairingToken');
    if (!pairingToken) throw new Error('Open Settings → Connect local server first.');
    if(path.startsWith('commerce/')||['products/search','products/details','products/compare'].includes(path))body={...body,userId:await shoppingIdentity()};
    const response = await fetch(`http://127.0.0.1:4317/api/${path}`, { method: 'POST', headers: { 'content-type':'application/json','x-bopit-token':pairingToken }, body:JSON.stringify(body), signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed.');
    return data;
  }
  function context() {
    const c = getCapture(); const result = { timestamp: c?.source?.timestamp || 0, cues: c?.context?.cues || [], note: $('#context-note').value.trim() };
    if ($('#use-youtube').checked) {
      try { const url = new URL(c.source.documentUrl); if (['www.youtube.com','youtube.com'].includes(url.hostname) && /^[\w-]{11}$/.test(url.searchParams.get('v') || '')) result.youtubeUrl = `https://www.youtube.com/watch?v=${url.searchParams.get('v')}`; } catch { /* Not a public watch page */ }
    }
    return result;
  }
  function setContextInfo() {
    const c = getCapture(), cues = c?.context?.cues || [];
    $('#context-status').textContent = cues.length ? `${cues.length} nearby caption segments available. Captions may contain transcription errors.` : 'No accessible captions found. The frame alone contains no speech. Add relevant text below or use public YouTube context when supported.';
    let supported = false;
    try { const u = new URL(c?.source?.documentUrl); supported = ['www.youtube.com','youtube.com'].includes(u.hostname) && /^[\w-]{11}$/.test(u.searchParams.get('v') || ''); } catch { /* Upload */ }
    $('#youtube-option').hidden = !supported;
  }
  function renderProfile(record) {
    $('#profile-summary').replaceChildren(); $('#profile-evidence').replaceChildren();
    const p = record.profile;
    if (record.contextWarning) $('#profile-summary').append(node('p',record.contextWarning,'variant-warning'));
    const title = [p.identity.brand, p.identity.model].filter(Boolean).join(' ');
    $('#profile-summary').append(node('p', p.summary), node('div', title ? `Identity candidate: ${title}` : 'Exact identity not established', 'identity-status'), node('p', p.identity.basis || 'No reliable model identifier available.', 'muted'));
    if (p.useInScene) $('#profile-summary').append(node('p', `Use in this scene: ${p.useInScene}`));
    if (!record.contextUsed?.captions && !record.contextUsed?.youtubeRequested && !record.contextUsed?.viewerNote) $('#profile-summary').append(node('p', 'Visual analysis only · no speech context supplied', 'muted'));
    const details = node('details'); details.append(node('summary', `All extracted details & evidence (${p.attributes.length})`));
    const table = node('table'); const head = node('thead'), tr = node('tr'); ['Detail','Finding & evidence'].forEach(t => tr.append(node('th',t))); head.append(tr); table.append(head);
    const body = node('tbody');
    for (const a of p.attributes) { const row = node('tr'), cell = node('td'); cell.append(node('strong', a.value),node('small',`${sourceLabel[a.source]} · ${a.evidence}`)); row.append(node('td',`${a.group} / ${a.name}`),cell); body.append(row); }
    table.append(body); details.append(table);
    for (const [heading, values] of [['Relationships',p.relationships],['Unknown / needs verification',p.unknowns],['Conflicting evidence',p.contradictions]]) if (values.length) { details.append(node('h3',heading)); const ul=node('ul'); values.forEach(v=>ul.append(node('li',v)));details.append(ul); }
    $('#profile-evidence').append(details);
    if (p.spokenClaims.length) { const speech=node('details');speech.append(node('summary',`What the creator said (${p.spokenClaims.length})`));for(const c of p.spokenClaims)speech.append(node('p',`${c.timestamp} · ${c.claim}`),node('small',`${c.refersTo} · ${c.status}`));$('#profile-evidence').append(speech); }
  }
  async function select(object, force = false) {
    cancel(); const version = generation; controller = new AbortController(); const signal = controller.signal;
    selected = object; current = null; commerce.onSelect(); commerce.event('object_selected'); $('#profile-summary').replaceChildren(); $('#profile-evidence').replaceChildren(); $('#products-container').replaceChildren();
    setContextInfo(); $('#view-status').textContent = `${(views.get(object.id)||[]).length} / 2 additional views. Use clear images of the same item.`; $('#clear-views').hidden = !(views.get(object.id)||[]).length; $('#investigation-status').textContent = '1 · Inspecting selected object & available context…'; $('#products-notice').textContent = 'Product search follows the detailed object investigation.';
    const c = getCapture(), ctx = context(), additionalImages = views.get(object.id)||[], key = JSON.stringify([c.captureId, object, ctx, additionalImages]);
    try {
      let record = force ? null : cache.get(key);
      if (!record) {
        record = await api('profile', { label:object.label,image:crop(object.box),scene:c.image,context:ctx,additionalImages }, signal);
        if (version !== generation) return;
        cache.set(key, record);
      }
      if (version !== generation) return;
      current = { ...record, key, object };
      renderProfile(record); $('#investigation-status').textContent = '1 ✓ Object details extracted · 2 · Searching catalog…';
      await runSearch(version, signal, force);
    } catch (e) {
      if (version !== generation || e.name === 'AbortError') return;
      $('#investigation-status').textContent = e instanceof TypeError ? 'Cannot reach local server. Run npm start.' : `Detailed investigation unavailable: ${e.message}`;
      $('#profile-summary').append(node('p','You can still search the visible category. No exact identity established.','muted'));
      const fallback = [object.visibleText,object.label,...object.visibleAttributes].filter(Boolean).join(' ');
      $('#product-query').value = fallback;
      await manual(fallback, true);
    }
  }
  function market() { const [country,currency] = $('#market').value.split(':'); return { country,currency }; }
  async function runSearch(version, signal, force) {
    if (!current) return;
    const plan = searchPlan(current.profile,intent,$('#budget').value), config = market();
    plan.filters={...commerce.filters(),...plan.filters};
    const key = JSON.stringify([current.key,intent,$('#budget').value,config,plan.filters]);
    $('#product-query').value = plan.query; $('#products-notice').textContent = `Searching ${intent === 'exact' ? 'identity candidates' : intent === 'look' ? 'similar appearances' : 'functional alternatives'}…`;
    $('#search-products-btn').disabled = true;
    try {
      let data = force ? null : searches.get(key);
      if (!data) {
        const seed=current.exactSeed;
        data = intent==='look'&&seed ? await api('commerce/similar',{id:seed.id,filters:plan.filters,config},signal) : await api('products/search', { query:plan.query,image:plan.useImage ? crop(current.object.box) : undefined,limit:12,filters:plan.filters,config }, signal);
        if(intent==='exact'&&data.products?.length)current.exactSeed=data.products[0];
        if (version !== generation) return;
        searches.set(key,data);
      }
      if (version !== generation) return;
      if(intent==='exact'&&data.products?.length)current.exactSeed=data.products[0];
      current.results = data; current.searchKey = key; renderProducts(data.products || [], data.assessments || []);
      $('#investigation-status').textContent = '1 ✓ Details extracted · 2 ✓ Catalog searched';
      if (intent === 'exact' && data.products?.length && !data.assessments) await compareCandidates(version,signal);
    } catch (e) {
      if (version === generation && e.name !== 'AbortError') { $('#products-notice').textContent = e.message; $('#investigation-status').textContent = 'Object details ready · catalog search needs retry'; }
    } finally { if (version === generation) $('#search-products-btn').disabled = false; }
  }
  async function compareCandidates(version, signal) {
    const state = current;
    $('#investigation-status').textContent = '1 ✓ Details · 2 ✓ Catalog · 3 · Comparing identifiers & catalog evidence…';
    try {
      const data = await api('products/compare',{ image:crop(state.object.box),profile:state.profile,ids:state.results.products.slice(0,3).map(p=>p.id),config:market() },signal);
      if (version !== generation || current !== state) return;
      const detailed = new Map(data.products.map(p=>[p.id,p]));
      state.results.products = state.results.products.map(p=>detailed.get(p.id)||p);state.results.assessments=data.assessments;state.results.comparedImageIds=data.comparedImageIds||[];
      searches.set(state.searchKey,state.results);renderProducts(state.results.products,data.assessments);
      $('#investigation-status').textContent = '1 ✓ Details · 2 ✓ Catalog · 3 ✓ Catalog evidence compared';
    } catch(e) {
      if(version===generation&&e.name!=='AbortError') { $('#investigation-status').textContent = `Matches loaded · deeper comparison unavailable: ${e.message}`; }
    }
  }
  function renderProducts(products, assessments = []) {
    lastRendered = {products,assessments};
    $('#products-container').replaceChildren();
    let priceSorted=false;
    try { const prepared=shopping.prepare(products, current?.object || selected || {}, intent);products=prepared.products;priceSorted=prepared.priceSorted; }
    catch(e){$('#products-notice').textContent=e.message;return;}

    $('#products-notice').textContent = products.length ? `${products.length} ${intent==='exact'?'identity candidates':intent==='look'?'similar-looking products':intent==='cheaper'?'alternatives sorted by price (original price unknown)':'functional alternatives'}. Exact identity is not verified. We may earn a commission from retailer links.` : 'No catalog matches found. Try another intent, increase your budget, or edit the query. An absent listing does not mean the item does not exist.';
    const ratings = new Map(assessments.map(a=>[a.id,a]));
    const rank = { identifier_match:0,possible_match:1,similar:2,contradicted:3 };
    const relevance = p => (rank[ratings.get(p.id)?.verdict] ?? 2) * 100 + (ratings.get(p.id)?.differences.length || 0) * 3 + (intent === 'exact' && /bundle|with.*stand|w\/stand/i.test(p.title) ? 12 : 0);
    const ordered=priceSorted ? products : [...products].sort((a,b)=>relevance(a)-relevance(b));
    for(const product of ordered) {
      const card=node('article',undefined,'product-card');card.dataset.productId=product.id;
      const image=node('img',undefined,'product-thumb');image.alt=product.title;image.referrerPolicy='no-referrer';image.loading='lazy';
      const placeholder='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" rx="12" fill="%23dff1e7"/></svg>';
      image.src=safeProductUrl(product.image)||placeholder;image.addEventListener('error',()=>image.src=placeholder,{once:true});
      const info=node('div',undefined,'product-info');info.append(node('div',product.title,'product-title'),node('div',`${formatProductPrice(product.price,product.currency)} · ${product.retailer||product.brand||'Retailer'}`,'product-meta'));
      info.append(shopping.actions(product));
      const assessment=ratings.get(product.id);
      if(assessment){const labels={identifier_match:'Identifier agrees · variant not verified',possible_match:'Possible match',similar:'Similar product',contradicted:'Conflicting evidence'};info.append(node('div',labels[assessment.verdict],'match-label'));const evidence=node('details');evidence.append(node('summary','Why this result?'));for(const [name,values] of [['Matches',assessment.matches],['Differences',assessment.differences],['Unknown',assessment.unknowns]])if(values.length)evidence.append(node('p',`${name}: ${values.join(' · ')}`));evidence.append(node('small',current?.results?.comparedImageIds?.includes(product.id) ? 'AI compared the video crop with catalog photos and listing text. This is supporting evidence, not proof of exact identity.' : 'AI compared the video crop with catalog text. A catalog photo was unavailable for this comparison.'));info.append(evidence);if(assessment.differences.length)info.append(node('small',`Difference: ${assessment.differences[0]}`));}else {info.append(node('small',product.matchType || 'Unverified catalog candidate')); if(product.matchExplanation) {const why=node('details');why.append(node('summary','Why this result?'),node('p',product.matchExplanation));info.append(why);}}
      card.commerceProduct=product;info.append(commerce.productTools(()=>card.commerceProduct));
      card.checkoutAction=checkoutAction(() => card.checkoutSelection || { id: product.id },product);info.append(card.checkoutAction);
      const details=node('button','Specifications & variants','secondary');details.onclick=()=>showDetails(product,card,details);info.append(details);
      const url=safeProductUrl(product.purchaseUrl);if(url){const link=node('a','Buy from seller ↗','buy-button');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.addEventListener('click',()=>commerce.event('product_link',card.commerceProduct.id));info.append(link);}
      card.append(image,info);$('#products-container').append(card);
    }
  }
  function checkoutAction(selection, product) {
    const group=node('div',undefined,'sandbox-action'), button=node('button','Pay with PayPal','secondary'), note=node('small');
    let eligible=true;
    group.updateOffer=offer=>{
      const out=offer.availability==='OutOfStock'||offer.availability==='out_of_stock';
      const valid=offer.price!=null&&Number.isFinite(Number(offer.price))&&Number(offer.price)>0&&['USD','EUR','GBP','CAD','AUD'].includes(offer.currency);
      eligible=!out&&valid;button.disabled=!eligible;
      note.textContent=out?'Currently unavailable from this seller.':!valid?'See seller for pricing and purchase options.':'Review price and selected options before paying.';
    };
    group.updateOffer(product);
    button.dataset.action='sandbox-checkout';
    button.onclick=async()=>{
      // Open synchronously from the click; browsers block popups after await.
      const checkout=window.open('about:blank','_blank');
      if(!checkout){note.textContent='Allow this checkout tab to open, then try again.';return;}
      checkout.opener=null;button.disabled=true;note.textContent='Checking the selected listing and current catalog price…';
      try {
        const data=await api('payments/quotes',{...selection(),config:market()});
        const url=new URL(data.checkoutUrl);
        if(url.origin!=='http://127.0.0.1:4317'||url.pathname!=='/checkout')throw new Error('Invalid checkout address.');
        checkout.location.replace(url.href);
        note.textContent='Quote ready in the checkout tab. Your video stays here.';
      } catch(e){checkout.close();note.textContent=e.message||'Checkout unavailable. Try again.';}
      finally{button.disabled=!eligible;}
    };
    group.append(button,note);return group;
  }
  async function showDetails(product, card, button, selection = {}) {
    const old=card.querySelector('.catalog-details');if(old&&Object.keys(selection).length===0){old.hidden=!old.hidden;return;}
    const box=old||node('div',undefined,'catalog-details');if(!old)card.append(box);box.hidden=false;box.replaceChildren(node('p','Loading catalog specifications…'));button.disabled=true;
    try {
      const data=await api('products/details',{id:product.id,selection,config:market()},controller?.signal);if(!card.isConnected)return;
      const p=data.product;card.commerceProduct=p;card.checkoutAction?.updateOffer(p);card.checkoutSelection = { id: p.id, selection: Object.fromEntries((p.variants?.selected || []).map(v=>[v.name,v.label])) };box.replaceChildren(node('p','Source: Channel3 / merchant listing. These specifications describe this catalog product; identity with the video object is not established.','muted'));
      if(p.selectionChanges?.length)box.append(node('p',`Requested variant changed: ${p.selectionChanges.map(c=>`${c.name}: ${c.requested} → ${c.actual}`).join('; ')}. Review before continuing.`,'variant-warning'));
      box.append(node('p',p.description||'No description supplied.'));
      const dl=node('dl');for(const [k,v] of Object.entries(p.structuredAttributes||{})){dl.append(node('dt',k),node('dd',Array.isArray(v)?v.join(', '):String(v)));}box.append(dl);
      if(p.materials?.length)box.append(node('p',`Catalog materials: ${p.materials.join(', ')}`));if(p.keyFeatures?.length)box.append(node('p',`Catalog features: ${p.keyFeatures.join(' · ')}`));
      let measurements=false;for(const offer of p.offers||[]){if(offer.dimensions){measurements=true;box.append(node('p',`Measurements (${offer.retailer}): ${Object.entries(offer.dimensions).filter(([,v])=>v).map(([k,v])=>`${k}: ${v.number} ${v.unit}`).join(' · ')}`));}}
      if(!measurements)box.append(node('p','Dimensions / weight: not supplied by this listing.','muted'));
      const effective=Object.fromEntries((p.variants?.selected||[]).map(v=>[v.name,v.label]));
      for(const option of p.variants?.options||[]){const label=node('label',option.name),sel=node('select');for(const v of option.values||[]){const opt=node('option',`${v.label}${!v.exists?' · different combination':v.available==='OutOfStock'?' · out of stock':v.available==null?' · stock unknown':''}`);opt.value=v.label;opt.selected=effective[option.name]===v.label;sel.append(opt);}sel.onchange=()=>{const value=option.values.find(v=>v.label===sel.value);showDetails({...p,id:value?.product_id||p.id},card,button,{...effective,[option.name]:sel.value});};label.append(sel);box.append(label);}
      for(const offer of p.offers||[]){const url=safeProductUrl(offer.purchaseUrl);if(!url)continue;const a=node('a',`${offer.retailer} · ${formatProductPrice(offer.price,offer.currency)} · ${offer.availability||'Stock unknown'} ↗`);a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.addEventListener('click',()=>commerce.event('product_link',p.id));box.append(a);}
      box.append(node('small','Compatibility is advisory; confirm the specifications for your equipment. Unknown stock is not confirmed availability.'));
    }catch(e){if(e.name!=='AbortError')box.replaceChildren(node('p',e.message));}finally{button.disabled=false;}
  }
  async function manual(query, preserveProfile = false) {
    cancel();const version=generation;controller=new AbortController();const signal=controller.signal;query=(query||'').trim();
    if(!query){$('#products-notice').textContent='Enter a product query.';return;}
    $('#products-container').replaceChildren();$('#products-notice').textContent=`Searching Channel3 for “${query}”…`;$('#search-products-btn').disabled=true;
    try{const plan=searchPlan({category:query,queries:{exact:query}},'exact',$('#budget').value);const data=await api('products/search',{query,limit:12,filters:{...commerce.filters(),...plan.filters},config:market()},signal);if(version!==generation)return;renderProducts(data.products||[]);if(!preserveProfile)$('#investigation-status').textContent='Manual catalog search · not an identity verification';}
    catch(e){if(version===generation&&e.name!=='AbortError')$('#products-notice').textContent=e.message;}
    finally{if(version===generation)$('#search-products-btn').disabled=false;}
  }
  function changeSearch() { if(!current){if(selected)select(selected);return;}cancel();const version=generation;controller=new AbortController();$('#products-container').replaceChildren();runSearch(version,controller.signal,false); }
  for(const chip of document.querySelectorAll('[data-intent]'))chip.onclick=()=>{intent=chip.dataset.intent;document.querySelectorAll('[data-intent]').forEach(b=>b.setAttribute('aria-pressed',String(b===chip)));changeSearch();};
  let lastPreferences = JSON.stringify([$('#budget').value,$('#market').value]);
  function changePreferences() { const key = JSON.stringify([$('#budget').value,$('#market').value]); if (key === lastPreferences) return; lastPreferences = key; changeSearch(); }
  $('#budget').addEventListener('change',changePreferences);$('#market').addEventListener('change',changePreferences);
  $('#refresh-profile').onclick=()=>{const object=getSelected();if(object)select(object,true);};
  $('#additional-view').addEventListener('change',async event=>{
    const file=event.target.files[0],object=getSelected();if(!file||!object)return;
    try {
      if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024)throw new Error('Choose a PNG/JPEG/WebP under 8 MB.');
      const existing=views.get(object.id)||[];if(existing.length>=2)throw new Error('Two additional views already attached. Remove them to replace.');
      const bitmap=await createImageBitmap(file);
      try {if(bitmap.width<16||bitmap.height<16||bitmap.width*bitmap.height>16000000)throw new Error('Use a view between 16 pixels per side and 16 megapixels.');const c=document.createElement('canvas'),scale=Math.min(1,1024/Math.max(bitmap.width,bitmap.height));c.width=Math.max(16,Math.round(bitmap.width*scale));c.height=Math.max(16,Math.round(bitmap.height*scale));c.getContext('2d').drawImage(bitmap,0,0,c.width,c.height);views.set(object.id,[...existing,c.toDataURL('image/png')]);}
      finally{bitmap.close();}
      if(getSelected()?.id===object.id)select(object,true);
    }catch(e){$('#view-status').textContent=e.message;}finally{event.target.value='';}
  });
  $('#clear-views').onclick=()=>{const object=getSelected();if(object){views.delete(object.id);select(object,true);}};
  return { select, cancel, reset, searchManual:manual, snapshot:()=>[...cache.values()] };

}
