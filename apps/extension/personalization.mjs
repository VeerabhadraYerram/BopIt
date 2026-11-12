// Explicit preferences only. Never infer a viewer's gender from a video.
export function normalizePersonalization(value={}) {
  return {version:1,enabled:value.enabled===true,preferences:String(value.preferences||'').trim().slice(0,1000),ownedProducts:String(value.ownedProducts||'').trim().slice(0,1000)};
}
export async function loadPersonalization(){const data=await chrome.storage.local.get('bopitPersonalization');return normalizePersonalization(data.bopitPersonalization);}
export async function savePersonalization(value){const profile=normalizePersonalization(value);await chrome.storage.local.set({bopitPersonalization:profile});return profile;}
export function personalizationContext(profile){return profile.enabled?{preferences:profile.preferences,ownedProducts:profile.ownedProducts}:null;}
