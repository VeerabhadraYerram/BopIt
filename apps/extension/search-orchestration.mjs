const complexConstraint = /\b(?:under|below|cheaper|premium|black|white|blue|red|leather|cotton|wood|metal|size|same brand|compare|except|instead|only|avoid|but)\b/gi;
const contextDependent = /\b(?:same but|keep the same|compare these|based on those|that one|those options|previous results)\b/i;

export function chooseSearchStrategy({ query = '', intent = 'exact', hasImage = false, hasFilters = false, hasPreviousResults = false, hasVariant = false } = {}) {
  const text = typeof query === 'string' ? query.trim() : '';
  if (!text) return { mode: 'default', reason: hasImage ? 'image-led search remains deterministic' : 'no text query to plan' };
  const constraints = [...text.matchAll(complexConstraint)].length;
  if (text.length > 160 || constraints >= 2 || (contextDependent.test(text) && (hasPreviousResults || hasVariant))) {
    return { mode: 'agentic', reason: constraints >= 2 || text.length > 160 ? 'multiple natural-language constraints' : 'follow-up depends on previous product or variant context' };
  }
  if (intent === 'exact' && hasImage && !hasFilters) return { mode: 'default', reason: 'simple exact image-and-text search' };
  return { mode: 'default', reason: 'simple search is adequately served by deterministic catalog search' };
}

function mayUseDeterministicFallback(error) {
  if (error?.name === 'AbortError' || ['AUTHENTICATION_FAILED', 'ACCESS_DENIED', 'RATE_LIMIT_EXCEEDED'].includes(error?.code)) return false;
  return error?.status === 422 || ['TIMEOUT', 'NETWORK_ERROR', 'PROVIDER_ERROR'].includes(error?.code);
}

export async function searchWithAgenticFallback(search, request, strategy) {
  const mode = strategy?.mode === 'agentic' ? 'agentic' : 'default';
  const withMode = value => ({ ...value, config: { ...(value.config || {}), mode } });
  if (mode === 'default') return { data: await search(withMode(request)), mode, fallbackUsed: false, attempts: 1 };
  try {
    return { data: await search(withMode(request)), mode, fallbackUsed: false, attempts: 1 };
  } catch (error) {
    if (!mayUseDeterministicFallback(error)) throw error;
    try {
      const data = await search({ ...request, config: { ...(request.config || {}), mode: 'default' } });
      return { data, mode: 'default', fallbackUsed: true, attempts: 2 };
    } catch (fallbackError) {
      fallbackError.fallbackUsed = true;
      fallbackError.attempts = 2;
      throw fallbackError;
    }
  }
}
