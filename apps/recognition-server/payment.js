const status = document.querySelector('#status');
const button = document.querySelector('#buy');
const query = new URLSearchParams(location.search);
const returnedOrderId = query.get('token');

function show(message, state) {
  status.textContent = message;
  status.className = state === 'failed' ? 'error' : '';
}

async function post(path, body = {}) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'same-origin'
  });
  const result = await response.json();
  if (!response.ok && !['pending', 'failed'].includes(result.state)) throw new Error(result.error || 'Payment request failed.');
  return result;
}

async function capture(orderId) {
  button.hidden = true;
  show('PayPal returned to BopIt. Verifying and capturing the approved order with PayPal Sandbox…', 'pending');
  try {
    const result = await post(`/api/payments/orders/${encodeURIComponent(orderId)}/capture`);
    if (result.state === 'success' && result.verified === true) {
      show(`Payment verified by PayPal Sandbox. Your ${result.product.name} demo order is complete.`, 'success');
    } else if (result.state === 'failed') {
      show(result.message || 'PayPal Sandbox did not approve this payment.', 'failed');
    } else {
      show(`${result.message || 'Payment confirmation is pending.'} Reload this page to check again.`, 'pending');
    }
  } catch (error) {
    show(`Payment status could not be confirmed: ${error.message} Reload this page to check again.`, 'pending');
  }
}

if (query.has('cancelled')) {
  button.hidden = true;
  show('Payment cancelled in PayPal Sandbox. No payment was captured.', 'cancelled');
} else if (returnedOrderId) {
  capture(returnedOrderId);
} else {
  button.addEventListener('click', async () => {
    button.disabled = true;
    show('Creating a fixed-price demo order…');
    try {
      const order = await post('/api/payments/orders');
      location.assign(order.approveUrl);
    } catch (error) {
      button.disabled = false;
      show(error.message, 'failed');
    }
  });
}
