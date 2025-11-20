(function(){
  function qs(sel){ return document.querySelector(sel); }
  function formatINR(n){ try { return 'Rs. ' + Number(n||0).toLocaleString('en-IN'); } catch { return 'Rs. ' + n; } }
  const ord = JSON.parse(localStorage.getItem('zylo_last_failed_order') || 'null');
  const box = qs('#failed-summary');
  if (!ord) { box.innerHTML = '<p>No failed payment found.</p>'; return; }
  box.innerHTML = `
    <div class="summary-row"><span class="summary-title">Order ID</span><span>${ord.id}</span></div>
    <div class="summary-row"><span class="summary-title">Amount</span><span>${formatINR(ord.totals?.total)}</span></div>
    <div class="summary-row"><span class="summary-title">Method</span><span>${ord.paymentMethod.toUpperCase()}</span></div>
  `;
})();

// Public API wrappers
window.loadFailedOrder = function(){ try { return JSON.parse(localStorage.getItem('zylo_last_failed_order') || 'null'); } catch { return null; } };
window.renderFailedSummary = function(){
  const ord = window.loadFailedOrder();
  const box = document.querySelector('#failed-summary');
  if (!box) return;
  if (!ord) { box.innerHTML = '<p>No failed payment found.</p>'; return; }
  const fmt = (window.formatPrice || (n => 'Rs. ' + Number(n||0).toLocaleString('en-IN')));
  box.innerHTML = `
    <div class="summary-row"><span class="summary-title">Order ID</span><span>${ord.id}</span></div>
    <div class="summary-row"><span class="summary-title">Amount</span><span>${fmt(ord.totals?.total)}</span></div>
    <div class="summary-row"><span class="summary-title">Method</span><span>${(ord.paymentMethod||'').toUpperCase()}</span></div>
  `;
};
window.clearFailedData = function(){ try { localStorage.removeItem('zylo_last_failed_order'); } catch {} };
window.initPaymentFailedPage = function(){ window.renderFailedSummary(); };

