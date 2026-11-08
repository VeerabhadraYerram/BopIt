export async function searchAfterProfileFailure(query, search) {
  const fallback = typeof query === 'string' ? query.trim() : '';
  if (!fallback) return false;
  await search(fallback, true);
  return true;
}
