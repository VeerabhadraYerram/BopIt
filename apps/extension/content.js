(() => {
  const VERSION = 'moment-gallery-v2';
  if (globalThis.__bopitInstalled?.version === VERSION) return;
  globalThis.__bopitInstalled?.dispose?.();
  // Old extension contexts can leave DOM behind after an extension reload.
  document.querySelectorAll('#bopit-explore-control, #bopit-status, #bopit-video-overlay, #bopit-results-panel').forEach(el => el.remove());
  const legacyStyle = document.createElement('style');
  legacyStyle.textContent = '#bopit-explore-control{display:none!important}';
  document.documentElement.append(legacyStyle);
  const lifetime = new AbortController();
  const listen = (target, type, fn, capture = false) => target.addEventListener(type, fn, { capture, signal: lifetime.signal });
  let timer, statusTimer;
  let armed = false, selected = null, pending = null, panel = null, panelFrame = null, captureId = null, captureTime = 0;
  let objects = [], activeId = null, scanning = false, exited = false;
  const host = document.createElement('div'); host.id = 'bopit-status';
  host.style.cssText = 'position:fixed;left:20px;bottom:20px;z-index:2147483647;display:none';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>[hidden]{display:none!important}*{box-sizing:border-box}button{font:650 13px system-ui;color:#21354d;background:#fff9ef;border:1.5px solid #21354d;border-radius:16px;padding:9px 14px;cursor:pointer;margin:4px}button:focus-visible{outline:3px solid #efac87;outline-offset:3px}p{max-width:330px;background:#fff9ef;color:#21354d;border:1px solid #24364e30;padding:12px;font:13px/1.5 system-ui;border-radius:12px;margin:0;box-shadow:0 4px 20px #24364e20}</style><p id="status" role="status" hidden></p>`;
  const status = shadow.querySelector('#status');
  const overlay = document.createElement('div'); overlay.id = 'bopit-video-overlay';
  overlay.style.cssText = 'position:fixed;z-index:2147483645;pointer-events:none;overflow:hidden;display:none;border-radius:8px';
  const root = overlay.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
    *{box-sizing:border-box}[hidden]{display:none!important}:host{color:#21354d;font:13px system-ui}
    .scan{position:absolute;inset:0;background:linear-gradient(180deg,#9cf6ce04,#a4e8cc18);pointer-events:none}
    .sweep{height:12%;position:absolute;left:0;right:0;background:linear-gradient(transparent,#a8e6cf55);border-bottom:2px solid #d8ffec;animation:sweep 2.4s ease-in-out infinite}
    svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
    .object-shape{fill:#ceffea08;stroke:#d4ffe4;stroke-width:1.8;vector-effect:non-scaling-stroke;pointer-events:visiblePainted;cursor:pointer;transition:fill 150ms,stroke 150ms,stroke-width 150ms;filter:drop-shadow(0 1px 1px #21354d88)}
    .object-shape:hover,.object-shape:focus-visible,.object-shape.active{fill:#ffd3b82e;stroke:#ffbe93;stroke-width:3;outline:none}
    .object-marker{fill:#fffaf1;stroke:#24364e;stroke-width:2;pointer-events:all;cursor:pointer}
    .object-marker:hover,.object-marker:focus-visible,.object-marker.active{fill:#ffc4a4;stroke-width:3;outline:none}
    #hover-label{position:absolute;pointer-events:none;padding:7px 11px;background:#fffaf1;color:#24364e;border:1px solid #24364e33;box-shadow:0 2px 0 #24364e;border-radius:12px;font:650 12px system-ui;max-width:190px;overflow-wrap:anywhere}
    @keyframes sweep{from{top:0}to{top:88%}}@media(prefers-reduced-motion:reduce){.sweep{animation:none;top:45%}.object-shape{transition:none}}
  </style><div class="scan" hidden><div class="sweep"></div></div><svg id="shapes" aria-label="Selectable objects"></svg><div id="hover-label" hidden></div>`;
  document.documentElement.append(overlay, host);
  function mount() {
    const container = document.fullscreenElement;
    if (container && container.tagName !== 'VIDEO') {
      for (const el of [host, overlay, panel].filter(Boolean)) if (el.parentElement !== container) container.append(el);
    } else if (!container) for (const el of [host, overlay, panel].filter(Boolean)) if (el.parentElement !== document.documentElement) document.documentElement.append(el);
  }
  function restoreTimestamp() { const video = pending?.video; if (video?.isConnected && Number.isFinite(pending.timestamp) && Math.abs(video.currentTime-pending.timestamp)>=.02) video.currentTime=pending.timestamp; }
  function hidePanel() { restoreTimestamp(); if (panel) panel.hidden = true; exited = true; root.querySelector('#hover-label').hidden = true; update(); selected?.focus({ preventScroll: true }); }
  function showError(message) { clearTimeout(statusTimer); status.textContent = message; status.hidden = false; host.style.display = 'block'; host.style.visibility = 'visible'; statusTimer = setTimeout(() => { status.hidden = true; host.style.display = 'none'; }, 8000); }
  function showPanel(id, error, background = false) {
    if (!panel) {
      panel = document.createElement('section'); panel.id = 'bopit-results-panel'; panel.setAttribute('aria-label', 'BopIt results');
      panel.style.cssText = 'position:fixed;right:14px;top:14px;width:min(440px,calc(100vw - 28px));height:calc(100dvh - 28px);animation:bopit-enter 220ms cubic-bezier(.2,.8,.2,1);z-index:2147483647;border-radius:24px;box-shadow:0 12px 60px #15253640;border:1px solid #24364e40;background:#fffaf1;overflow:hidden';
      const pr = panel.attachShadow({ mode: 'open' });
      pr.innerHTML = `<style>:host([hidden]){display:none!important}@keyframes bopit-enter{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:none}}@media(prefers-reduced-motion:reduce){:host{animation:none!important}}header{height:44px;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;padding:8px 14px;font:650 12px system-ui;color:#24364e;border-bottom:1px solid #24364e20}button{border:1px solid #24364e;border-radius:50%;height:32px;width:32px;background:#fffaf1;cursor:pointer}iframe{width:100%;height:calc(100% - 44px);border:0;display:block}</style><header><span>✳ BopIt · a closer look</span><button aria-label="Close BopIt results">×</button></header>`;
      pr.querySelector('button').onclick = hidePanel;
      panelFrame = document.createElement('iframe'); panelFrame.id = 'bopit-inspector'; panelFrame.title = 'BopIt object details'; panelFrame.referrerPolicy = 'no-referrer'; panelFrame.allow = 'microphone'; pr.append(panelFrame); document.documentElement.append(panel);
    }
    if (id !== captureId || !panelFrame.src || error) {
      captureId = id;
      const params = new URLSearchParams({ embedded: '1', ...(id ? { capture: id, auto: '1' } : { error: error || 'Capture unavailable' }) });
      panelFrame.src = chrome.runtime.getURL(`viewer.html?${params}`);
    }
    panel.hidden = background; mount();
  }
  function videoList() { return [...document.querySelectorAll('video')].filter(v => { const r = v.getBoundingClientRect(); return r.width >= 160 && r.height >= 90 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth && getComputedStyle(v).visibility !== 'hidden'; }); }
  function geometry() { if (!selected) return null; const r = selected.getBoundingClientRect(), css = getComputedStyle(selected); return { rect: r, image: globalThis.BopitGeometry.imageRect(r, selected.videoWidth, selected.videoHeight, css.objectFit) }; }
  function update() {
    mount();
    const nativeFullscreen = document.fullscreenElement?.tagName === 'VIDEO';
    if (!armed || nativeFullscreen || document.pictureInPictureElement) { host.style.display = 'none'; overlay.style.display = 'none'; return; }
    const valid = selected?.isConnected && selected.paused && Math.abs(selected.currentTime - captureTime) < .04 && !exited;
    overlay.style.display = (scanning || objects.length) && valid ? 'block' : 'none';
    if (!valid) return;
    const g = geometry(); if (!g?.image) return;
    Object.assign(overlay.style, { left: `${g.rect.left}px`, top: `${g.rect.top}px`, width: `${g.rect.width}px`, height: `${g.rect.height}px` });
    root.querySelector('#shapes').setAttribute('viewBox', `0 0 ${g.rect.width} ${g.rect.height}`);
    for (const el of root.querySelectorAll('[data-id]')) {
      const o = objects.find(o => o.id === el.dataset.id); if (!o) continue;
      const p = globalThis.BopitGeometry.project(o.box, g.image, g.rect);
      const rings = o.contours?.length ? o.contours : o.contour?.length ? [o.contour] : [];
      if (rings.length) el.setAttribute('d', rings.map(ring=>ring.map(([x,y],i) => `${i ? 'L' : 'M'}${(p.x+x*p.width).toFixed(1)},${(p.y+y*p.height).toFixed(1)}`).join(' ')+'Z').join(' '));
      else { el.setAttribute('cx',p.x+p.width/2);el.setAttribute('cy',p.y+p.height/2); }
    }
  }
  function hoverObject(id) {
    const o = objects.find(o => o.id === id), label = root.querySelector('#hover-label');
    if (!o) { label.hidden = true; return; }
    label.textContent = o.label; label.hidden = false;
    const g = geometry(); if (!g?.image) return;
    const p = globalThis.BopitGeometry.project(o.box,g.image,g.rect);
    label.style.left = `${Math.max(4,Math.min(g.rect.width-label.offsetWidth-4,p.x))}px`;
    label.style.top = `${Math.max(4,Math.min(g.rect.height-label.offsetHeight-4,p.y-36))}px`;
  }
  function render() {
    root.querySelector('.scan').hidden = !scanning;
    const shapes = root.querySelector('#shapes'); shapes.replaceChildren();
    // Small foreground objects paint after large background objects.
    for (const o of [...objects].sort((a,b)=>b.box.width*b.box.height-a.box.width*a.box.height)) {
      const shape = document.createElementNS('http://www.w3.org/2000/svg',o.contours?.length || o.contour?.length ? 'path' : 'circle');
      shape.classList.add(o.contours?.length || o.contour?.length ? 'object-shape' : 'object-marker');
      if (o.id === activeId) shape.classList.add('active');
      shape.dataset.id = o.id; shape.setAttribute('role','button');shape.setAttribute('tabindex','0');shape.setAttribute('aria-label',`Inspect ${o.label}`);
      shape.setAttribute('fill-rule','evenodd');if (!o.contours?.length && !o.contour?.length) shape.setAttribute('r','12');
      shape.onclick = () => choose(o.id);
      shape.onkeydown = event => { if (event.key==='Enter'||event.key===' ') { event.preventDefault();choose(o.id); } };
      shape.onmouseenter = shape.onfocus = () => hoverObject(o.id);
      shape.onmouseleave = shape.onblur = () => hoverObject(null);
      shapes.append(shape);
    }
    update();
  }
  function choose(id) { activeId=id;if(panel)panel.hidden=false;render();chrome.runtime.sendMessage({type:'BOPIT_SELECT_OBJECT',captureId,id}).catch(()=>showError('Reload this page after updating BopIt.')); }
  listen(document,'keydown', e => { if (e.key==='Escape') hidePanel(); });
  function captions(v) {
    const cues = []; for (const track of v.textTracks) { try { for (const c of track.cues || []) if (c.endTime >= v.currentTime - 40 && c.startTime <= v.currentTime + 20) cues.push({ start:c.startTime,end:c.endTime,text:c.text.replace(/<[^>]*>/g,'').slice(0,1500) }); } catch { /* Unavailable track */ } }
    if (!cues.length) { const visible = [...document.querySelectorAll('.ytp-caption-segment')].map(el => el.textContent).join(' '); if (visible) cues.push({ start:v.currentTime,end:v.currentTime,text:visible.slice(0,1500) }); }
    return cues.slice(0,80);
  }
  async function begin() {
    status.hidden = true; exited = false; objects = []; activeId = null; captureTime = selected.currentTime;
    if (getComputedStyle(selected).objectPosition !== '50% 50%' || getComputedStyle(selected).transform !== 'none') return showError('This transformed video needs the frame-preview fallback. Reset its crop/position first.');
    host.style.display = 'none';
    try {
      const result = await chrome.runtime.sendMessage({ type: 'BOPIT_CAPTURE' });
      if (result?.error) { scanning = false; render(); showError(result.error); }
    } catch { scanning = false; render(); showError('Extension reloaded. Reload this video page and activate BopIt again.'); }
    finally { host.style.visibility = 'visible'; }
  }
  function startFromToolbar() {
    clearTimeout(statusTimer); status.hidden = true; host.style.display = 'none'; armed = true; exited = false;
    if (scanning) { showError('This moment is already being analyzed.'); return { started: false, busy: true }; }
    const candidates = videoList().filter(v => v.paused && v.readyState >= 2);
    if (!candidates.length) { showError(videoList().length ? 'Pause the video, then click the BopIt toolbar icon again.' : 'No supported video found on this page.'); return { started: false }; }
    if (candidates.length === 1) { selected = candidates[0]; begin(); return { started: true }; }
    status.replaceChildren(document.createTextNode('Which paused video would you like to explore?'));
    for (const [i,v] of candidates.entries()) { const b = document.createElement('button'); b.textContent = `Video ${i+1}`; b.onclick = () => { selected = v; begin(); }; status.append(b); }
    const close = document.createElement('button'); close.textContent = 'Cancel'; close.onclick = () => host.style.display = 'none'; status.append(close);
    status.hidden = false; host.style.display = 'block'; return { started: false, choosing: true };
  }
  const onMessage = (msg, _sender, respond) => {
    if (msg?.type === 'BOPIT_SHOW_PANEL') { scanning = Boolean(msg.captureId); showPanel(msg.captureId,msg.error,false); render(); respond({ok:true}); }
    if (msg?.type === 'BOPIT_OVERLAY_STATE' && msg.captureId === captureId) {
      if (Array.isArray(msg.objects)) objects = msg.objects;
      if (msg.selectedId !== undefined) activeId = msg.selectedId;
      if (msg.hoveredId !== undefined) hoverObject(msg.hoveredId);
      if (msg.scanning !== undefined) scanning = msg.scanning;
      if (msg.error) { showError(msg.error); if(panel)panel.hidden=false; }
      if (!scanning && !objects.length && panel) panel.hidden=false;
      render(); respond({ok:true});
    }
    if (msg?.type === 'BOPIT_HIDE_PANEL') { hidePanel(); respond({ok:true}); }
    if (msg?.type === 'BOPIT_ARM') { armed=true;exited=false;update();respond({videos:videoList().length}); }
    if (msg?.type === 'BOPIT_START') { respond(startFromToolbar()); }
    if (msg?.type === 'BOPIT_PREPARE') {
      if (!selected?.isConnected || !selected.paused || selected.readyState < 2) { respond({error:'Pause the video first.'}); return; }
      const framePreparationStarted = performance.now();
      const v=selected,r=v.getBoundingClientRect(),css=getComputedStyle(v);
      if(document.pictureInPictureElement || v.mediaKeys || document.fullscreenElement?.tagName==='VIDEO'){respond({error:'Protected media, Picture-in-Picture and native video-only fullscreen are unsupported. Use the normal player.'});return;}
      const id=crypto.randomUUID(); let directImage=null;
      try {const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;if(!c.width||c.width*c.height>16000000)throw new Error();c.getContext('2d').drawImage(v,0,0);directImage=c.toDataURL('image/png');}catch{/* activeTab fallback */}
      let rect={x:r.left,y:r.top,width:r.width,height:r.height};
      if(!directImage){if(r.left<0||r.top<0||r.right>innerWidth||r.bottom>innerHeight||!['contain','fill'].includes(css.objectFit)){respond({error:'For this cross-origin player, keep the whole video visible with contain/fill positioning.'});return;}rect=globalThis.BopitGeometry.imageRect(r,v.videoWidth,v.videoHeight,css.objectFit);}
      pending={captureId:id,timestamp:v.currentTime,video:v,rect:r.toJSON(),viewport:{width:innerWidth,height:innerHeight}};
      host.style.visibility='hidden';overlay.style.display='none';if(panel)panel.hidden=true;
      requestAnimationFrame(()=>requestAnimationFrame(()=>respond({captureId:id,directImage,rect,viewport:pending.viewport,timestamp:v.currentTime,context:{timestamp:v.currentTime,cues:captions(v),note:''},framePreparationMs:performance.now()-framePreparationStarted})));
      return true;
    }
    if(msg?.type==='BOPIT_CONFIRM'){const r=selected?.getBoundingClientRect();respond({valid:Boolean(pending?.captureId===msg.captureId&&selected?.paused&&Math.abs(selected.currentTime-pending.timestamp)<.02&&r&&['x','y','width','height'].every(k=>Math.abs(r[k]-pending.rect[k])<.5)&&innerWidth===pending.viewport.width&&innerHeight===pending.viewport.height)});}
  };
  chrome.runtime.onMessage.addListener(onMessage);
  listen(window,'resize',update);listen(document,'scroll',update,true);listen(document,'fullscreenchange',update);listen(document,'play',update,true);listen(document,'seeked',update,true);timer=setInterval(update,250);
  globalThis.__bopitInstalled = { version: VERSION, dispose() { lifetime.abort();clearInterval(timer);clearTimeout(statusTimer);chrome.runtime.onMessage.removeListener(onMessage);[host,overlay,panel,legacyStyle].filter(Boolean).forEach(el=>el.remove()); } };
})();
