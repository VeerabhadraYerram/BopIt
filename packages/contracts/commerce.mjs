export const catalogId=value=>text(value,160,/^[A-Za-z0-9_-]+$/,'product ID');
export function text(value,max=2000,pattern=null,label='text') {
  if(typeof value!=='string'||!value.trim()||value.length>max||(pattern&&!pattern.test(value)))throw new Error(`Invalid ${label}.`);return value.trim();
}
export function identity(value){return value==null?undefined:text(value,128,/^[A-Za-z0-9._@-]+$/,'attribution ID');}
export function selection(value={}) {
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>12)throw new Error('Invalid variant selection.');
  return Object.fromEntries(Object.entries(value).map(([k,v])=>[text(k,100),text(v,160)]));
}
const countries=['US','GB','EU','AU','CA','IE','DE','AT','FR','BE','IT','ES','NL','SE','FI','PT','CZ','GR','RO'];
const currencies=['USD','CAD','AUD','GBP','EUR','SEK','CZK','RON'];
export function locale(value={}){
  const result={country:'US',currency:'USD'};
  if(value.country){if(!countries.includes(value.country))throw new Error('Unsupported catalog market.');result.country=value.country;}
  if(value.currency){if(!currencies.includes(value.currency))throw new Error('Unsupported catalog currency.');result.currency=value.currency;}
  if(value.mode){if(!['default','agentic'].includes(value.mode))throw new Error('Invalid search mode.');result.mode=value.mode;}
  return result;
}
export function filters(value={}){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid search filters.');
  const out={};
  for(const key of ['brand_ids','category_ids','website_ids','exclude_brand_ids','exclude_category_ids','exclude_website_ids'])if(value[key]!=null){if(!Array.isArray(value[key])||value[key].length>12)throw new Error('Invalid filter list.');out[key]=value[key].map(v=>text(v,160,/^[a-zA-Z0-9_.-]+$/,'filter'));}
  if(value.price){out.price={};for(const key of ['min_price','max_price'])if(value.price[key]!=null){const n=Number(value.price[key]);if(!Number.isFinite(n)||n<0||n>1000000)throw new Error('Invalid price filter.');out.price[key]=n;}if(out.price.min_price>out.price.max_price)throw new Error('Invalid price range.');}
  for(const [key,allowed] of [['conditions',['new','used']],['availability',['InStock','OutOfStock']]])if(value[key]){if(!Array.isArray(value[key])||!value[key].length||value[key].some(v=>!allowed.includes(v)))throw new Error(`Invalid ${key}.`);out[key]=value[key];}
  if(value.gender){if(!['male','female'].includes(value.gender))throw new Error('Invalid clothing preference.');out.gender=value.gender;}
  if(value.sale){if(value.sale!=='on_sale')throw new Error('Invalid sale filter.');out.sale=value.sale;}
  if(value.colors){if(!Array.isArray(value.colors.palette)||!value.colors.palette.length||value.colors.palette.length>5)throw new Error('Invalid palette.');out.colors={palette:value.colors.palette.map(c=>{const hex=text(c.hex,7,/^#[a-fA-F0-9]{6}$/,'color');if(c.percentage!=null&&(!Number.isFinite(c.percentage)||c.percentage<0||c.percentage>1))throw new Error('Invalid color proportion.');return {hex,...(c.percentage!=null?{percentage:c.percentage}:{})};})};}
  if(value.attributes){if(typeof value.attributes!=='object'||Array.isArray(value.attributes)||Object.keys(value.attributes).length>8)throw new Error('Invalid attributes.');out.attributes=Object.fromEntries(Object.entries(value.attributes).map(([key,values])=>{if(key==='color')throw new Error('Use palette filters for color.');text(key,80,/^[\w-]+$/);if(!Array.isArray(values)||values.length>12)throw new Error('Invalid attribute values.');return [key,values.map(v=>text(v,120))];}));}
  if(value.dimensions){out.dimensions={};for(const [key,range]of Object.entries(value.dimensions)){if(!['length','width','height','weight'].includes(key)||!range||typeof range!=='object')throw new Error('Invalid dimensions.');const units=key==='weight'?['mg','g','kg','oz','lb']:['mm','cm','m','in','ft'];if(!units.includes(range.unit))throw new Error('Invalid measurement unit.');const r={unit:range.unit};for(const edge of ['min','max'])if(range[edge]!=null){const n=Number(range[edge]);if(!Number.isFinite(n)||n<=0||n>1000000)throw new Error('Invalid measurement.');r[edge]=n;}if(r.min==null&&r.max==null||r.min>r.max)throw new Error('Invalid dimension range.');out.dimensions[key]=r;}}
  if(Object.keys(value).some(k=>!['brand_ids','category_ids','website_ids','exclude_brand_ids','exclude_category_ids','exclude_website_ids','price','conditions','availability','gender','sale','colors','attributes','dimensions'].includes(k)))throw new Error('Unknown search filter.');
  return out;
}
export function productUrl(value){
  const url=new URL(text(value,2048));
  if(url.protocol!=='https:'||url.port||url.username||url.password||!url.hostname.includes('.')||url.hostname.startsWith('[')||url.hostname.endsWith('.')||/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(url.hostname)||/\.(local|localhost|internal)$/.test(url.hostname)||/^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname))throw new Error('Use a public HTTPS product link.');url.hash='';return url.href;
}
export function cartItems(value){
  if(!Array.isArray(value)||!value.length||value.length>12)throw new Error('Choose between one and twelve cart lines.');
  const seen=new Set();return value.map(item=>{if(!item||typeof item!=='object')throw new Error('Invalid cart line.');const id=catalogId(item.id),options=selection(item.selection),quantity=Number(item.quantity??1),key=JSON.stringify([id,Object.entries(options).sort()]);if(!Number.isInteger(quantity)||quantity<1||quantity>10||seen.has(key))throw new Error('Invalid cart quantity or duplicate line.');seen.add(key);return {id,selection:options,quantity};});
}
export function cartKey(item){return JSON.stringify([item.id,Object.entries(item.selection||{}).sort()]);}
export function sourceContext(value={}){
  const source={};if(value.url){const u=new URL(value.url);if(!['http:','https:'].includes(u.protocol))throw new Error('Invalid source URL.');source.url=u.origin+u.pathname+(u.hostname.endsWith('youtube.com')&&u.searchParams.get('v')?'?v='+encodeURIComponent(u.searchParams.get('v')):'');}
  if(value.timestamp!=null){if(!Number.isFinite(value.timestamp)||value.timestamp<0)throw new Error('Invalid source timestamp.');source.timestamp=value.timestamp;}
  for(const k of ['objectId','label'])if(value[k])source[k]=text(value[k],160);
  return source;
}
