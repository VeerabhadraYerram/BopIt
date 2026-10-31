(() => {
  if (globalThis.__bopitInstalled) return;
  globalThis.__bopitInstalled = true;
  let armed = false, selected = null, pending = null, panel = null, panelFrame = null;
  const host = document.createElement('div');
  host.id = 'bopit-explore-control';
  host.style.cssText = 'position:fixed;z-index:2147483647;display:none;';
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = 'button{font:600 14px system-ui;color:#21354d;background:#fff9ef;border:2px solid #21354d;border-radius:24px;padding:10px 16px;box-shadow:0 3px 0 #21354d;cursor:pointer}button:focus-visible{outline:3px solid #efac87;outline-offset:3px}p{max-width:300px;background:#fff9ef;color:#21354d;padding:8px;font:13px system-ui;border-radius:8px}';
  const button = document.createElement('button'); button.textContent = 'Explore this moment ✨';
  const status = document.createElement('p'); status.hidden = true; status.setAttribute('role', 'status');
  shadow.append(style, button, status); document.documentElement.append(host);

  function hidePanel() {
    if (panel) panel.hidden = true;
    host.style.visibility = 'visible';
    if (selected?.isConnected) {
      const hadTabIndex = selected.hasAttribute('tabindex');
      if (!hadTabIndex) selected.setAttribute('tabindex', '-1');
      selected.focus({ preventScroll: true });
      if (!hadTabIndex) selected.removeAttribute('tabindex');
    } else button.focus({ preventScroll: true });
  }
  function showPanel(captureId, error) {
    if (!panel) {
      panel = document.createElement('section'); panel.id = 'bopit-results-panel';
      panel.setAttribute('aria-label', 'BopIt results');
      panel.style.cssText = 'position:fixed;right:16px;top:16px;width:min(460px,calc(100vw - 32px));height:calc(100dvh - 32px);max-height:900px;z-index:2147483647;border-radius:22px;box-shadow:0 12px 60px #15253640;border:1px solid #24364e40;background:#fffaf1;overflow:hidden;';
      const panelRoot = panel.attachShadow({ mode: 'closed' });
      const css = document.createElement('style'); css.textContent = ':host([hidden]){display:none!important}header{height:46px;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;padding:8px 14px;font:600 13px system-ui;color:#24364e;border-bottom:1px solid #24364e20}button{border:1px solid #24364e;border-radius:50%;height:28px;width:28px;background:#fffaf1;color:#24364e;cursor:pointer}button:focus-visible{outline:3px solid #376eaa}iframe{width:100%;height:calc(100% - 46px);border:0;display:block;background:#fffaf1}';
      const bar = document.createElement('header'), title = document.createElement('span'), close = document.createElement('button');
      title.textContent = 'BopIt · explore without leaving your video'; close.textContent = '×'; close.setAttribute('aria-label', 'Close BopIt results'); close.addEventListener('click', hidePanel);
      bar.append(title, close);
      panelFrame = document.createElement('iframe'); panelFrame.id = 'bopit-inspector'; panelFrame.title = 'BopIt object recognition'; panelFrame.setAttribute('referrerpolicy', 'no-referrer');
      panelRoot.append(css, bar, panelFrame); document.documentElement.append(panel);
    }
    const params = new URLSearchParams({ embedded: '1' });
    if (captureId) params.set('capture', captureId); else if (error) params.set('error', error);
    panel.hidden = false; panelFrame.src = chrome.runtime.getURL(`viewer.html?${params}`);
    host.style.visibility = 'visible';
    panelFrame.addEventListener('load', () => panelFrame.focus({ preventScroll: true }), { once: true });
  }
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && panel && !panel.hidden) hidePanel(); });

  function videos() {
    return [...document.querySelectorAll('video')].filter(v => {
      const r = v.getBoundingClientRect();
      return r.width >= 160 && r.height >= 90 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth && getComputedStyle(v).visibility !== 'hidden';
    });
  }
  function update() {
    if (!armed || document.fullscreenElement || document.pictureInPictureElement) { host.style.display = 'none'; return; }
    const paused = videos().filter(v => v.paused && v.readyState >= 2);
    selected = paused.length === 1 ? paused[0] : paused.includes(selected) ? selected : null;
    host.style.display = paused.length ? 'block' : 'none';
    const rect = (selected || paused[0])?.getBoundingClientRect();
    if (rect) { host.style.left = `${Math.max(8, Math.min(rect.right - 240, innerWidth - 320))}px`; host.style.top = `${Math.max(8, rect.top + 12)}px`; }
    button.textContent = paused.length > 1 && !selected ? 'Choose a video to explore' : 'Explore this moment ✨';
  }
  function showError(message) { status.textContent = message; status.hidden = false; host.style.visibility = 'visible'; }

  button.addEventListener('click', async () => {
    status.hidden = true;
    if (!selected) {
      const candidates = videos().filter(v => v.paused && v.readyState >= 2);
      const picker = document.createElement('div');
      candidates.forEach((v, i) => {
        const choice = document.createElement('button'); choice.textContent = `Video ${i + 1} (${Math.round(v.getBoundingClientRect().width)}px wide)`;
        choice.addEventListener('click', () => { selected = v; picker.remove(); begin(); }); picker.append(choice);
      });
      status.replaceChildren(picker); status.hidden = false; return;
    }
    await begin();
  });
  async function begin() {
    button.disabled = true;
    if (panel) panel.hidden = true;
    try {
      const result = await chrome.runtime.sendMessage({ type: 'BOPIT_CAPTURE' });
      if (result?.error) { showError(result.error); if (panelFrame?.src) panel.hidden = false; }
    } catch { showError('Extension reloaded. Reload this video page and activate BopIt again.'); }
    finally { button.disabled = false; host.style.visibility = 'visible'; }
  }

  chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
    if (msg?.type === 'BOPIT_SHOW_PANEL') { showPanel(msg.captureId, msg.error); respond({ ok: true }); }
    if (msg?.type === 'BOPIT_HIDE_PANEL') { hidePanel(); respond({ ok: true }); }
    if (msg?.type === 'BOPIT_ARM') { armed = true; update(); respond({ videos: videos().length }); }
    if (msg?.type === 'BOPIT_PREPARE') {
      if (!selected?.isConnected || !selected.paused || selected.readyState < 2) { respond({ error: 'Pause the video first, then click Explore.' }); return; }
      const v = selected, r = v.getBoundingClientRect(), css = getComputedStyle(v);
      if (document.fullscreenElement || document.pictureInPictureElement || v.mediaKeys) { respond({ error: 'Exit fullscreen/Picture-in-Picture. Protected media is unsupported.' }); return; }
      const captureId = crypto.randomUUID();
      let directImage = null;
      try {
        const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
        if (!c.width || c.width * c.height > 16_000_000) throw new Error('Oversized');
        c.getContext('2d').drawImage(v, 0, 0); directImage = c.toDataURL('image/png');
      } catch { /* Cross-origin video: explicit activeTab screenshot fallback below. */ }
      let rect = { x: r.left, y: r.top, width: r.width, height: r.height };
      if (!directImage) {
        if (r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight || css.transform !== 'none' || !['contain', 'fill'].includes(css.objectFit) || css.objectPosition !== '50% 50%') {
          respond({ error: 'Keep the whole video visible without zoom/crop transforms, or use an uploaded frame. This layout is not supported yet.' }); return;
        }
        if (css.objectFit === 'contain' && v.videoWidth && v.videoHeight) {
          const scale = Math.min(r.width / v.videoWidth, r.height / v.videoHeight);
          rect = { x: r.left + (r.width - v.videoWidth * scale) / 2, y: r.top + (r.height - v.videoHeight * scale) / 2, width: v.videoWidth * scale, height: v.videoHeight * scale };
        }
      }
      pending = { captureId, timestamp: v.currentTime, rect: r.toJSON(), viewport: { width: innerWidth, height: innerHeight } };
      host.style.visibility = 'hidden';
      requestAnimationFrame(() => requestAnimationFrame(() => respond({ captureId, directImage, rect, viewport: pending.viewport, timestamp: v.currentTime })));
      return true;
    }
    if (msg?.type === 'BOPIT_CONFIRM') {
      const r = selected?.getBoundingClientRect();
      const valid = pending?.captureId === msg.captureId && selected?.paused && Math.abs(selected.currentTime - pending.timestamp) < 0.02 && r && ['x', 'y', 'width', 'height'].every(k => Math.abs(r[k] - pending.rect[k]) < 0.5) && innerWidth === pending.viewport.width && innerHeight === pending.viewport.height;
      respond({ valid: Boolean(valid) });
    }
  });
  // No automatic browsing access: this runs only after toolbar activation on this page.
  setInterval(update, 700);
})();
