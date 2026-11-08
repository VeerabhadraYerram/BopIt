import { normalizeSavedProducts, toggleSavedProduct, buildProductComparison, filterDiscoveryProducts, resolveBudgetMaximum, rankDiscoveryProducts } from './contracts/discovery.mjs';
import { formatProductPrice, safeProductUrl } from './product-display.js';
const $=s=>document.querySelector(s);
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
export function createShoppingTools(onChange,{openSeller}={}) {
  let saved=[],ready=false,queue=Promise.resolve(),lastProducts=[],lastKey='';
  const catalog=new Map(),comparison=new Set(),pending=new Set();
  const initialized=chrome.storage.local.get('savedProducts').then(async data=>{
    saved=normalizeSavedProducts(data.savedProducts);ready=true;
    if(JSON.stringify(saved)!==JSON.stringify(data.savedProducts||[]))await chrome.storage.local.set({savedProducts:saved});
    renderSaved();syncButtons();
  }).catch(()=>{$('#wishlist-notice').textContent='Saved items could not be loaded. Reload before changing saved items.';});
  function syncButtons() {
    document.querySelectorAll('[data-save-product]').forEach(b=>{const id=b.dataset.saveProduct;b.textContent=saved.some(p=>p.id===id)?'Saved ♥':'Save ♡';b.setAttribute('aria-pressed',String(saved.some(p=>p.id===id)));b.disabled=pending.has(id);});
    document.querySelectorAll('[data-compare-product]').forEach(b=>{const id=b.dataset.compareProduct;b.textContent=comparison.has(id)?'Remove comparison':'Compare';b.setAttribute('aria-pressed',String(comparison.has(id)));b.disabled=!comparison.has(id)&&comparison.size>=3;});
    $('#saved-count').textContent=String(saved.length);
  }
  async function save(product) {
    if(pending.has(product.id))return;pending.add(product.id);syncButtons();
    try {await initialized;if(!ready)throw new Error('Saved items are unavailable');
      const next=queue.then(async()=>{const updated=toggleSavedProduct(saved,product);await chrome.storage.local.set({savedProducts:updated});saved=updated;});queue=next.catch(()=>{});await next;renderSaved();
    }catch(e){$('#wishlist-notice').textContent=`Could not save: ${e.message}`;}
    finally{pending.delete(product.id);syncButtons();}
  }
  function renderSaved() {
    const target=$('#wishlist-container');target.replaceChildren();$('#wishlist-notice').textContent=saved.length?`${saved.length} saved on this device. Prices may have changed.`:'Save a find to come back to it.';
    for(const product of saved){const card=el('article',undefined,'wishlist-item');card.append(el('strong',product.title||'Saved product'),el('small',formatProductPrice(product.price,product.currency)));const url=safeProductUrl(product.purchaseUrl);if(url){const link=el('a','View retailer ↗');link.href=url;link.target='_blank';link.rel='noopener noreferrer';if(openSeller)link.onclick=event=>{event.preventDefault();openSeller(product).catch(e=>$('#wishlist-notice').textContent=e.message);};card.append(link);}const remove=el('button','Remove','secondary');remove.onclick=()=>save(product);card.append(remove);target.append(card);}syncButtons();
  }
  function renderComparison() {
    const products=[...comparison].map(id=>catalog.get(id)).filter(Boolean),panel=$('#comparison-panel'),target=$('#comparison-container');panel.hidden=!products.length;target.replaceChildren();if(!products.length)return;
    const data=buildProductComparison(products);$('#comparison-notice').textContent=data.pricesComparable?'Prices use one supplied currency. Retailer totals may differ.':'Different or missing currencies: prices are not directly comparable. No currency conversion is applied.';
    const table=el('table',undefined,'comparison-table'),head=el('tr');head.append(el('th','Detail'));for(const p of products){const th=el('th',p.title),remove=el('button','Remove','secondary');remove.onclick=()=>{comparison.delete(p.id);renderComparison();syncButtons();};th.append(remove);head.append(th);}const thead=el('thead');thead.append(head);table.append(thead);
    const body=el('tbody');for(const [label,value] of [['Price',p=>formatProductPrice(p.price,p.currency)],['Brand',p=>p.brand||'Not supplied'],['Retailer',p=>p.retailer||'Not supplied'],['Availability',p=>p.availability||'Not supplied'],['Category',p=>p.category||'Not supplied'],['Attributes',p=>p.attributes?.join(' · ')||p.condition||'Not supplied']]){const row=el('tr');row.append(el('th',label));products.forEach(p=>row.append(el('td',value(p))));body.append(row);}table.append(body);target.append(table);
  }
  function actions(product) {
    catalog.set(product.id,product);const row=el('div',undefined,'product-actions');const saveButton=el('button','Save ♡','save-product secondary');saveButton.dataset.saveProduct=product.id;saveButton.onclick=()=>save(product);
    const compareButton=el('button','Compare','compare-product secondary');compareButton.dataset.compareProduct=product.id;compareButton.onclick=()=>{if(comparison.has(product.id))comparison.delete(product.id);else if(comparison.size<3)comparison.add(product.id);renderComparison();syncButtons();};row.append(saveButton,compareButton);queueMicrotask(syncButtons);return row;
  }
  function prepare(products,selection,mode) {
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
