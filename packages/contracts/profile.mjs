const text = (v, n = 600) => {
  if (typeof v !== 'string' || v.length > n) throw new Error('Invalid profile text');
  return v.trim();
};
const list = (v, n = 40) => {
  if (!Array.isArray(v) || v.length > n) throw new Error('Invalid profile list');
  return v;
};
export const evidenceSources = ['visible', 'caption', 'video_speech', 'viewer_note', 'inferred'];
function identityValue(value) {
  const clean = text(value, 160);
  return /^(?:unknown(?: brand| model)?|unidentified|unspecified|not (?:known|identified|visible|available|readable)|n\/?a|none|null|—|-)$/i.test(clean) ? '' : clean;
}
export function profileIdentityLabel(identity) {
  const brand = identityValue(identity.brand), model = identityValue(identity.model);
  if (brand && model) return `Possible product: ${brand} ${model}`;
  if (brand) return `Possible brand: ${brand}. Model not identified.`;
  if (model) return `Possible model: ${model}. Brand not identified.`;
  return 'Brand and model couldn’t be identified from this frame.';
}
export function validateProfile(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid object profile');
  return {
    summary: text(raw.summary, 1200), category: text(raw.category, 160),
    identity: { brand: identityValue(raw.identity?.brand), model: identityValue(raw.identity?.model),
      basis: text(raw.identity?.basis), status: ['unidentified', 'candidate', 'identifier_observed'].includes(raw.identity?.status) ? raw.identity.status : 'unidentified' },
    attributes: list(raw.attributes).map(a => {
      if (!evidenceSources.includes(a.source)) throw new Error('Invalid attribute evidence');
      return { group: text(a.group, 80), name: text(a.name, 100), value: text(a.value), source: a.source, evidence: text(a.evidence) };
    }),
    spokenClaims: list(raw.spokenClaims, 12).map(a => ({ claim: text(a.claim), timestamp: text(a.timestamp, 80), refersTo: text(a.refersTo, 200), status: 'Creator claim · not independently verified' })),
    useInScene: text(raw.useInScene), relationships: list(raw.relationships, 12).map(v => text(v)),
    unknowns: list(raw.unknowns, 16).map(v => text(v)), contradictions: list(raw.contradictions, 12).map(v => text(v)),
    queries: { exact: text(raw.queries?.exact, 600), look: text(raw.queries?.look, 600), function: text(raw.queries?.function, 600) }
  };
}
export function validateContext(raw = {}) {
  const timestamp = Number(raw.timestamp ?? 0);
  if (!Number.isFinite(timestamp) || timestamp < 0 || timestamp > 86400) throw new Error('Invalid video timestamp');
  const cues = list(raw.cues ?? [], 80).map(c => {
    const start = Number(c.start), end = Number(c.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || end > 86400) throw new Error('Invalid caption timestamp');
    return { start, end, text: text(c.text, 1500) };
  }).filter(c => c.end >= timestamp - 40 && c.start <= timestamp + 20);
  let youtubeUrl = '';
  if (raw.youtubeUrl) {
    const u = new URL(raw.youtubeUrl);
    const id = u.searchParams.get('v');
    if (u.protocol !== 'https:' || !['www.youtube.com', 'youtube.com'].includes(u.hostname) || u.pathname !== '/watch' || !/^[\w-]{11}$/.test(id || '')) throw new Error('Only a public YouTube watch URL is supported');
    youtubeUrl = `https://www.youtube.com/watch?v=${id}`;
  }
  return { timestamp, cues, youtubeUrl, note: text(raw.note ?? '', 4000) };
}
export function searchPlan(profile, intent = 'exact', budget) {
  if (!['exact', 'look', 'function', 'cheaper'].includes(intent)) throw new Error('Unknown shopping intent');
  const query = profile.queries[intent === 'cheaper' ? 'look' : intent] || profile.category;
  const filters = {};
  if (budget !== undefined && budget !== '' && budget !== null) {
    const value = Number(budget);
    if (!Number.isFinite(value) || value <= 0 || value > 1000000) throw new Error('Invalid budget');
    filters.price = { max_price: value };
  }
  return { query, filters, useImage: intent !== 'function', intent };
}
