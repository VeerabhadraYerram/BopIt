const status = document.querySelector('#status');
const button = document.querySelector('#buy');
const checkButton = document.querySelector('#check');
const setupButton = document.querySelector('#setup-check');
const query = new URLSearchParams(location.search);
const returnedOrderId = query.get('token');
let busy = false;
const quote = query.get('quote');
if (quote) {
  document.querySelector('h1').textContent = 'Your selected item';
  document.querySelector('.price').textContent = 'Verifying quote…';
  document.querySelector('#product-description').textContent = 'BopIt Sandbox checkout · simulated fulfillment only. Nothing is shipped or reserved.';
}
const suffix = quote ? `?quote=${encodeURIComponent(quote)}` : '';
const storageKey = `bopit-checkout-id:${quote || 'demo'}`;
let checkoutId;
try { checkoutId = sessionStorage.getItem(storageKey); } catch { /* Optional storage. */ }
checkoutId ||= crypto.randomUUID();
try { sessionStorage.setItem(storageKey, checkoutId); } catch { /* Retain the in-memory ID. */ }

function show(message, state = '') {
  status.textContent = message;
  status.className = state === 'failed' ? 'error' : '';
}

async function post(path, body = {}) {
  const response = await fetch(`${path}${suffix}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body), credentials: 'same-origin',
    signal: AbortSignal.timeout(70_000)
  });
  const result = await response.json();
  if (!response.ok && !['pending', 'failed'].includes(result.state)) throw new Error(result.error || 'Payment request failed.');
  return result;
}

function renderProduct(product) {
  if (!product) return;
  document.querySelector('h1').textContent = product.name;
  document.querySelector('.price').textContent = `${product.currency} ${product.price}`;
  if (product.fulfillment) document.querySelector('#product-description').textContent = `${product.fulfillment}. ${product.variants || 'Listing default variant'}. Catalog price only; no tax or shipping is charged in this simulation. This does not place an order with the retailer or reserve inventory.`;
}

async function capture(orderId) {
  if (busy) return;
  busy = true;
  button.hidden = true;
  checkButton.hidden = false;
  checkButton.disabled = true;
  show('Checking your approved payment with PayPal Sandbox. Please keep this page open…', 'pending');
  try {
    const result = await post(`/api/payments/orders/${encodeURIComponent(orderId)}/capture`);
    if (result.state === 'success' && result.verified === true) {
      renderProduct(result.product);
      show(`Payment verified by PayPal Sandbox. ${result.product.name} · ${result.product.currency} ${result.product.price}. Receipt: ${result.captureId}. ${result.product.fulfillment || 'Demo only; nothing is shipped.'} Return to your video tab to keep watching.`, 'success');
      checkButton.hidden = true;
      try { sessionStorage.removeItem(storageKey); } catch { /* Optional storage. */ }
    } else if (result.state === 'failed') {
      show(result.message || 'PayPal Sandbox did not approve this payment.', 'failed');
    } else {
      show(`${result.message || 'Payment confirmation is pending.'} Use “Check payment again” to retry safely.`, 'pending');
    }
  } catch (error) {
    show(`Payment status could not be confirmed. ${error.name === 'TimeoutError' || error instanceof TypeError ? 'Check that the local server is running.' : error.message} Use “Check payment again”; do not start another checkout.`, 'pending');
  } finally {
    busy = false;
    checkButton.disabled = false;
  }
}

async function checkSetup() {
  button.disabled = true;
  setupButton.hidden = true;
  show('Checking PayPal Sandbox connection…');
  try {
    const response = await fetch(`/api/payments/config${suffix}`, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error('Could not check the local server.');
    const config = await response.json();
    renderProduct(config.product);
    if (!config.configured) throw new Error('PayPal Sandbox needs setup. Follow the PayPal setup steps in README.md, restart the local server, then check again.');
    button.disabled = false;
    show('Sandbox credentials are configured. Continue to sign in with a sandbox personal (buyer) account. No real money is used.');
  } catch (error) {
    show(error instanceof TypeError ? 'Cannot reach the local server. Run npm start and check again.' : error.message, 'failed');
    setupButton.hidden = false;
  }
}

checkButton.addEventListener('click', () => capture(returnedOrderId));
setupButton.addEventListener('click', checkSetup);
button.addEventListener('click', async () => {
  if (busy) return;
  busy = true;
  button.disabled = true;
  show('Creating your demo order…');
  try {
    const order = await post('/api/payments/orders', { checkoutId });
    const approval = new URL(order.approveUrl);
    if (approval.protocol !== 'https:' || approval.hostname !== 'www.sandbox.paypal.com') throw new Error('Invalid PayPal Sandbox approval link.');
    location.assign(approval.href);
  } catch (error) {
    busy = false;
    button.disabled = false;
    show(`${error.name === 'TimeoutError' || error instanceof TypeError ? 'Cannot reach PayPal through the local server.' : error.message} You can retry safely.`, 'failed');
  }
});

if (query.has('cancelled')) {
  show('Payment cancelled in PayPal Sandbox. Return to your video tab, or reopen checkout to try again.', 'cancelled');
  button.hidden = true;
  try { sessionStorage.removeItem(storageKey); } catch { /* Optional storage. */ }
} else if (returnedOrderId) {
  if (/^[A-Za-z0-9_-]{1,128}$/.test(returnedOrderId)) capture(returnedOrderId);
  else { button.hidden = true; show('This PayPal return link is invalid. Reopen checkout from BopIt.', 'failed'); }
} else {
  checkSetup();
}
