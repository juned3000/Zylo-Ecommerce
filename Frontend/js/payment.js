// Payment gateway simulation for online methods
(function(){
  function qs(sel){ return document.querySelector(sel); }
  function createEl(tag, cls){ const el=document.createElement(tag); if(cls) el.className=cls; return el; }

  function formatINR(n){ try { return 'Rs. ' + Number(n||0).toLocaleString('en-IN'); } catch { return 'Rs. ' + n; } }

  const pending = JSON.parse(localStorage.getItem('zylo_pending_payment') || 'null');
  const metaBox = qs('#pg-meta');
  const contentBox = qs('#pg-content');

  if (!pending) {
    // No pending payment, go back
    contentBox.innerHTML = '<p>No pending payment found. Returning to checkout...</p>';
    setTimeout(()=>{ window.location.href = 'checkout.html'; }, 1200);
    return;
  }

  // Build meta chips
  const chips = [
    { icon: 'fas fa-hashtag', label: 'Order: ' + pending.id },
    { icon: 'fas fa-rupee-sign', label: 'Total: ' + formatINR(pending.totals?.total) },
    { icon: 'fas fa-credit-card', label: 'Method: ' + pending.paymentMethod.toUpperCase() }
  ];
  chips.forEach(c=>{
    const el = createEl('div','pg-chip');
    el.innerHTML = `<i class="${c.icon}"></i> <span>${c.label}</span>`;
    metaBox.appendChild(el);
  });

  // Render method-specific content
  const method = pending.paymentMethod;
  if (method === 'card') {
    const last4 = pending.methodDetails?.last4 || '••••';
    contentBox.innerHTML = `
      <h3>Verify your card</h3>
      <p>We have sent a one-time password (OTP) to your registered mobile/email for card •••• •••• •••• ${last4}.</p>
      <div class="otp-row">
        <input maxlength="1" inputmode="numeric" />
        <input maxlength="1" inputmode="numeric" />
        <input maxlength="1" inputmode="numeric" />
        <input maxlength="1" inputmode="numeric" />
        <input maxlength="1" inputmode="numeric" />
        <input maxlength="1" inputmode="numeric" />
      </div>
      <p class="tip">Enter any digits to simulate OTP.</p>
    `;
  } else if (method === 'upi') {
    const upiId = pending.methodDetails?.upiId || '(UPI ID not provided)';
    const app = pending.methodDetails?.app || 'Any UPI App';
    contentBox.innerHTML = `
      <h3>Approve in your UPI app</h3>
      <div class="upi-box">
        <div class="row"><span class="upi-badge">Collect request</span> sent to <strong>${app}</strong></div>
        <div class="row">UPI ID: <strong>${upiId}</strong></div>
        <div class="row">Amount: <strong>${formatINR(pending.totals?.total)}</strong></div>
      </div>
      <p class="tip">Alternatively, scan the QR below to pay.</p>
      <div class="qr"></div>
    `;
  } else if (method === 'wallet') {
    const wallet = pending.methodDetails?.wallet || 'Selected Wallet';
    contentBox.innerHTML = `
      <h3>Confirm in ${wallet}</h3>
      <p>We redirected you to <strong>${wallet}</strong>. After confirming, click Confirm Payment.</p>
    `;
  } else if (method === 'netbanking') {
    const bank = pending.methodDetails?.bank || 'Your Bank';
    contentBox.innerHTML = `
      <h3>Net Banking - ${bank}</h3>
      <p>Complete the payment on your bank portal. Then click Confirm Payment.</p>
    `;
  } else {
    contentBox.innerHTML = `<p>Unknown payment method. Returning to checkout...</p>`;
    setTimeout(()=>{ window.location.href = 'checkout.html'; }, 1200);
  }

  function completePayment(success){
    const order = JSON.parse(localStorage.getItem('zylo_pending_payment') || 'null');
    if (!order) { window.location.href = 'checkout.html'; return; }
    localStorage.removeItem('zylo_pending_payment');

    if (success) {
      order.paymentStatus = 'paid';
      order.orderStatus = 'confirmed';
      localStorage.setItem('zylo_last_order', JSON.stringify(order));
      try {
        const orders = JSON.parse(localStorage.getItem('zylo_orders') || '[]');
        orders.unshift(order);
        localStorage.setItem('zylo_orders', JSON.stringify(orders));
      } catch {}
      // Clear cart
      localStorage.removeItem('zylo_cart');
      window.location.href = 'order-success.html?orderId=' + encodeURIComponent(order.id);
    } else {
      // Failed
      order.paymentStatus = 'failed';
      order.orderStatus = 'payment_failed';
      localStorage.setItem('zylo_last_failed_order', JSON.stringify(order));
      window.location.href = 'payment-failed.html?orderId=' + encodeURIComponent(order.id);
    }
  }

  qs('#btn-confirm')?.addEventListener('click', ()=> completePayment(true));
  qs('#btn-fail')?.addEventListener('click', ()=> completePayment(false));
  qs('#btn-cancel')?.addEventListener('click', ()=> { window.location.href = 'checkout.html'; });

  // Public API wrappers
  if (typeof window.confirmPayment !== 'function') {
    window.confirmPayment = function(){ qs('#btn-confirm')?.click(); };
  }
  if (typeof window.failPayment !== 'function') {
    window.failPayment = function(){ qs('#btn-fail')?.click(); };
  }
  if (typeof window.cancelPayment !== 'function') {
    window.cancelPayment = function(){ qs('#btn-cancel')?.click(); };
  }
})();

