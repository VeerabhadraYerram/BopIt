import {formatProductPrice} from './product-display.js';
const make=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
export function createInlineCheckout(api){
 const panel=make('section',undefined,'inline-checkout panel');panel.id='inline-checkout';panel.hidden=true;panel.setAttribute('aria-label','Review and pay');document.querySelector('main').prepend(panel);
 const storageKey='bopitInlinePayment';let lastData=null,finished=false;
 let order=null,quote=null,popup=null,busy=false,timer=null,generation=0;const heading=make('h2','Review your order'),close=make('button','← Back','secondary'),items=make('div'),total=make('strong'),notice=make('p','PayPal Sandbox · test payment. No retailer order or shipment is created.','muted'),status=make('p');status.setAttribute('role','status');const pay=make('button','Continue with PayPal'),retry=make('button','Check payment status','secondary');retry.hidden=true;
 const head=make('div',undefined,'panel-heading');head.append(close,heading);const cancel=make('button','Cancel checkout','secondary');cancel.hidden=true;panel.append(head,items,total,notice,status,pay,retry,cancel);
 const hide=()=>{panel.hidden=true;delete document.body.dataset.checkoutOpen;generation++;clearTimeout(timer);};close.onclick=hide;document.querySelectorAll('[data-workspace-link]').forEach(button=>button.addEventListener('click',hide));window.addEventListener('bopit:navigate',hide);
 const persist=()=>chrome.storage.session.set({[storageKey]:{order,quote,popup,data:lastData}});
 const endpoint=suffix=>`payments/orders${suffix}?quote=${encodeURIComponent(quote)}`;
 async function check(version,attempt=0){
  if(!order||version!==generation)return;
  try{
   const result=await api(endpoint(`/${encodeURIComponent(order)}/status`),{});if(version!==generation)return;
   if(result.state==='success'){await receipt(result);return;}
   if(result.approved){status.textContent='Confirming your payment…';const captured=await api(endpoint(`/${encodeURIComponent(order)}/capture`),{});if(version!==generation)return;if(captured.state==='success'){await receipt(captured);return;}}
   if(result.state==='failed'){status.textContent=result.message||'This payment could not be completed.';retry.hidden=false;return;}
   const state=popup?await chrome.runtime.sendMessage({type:'BOPIT_APPROVAL_STATE',windowId:popup}):{closed:true};
   if(state.closed){status.textContent='The approval window closed. Check status before trying another payment.';retry.hidden=false;return;}
   if(attempt>=60){status.textContent='Approval is still pending. You can check again when ready.';retry.hidden=false;return;}
   timer=setTimeout(()=>check(version,attempt+1),3000);
  }catch(error){if(version===generation){status.textContent=error.message;retry.hidden=false;}}
 }
 async function receipt(result){
  if(!result.verified||!result.captureId)throw new Error('PayPal has not verified this receipt.');
  finished=true;clearTimeout(timer);status.textContent=`Payment confirmed · Receipt ${result.captureId}`;pay.hidden=true;retry.hidden=true;cancel.hidden=true;heading.textContent='Your receipt';await chrome.storage.session.remove(storageKey);
  if(popup)await chrome.runtime.sendMessage({type:'BOPIT_CLOSE_APPROVAL',windowId:popup});popup=null;
 }
 pay.onclick=async()=>{if(busy)return;busy=true;pay.disabled=true;status.textContent='Preparing secure PayPal approval…';
  try{if(!order){const data=await api(endpoint(''),{checkoutId:crypto.randomUUID()});order=data.orderId;await persist();const opened=await chrome.runtime.sendMessage({type:'BOPIT_APPROVE_PAYMENT',url:data.approveUrl});if(!opened?.windowId)throw new Error(opened?.error||'Could not open PayPal approval. Check the payment status before retrying.');popup=opened.windowId;await persist();}
   status.textContent='Approve in the PayPal window. Your receipt will appear here.';retry.hidden=false;cancel.hidden=false;check(generation);
  }catch(error){status.textContent=error.message;retry.hidden= !order;}finally{busy=false;pay.disabled=false;if(order)pay.hidden=true;}
 };
 retry.onclick=()=>{clearTimeout(timer);check(generation);};
 cancel.onclick=async()=>{if(busy||!order)return;busy=true;cancel.disabled=true;const version=++generation;clearTimeout(timer);try{if(popup)await chrome.runtime.sendMessage({type:'BOPIT_CLOSE_APPROVAL',windowId:popup});const result=await api(endpoint(`/${encodeURIComponent(order)}/status`),{});if(result.state==='success'){await receipt(result);return;}if(result.approved){status.textContent='This payment was already approved. Confirming its status…';check(version);return;}await chrome.storage.session.remove(storageKey);order=null;quote=null;popup=null;lastData=null;panel.hidden=true;delete document.body.dataset.checkoutOpen;}catch(error){status.textContent=error.message;retry.hidden=false;}finally{busy=false;cancel.disabled=false;}};
 async function show(data,resume=false){
  if(!resume)await ready;
  if(!resume&&order&&!finished&&lastData){data=lastData;resume=true;}
  generation++;clearTimeout(timer);panel.hidden=false;document.body.dataset.checkoutOpen='true';heading.textContent='Review your order';items.replaceChildren();
  const product=data.product;for(const line of product.items||[{name:product.name,quantity:1,price:product.price,currency:product.currency}])items.append(make('p',`${line.name} × ${line.quantity} · ${formatProductPrice(Number(line.price),line.currency)}`));
  total.textContent=`Total ${formatProductPrice(Number(product.price),product.currency)}`;status.textContent='Review the item, quantity and total before continuing.';pay.hidden=false;pay.disabled=false;retry.hidden=true;cancel.hidden=true;
  if(!resume){finished=false;lastData=data;const url=new URL(data.checkoutUrl);if(url.origin!=='http://127.0.0.1:4317'||url.pathname!=='/checkout'||!url.searchParams.get('quote'))throw new Error('Invalid checkout quote.');quote=url.searchParams.get('quote');order=null;popup=null;}
  if(resume){pay.hidden=true;retry.hidden=false;cancel.hidden=false;status.textContent='A previous payment is awaiting confirmation. Check its status before starting another payment.';}
  panel.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});close.focus({preventScroll:true});
 }
 const ready=chrome.storage.session.get(storageKey).then(async stored=>{const pending=stored[storageKey];if(pending?.order&&pending?.quote&&pending?.data){order=pending.order;quote=pending.quote;popup=pending.popup;lastData=pending.data;await show(lastData,true);check(generation);}}).catch(()=>{});
 return {show};
}
