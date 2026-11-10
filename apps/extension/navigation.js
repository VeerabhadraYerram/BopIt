// Navigation changes presentation only; it never initiates a provider request.
const pages = new Set(['explore', 'saved', 'alerts', 'tools', 'activity', 'cart']);
const positions = new Map();
export function showWorkspace(page) {
  if (!pages.has(page)) return;
  const menuHadFocus = document.querySelector('#app-menu').contains(document.activeElement);
  positions.set(document.body.dataset.workspace || 'explore', window.scrollY);
  document.body.dataset.workspace = page;
  document.querySelectorAll('[data-workspace-link]').forEach(button => {
    if (button.dataset.workspaceLink === page) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  const cart = document.querySelector('#cart-panel');
  if (cart) cart.hidden = page !== 'cart';
  document.querySelector('#cart-toggle')?.setAttribute('aria-pressed', String(page === 'cart'));
  document.querySelector('#app-menu').open = false;
  window.scrollTo({ top: positions.get(page) || 0, behavior: 'instant' });
  if (menuHadFocus) {
    const heading = document.querySelector(page === 'tools' ? '#tools-view h1' : '#reporting-panel h1');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  }
}
export function initializeNavigation() {
  document.querySelectorAll('[data-workspace-link]').forEach(button => {
    button.addEventListener('click', () => showWorkspace(button.dataset.workspaceLink));
  });
  window.addEventListener('bopit:navigate', event => showWorkspace(event.detail));
  document.addEventListener('click', event => {
    const menu = document.querySelector('#app-menu');
    if (!menu.contains(event.target)) menu.open = false;
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.querySelector('#app-menu').open) {
      document.querySelector('#app-menu').open = false;
      document.querySelector('#app-menu > summary').focus();
      event.preventDefault();
    }
  });
}
