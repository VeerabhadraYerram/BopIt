import test from 'node:test';
import assert from 'node:assert/strict';
import { isPreferenceRequest, contextualRequest } from '../apps/extension/search-request.mjs';

test('the single search distinguishes product queries from contextual preferences',()=>{
  for(const query of ['Sony headphones','camera tripod','slow-A'])assert.equal(isPreferenceRequest(query),false);
  for(const query of ['Something like this but under $100','Only wireless ones','Same style in blue','Smaller and suitable for outdoor use'])assert.equal(isPreferenceRequest(query),true);
});

test('context includes evidence and previous request without implying a confirmed identity',()=>{
  const message=contextualRequest('Only wireless ones',{object:{label:'headphones'},profile:{summary:'Black headphones',attributes:[{name:'Brand',value:'Sony',source:'caption'}]},previousRequest:'Under $100',market:{country:'US',currency:'USD'}});
  assert.match(message,/unverified observations/);assert.match(message,/Brand: Sony \(caption\)/);assert.match(message,/Previous request: Under \$100/);assert.match(message,/Viewer request: Only wireless ones/);
  const cleared=contextualRequest('Find a camera',{market:{country:'GB',currency:'GBP'}});
  assert.doesNotMatch(cleared,/Selected object|Previous request|Sony/);assert.match(cleared,/GBP/);
});
