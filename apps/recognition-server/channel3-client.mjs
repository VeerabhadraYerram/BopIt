import { normalizeChannel3Response, normalizeChannel3Product } from '../../packages/contracts/discovery.mjs';
import { retrieveChannel3 } from './channel3.mjs';

const API='https://api.trychannel3.com';
export function createChannel3Client({apiKey='',fetcher=fetch,onRequest=()=>{}}={}) {
  async function request(path,{method='GET',body,userId,timeout=30000}={}) {
    if(!apiKey)throw Object.assign(new Error('Channel3 is not configured.'),{status:503});
    const start=Date.now();let status=0;
    try {
      const response=await fetcher(API+path,{method,headers:{'x-api-key':apiKey,...(body?{'content-type':'application/json'}:{}),...(userId?{'x-user-id':userId}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(timeout)});status=response.status;
      if(!response.ok)throw Object.assign(new Error(`Channel3 request failed (${status}). Please retry or adjust your request.`),{status:status===429?429:502,providerStatus:status});
      return await response.json();
    } finally {onRequest({path:path.split('?')[0],method,status,elapsedMs:Date.now()-start});}
  }
  const results=async(path,body,options)=>{const raw=await request(path,{method:'POST',body,...options});return {...normalizeChannel3Response(raw),ok:true};};
  return {
    request,
    search:(body,options)=>results('/v1/search',body,options),
    similar:(body,options)=>results('/v1/similar',body,options),
    browse:(body,options)=>results('/v1/browse',body,options),
    lookup:async(url,options)=>{const data=await request('/v1/lookup',{method:'POST',body:{url},...options});return {product:normalizeChannel3Product(data.product||data)};},
    retrieve:(id,options={})=>retrieveChannel3(id,{apiKey,fetcher,...options}),
    categories:query=>request('/v1/categories/search?'+new URLSearchParams({query,limit:'8'})),
    category:slug=>request('/v1/categories/'+encodeURIComponent(slug)),
    brands:query=>request('/v1/brands/search?'+new URLSearchParams({query,limit:'8'})),
    history:(id,days=90)=>request(`/v0/price-tracking/history/${encodeURIComponent(id)}?days=${days}`),
    converse:(body,options)=>request('/v1/conversations',{method:'POST',body:{...body,stream:false},timeout:90000,...options}),
    subscribe:body=>request('/v1/product-subscriptions',{method:'POST',body}),
    unsubscribe:id=>request('/v1/product-subscriptions/'+encodeURIComponent(id),{method:'DELETE'}),
    reporting:(kind,params)=>request('/v1/reporting/'+kind+'?'+new URLSearchParams(params))
  };
}
