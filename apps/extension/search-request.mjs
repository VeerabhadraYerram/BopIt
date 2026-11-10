// Interpret references as refinements; ordinary product names remain direct searches.
export function isPreferenceRequest(query) {
  return /\b(?:this|these|that|those|same|similar|instead|cheaper|smaller|larger|bigger|lighter|darker|brighter|wireless ones|only|under|below|budget|suitable|prefer|without|but|for me)\b/i.test(query) || query.length > 160;
}

export function contextualRequest(query, { object, profile, previousRequest, market }) {
  const observations = [profile?.summary || object?.label,
    ...(profile?.attributes || []).map(a => `${a.name}: ${a.value} (${a.source})`)]
    .filter(Boolean).join('\n').slice(0, 850);
  return [observations && `Selected object, unverified observations:\n${observations}`,
    previousRequest && `Previous request: ${previousRequest.slice(0, 300)}`,
    `Requested market: ${market.country}; currency: ${market.currency}.`,
    `Viewer request: ${query}`].filter(Boolean).join('\n');
}
