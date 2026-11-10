import { formatProductPrice, safeProductUrl } from './product-display.js';
import { createShoppingTools } from './shopping-tools.js';
import { searchPlan, profileIdentityLabel } from './contracts/profile.mjs';
import { isPreferenceRequest, contextualRequest } from './search-request.mjs';
import { attachVoiceInput } from './voice-input.js';
import { priceHistorySeries, createPriceHistoryChart } from './price-history.js';
import { extractColorPalette } from './contracts/discovery.mjs';
import { chooseSearchStrategy, searchWithAgenticFallback } from './search-orchestration.mjs';
import { createSubscriptionPager } from './subscription-pagination.mjs';
import { extractPaletteFromDataUrl } from './palette-image.mjs';
import { prepareProfileImages } from './profile-images.mjs';
import { searchAfterProfileFailure } from './profile-fallback.mjs';
import { channel3ErrorMessage, profileErrorMessage, searchErrorMessage } from './ui-feedback.mjs';
const $ = s => document.querySelector(s);
const node = (tag, text, className) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; };
const logOrchestration = entry => console.info('[bopit-orchestration]', JSON.stringify(entry));
const sourceLabel = { visible: 'Seen in frame', caption: 'Caption claim', video_speech: 'Video speech claim', viewer_note: 'Viewer-provided · unverified', inferred: 'Inference · unverified' };
const progressStages = {
  preparation: 'Preparing selected object',
  identification: 'Identifying object with Gemini',
  attributes: 'Extracting details and optional colour palette',
  search: 'Searching Channel3',
  comparison: 'Comparing available listings'
};
export function createInvestigator({ getCapture, crop, getSelected }) {
  let generation = 0, controller = null, selected = null, intent = 'exact', current = null, activeSimilar = null;
  let conversationScope = null, conversationId = null, conversationHistory = [], conversationGeneration = 0, selectedProductContext = null;
  let channel3UserIdPromise = null;
  let clickReport = null, transactionReport = null;
  let lastRendered = { products: [], assessments: [] };
  let useObjectContext = true, previousRequest = '';
  const voice = attachVoiceInput({ input: $('#product-query'), button: $('#voice-search-btn'), status: $('#voice-search-status'), onTranscript: () => cancel({ keepResults: true }) });
  function updateSearchContext() {
    const label = useObjectContext ? selected?.label : '';
    $('#search-context-label').textContent = label ? `Finding alternatives to: ${label}` : previousRequest ? `Refining: ${previousRequest}` : 'Search products or describe what you need.';
    $('#clear-search-context').hidden = !label && !previousRequest;
  }
  function clearConversation() { conversationGeneration++; conversationId = null; conversationHistory = []; }
  $('#clear-search-context').onclick = () => {
    cancel(); voice.cancel(); useObjectContext = false; previousRequest = ''; clearConversation();
    $('#product-query').value = ''; $('#shopping-reply').textContent = ''; $('#voice-search-status').textContent = '';
    updateSearchContext(); $('#product-query').focus();
  };
  const resultHistory = [];
  const resultsBack = node('button', '← Back to previous results', 'secondary');
  resultsBack.id = 'back-to-results'; resultsBack.type = 'button'; resultsBack.hidden = true; resultsBack.onclick = backToResults;
  $('#results-toolbar').before(resultsBack);
  function updateResultsBack() {
    resultsBack.hidden = !resultHistory.length;
    $('#back-to-items').textContent = resultHistory.length ? '← Previous results' : '← All items';
  }
  function resultsSnapshot() {
    return { nodes: [...$('#products-container').childNodes], rendered: lastRendered, notice: $('#products-notice').textContent, scroll: window.scrollY,
      trigger: document.activeElement, activeSearch, activeBrowse, activeSimilar, selectedProductContext, moreHidden: $('#load-more-products').hidden, moreClick: $('#load-more-products').onclick };
  }
  function backToResults() {
    const saved = resultHistory.pop(); if (!saved) return false;
    generation++; controller?.abort(); controller = null; $('#search-products-btn').disabled = false;
    $('#products-container').replaceChildren(...saved.nodes); lastRendered = saved.rendered;
    ({ activeSearch, activeBrowse, activeSimilar, selectedProductContext } = saved);
    $('#products-notice').textContent = saved.notice; $('#results-count').textContent = `${saved.nodes.length} products`;
    $('#load-more-products').hidden = saved.moreHidden; $('#load-more-products').onclick = saved.moreClick; updateResultsBack();
    requestAnimationFrame(() => { window.scrollTo({ top: saved.scroll, behavior: 'instant' }); saved.trigger?.focus({ preventScroll: true }); });
    return true;
  }
  const shopping = createShoppingTools(() => {
    if(activeSimilar?.nextPageToken)renderProducts(lastRendered.products,lastRendered.assessments,{keepNavigation:true,nextPageToken:activeSimilar.nextPageToken,loadMore:()=>loadMoreSimilar(activeSimilar)});
    else if(activeBrowse?.nextPageToken)renderProducts(lastRendered.products,lastRendered.assessments,{keepNavigation:true,nextPageToken:activeBrowse.nextPageToken,loadMore:loadMoreBrowse});
    else renderProducts(lastRendered.products,lastRendered.assessments,{keepNavigation:true,nextPageToken:activeSearch?.nextPageToken,loadMore:loadMoreSearch});
  },api,market,product=>checkoutAction(
    ()=>({id:product.id,selection:product.variantSelection||{},websiteIds:product.retailer?[product.retailer]:[],config:market(),expectedOffer:offerSnapshot(product)}),product),
    ()=>({url:getCapture()?.source?.documentUrl,timestamp:getCapture()?.source?.timestamp||0}));
  const cache = new Map(), searches = new Map(), views = new Map();
  const detailGenerations = new WeakMap();
  let palette = [], activeSearch = null, activeBrowse = null;
  let brandCursor = null, categoryPage = 1, categoryTotal = 0;
  function setStage(name, state) {
    const item = $(`#investigation-stages [data-stage="${name}"]`);
    if (!item) return;
    item.dataset.state = state;
    item.setAttribute('aria-label', `${progressStages[name]}: ${state}`);
    let status = item.querySelector('.stage-state');
    if (!status) { status = node('span', undefined, 'stage-state'); item.append(status); }
    status.textContent = state === 'complete' ? 'Done' : state === 'active' ? 'In progress' : state === 'error' ? 'Needs attention' : state === 'skipped' ? 'Skipped' : 'Waiting';
  }
  function resetStages() {
    for (const name of Object.keys(progressStages)) setStage(name, 'pending');
    setStage('preparation', 'active');
  }
  function cancel({ keepResults = false } = {}) { if (!keepResults) { resultHistory.length = 0; updateResultsBack(); lastRendered = { products: [], assessments: [] }; } generation++; conversationGeneration++; controller?.abort(); controller = null; $('#search-products-btn').disabled = false; }
  function reset() { voice.cancel(); useObjectContext=true; previousRequest=''; $('#product-query').value=''; $('#shopping-reply').textContent=''; $('#voice-search-status').textContent=''; cancel(); cache.clear(); searches.clear(); views.clear(); selected = null; current = null; updateSearchContext(); conversationGeneration++; conversationScope = null; conversationId = null; conversationHistory = []; selectedProductContext = null; $('#conversation-tools').hidden = true; $('#profile-summary').replaceChildren(); $('#profile-evidence').replaceChildren(); $('#context-note').value = ''; $('#use-youtube').checked = false; }
  function getChannel3UserId() {
    if (!channel3UserIdPromise) {
      channel3UserIdPromise = (async() => {
        const { channel3UserId } = await chrome.storage.local.get('channel3UserId');
        if (typeof channel3UserId === 'string' && /^bopit_[a-f0-9-]{36}$/.test(channel3UserId)) return channel3UserId;
        const id = `bopit_${crypto.randomUUID()}`;
        await chrome.storage.local.set({ channel3UserId: id });
        return id;
      })();
      channel3UserIdPromise.catch(() => { channel3UserIdPromise = null; });
    }
    return channel3UserIdPromise;
  }
  async function api(path, body, signal) {
    const { pairingToken } = await chrome.storage.local.get('pairingToken');
    if (!pairingToken) throw new Error('Open Settings → Connect local server first.');
    const userId = await getChannel3UserId();
    const requestBody = JSON.stringify(body);
    const response = await fetch(`http://127.0.0.1:4317/api/${path}`, { method: 'POST', headers: { 'content-type':'application/json','x-bopit-token':pairingToken,'x-bopit-user-id':userId }, body:requestBody, signal });
    const data = await response.json();
    if (!response.ok) {
      if (path === 'profile') console.warn('[bopit-profile-client]', JSON.stringify({
        status: response.status,
        code: data.code || 'UNKNOWN',
        requestBytes: new Blob([requestBody]).size,
        imagePayloadBytes: {
          crop: typeof body.image === 'string' ? body.image.length : null,
          scene: typeof body.scene === 'string' ? body.scene.length : null,
          additional: Array.isArray(body.additionalImages) ? body.additionalImages.map(image => typeof image === 'string' ? image.length : null) : []
        }
      }));
      const error = new Error(data.error || 'Request failed.');
      error.status = response.status; error.code = data.code;
      throw error;
    }
    return data;
  }
  function context() {
    const c = getCapture(); const result = { timestamp: c?.source?.timestamp || 0, cues: c?.context?.cues || [], note: $('#context-note').value.trim() };
    if ($('#use-youtube').checked) {
      try { const url = new URL(c.source.documentUrl); if (['www.youtube.com','youtube.com'].includes(url.hostname) && /^[\w-]{11}$/.test(url.searchParams.get('v') || '')) result.youtubeUrl = `https://www.youtube.com/watch?v=${url.searchParams.get('v')}`; } catch { /* Not a public watch page */ }
    }
    return result;
  }
  function renderConversationHistory() {
    const target = $('#conversation-transcript');
    target.replaceChildren();
    for (const turn of conversationHistory) {
      target.append(node('div', turn.text, `conversation-turn ${turn.role}`));
    }
    target.scrollTop = target.scrollHeight;
  }
  async function restoreConversation(object) {
    const capture = getCapture();
    conversationScope = `bopit-conversation:${capture?.captureId || 'session'}:${object.id}`;
    const scope = conversationScope, version = ++conversationGeneration;
    const saved = await chrome.storage.session.get(scope);
    if (version !== conversationGeneration) return;
    const state = saved[scope];
    conversationId = typeof state?.conversationId === 'string' ? state.conversationId : null;
    conversationHistory = Array.isArray(state?.history)
      ? state.history.filter(turn => ['user', 'assistant'].includes(turn?.role) && typeof turn.text === 'string').slice(-12)
      : [];
    $('#conversation-tools').hidden = true;
    $('#conversation-status').textContent = conversationId
      ? 'Continuing this shopping conversation for the selected item.'
      : 'Ask for a change to the current results; this starts a new Channel3 conversation.';
    renderConversationHistory();
  }
  function initialConversationContext() {
    const selectedProduct = selectedProductContext;
    const variant = selectedProduct?.variants?.selected?.map(item => `${item.name}: ${item.label}`).join(', ');
    const contextValue = {
      selectedObject: useObjectContext ? selected?.label || '' : '',
      investigation: useObjectContext ? current?.profile?.summary || '' : '',
      intent,
      currentFilters: searchFilters(),
      previousResults: (current?.results?.products || []).slice(0, 5).map(product => ({ id: product.id, title: product.title })),
      selectedProduct: selectedProduct ? { id: selectedProduct.id, title: selectedProduct.title, variant: variant || null } : null
    };
    return {
      application_context: 'BopIt selected-object product discovery. Continue or refine the active catalog search.',
      user_context: JSON.stringify({ ...contextValue, previousRequest, viewerContext: contextualRequest('', { object: useObjectContext ? selected : null, profile: useObjectContext ? current?.profile : null, previousRequest, market: market() }) }).slice(0, 3800)
    };
  }
  async function sendConversationMessage(message, signal) {
    const text = (message ?? $('#conversation-message').value).trim();
    if (!text) { $('#conversation-status').textContent = 'Enter a refinement request first.'; return; }
    const initialTurn = !conversationId;
    const scope = conversationScope, version = ++conversationGeneration;
    const sendButton = $('#send-conversation');
    sendButton.disabled = true;
    $('#conversation-status').textContent = 'Asking Channel3 to refine these product results…';
    const userTurn = { role: 'user', text };
    conversationHistory.push(userTurn);
    renderConversationHistory();
    try {
      const request = {
        message: text,
        ...(conversationId ? { conversationId } : { context: initialConversationContext() }),
        filters: searchFilters(),
        config: market(),
        ...(!conversationId && useObjectContext && selected ? { image: crop(selected.box) } : {})
      };
      const data = await api('conversations/turn', request, signal);
      if (version !== conversationGeneration || scope !== conversationScope) return;
      conversationId = data.conversationId;
      const answer = data.message?.text || data.message?.errors?.join(' ') || '';
      $('#shopping-reply').textContent = answer;
      if (answer) conversationHistory.push({ role: 'assistant', text: answer });
      else if (!(data.message?.products || []).length) conversationHistory.push({ role: 'assistant', text: 'Channel3 returned no text or product matches for this turn. Try a more specific refinement.' });
      conversationHistory = conversationHistory.slice(-12);
      await chrome.storage.session.set({ [conversationScope]: { conversationId, history: conversationHistory } });
      renderConversationHistory();
      const products = data.message?.products || [];
      if (products.length) {
        activeSearch = null; activeBrowse = null; activeSimilar = null;
        if (current) current.results = { products };
        renderProducts(products);
        $('#products-notice').textContent = `${products.length} product${products.length === 1 ? '' : 's'} returned by the Channel3 conversation.`;
      }
      const suggestions = (data.message?.suggestions || []).slice(0, 4);
      if (suggestions.length) {
        const group = node('div', undefined, 'conversation-suggestions');
        for (const suggestion of suggestions) {
          const button = node('button', suggestion, 'secondary');
          button.type = 'button';
          button.onclick = () => { $('#conversation-message').value = suggestion; sendConversationMessage(suggestion); };
          group.append(button);
        }
        $('#conversation-transcript').append(group);
      }
      $('#conversation-message').value = '';
      $('#conversation-status').textContent = products.length
        ? 'Product matches were refreshed from the conversation. Review the listings before buying.'
        : 'Conversation updated; no new product matches were returned.';
      logOrchestration({
        strategy: 'conversation',
        reason: initialTurn ? 'new shopping conversation' : 'refinement of existing shopping conversation',
        operations: ['POST /v1/conversations'],
        fallbackUsed: false,
        outcome: products.length ? 'products-returned' : 'response-without-products'
      });
    } catch (error) {
      if (version !== conversationGeneration || scope !== conversationScope || error.name === 'AbortError') return;
      if ((error.status === 404 || error.status === 410) && conversationId) {
        conversationId = null;
        await chrome.storage.session.remove(conversationScope);
        $('#conversation-status').textContent = 'This Channel3 conversation is unavailable or expired. Start fresh to continue shopping.';
      } else {
        $('#conversation-status').textContent = `Conversation unavailable: ${error.message}`;
      }
      logOrchestration({
        strategy: 'conversation', reason: 'user requested conversational refinement',
        operations: ['POST /v1/conversations'], fallbackUsed: false, outcome: 'error'
      });
    } finally { sendButton.disabled = false; }
  }
  function setContextInfo() {
    const c = getCapture(), cues = c?.context?.cues || [];
    $('#context-status').textContent = cues.length ? `${cues.length} nearby caption segments available. Captions may contain transcription errors.` : 'No accessible captions found. The frame alone contains no speech. Add relevant text below or use public YouTube context when supported.';
    let supported = false;
    try { const u = new URL(c?.source?.documentUrl); supported = ['www.youtube.com','youtube.com'].includes(u.hostname) && /^[\w-]{11}$/.test(u.searchParams.get('v') || ''); } catch { /* Upload */ }
    $('#youtube-option').hidden = !supported;
  }
  function renderProfile(record) {
    $('#profile-summary').replaceChildren(); $('#profile-evidence').replaceChildren();
    const p = record.profile;
    if (record.contextWarning) $('#profile-summary').append(node('p',record.contextWarning,'variant-warning'));
    $('#profile-summary').append(node('p', p.summary), node('div', profileIdentityLabel(p.identity), 'identity-status'), node('p', p.identity.basis || 'No reliable model identifier available.', 'muted'));
    if (p.useInScene) $('#profile-summary').append(node('p', `Use in this scene: ${p.useInScene}`));
    if (!record.contextUsed?.captions && !record.contextUsed?.youtubeRequested && !record.contextUsed?.viewerNote) $('#profile-summary').append(node('p', 'Visual analysis only · no speech context supplied', 'muted'));
    const details = node('details'); details.append(node('summary', `All extracted details & evidence (${p.attributes.length})`));
    const table = node('table'); const head = node('thead'), tr = node('tr'); ['Detail','Finding & evidence'].forEach(t => tr.append(node('th',t))); head.append(tr); table.append(head);
    const body = node('tbody');
    for (const a of p.attributes) { const row = node('tr'), cell = node('td'); cell.append(node('strong', a.value),node('small',`${sourceLabel[a.source]} · ${a.evidence}`)); row.append(node('td',`${a.group} / ${a.name}`),cell); body.append(row); }
    table.append(body); details.append(table);
    for (const [heading, values] of [['Relationships',p.relationships],['Unknown / needs verification',p.unknowns],['Conflicting evidence',p.contradictions]]) if (values.length) { details.append(node('h3',heading)); const ul=node('ul'); values.forEach(v=>ul.append(node('li',v)));details.append(ul); }
    $('#profile-evidence').append(details);
    if (p.spokenClaims.length) { const speech=node('details');speech.append(node('summary',`What the creator said (${p.spokenClaims.length})`));for(const c of p.spokenClaims)speech.append(node('p',`${c.timestamp} · ${c.claim}`),node('small',`${c.refersTo} · ${c.status}`));$('#profile-evidence').append(speech); }
  }
  async function select(object, force = false) {
    cancel(); const version = generation; controller = new AbortController(); const signal = controller.signal;
    selected = object; selectedProductContext = null; current = null; $('#profile-summary').replaceChildren(); $('#profile-evidence').replaceChildren(); $('#products-container').replaceChildren();
    useObjectContext = true; previousRequest = ''; voice.cancel(); $('#voice-search-status').textContent = ''; $('#shopping-reply').textContent = ''; updateSearchContext();
    palette = []; renderPalette(); resetStages();
    $('#investigation-status').textContent = 'Preparing your selection…';
    await restoreConversation(object);
    if (version !== generation) return;
    setContextInfo(); $('#view-status').textContent = `${(views.get(object.id)||[]).length} / 2 additional views. Use clear images of the same item.`; $('#clear-views').hidden = !(views.get(object.id)||[]).length; $('#products-notice').textContent = 'Product search follows the detailed object investigation.';
    const c = getCapture(), ctx = context(), additionalImages = views.get(object.id)||[], key = JSON.stringify([c.captureId, object, ctx, additionalImages]);
    try {
      let record = force ? null : cache.get(key);
      if (!record) {
        const profileImages = await prepareProfileImages({ crop:crop(object.box),scene:c.image,additionalImages });
        if (version !== generation) return;
        setStage('preparation', 'complete');
        setStage('identification', 'active');
        $('#investigation-status').textContent = 'Identifying the object with Gemini…';
        record = await api('profile', { label:object.label,image:profileImages.crop,scene:profileImages.scene,context:ctx,additionalImages:profileImages.additionalImages }, signal);
        if (version !== generation) return;
        cache.set(key, record);
      } else {
        setStage('preparation', 'complete');
        setStage('identification', 'complete');
      }
      if (version !== generation) return;
      current = { ...record, key, object };
      setStage('identification', 'complete');
      setStage('attributes', 'active');
      renderProfile(record);
      $('#investigation-status').textContent = 'Object details are ready. Colour matching is optional; products will not wait for it.';
      void preparePalette(object, version);
      await runSearch(version, signal, force);
    } catch (e) {
      if (version !== generation || e.name === 'AbortError') return;
      setStage('identification', 'error');
      setStage('attributes', 'skipped');
      $('#investigation-status').textContent = `${profileErrorMessage(e)} Searching by the visible description instead.`;
      $('#profile-summary').append(node('p','You can still search the visible category. No exact identity established.','muted'));
      const fallback = [object.visibleText,object.label,...object.visibleAttributes].filter(Boolean).join(' ');
      $('#product-query').value = fallback;
      await searchAfterProfileFailure(fallback, manual);
    }
  }
  function market() { const [country,currency] = $('#market').value.split(':'); return { country,currency }; }
  async function preparePalette(object, version) {
    try {
      const source = crop(object.box);
      const colors = (await extractPaletteFromDataUrl(source, extractColorPalette)).map(color => ({ ...color, enabled: true }));
      if (version !== generation) return;
      palette = colors;
      renderPalette();
      $('#palette-status').textContent = palette.length ? 'Colour filtering is optional and uses Channel3 Beta.' : 'No usable colours were found in this crop.';
      setStage('attributes', 'complete');
    } catch (error) {
      if (version !== generation) return;
      palette = []; renderPalette();
      $('#palette-status').textContent = 'Colour matching is unavailable for this crop. Product search is unaffected.';
      setStage('attributes', 'error');
    }
  }
  function renderPalette() {
    const target = $('#palette-controls');
    target.replaceChildren();
    palette.forEach((color, index) => {
      const row = node('div', undefined, 'palette-row');
      const enabled = document.createElement('input'); enabled.type = 'checkbox'; enabled.checked = color.enabled;
      enabled.setAttribute('aria-label', `Include colour ${index + 1}`);
      enabled.onchange = () => { color.enabled = enabled.checked; changeSearch(); };
      const picker = document.createElement('input'); picker.type = 'color'; picker.value = color.hex;
      picker.setAttribute('aria-label', `Adjust colour ${index + 1}`);
      picker.onchange = () => { color.hex = picker.value.toUpperCase(); changeSearch(); };
      row.append(enabled, picker, node('span', `${Math.round(color.percentage * 100)}% prominent`));
      target.append(row);
    });
  }
  function searchFilters(base = {}) {
    const filters = { ...base };
    const category = $('#category-filter').value;
    if (category) filters.category_ids = [category];
    const brandId = $('#catalog-brand').value;
    if (brandId) filters.brand_ids = [brandId];
    const attributes = {};
    for (const control of document.querySelectorAll('#category-attributes [data-attribute]')) {
      const values = control.tagName === 'SELECT'
        ? [...control.selectedOptions].map(option => option.value)
        : control.value.trim() ? [control.value.trim()] : [];
      if (values.length) attributes[control.dataset.attribute] = values;
    }
    if (Object.keys(attributes).length) filters.attributes = attributes;
    const colors = palette.filter(color => color.enabled).map(({ hex, percentage }) => ({ hex, percentage }));
    if (colors.length) filters.colors = { palette: colors };
    return filters;
  }
  async function discoverySearch(request, signal) {
    const strategy = chooseSearchStrategy({
      query: request.query,
      intent,
      hasImage: Boolean(request.image),
      hasFilters: Boolean(Object.keys(request.filters || {}).length),
      hasPreviousResults: Boolean(current?.results?.products?.length),
      hasVariant: Boolean(selectedProductContext?.variants?.selected?.length)
    });
    let result;
    try {
      result = await searchWithAgenticFallback(payload => api('products/search', payload, signal), request, strategy);
    } catch (error) {
      if (!request.filters?.colors || ![400, 422].includes(error.status)) {
        logOrchestration({
          strategy: strategy.mode, reason: strategy.reason, operations: ['POST /v1/search'],
          fallbackUsed: Boolean(error.fallbackUsed), outcome: 'error'
        });
        throw error;
      }
      const filters = { ...request.filters };
      delete filters.colors;
      const fallbackRequest = { ...request, filters, config: { ...(request.config || {}), mode: 'default' } };
      result = {
        data: await api('products/search', fallbackRequest, signal),
        mode: 'default',
        fallbackUsed: true,
        attempts: (error.attempts || 1) + 1
      };
      result.data._requestFilters = filters;
      $('#palette-status').textContent = 'Channel3 rejected the Beta colour filter; results were searched without palette matching.';
    }
    request.config = { ...(request.config || {}), mode: result.mode };
    logOrchestration({
      strategy: result.mode,
      reason: strategy.reason,
      operations: Array.from({ length: result.attempts }, (_, index) => `POST /v1/search (${index === 0 && strategy.mode === 'agentic' ? 'agentic' : 'default'})`),
      fallbackUsed: result.fallbackUsed,
      outcome: 'success'
    });
    return result;
  }
  function reportingRange(days) {
    const end = new Date(), start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }
  function renderReporting() {
    const metrics = $('#reporting-metrics');
    metrics.replaceChildren();
    const clicks = clickReport?.totalClicks;
    const transactions = transactionReport?.totalTransactions;
    const metric = (label, value) => {
      const item = node('div', undefined, 'reporting-metric');
      item.append(node('span', label), node('strong', value === null || value === undefined ? 'Not supplied' : String(value)));
      metrics.append(item);
    };
    metric('Product clicks', clicks);
    metric('Attributed purchases', transactions);
    metric('Conversion rate', clicks > 0 && transactions !== null && transactions !== undefined
      ? `${(transactions / clicks * 100).toFixed(1)}%` : clicks === 0 ? 'N/A · no clicks' : null);
    const dates = clickReport?.startDate && clickReport?.endDate
      ? `${new Date(clickReport.startDate).toLocaleDateString()} – ${new Date(clickReport.endDate).toLocaleDateString()}`
      : transactionReport?.startDate && transactionReport?.endDate
        ? `${new Date(transactionReport.startDate).toLocaleDateString()} – ${new Date(transactionReport.endDate).toLocaleDateString()}`
        : 'Reporting period unavailable';
    metric('Reporting period', dates);

    const chart = $('#reporting-chart');
    chart.replaceChildren();
    if (clicks !== null && clicks !== undefined && transactions !== null && transactions !== undefined) {
      const max = Math.max(clicks, transactions, 1);
      for (const [label, value] of [['Clicks', clicks], ['Transactions', transactions]]) {
        const bar = node('div', undefined, 'reporting-bar');
        const fill = node('div', undefined, 'reporting-bar-fill');
        fill.style.height = `${Math.max(value ? 4 : 0, value / max * 90)}px`;
        fill.setAttribute('aria-label', `${label}: ${value}`);
        bar.append(node('strong', String(value)), fill, node('span', label));
        chart.append(bar);
      }
    } else {
      chart.append(node('p', 'Chart unavailable because Channel3 did not supply both reporting totals.', 'muted'));
    }

    const values = $('#reporting-values');
    values.replaceChildren();
    const transactionsPage = transactionReport?.items || [];
    const withCurrency = transactionsPage.filter(item => item.orderAmount !== null && item.currency);
    const amounts = new Map();
    for (const item of withCurrency) amounts.set(item.currency, (amounts.get(item.currency) || 0) + item.orderAmount);
    if (clicks === 0 && transactions === 0) {
      values.append(node('p', 'No affiliate activity found for this reporting period. Product clicks and attributed purchases will appear here when Channel3 reports them.', 'empty-state'));
    }
    if (amounts.size) {
      for (const [currency, total] of amounts) values.append(node('p', `Transaction value on loaded page · ${formatProductPrice(total, currency)} (${transactionsPage.length} loaded records).`));
    } else if (transactionsPage.some(item => item.orderAmount !== null)) {
      values.append(node('p', 'Transaction amounts are present, but Channel3 does not provide their currency in the current reporting schema; no total is calculated.', 'muted'));
    } else {
      values.append(node('p', 'No transaction values were supplied for the loaded page.', 'muted'));
    }
    if (transactionReport?.totalCommission !== null && transactionReport?.totalCommission !== undefined) {
      values.append(node('p', `Channel3 net commission summary: ${transactionReport.totalCommission}. Currency is not specified by the reporting response, so this amount is not assigned a currency.`,'muted'));
    }

    const clicksTarget = $('#click-report-items');
    clicksTarget.replaceChildren();
    for (const item of clickReport?.items || []) {
      const row = node('div', undefined, 'reporting-item');
      row.append(node('strong', item.product?.title || item.product?.id || 'Product not matched'));
      row.append(node('div', new Date(item.timestamp).toLocaleString()));
      clicksTarget.append(row);
    }
    if (!clickReport?.items?.length) clicksTarget.append(node('p', 'No click events returned for this period.', 'muted'));
    const transactionsTarget = $('#transaction-report-items');
    transactionsTarget.replaceChildren();
    for (const item of transactionReport?.items || []) {
      const row = node('div', undefined, 'reporting-item');
      const amount = item.orderAmount === null ? 'Order amount not supplied'
        : item.currency ? formatProductPrice(item.orderAmount, item.currency) : `${item.orderAmount} · currency not supplied`;
      row.append(node('strong', item.product?.title || item.brandName || 'Transaction'));
      row.append(node('div', `${amount} · ${item.status || 'status unknown'}`));
      row.append(node('small', new Date(item.purchasedAt).toLocaleString()));
      transactionsTarget.append(row);
    }
    if (!transactionReport?.items?.length) transactionsTarget.append(node('p', 'No attributed transactions returned for this period.', 'muted'));
    $('#more-clicks').hidden = !clickReport?.hasMore;
    $('#more-transactions').hidden = !transactionReport?.hasMore;
  }
  async function loadReporting() {
    $('#reporting-status').textContent = 'Loading Channel3 click and transaction reports…';
    $('#load-reporting').disabled = true;
    clickReport = null; transactionReport = null;
    const range = reportingRange(Number($('#reporting-period').value));
    const results = await Promise.allSettled([
      api('reporting/clicks', { ...range, page: 1, limit: 100 }),
      api('reporting/transactions', { ...range, page: 1, limit: 100 })
    ]);
    if (results[0].status === 'fulfilled') clickReport = results[0].value;
    if (results[1].status === 'fulfilled') transactionReport = results[1].value;
    renderReporting();
    const failures = results.filter(result => result.status === 'rejected');
    $('#reporting-status').textContent = failures.length
      ? 'Some affiliate report data could not be loaded. Check your connection or try again.'
      : clickReport?.totalClicks === 0 && transactionReport?.totalTransactions === 0
        ? 'No affiliate activity was reported for this period.'
        : 'Channel3 reporting loaded for this period. Attribution depends on merchant tracking and approval.';
    $('#load-reporting').disabled = false;
  }
  async function loadMoreReport(kind) {
    const report = kind === 'clicks' ? clickReport : transactionReport;
    if (!report?.hasMore) return;
    const button = kind === 'clicks' ? $('#more-clicks') : $('#more-transactions');
    button.disabled = true;
    try {
      const next = await api(`reporting/${kind}`, {
        startDate: report.startDate, endDate: report.endDate, page: report.page + 1, limit: report.limit
      });
      const combined = { ...next, items: [...report.items, ...next.items] };
      if (kind === 'clicks') clickReport = combined; else transactionReport = combined;
      renderReporting();
      $('#reporting-status').textContent = `${kind === 'clicks' ? 'Click' : 'Transaction'} page ${next.page} loaded.`;
    } catch (error) {
      $('#reporting-status').textContent = channel3ErrorMessage(error, `the next ${kind === 'clicks' ? 'click report page' : 'purchase report page'}`);
    } finally { button.disabled = false; }
  }
  function setMoreProducts(token, loader) {
    const button = $('#load-more-products');
    button.hidden = !token;
    button.disabled = false;
    button.textContent = loader ? 'Load more products' : 'Load more products';
    button.onclick = token ? loader : null;
  }
  async function loadMoreSearch() {
    if (!activeSearch?.nextPageToken) return;
    const state = activeSearch; $('#load-more-products').disabled = true;
    try {
      const next = await api('products/search', { ...state.request, pageToken: state.nextPageToken });
      if (activeSearch !== state) return;
      state.nextPageToken = next.nextPageToken || next.pageToken;
      const combined = [...state.products, ...(next.products || [])];
      state.products = combined;
      renderProducts(combined, state.assessments, { nextPageToken: state.nextPageToken, loadMore: loadMoreSearch });
    } catch (error) { $('#products-notice').textContent = `Could not load the next page: ${error.message}`; }
    finally { $('#load-more-products').disabled = false; }
  }
  async function findSimilar(product) {
    const saved = resultsSnapshot();
    cancel({ keepResults: true });
    selectedProductContext = product;
    const request = { id: product.id, limit: 12, config: market(), filters: searchFilters() };
    const requestId = {};
    activeSimilar = requestId; activeSearch = null; activeBrowse = null;
    $('#products-notice').textContent = `Finding products similar to ${product.title}…`;
    setMoreProducts(null);
    try {
      const data = await api('products/similar', request);
      if (activeSimilar !== requestId) return;
      const state = { request, products: data.products || [], assessments: [], nextPageToken: data.nextPageToken || data.pageToken, kind: 'similar' };
      activeSimilar = state;
      resultHistory.push(saved); if (resultHistory.length > 10) resultHistory.shift();
      renderProducts(state.products, [], { nextPageToken: state.nextPageToken, loadMore: () => loadMoreSimilar(state), keepNavigation: true });
      $('#products-notice').textContent = state.products.length ? `Native Channel3 similar products for ${product.title}.` : 'Channel3 found no similar products for this catalog item.';
      logOrchestration({ strategy: 'native-similar', reason: 'selected canonical product is the discovery context', operations: ['POST /v1/similar'], fallbackUsed: false, outcome: state.products.length ? 'products-returned' : 'empty' });
    } catch (error) {
      if (activeSimilar !== requestId) return;
      $('#products-notice').textContent = error.status === 404 ? 'Channel3 no longer has this canonical product ID. Search by text or image instead.' : `Similar-product search unavailable: ${error.message}`;
      logOrchestration({ strategy: 'native-similar', reason: 'selected canonical product is the discovery context', operations: ['POST /v1/similar'], fallbackUsed: false, outcome: 'error' });
    }
  }
  async function loadMoreSimilar(state) {
    if (!state.nextPageToken) return;
    $('#load-more-products').disabled = true;
    try {
      const next = await api('products/similar', { ...state.request, pageToken: state.nextPageToken });
      if(activeSimilar!==state)return;
      state.nextPageToken = next.nextPageToken || next.pageToken;
      state.products = [...state.products, ...(next.products || [])];
      renderProducts(state.products, [], { nextPageToken: state.nextPageToken, loadMore: () => loadMoreSimilar(state), keepNavigation: true });
    } catch (error) { $('#products-notice').textContent = `Could not load similar products: ${error.message}`; }
    finally { $('#load-more-products').disabled = false; }
  }
  function populateOptions(select, items, { value, label, empty } = {}) {
    const previous = select.value;
    select.replaceChildren(new Option(empty, ''));
    for (const item of items) {
      const id = value(item), name = label(item);
      if (id && name) select.add(new Option(name, id));
    }
    if ([...select.options].some(option => option.value === previous)) select.value = previous;
  }
  async function categoryDetails(slug) {
    $('#category-attributes').replaceChildren();
    if (!slug) return;
    $('#catalog-notice').textContent = 'Loading available category attributes…';
    try {
      const data = await api('catalog/categories/details', { slug });
      const category = data.category || data;
      for (const attribute of category.attributes || []) {
        const handle = attribute.handle || attribute.slug;
        if (!handle || !Array.isArray(attribute.values)) continue;
        const label = node('label', attribute.name || handle);
        if (attribute.values.length) {
          const select = document.createElement('select'); select.multiple = true; select.dataset.attribute = handle;
          for (const value of attribute.values) if (typeof value === 'string') select.add(new Option(value, value));
          select.onchange = changeSearch;
          label.append(select);
        } else {
          const input = document.createElement('input'); input.type = 'text'; input.maxLength = 200; input.dataset.attribute = handle;
          input.onchange = changeSearch;
          label.append(input);
        }
        $('#category-attributes').append(label);
      }
      $('#catalog-notice').textContent = `${category.attributes?.length || 0} category attribute groups available.`;
    } catch (error) { $('#catalog-notice').textContent = `Category filters unavailable: ${error.message}`; }
  }
  async function searchCategoryCatalog() {
    const query = $('#category-query').value.trim();
    if (!query) { $('#catalog-notice').textContent = 'Enter a category name first.'; return; }
    $('#catalog-notice').textContent = 'Searching Channel3 categories…';
    try {
      const data = await api('catalog/categories/search', { query });
      const items = data.categories || data.items || [];
      populateOptions($('#category-filter'), items, { value: item => item.slug, label: item => item.name || item.title || item.slug, empty: 'Choose a category' });
      if (!items.length) $('#catalog-notice').textContent = 'No matching Channel3 categories.';
      else { $('#catalog-notice').textContent = `${items.length} categories found.`; if (items.length === 1) { $('#category-filter').value = items[0].slug; await categoryDetails(items[0].slug); changeSearch(); } }
    } catch (error) { $('#catalog-notice').textContent = `Category search failed: ${error.message}`; }
  }
  async function listCategoryCatalog(page = 1) {
    $('#catalog-notice').textContent = 'Loading Channel3 categories…';
    try {
      const data = await api('catalog/categories/list', { rootsOnly: true, page, pageSize: 100 });
      const items = data.items || data.categories || [];
      const select=$('#category-filter'),prior=select.value;
      const existing=page>1?[...select.options].filter(option=>option.value).map(option=>({slug:option.value,title:option.textContent})):[];
      populateOptions(select,[...existing,...items],{value:item=>item.slug,label:item=>item.name||item.title||item.slug,empty:'Choose a category'});
      if(prior&&[...select.options].some(option=>option.value===prior))select.value=prior;
      categoryPage=data.page||page;categoryTotal=data.total||items.length;
      $('#category-more').hidden=categoryPage*100>=categoryTotal;
      $('#catalog-notice').textContent = items.length ? `${items.length} top-level categories loaded.` : 'No top-level categories returned.';
    } catch (error) { $('#catalog-notice').textContent = `Could not load categories: ${error.message}`; }
  }
  async function searchBrandCatalog() {
    const query = $('#brand-query').value.trim();
    if (!query) { $('#catalog-notice').textContent = 'Enter a brand name first.'; return; }
    $('#catalog-notice').textContent = 'Searching Channel3 brands…';
    try {
      const category = $('#category-filter').value;
      const data = await api('catalog/brands/search', { query, categoryIds: category ? [category] : [], config: market() });
      const items = data.brands || data.items || [];
      populateOptions($('#catalog-brand'), items, { value: item => item.id, label: item => item.name, empty: 'Choose a brand' });
      $('#catalog-notice').textContent = items.length ? `${items.length} Channel3 brands found.` : 'No matching Channel3 brands.';
    } catch (error) { $('#catalog-notice').textContent = `Brand search failed: ${error.message}`; }
  }
  async function listBrandCatalog(cursor) {
    $('#catalog-notice').textContent = 'Loading Channel3 brands…';
    try {
      const category = $('#category-filter').value;
      const data = await api('catalog/brands/list', { limit: 100, cursor, categoryIds: category ? [category] : [], config: market() });
      const items = data.items || [];
      const select = $('#catalog-brand'), previous = select.value;
      const existing = cursor ? [...select.options].filter(option => option.value).map(option => ({ id: option.value, name: option.textContent })) : [];
      populateOptions(select, [...existing, ...items], { value: item => item.id, label: item => item.name, empty: 'Choose a brand' });
      if (previous && [...select.options].some(option => option.value === previous)) select.value = previous;
      brandCursor = data.next_cursor || null;
      $('#brand-more').hidden = !brandCursor;
      $('#catalog-notice').textContent = items.length ? `${items.length} Channel3 brands loaded.` : 'No additional brands returned.';
    } catch (error) { $('#catalog-notice').textContent = `Could not load brands: ${error.message}`; }
  }
  async function showBrandDetails() {
    const id = $('#catalog-brand').value, target = $('#brand-details-view');
    target.replaceChildren();
    if (!id) { target.textContent = 'Choose a brand first.'; return; }
    try {
      const data = await api('catalog/brands/details', { id }), brand = data.brand || data;
      target.append(node('strong', brand.name || 'Channel3 brand'));
      if (brand.description) target.append(node('p', brand.description));
      if (brand.best_commission_rate !== undefined) target.append(node('small', `Maximum commission rate reported by Channel3: ${brand.best_commission_rate}%`));
    } catch (error) { target.textContent = `Brand details unavailable: ${error.message}`; }
  }
  async function browseCatalog() {
    const category = $('#category-filter').value, brand = $('#catalog-brand').value;
    if (!category && !brand) { $('#catalog-notice').textContent = 'Choose a category or brand to browse.'; return; }
    const filters = {};
    if (category) filters.category_ids = [category];
    if (brand) filters.brand_ids = [brand];
    if ($('#budget').value) filters.price = { max_price:Number($('#budget').value) };
    const requestedFilters=searchFilters(filters);
    const request = { filters:requestedFilters, limit: 12, config: market() };
    const requestId={};activeBrowse=requestId;activeSimilar=null;activeSearch=null;
    $('#products-container').replaceChildren();setMoreProducts(null);
    $('#catalog-notice').textContent = 'Browsing Channel3 products…';
    try {
      const data = await api('products/browse', request);
      if(activeBrowse!==requestId)return;
      activeBrowse = { request, products: data.products || [], nextPageToken: data.nextPageToken || data.pageToken };
      activeSearch = null;
      renderProducts(activeBrowse.products, [], { nextPageToken: activeBrowse.nextPageToken, loadMore: loadMoreBrowse });
      $('#catalog-notice').textContent = activeBrowse.products.length ? `${activeBrowse.products.length} catalog products loaded.` : 'No products in this catalog page.';
      logOrchestration({ strategy: 'catalog-browse', reason: 'a real Channel3 category or brand was selected', operations: ['POST /v1/browse'], fallbackUsed: false, outcome: activeBrowse.products.length ? 'products-returned' : 'empty' });
    } catch (error) { if(activeBrowse===requestId)$('#catalog-notice').textContent = `Catalog browse failed: ${error.message}`; }
  }
  async function loadMoreBrowse() {
    const state = activeBrowse;
    if (!state?.nextPageToken) return;
    $('#load-more-products').disabled = true;
    try {
      const next = await api('products/browse', { ...state.request, pageToken: state.nextPageToken });
      if (activeBrowse !== state) return;
      state.nextPageToken = next.nextPageToken || next.pageToken;
      state.products = [...state.products, ...(next.products || [])];
      renderProducts(state.products, [], { nextPageToken: state.nextPageToken, loadMore: loadMoreBrowse });
    } catch (error) { $('#catalog-notice').textContent = `Could not load more catalog products: ${error.message}`; }
    finally { $('#load-more-products').disabled = false; }
  }
  async function runSearch(version, signal, force) {
    if (!current) return;
    activeSearch=null;activeBrowse=null;activeSimilar=null;
    setStage('search', 'active');
    $('#investigation-status').textContent = 'Finding matching products on Channel3…';
    const plan = searchPlan(current.profile,intent,$('#budget').value), config = market();
    const filters = searchFilters(plan.filters);
    const key = JSON.stringify([current.key,intent,$('#budget').value,config,filters]);
    const request = { query:plan.query,image:plan.useImage ? crop(current.object.box) : undefined,limit:12,filters,config };
    $('#product-query').value = ''; $('#products-notice').textContent = `Searching ${intent === 'exact' ? 'identity candidates' : intent === 'look' ? 'similar appearances' : 'functional alternatives'}…`;
    $('#search-products-btn').disabled = true;
    try {
      let data = force ? null : searches.get(key);
      if (!data) {
        if (filters.colors) $('#products-notice').textContent = 'Searching with the optional Channel3 colour filter…';
        const outcome = await discoverySearch(request, signal);
        data = outcome.data;
        if (version !== generation) return;
        if (data._requestFilters) request.filters = data._requestFilters;
        data._searchMode = request.config.mode;
        searches.set(key,data);
      } else if (data._searchMode) {
        request.config = { ...request.config, mode: data._searchMode };
      }
      if (version !== generation) return;
      activeSearch = { request, products:data.products || [], assessments:data.assessments || [], nextPageToken:data.nextPageToken || data.pageToken };
      current.results = data; current.searchKey = key; renderProducts(data.products || [], data.assessments || [], { nextPageToken:data.nextPageToken || data.pageToken, loadMore:loadMoreSearch });
      setStage('search', 'complete');
      if (intent === 'exact' && data.products?.length && !data.assessments) {
        setStage('comparison', 'active');
        $('#investigation-status').textContent = 'Products are displayed. Comparing available listings…';
        void compareCandidates(version,signal);
      } else {
        setStage('comparison', 'skipped');
        $('#investigation-status').textContent = 'Your results are ready!';
      }
    } catch (e) {
      if (version === generation && e.name !== 'AbortError') {
        setStage('search', 'error');
        setStage('comparison', 'skipped');
        $('#products-notice').textContent = searchErrorMessage(e);
        $('#investigation-status').textContent = `${searchErrorMessage(e)} Use Search to retry.`;
      }
    } finally { if (version === generation) $('#search-products-btn').disabled = false; }
  }
  async function compareCandidates(version, signal) {
    const state = current, displayedProducts = lastRendered.products;
    $('#investigation-status').textContent = 'Comparing available listings…';
    try {
      const data = await api('products/compare',{ image:crop(state.object.box),profile:state.profile,ids:state.results.products.slice(0,3).map(p=>p.id) },signal);
      if (version !== generation || current !== state) return;
      const detailed = new Map(data.products.map(p=>[p.id,p]));
      state.results.products = state.results.products.map(p=>detailed.get(p.id)||p);state.results.assessments=data.assessments;state.results.comparedImageIds=data.comparedImageIds||[];
      searches.set(state.searchKey,state.results);
      if(activeSearch){activeSearch.products=state.results.products;activeSearch.assessments=data.assessments;}
      if (!resultHistory.length && lastRendered.products === displayedProducts) renderProducts(state.results.products,data.assessments,{nextPageToken:activeSearch?.nextPageToken,loadMore:loadMoreSearch});
      setStage('comparison', 'complete');
      $('#investigation-status').textContent = 'Your results are ready! Available listings were compared.';
    } catch(e) {
      if(version===generation&&e.name!=='AbortError') {
        setStage('comparison', 'error');
        $('#investigation-status').textContent = 'Your results are ready. Deeper comparison could not finish; review listing details before buying.';
      }
    }
  }
  function renderProducts(products, assessments = [], { nextPageToken = null, loadMore = loadMoreSearch, target = $('#products-container'), sceneObject = null, keepNavigation = false } = {}) {
    const sceneResults = Boolean(sceneObject);
    if (!sceneResults) { if (!keepNavigation) resultHistory.length = 0; updateResultsBack(); lastRendered = {products,assessments}; }
    const cards = document.createDocumentFragment();
    let priceSorted=false;
    try { const prepared=shopping.prepare(products, sceneObject || current?.object || selected || {}, sceneResults ? 'look' : intent);products=prepared.products;priceSorted=prepared.priceSorted; }
    catch(e){if(!sceneResults)$('#products-notice').textContent=e.message;return;}

    if (!sceneResults) {
      $('#products-notice').textContent = products.length ? `${products.length} ${intent==='exact'?'identity candidates':intent==='look'?'similar-looking products':intent==='cheaper'?'alternatives sorted by price (original price unknown)':'functional alternatives'}. Exact identity is not verified. We may earn a commission from retailer links.` : 'No catalog matches found. Try another intent, increase your budget, or edit the query. An absent listing does not mean the item does not exist.';
    }
    const ratings = new Map(assessments.map(a=>[a.id,a]));
    const rank = { identifier_match:0,possible_match:1,similar:2,contradicted:3 };
    const relevance = p => (rank[ratings.get(p.id)?.verdict] ?? 2) * 100 + (ratings.get(p.id)?.differences.length || 0) * 3 + (intent === 'exact' && /bundle|with.*stand|w\/stand/i.test(p.title) ? 12 : 0);
    const ordered=priceSorted ? products : [...products].sort((a,b)=>relevance(a)-relevance(b));
    if (!sceneResults) { setMoreProducts(nextPageToken, loadMore); $('#results-count').textContent = `${ordered.length} products`; }
    for(const product of ordered) {
      const card=node('article',undefined,'product-card');card.dataset.productId=product.id;
      const image=node('img',undefined,'product-thumb');image.alt=product.title;image.referrerPolicy='no-referrer';image.loading='lazy';
      const placeholder='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" rx="12" fill="%23dff1e7"/></svg>';
      image.src=safeProductUrl(product.image)||placeholder;image.addEventListener('error',()=>image.src=placeholder,{once:true});
      const info=node('div',undefined,'product-info');info.append(node('div',product.title,'product-title'),node('div',`${formatProductPrice(product.price,product.currency)} · ${product.retailer||product.brand||'Retailer'}`,'product-meta'));
      info.append(shopping.actions(product,()=>card.checkoutSelection));
      const assessment=ratings.get(product.id);
      if(assessment){const labels={identifier_match:'Identifier agrees · variant not verified',possible_match:'Possible match',similar:'Similar product',contradicted:'Conflicting evidence'};info.append(node('div',labels[assessment.verdict],'match-label'));const evidence=node('details');evidence.append(node('summary','Why this result?'));for(const [name,values] of [['Matches',assessment.matches],['Differences',assessment.differences],['Unknown',assessment.unknowns]])if(values.length)evidence.append(node('p',`${name}: ${values.join(' · ')}`));evidence.append(node('small',current?.results?.comparedImageIds?.includes(product.id) ? 'AI compared the video crop with catalog photos and listing text. This is supporting evidence, not proof of exact identity.' : 'AI compared the video crop with catalog text. A catalog photo was unavailable for this comparison.'));info.append(evidence);if(assessment.differences.length)info.append(node('small',`Difference: ${assessment.differences[0]}`));}else {info.append(node('small',product.matchType || 'Unverified catalog candidate')); if(product.matchExplanation) {const why=node('details');why.append(node('summary','Why this result?'),node('p',product.matchExplanation));info.append(why);}}
      card.checkoutSelection={id:product.id,selection:Object.fromEntries((product.variants?.selected||[]).map(v=>[v.name,v.label])),websiteIds:product.retailer?[product.retailer]:[],config:market(),expectedOffer:offerSnapshot(product)};
      card.checkoutAction=checkoutAction(() => card.checkoutSelection,product);info.append(card.checkoutAction);
      const details=node('button','View specifications','secondary');details.onclick=()=>showDetails(product,card,details);info.append(details);
      const similar=node('button','Find similar products','secondary');similar.onclick=()=>findSimilar(product);info.append(similar);
      const url=safeProductUrl(product.purchaseUrl);if(url){const link=node('a','Buy from seller ↗','buy-button');link.href=url;link.target='_blank';link.rel='noopener noreferrer';info.append(link);}
      card.append(image,info);cards.append(card);
    }
    target.replaceChildren(cards);
  }
  function sceneSearchContext() {
    return { filters: searchFilters(), config: market() };
  }
  function sceneSearchCacheKey(sceneObject, requestContext) {
    return JSON.stringify([sceneObject.searchIntent.query, requestContext]);
  }
  async function discoverSceneObject(sceneObject, target, signal, requestContext = sceneSearchContext()) {
    const request = {
      query: sceneObject.searchIntent.query,
      image: sceneObject.searchIntent.useImage ? sceneObject.crop : undefined,
      limit: 8,
      filters: requestContext.filters,
      config: requestContext.config
    };
    const outcome = await discoverySearch(request, signal);
    const products = outcome.data.products || [];
    renderProducts(products, [], { target, sceneObject });
    return products;
  }
  function renderSceneResults(sceneObject, target) {
    renderProducts(sceneObject.results || [], [], { target, sceneObject });
  }
  function listSubscriptionEvents() { return api('subscriptions/events', { limit: 100 }); }
  function markSubscriptionEventsRead(eventIds) { return api('subscriptions/events/read', { eventIds }); }
  function checkoutAction(selection, product) {
    const group=node('div',undefined,'sandbox-action'), button=node('button','Pay with PayPal','secondary'), note=node('small');
    let eligible=true;
    group.updateOffer=offer=>{
      const out=offer.availability==='OutOfStock'||offer.availability==='out_of_stock';
      const valid=offer.price!=null&&Number.isFinite(Number(offer.price))&&Number(offer.price)>0&&['USD','EUR','GBP','CAD','AUD'].includes(offer.currency);
      eligible=Boolean(offer.retailer)&&!out&&valid;button.disabled=!eligible;
      note.textContent=out?'Currently unavailable from this seller.':!valid?'See seller for pricing and purchase options.':!offer.retailer?'Seller identity is unavailable; checkout cannot pin this offer.':'Review price and selected options before paying.';
    };
    group.disableSelection=message=>{eligible=false;button.disabled=true;note.textContent=message;};
    group.updateOffer(product);
    button.dataset.action='sandbox-checkout';
    button.onclick=async()=>{
      // Open synchronously from the click; browsers block popups after await.
      const checkout=window.open('about:blank','_blank');
      if(!checkout){note.textContent='Allow this checkout tab to open, then try again.';return;}
      checkout.opener=null;button.disabled=true;note.textContent='Checking the selected listing and current catalog price…';
      try {
        const data=await api('payments/quotes',selection());
        const url=new URL(data.checkoutUrl);
        if(url.origin!=='http://127.0.0.1:4317'||url.pathname!=='/checkout')throw new Error('Invalid checkout address.');
        checkout.location.replace(url.href);
        note.textContent='Quote ready in the checkout tab. Your video stays here.';
      } catch(e){checkout.close();note.textContent=e.message||'Checkout unavailable. Try again.';}
      finally{button.disabled=!eligible;}
    };
    group.append(button,note);return group;
  }
  function offerSnapshot(offer) {
    return {
      retailer:offer.retailer||'',
      price:offer.price??null,
      currency:offer.currency??null,
      condition:offer.condition??null,
      availability:offer.availability??null,
      purchaseUrl:offer.purchaseUrl||''
    };
  }
  function drawPriceHistory(target, history) {
    target.replaceChildren();
    if (!history.history.length) {
      target.append(node('p', 'No historical price points are available for this product in the selected period.', 'muted'));
      return;
    }
    const currencies = [...new Set(history.history.map(point => point.currency))];
    if (currencies.length !== 1) {
      target.append(node('p', 'Channel3 returned multiple currencies; the chart is omitted to avoid comparing unlike prices.', 'variant-warning'));
      for (const point of history.history) target.append(node('p', `${new Date(point.timestamp).toLocaleDateString()} · ${formatProductPrice(point.price, point.currency)}`));
      return;
    }
    const currency = currencies[0], points = priceHistorySeries(history.history, currency);
    if (!points.length) { target.append(node('p', 'No valid recorded prices are available.', 'muted')); return; }
    const min = Math.min(...points.map(p => p.price)), max = Math.max(...points.map(p => p.price));
    const chart = createPriceHistoryChart(points, currency); chart.classList.add('price-history-chart');
    target.append(chart, node('p', `${points.length} recorded prices · ${formatProductPrice(min, currency)} low · ${formatProductPrice(max, currency)} high`));
    const stats = history.statistics;
    if (stats && (!stats.currency || stats.currency === currency)) {
      const supplied = [
        stats.mean !== null && `Mean ${formatProductPrice(stats.mean, currency)}`,
        stats.minPrice !== null && `Minimum ${formatProductPrice(stats.minPrice, currency)}`,
        stats.maxPrice !== null && `Maximum ${formatProductPrice(stats.maxPrice, currency)}`,
        stats.currentPrice !== null && `Current ${formatProductPrice(stats.currentPrice, currency)}`,
        stats.currentStatus && `Status ${stats.currentStatus}`
      ].filter(Boolean);
      if (supplied.length) target.append(node('p', supplied.join(' · ')));
    }
  }
  async function loadPriceHistory(id, days, target, button) {
    button.disabled = true;
    target.replaceChildren(node('p', 'Loading Channel3 price history…', 'muted'));
    try {
      const history = await api('products/price-history', { id, days });
      if (history.canonicalProductId && history.canonicalProductId !== id) throw new Error('Channel3 returned history for a different product ID.');
      drawPriceHistory(target, history);
    } catch (error) {
      target.replaceChildren(node('p', `Price history unavailable: ${error.message}`));
    } finally { button.disabled = false; }
  }
  async function renderProductSubscriptions(target, product, unavailableSelection) {
    const panel = node('section', undefined, 'subscription-controls');
    panel.append(node('h3', 'Price & Availability Alerts'));
    panel.append(node('p', 'Choose supported price or availability updates, review active subscriptions below, and check the alert inbox for changes. Updates depend on Channel3 provider support and webhook delivery. Optional desktop notifications can be enabled in the alert inbox.', 'muted'));
    const eventTypes = [
      ['offer.price.changed', 'Price changes', true],
      ['offer.availability.changed', 'Availability changes', true],
      ['offer.created', 'New seller offers', false],
      ['offer.deleted', 'Seller offers removed', false]
    ];
    const selectedEvents = [];
    for (const [event, title, checked] of eventTypes) {
      const label = node('label', undefined, 'subscription-event');
      const input = document.createElement('input');
      input.type = 'checkbox'; input.checked = checked;
      input.addEventListener('change', () => {
        if (input.checked && !selectedEvents.includes(event)) selectedEvents.push(event);
        if (!input.checked) {
          const index = selectedEvents.indexOf(event);
          if (index >= 0) selectedEvents.splice(index, 1);
        }
      });
      if (checked) selectedEvents.push(event);
      label.append(input, node('span', title));
      panel.append(label);
    }
    if (product.variants?.options?.length) {
      const variant = (product.variants.selected || []).map(option => `${option.name}: ${option.label}`).join(' · ');
      panel.append(node('p', unavailableSelection
        ? 'This response substituted or omitted a variant. Choose a complete supported configuration and refresh before creating an alert.'
        : `Variant being watched: ${variant || 'No complete variant selection was supplied.'}`, unavailableSelection ? 'variant-warning' : 'muted'));
    }
    const create = node('button', 'Create alert subscription', 'secondary');
    create.type = 'button'; create.disabled = Boolean(unavailableSelection);
    const status = node('p', 'No subscription request made.', 'muted');
    const active = node('div', undefined, 'active-subscriptions');
    const cancelled = node('div', undefined, 'cancelled-subscriptions');
    const cancelledItems = [];
    function renderCancelled() {
      cancelled.replaceChildren();
      if (!cancelledItems.length) {
        cancelled.append(node('p', 'No cancelled subscriptions for this product.', 'muted'));
        return;
      }
      for (const item of cancelledItems) {
        const row = node('div', undefined, 'cancelled-subscription');
        row.append(node('strong', `Cancelled · ${item.label}`), node('p', item.message, 'muted'));
        cancelled.append(row);
      }
    }
    const refresh = node('button', 'Refresh subscriptions', 'secondary');
    refresh.type = 'button';
    const loadMore = node('button', 'Load more subscriptions', 'secondary');
    loadMore.type = 'button'; loadMore.hidden = true;
    const pager = createSubscriptionPager(cursor => api('subscriptions/list', {
      status: 'active', limit: 100, ...(cursor ? { cursor } : {})
    }), product.id);
    async function load(reset = true) {
      if (reset) {
        pager.reset();
        active.replaceChildren(node('p', 'Loading subscriptions…', 'muted'));
      } else active.querySelectorAll('.subscription-page-notice, .subscription-load-error').forEach(item => item.remove());
      refresh.disabled = true;
      loadMore.disabled = true;
      try {
        const page = await pager.next();
        if (reset) active.replaceChildren();
        for (const item of page.items) {
          const row = node('div', undefined, 'active-subscription');
          const variant = item.variantSelection?.map(option => `${option.name}: ${option.label}`).join(' · ');
          row.append(node('p', `${item.events.join(', ')}${variant ? ` · ${variant}` : ''}`));
          const cancelButton = node('button', 'Cancel alerts', 'secondary');
          cancelButton.type = 'button';
          cancelButton.addEventListener('click', async () => {
            cancelButton.disabled = true;
            try {
              const cancelled = await api('subscriptions/cancel', { subscriptionId: item.subscriptionId });
              status.textContent = cancelled.shared
                ? 'Alerts were removed from this installation; another installation still owns the shared Channel3 subscription.'
                : cancelled.unavailable ? 'Channel3 no longer has this subscription; local ownership was closed.'
                  : 'Channel3 subscription cancelled.';
              cancelledItems.push({
                label: `${item.events.join(', ')}${variant ? ` · ${variant}` : ''}`,
                message: status.textContent
              });
              renderCancelled();
              await load();
            } catch (error) {
              status.textContent = channel3ErrorMessage(error, 'cancel the subscription');
              cancelButton.disabled = false;
            }
          });
          row.append(cancelButton);
          active.append(row);
        }
        const displayed = active.querySelectorAll('.active-subscription').length;
        if (!displayed) {
          const notice = node('p', page.hasMore
            ? 'No subscriptions for this product on this page; more pages may contain matching alerts.'
            : 'You haven’t subscribed to this product for alerts yet. Your subscriptions will appear here.', 'empty-state');
          notice.classList.add('subscription-page-notice');
          active.append(notice);
        }
        loadMore.hidden = !page.hasMore;
      } catch (error) {
        if (reset) active.replaceChildren();
        const notice = node('p', channel3ErrorMessage(error, 'load subscriptions'), 'variant-warning');
        notice.classList.add('subscription-load-error');
        active.append(notice);
      } finally { refresh.disabled = false; loadMore.disabled = false; }
    }
    create.addEventListener('click', async () => {
      const events = eventTypes.map(([event]) => event).filter(event => selectedEvents.includes(event));
      if (!events.length) { status.textContent = 'Select at least one event type.'; return; }
      create.disabled = true;
      status.textContent = 'Creating Channel3 product subscription…';
      try {
        const request = { productId: product.id, events };
        if (product.variants?.options?.length) {
          request.selection = (product.variants.selected || []).map(({ name, label }) => ({ name, label }));
        }
        const data = await api('subscriptions/create', request);
        status.textContent = data.duplicate
          ? 'This installation already has the matching active subscription.'
          : 'Channel3 subscription saved. Alerts arrive when a catalog refresh detects a change.';
        await load();
      } catch (error) {
        status.textContent = channel3ErrorMessage(error, 'create the subscription');
      } finally { create.disabled = Boolean(unavailableSelection); }
    });
    refresh.addEventListener('click', load);
    loadMore.addEventListener('click', () => load(false));
    panel.append(create, status, refresh, node('h4', 'Active subscriptions'), active, node('h4', 'Cancelled subscriptions'), cancelled);
    renderCancelled();
    target.append(panel);
    await load();
  }
  async function showDetails(product, card, button, selection = {}) {
    selectedProductContext = product;
    const old=card.querySelector('.catalog-details');if(old&&Object.keys(selection).length===0){old.hidden=!old.hidden;return;}
    const revision = (detailGenerations.get(card) || 0) + 1;
    detailGenerations.set(card, revision);
    const box=old||node('div',undefined,'catalog-details');if(!old)card.append(box);box.hidden=false;box.replaceChildren(node('p','Loading catalog specifications…'));button.disabled=true;
    try {
      const data=await api('products/details',{id:product.id,selection,config:market()},controller?.signal);if((!card.isConnected&&!resultHistory.some(entry=>entry.nodes.includes(card)))||detailGenerations.get(card)!==revision)return;
      const p=data.product;
      selectedProductContext = p;
      logOrchestration({ strategy: 'product-details', reason: 'user opened product details or changed a variant', operations: ['GET /v1/products/{id}'], fallbackUsed: false, outcome: p.selectionChanges?.length ? 'variant-substituted' : 'success' });
      if(p.selectionChanges?.length){card.checkoutSelection=null;card.checkoutAction?.disableSelection('The requested variant was unavailable; choose a supported variant before checkout.');}
      else {card.checkoutAction?.updateOffer(p);card.checkoutSelection = { id: p.id, selection: Object.fromEntries((p.variants?.selected || []).map(v=>[v.name,v.label])),websiteIds:p.retailer?[p.retailer]:[],config:market(),expectedOffer:offerSnapshot(p) };}
      box.replaceChildren(node('p','Source: Channel3 / merchant listing. These specifications describe this catalog product; identity with the video object is not established.','muted'));
      if(p.selectionChanges?.length)box.append(node('p',`Requested variant changed: ${p.selectionChanges.map(c=>`${c.name}: ${c.requested} → ${c.actual}`).join('; ')}. Review before continuing.`,'variant-warning'));
      box.append(node('p',p.description||'No description supplied.'));
      const dl=node('dl');for(const [k,v] of Object.entries(p.structuredAttributes||{})){dl.append(node('dt',k),node('dd',Array.isArray(v)?v.join(', '):String(v)));}box.append(dl);
      if(p.materials?.length)box.append(node('p',`Catalog materials: ${p.materials.join(', ')}`));if(p.keyFeatures?.length)box.append(node('p',`Catalog features: ${p.keyFeatures.join(' · ')}`));
      let measurements=false;for(const offer of p.offers||[]){if(offer.dimensions){measurements=true;box.append(node('p',`Measurements (${offer.retailer}): ${Object.entries(offer.dimensions).filter(([,v])=>v).map(([k,v])=>`${k}: ${v.number} ${v.unit}`).join(' · ')}`));}}
      if(!measurements)box.append(node('p','Dimensions / weight: not supplied by this listing.','muted'));
      const effective=Object.fromEntries((p.variants?.selected||[]).map(v=>[v.name,v.label]));
      for(const option of p.variants?.options||[]){const label=node('label',option.name),sel=node('select');for(const v of option.values||[]){const opt=node('option',`${v.label}${!v.exists?' · different combination':v.available==='OutOfStock'?' · out of stock':v.available==null?' · stock unknown':''}`);opt.value=v.label;opt.selected=effective[option.name]===v.label;sel.append(opt);}sel.onchange=()=>showDetails(p,card,button,{...effective,[option.name]:sel.value});label.append(sel);box.append(label);}
      const offerHeading=node('h3',`Seller offers · same selected configuration (${p.variants?.selected?.map(v=>`${v.name}: ${v.label}`).join(', ')||'no variant options'})`);
      box.append(offerHeading);
      if(!(p.offers||[]).length)box.append(node('p','No seller offers were supplied for this product detail response.','muted'));
      for(const offer of p.offers||[]){
        const row=node('div',undefined,'seller-offer');
        row.append(node('strong',offer.retailer||'Seller not supplied'));
        row.append(node('span',formatProductPrice(offer.price,offer.currency)));
        row.append(node('span',offer.condition||'Condition not supplied'));
        row.append(node('span',offer.availability||'Availability unknown'));
        const url=safeProductUrl(offer.purchaseUrl);
        if(url){const a=node('a','View seller ↗');a.href=url;a.target='_blank';a.rel='noopener noreferrer';row.append(a);}
        else row.append(node('span','Purchase URL not supplied','muted'));
        if(!p.selectionChanges?.length && offer.retailer){
          const choose=node('button','Use this seller for Sandbox quote','secondary');
          choose.onclick=()=>{card.checkoutSelection={id:p.id,selection:effective,websiteIds:[offer.retailer],config:market(),expectedOffer:offerSnapshot(offer)};card.checkoutAction?.updateOffer(offer);choose.textContent=`Selected seller · ${offer.retailer}`;};
          row.append(choose);
        }
        box.append(row);
      }
      const historyControls=node('div',undefined,'price-history-controls');
      const historyLabel=node('label','Price history period');
      const historyDays=document.createElement('select');
      for(const days of [7,30,90])historyDays.add(new Option(`${days} days`,String(days)));
      historyDays.value='30';historyLabel.append(historyDays);
      const historyButton=node('button','Load price history','secondary');
      const historyContent=node('div',undefined,'price-history-content');
      historyButton.onclick=()=>loadPriceHistory(p.id,Number(historyDays.value),historyContent,historyButton);
      historyControls.append(historyLabel,historyButton,historyContent);
      box.append(node('h3','Price history'),node('p','History is fetched only on request and is for the canonical product; the provider does not identify a selected variant in this endpoint.','muted'),historyControls);
      if(p.selectionChanges?.length)box.append(node('p','Seller offers above describe the server-selected variant, not the requested variant. They are not comparable to your selection; choose a supported variant and refresh.','variant-warning'));
      const variantIncomplete = Boolean(p.variants?.options?.length && (p.variants.selected || []).length !== p.variants.options.length);
      await renderProductSubscriptions(box, p, Boolean(p.selectionChanges?.length) || variantIncomplete);
      if (detailGenerations.get(card) !== revision) return;
      box.append(node('small','Compatibility is advisory; confirm the specifications for your equipment. Unknown stock is not confirmed availability.'));
    }catch(e){if(e.name!=='AbortError'){box.replaceChildren(node('p',e.message));logOrchestration({strategy:'product-details',reason:'user opened product details or changed a variant',operations:['GET /v1/products/{id}'],fallbackUsed:false,outcome:'error'});}}finally{button.disabled=false;}
  }
  async function manual(query, preserveProfile = false) {
    query=(query||'').trim();
    if(!query){$('#products-notice').textContent='Describe a product or what you would like to change.';return;}
    if(/^https?:\/\//i.test(query)){$('#product-url').value=query;lookupProductUrl();return;}
    cancel();const version=generation;controller=new AbortController();const signal=controller.signal;
    activeSearch=null;activeBrowse=null;activeSimilar=null;
    voice.cancel(); $('#voice-search-status').textContent=''; $('#shopping-reply').textContent='';
    if (!preserveProfile && isPreferenceRequest(query) && ((useObjectContext && selected) || previousRequest)) {
      conversationScope ||= `bopit-conversation:manual:${getCapture()?.captureId || 'session'}`;
      await sendConversationMessage(query, signal);
      if (version === generation) { previousRequest = query; updateSearchContext(); }
      return;
    }
    if (!preserveProfile) clearConversation();
    if (preserveProfile) {
      setStage('search', 'active');
      $('#investigation-status').textContent = 'Searching Channel3 using the visible description…';
    }
    $('#products-container').replaceChildren();$('#products-notice').textContent=`Searching Channel3 for “${query}”…`;$('#search-products-btn').disabled=true;
    try{
      const plan=searchPlan({category:query,queries:{exact:query}},'exact',$('#budget').value);
      const request={query,image:preserveProfile&&selected?crop(selected.box):undefined,limit:12,filters:searchFilters(plan.filters),config:market()};
      const outcome=await discoverySearch(request,signal),data=outcome.data;if(version!==generation)return;
      activeSearch={request,products:data.products||[],assessments:[],nextPageToken:data.nextPageToken||data.pageToken};
      activeBrowse=null;
      renderProducts(activeSearch.products,[],{nextPageToken:activeSearch.nextPageToken,loadMore:loadMoreSearch});
      if (preserveProfile) {
        setStage('search', 'complete');
        setStage('comparison', 'skipped');
        $('#investigation-status').textContent = 'Fallback search results are ready. Product identity has not been verified.';
      } else { useObjectContext=false; previousRequest=query; updateSearchContext(); $('#investigation-status').textContent='Manual catalog search · not an identity verification'; }
    }
    catch(e){if(version===generation&&e.name!=='AbortError')$('#products-notice').textContent=searchErrorMessage(e);}
    finally{if(version===generation)$('#search-products-btn').disabled=false;}
  }
  async function lookupProductUrl() {
    const url=$('#product-url').value.trim();
    if(!url){$('#products-notice').textContent='Paste a public HTTPS product page URL first.';return;}
    cancel();const version=generation;activeSearch=null;activeBrowse=null;activeSimilar=null;
    $('#products-container').replaceChildren();setMoreProducts(null);
    $('#lookup-product-btn').disabled=true;$('#products-notice').textContent='Looking up this product in Channel3…';
    try {
      const result=await api('products/lookup',{url,maxStalenessHours:3,realtimeFetch:true});
      if(version!==generation)return;
      const product=result.product;
      if(!product?.id||!product.title)throw new Error('Channel3 returned an incomplete product record.');
      activeSearch=null;activeBrowse=null;
      renderProducts([product]);
      $('#products-notice').textContent=`Channel3 product lookup returned ${product.title}. Canonical product ID: ${product.id}.`;
      logOrchestration({ strategy: 'product-url-lookup', reason: 'submitted input is a product URL', operations: ['POST /v1/lookup'], fallbackUsed: false, outcome: 'product-returned' });
    } catch(error) {
      if(version!==generation)return;
      $('#products-notice').textContent=error.status===404
        ?'Channel3 could not resolve this URL. Check that it is a supported product page, or search by text/image.'
        :`Product URL lookup failed: ${error.message}`;
      logOrchestration({ strategy: 'product-url-lookup', reason: 'submitted input is a product URL', operations: ['POST /v1/lookup'], fallbackUsed: false, outcome: 'error' });
    } finally { if(version===generation)$('#lookup-product-btn').disabled=false; }
  }
  function changeSearch() { if(!current){if(selected)select(selected);return;}cancel();const version=generation;controller=new AbortController();$('#products-container').replaceChildren();runSearch(version,controller.signal,false); }
  for(const chip of document.querySelectorAll('[data-intent]'))chip.onclick=()=>{intent=chip.dataset.intent;document.querySelectorAll('[data-intent]').forEach(b=>b.setAttribute('aria-pressed',String(b===chip)));if(intent==='look'&&selectedProductContext?.id)findSimilar(selectedProductContext);else changeSearch();};
  let lastPreferences = JSON.stringify([$('#budget').value,$('#market').value]);
  function changePreferences() { const key = JSON.stringify([$('#budget').value,$('#market').value]); if (key === lastPreferences) return; lastPreferences = key; changeSearch(); }
  $('#budget').addEventListener('change',changePreferences);$('#market').addEventListener('change',changePreferences);
  $('#category-search').onclick=searchCategoryCatalog;
  $('#category-list').onclick=listCategoryCatalog;
  $('#category-more').onclick=()=>listCategoryCatalog(categoryPage+1);
  $('#brand-search').onclick=searchBrandCatalog;
  $('#brand-list').onclick=()=>listBrandCatalog();
  $('#brand-more').onclick=()=>listBrandCatalog(brandCursor);
  $('#brand-details').onclick=showBrandDetails;
  $('#browse-products').onclick=browseCatalog;
  $('#category-filter').onchange=async()=>{await categoryDetails($('#category-filter').value);changeSearch();};
  $('#catalog-brand').onchange=changeSearch;
  $('#load-more-products').onclick=loadMoreSearch;
  $('#lookup-product-btn').onclick=lookupProductUrl;
  $('#product-url').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();lookupProductUrl();}});
  for(const selector of ['#category-query','#brand-query'])$(selector).addEventListener('keydown',event=>{
    if(event.key!=='Enter')return;event.preventDefault();selector==='#category-query'?searchCategoryCatalog():searchBrandCatalog();
  });
  $('#brand-filter').addEventListener('change',changeSearch);
  $('#refresh-profile').onclick=()=>{const object=getSelected();if(object)select(object,true);};
  $('#additional-view').addEventListener('change',async event=>{
    const file=event.target.files[0],object=getSelected();if(!file||!object)return;
    try {
      if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024)throw new Error('Choose a PNG/JPEG/WebP under 8 MB.');
      const existing=views.get(object.id)||[];if(existing.length>=2)throw new Error('Two additional views already attached. Remove them to replace.');
      const bitmap=await createImageBitmap(file);
      try {if(bitmap.width<16||bitmap.height<16||bitmap.width*bitmap.height>16000000)throw new Error('Use a view between 16 pixels per side and 16 megapixels.');const c=document.createElement('canvas'),scale=Math.min(1,1024/Math.max(bitmap.width,bitmap.height));c.width=Math.max(16,Math.round(bitmap.width*scale));c.height=Math.max(16,Math.round(bitmap.height*scale));c.getContext('2d').drawImage(bitmap,0,0,c.width,c.height);views.set(object.id,[...existing,c.toDataURL('image/png')]);}
      finally{bitmap.close();}
      if(getSelected()?.id===object.id)select(object,true);
    }catch(e){$('#view-status').textContent=e.message;}finally{event.target.value='';}
  });
  $('#clear-views').onclick=()=>{const object=getSelected();if(object){views.delete(object.id);select(object,true);}};
  $('#conversation-form').addEventListener('submit', event => { event.preventDefault(); sendConversationMessage(); });
  $('#new-conversation').onclick=async()=>{
    conversationGeneration++;
    conversationId=null;conversationHistory=[];
    await chrome.storage.session.remove(conversationScope);
    renderConversationHistory();
    $('#conversation-status').textContent='Fresh conversation ready. Your next refinement will start a new Channel3 thread.';
  };
  $('#load-reporting').onclick=loadReporting;
  $('#more-clicks').onclick=()=>loadMoreReport('clicks');
  $('#more-transactions').onclick=()=>loadMoreReport('transactions');
  return { select, cancel, reset, backToResults, searchManual:manual, discoverSceneObject, sceneSearchContext, sceneSearchCacheKey, renderSceneResults, listSubscriptionEvents, markSubscriptionEventsRead, snapshot:()=>[...cache.values()] };

}
