const text = (value, limit = 300) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
const normalizedWords = value => text(value, 500).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function createScenePlan({ sceneId, sceneObservation, sceneImageReference, objects, cropForObject }) {
  if (typeof sceneId !== 'string' || !sceneId.trim() || !Array.isArray(objects)) throw new Error('A scene ID and detected objects are required.');
  const planObjects = objects.map(object => {
    const label = text(object.label, 100);
    if (!label || typeof object.id !== 'string' || !object.box) throw new Error('Detected scene object is invalid.');
    const visualDetails = [...(Array.isArray(object.visibleAttributes) ? object.visibleAttributes : []), object.color]
      .map(value => text(value, 120)).filter(Boolean).slice(0, 8);
    const query = [label, ...visualDetails].join(' ').slice(0, 500);
    return {
      id: object.id,
      label,
      box: { ...object.box },
      crop: cropForObject(object),
      visibleAttributes: Array.isArray(object.visibleAttributes) ? [...object.visibleAttributes] : [],
      color: text(object.color, 100),
      material: text(object.material, 100),
      brand: text(object.brand, 100),
      model: text(object.model, 100),
      confidence: typeof object.confidence === 'number' && Number.isFinite(object.confidence) ? object.confidence : null,
      selected: true,
      searchIntent: { kind: 'visual-category', query, useImage: true },
      relationshipEvidence: text(object.relationship, 500) ? {
        description: text(object.relationship, 500),
        source: 'visual-detection-model-unverified'
      } : null,
      results: null,
      status: 'not-searched'
    };
  });
  const combinations = [];
  for (const source of planObjects) {
    if (!source.relationshipEvidence) continue;
    const relationship = ` ${normalizedWords(source.relationshipEvidence.description)} `;
    for (const target of planObjects) {
      const targetLabel = normalizedWords(target.label);
      if (target.id === source.id || !targetLabel || !relationship.includes(` ${targetLabel} `)) continue;
      combinations.push({
        objectIds: [source.id, target.id],
        evidence: source.relationshipEvidence.description,
        source: source.relationshipEvidence.source,
        claim: 'Possible related scene items; this is not a product compatibility claim.'
      });
    }
  }
  return {
    sceneId,
    sceneObservation: text(sceneObservation, 1000) || null,
    sceneImageReference: text(sceneImageReference, 256) || null,
    objects: planObjects,
    combinations
  };
}

export function createSceneSearchRunner({ concurrency = 2 } = {}) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) throw new Error('Scene search concurrency must be between 1 and 4.');
  const cache = new Map(), pending = new Map();
  let active = 0;
  const waiters = [];

  function acquire(signal) {
    if (signal?.aborted) return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
    if (active < concurrency) { active++; return Promise.resolve(); }
    return new Promise((resolve, reject) => {
      const waiter = {
        grant() {
          signal?.removeEventListener('abort', abort);
          active++;
          resolve();
        }
      };
      const abort = () => {
        const index = waiters.indexOf(waiter);
        if (index >= 0) waiters.splice(index, 1);
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      };
      waiter.abort = abort;
      signal?.addEventListener('abort', abort, { once: true });
      waiters.push(waiter);
    });
  }

  function release() {
    const waiter = waiters.shift();
    if (waiter) waiter.grant();
    else active--;
  }

  async function limitedSearch(search, object, signal) {
    await acquire(signal);
    try { return await search(object, signal); }
    finally { release(); }
  }

  async function searchObject(sceneId, object, search, { signal, force = false, contextKey } = {}) {
    const key = `${sceneId}:${object.id}:${contextKey || object.searchIntent.query}`;
    if (!force && cache.has(key)) return { ...cache.get(key), cached: true };
    if (pending.has(key)) return pending.get(key);
    const operation = limitedSearch(search, object, signal).then(products => {
      const result = { objectId: object.id, status: 'complete', products: Array.isArray(products) ? products : [], error: null, cached: false };
      cache.set(key, result);
      return result;
    }, error => ({ objectId: object.id, status: 'error', products: [], error: error.message || 'Product discovery failed.', cached: false }))
      .finally(() => pending.delete(key));
    pending.set(key, operation);
    return operation;
  }

  return {
    async run(plan, search, { selectedIds = plan.objects.filter(item => item.selected).map(item => item.id), signal, force = false, keyForObject } = {}) {
      const selected = new Set(selectedIds);
      const eligible = plan.objects.filter(item => selected.has(item.id));
      const results = new Array(eligible.length);
      let nextIndex = 0;
      const worker = async () => {
        while (nextIndex < eligible.length) {
          const index = nextIndex++;
          const item = eligible[index];
          results[index] = await searchObject(plan.sceneId, item, search, {
            signal, force, contextKey: keyForObject?.(item)
          });
        }
      };
      await Promise.all(Array.from({ length: Math.min(concurrency, eligible.length) }, worker));
      for (const result of results) {
        const sceneObject = plan.objects.find(item => item.id === result.objectId);
        if (sceneObject) {
          sceneObject.status = result.status;
          sceneObject.results = result.products;
          sceneObject.error = result.error;
        }
      }
      return results;
    },
    clear(sceneId) {
      for (const key of cache.keys()) if (key.startsWith(`${sceneId}:`)) cache.delete(key);
    }
  };
}
