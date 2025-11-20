// Modern Order Success Page Script with Enhanced Features
(function(){
  function qs(sel){ return document.querySelector(sel); }
  function formatINR(n){ try { return 'Rs. ' + Number(n||0).toLocaleString('en-IN'); } catch { return 'Rs. ' + n; } }

  // Initialize page when DOM loads
  document.addEventListener('DOMContentLoaded', function() {
    renderOrderSummary();
    setupAnimations();
  });

  function renderOrderSummary() {
    const order = JSON.parse(localStorage.getItem('zylo_last_order') || 'null');
    const box = qs('#order-summary');

    if (!order) {
      box.innerHTML = `
        <div class="no-order-found">
          <i class="fas fa-exclamation-circle" style="font-size: 48px; color: #f59e0b; margin-bottom: 16px;"></i>
          <h3>No Recent Order Found</h3>
          <p>We couldn't find any recent order information. Please check your email for order confirmation.</p>
          <a href="shop.html" class="btn primary" style="margin-top: 20px;">Start Shopping</a>
        </div>
      `;
      return;
    }

    const addr = (order.shippingAddress?.name || 'Customer') + ' — ' + (order.shippingAddress?.addressText || 'Address not available');
    const method = order.paymentMethod === 'cod' ? 'Cash on Delivery' : (order.paymentMethod || 'Payment Method').toUpperCase();
    const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long', 
      day: 'numeric'
    }) : new Date().toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    box.innerHTML = `
      <div class="order-header">
        <h3 style="margin: 0 0 20px 0; color: var(--text); display: flex; align-items: center; gap: 8px;">
          <i class="fas fa-receipt"></i>
          Order Details
        </h3>
      </div>
      
      <div class="summary-row">
        <span class="summary-title"><i class="fas fa-hashtag"></i> Order ID</span>
        <span style="font-family: monospace; background: #f1f5f9; padding: 4px 8px; border-radius: 6px;">#${order.id}</span>
      </div>
      
      <div class="summary-row">
        <span class="summary-title"><i class="fas fa-calendar-alt"></i> Order Date</span>
        <span>${orderDate}</span>
      </div>
      
      <div class="summary-row">
        <span class="summary-title"><i class="fas fa-credit-card"></i> Payment Method</span>
        <span style="display: flex; align-items: center; gap: 6px;">
          ${method === 'CASH ON DELIVERY' ? '<i class="fas fa-money-bill-wave" style="color: #10b981;"></i>' : '<i class="fas fa-credit-card" style="color: #2563eb;"></i>'}
          ${method}
        </span>
      </div>
      
      ${order.appliedCoupon && order.appliedCoupon.discountAmount > 0 ? `
        <div class="summary-row coupon-row">
          <span class="summary-title"><i class="fas fa-tags"></i> Coupon Applied (${order.appliedCoupon.code})</span>
          <span style="color: #7c3aed; font-weight: 600;">-${formatINR(order.appliedCoupon.discountAmount)}</span>
        </div>
        <div class="summary-row">
          <span class="summary-title"><i class="fas fa-rupee-sign"></i> Original Amount</span>
          <span style="text-decoration: line-through; color: #6b7280;">${formatINR(order.appliedCoupon.originalTotal)}</span>
        </div>
        <div class="summary-row">
          <span class="summary-title"><i class="fas fa-money-check-alt"></i> Final Amount</span>
          <span style="font-weight: 700; color: #10b981; font-size: 18px;">${formatINR(order.totals?.total)}</span>
        </div>
      ` : `
        <div class="summary-row">
          <span class="summary-title"><i class="fas fa-rupee-sign"></i> Total Amount</span>
          <span style="font-weight: 700; color: #10b981; font-size: 18px;">${formatINR(order.totals?.total)}</span>
        </div>
      `}
      
      <div class="summary-row">
        <span class="summary-title"><i class="fas fa-map-marker-alt"></i> Delivery Address</span>
        <span style="text-align: right; max-width: 250px;">${addr}</span>
      </div>
      
      ${order.items && order.items.length > 0 ? `
        <div style="margin-top: 24px; padding-top: 20px; border-top: 2px solid #e2e8f0;">
          <h4 style="margin: 0 0 16px 0; color: var(--text); display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-shopping-bag"></i>
            Items Ordered (${order.items.length})
          </h4>
          <div class="items-list">
            ${order.items.map(it => `
              <div class="item">
                <img src="${it.image}" alt="${it.name}" onerror="this.src='../img/products/default.jpg'" />
                <div>
                  <div class="name">${it.name}</div>
                  <div class="meta">
                    <span><i class="fas fa-tag"></i> ${it.brand}</span> • 
                    <span><i class="fas fa-expand-arrows-alt"></i> ${it.size}</span> • 
                    <span><i class="fas fa-box"></i> Qty ${it.quantity}</span>
                  </div>
                </div>
                <div style="font-weight: 600; color: #10b981;">${formatINR(it.price * it.quantity)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;
  }

  function setupAnimations() {
    // Add entrance animations with delays
    const elements = document.querySelectorAll('.success-card > *');
    elements.forEach((el, index) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'all 0.6s ease';
      
      setTimeout(() => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }, 100 + (index * 100));
    });
  }
})();

// Social Sharing Functions
window.shareOnFacebook = function() {
  const order = JSON.parse(localStorage.getItem('zylo_last_order') || 'null');
  const shareText = order 
    ? `Just ordered ${order.items?.length || 0} amazing items from Zylo! Order #${order.id} – loving this shopping experience! 🛍️✨`
    : 'Just had an amazing shopping experience at Zylo! Check out their awesome collection! 🛍️✨';
  
  const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.origin)}&quote=${encodeURIComponent(shareText)}`;
  window.open(shareUrl, '_blank', 'width=600,height=400,scrollbars=yes,resizable=yes');
};

window.shareOnTwitter = function() {
  const order = JSON.parse(localStorage.getItem('zylo_last_order') || 'null');
  const shareText = order 
    ? `Just ordered ${order.items?.length || 0} amazing items from @Zylo! Order #${order.id} – loving this shopping experience! 🛍️✨ #ZyloShopping`
    : 'Just had an amazing shopping experience at @Zylo! Check out their awesome collection! 🛍️✨ #ZyloShopping';
  
  const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(window.location.origin)}`;
  window.open(shareUrl, '_blank', 'width=600,height=400,scrollbars=yes,resizable=yes');
};

window.shareOnWhatsApp = function() {
  const order = JSON.parse(localStorage.getItem('zylo_last_order') || 'null');
  const shareText = order 
    ? `🎉 Just ordered ${order.items?.length || 0} amazing items from Zylo! Order #${order.id}\n\nLoving this shopping experience! 🛍️✨\n\nCheck them out: ${window.location.origin}`
    : `🎉 Just had an amazing shopping experience at Zylo!\n\nCheck out their awesome collection! 🛍️✨\n\n${window.location.origin}`;
  
  const shareUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  window.open(shareUrl, '_blank');
};

// Enhanced Order Summary Functions
window.generateOrderSummaryCard = function(order) {
  if (!order) return '<div class="no-order">No order data available</div>';
  
  const formatINR = (n) => {
    try { return 'Rs. ' + Number(n||0).toLocaleString('en-IN'); } 
    catch { return 'Rs. ' + n; }
  };
  
  return `
    <div class="order-confirmation-card">
      <div class="order-status">
        <i class="fas fa-check-circle"></i>
        <span>Order Confirmed</span>
      </div>
      <div class="order-info">
        <div class="info-row">
          <span>Order ID:</span>
          <strong>#${order.id}</strong>
        </div>
        <div class="info-row">
          <span>Total Amount:</span>
          <strong style="color: #10b981;">${formatINR(order.totals?.total)}</strong>
        </div>
        <div class="info-row">
          <span>Items:</span>
          <strong>${order.items?.length || 0} item(s)</strong>
        </div>
        <div class="info-row">
          <span>Payment:</span>
          <strong>${order.paymentMethod === 'cod' ? 'Cash on Delivery' : (order.paymentMethod || 'Card').toUpperCase()}</strong>
        </div>
      </div>
    </div>
  `;
};

// Public API wrappers (maintain compatibility)
window.loadSuccessOrder = function(){ 
  try { return JSON.parse(localStorage.getItem('zylo_last_order') || 'null'); } 
  catch { return null; } 
};

window.renderOrderSummary = function(){
  const order = window.loadSuccessOrder();
  const box = document.querySelector('#order-summary');
  if (!box) return;
  if (!order) { 
    box.innerHTML = '<div class="no-order-found" style="text-align: center; padding: 40px;"><i class="fas fa-exclamation-circle" style="font-size: 48px; color: #f59e0b; margin-bottom: 16px;"></i><h3>No recent order found.</h3><p>Please check your email for order confirmation.</p></div>';
    return; 
  }
  
  const fmt = (window.formatPrice || (n => 'Rs. ' + Number(n||0).toLocaleString('en-IN')));
  const addr = (order.shippingAddress?.name || 'Customer') + ' — ' + (order.shippingAddress?.addressText || 'Address not available');
  const method = order.paymentMethod === 'cod' ? 'Cash on Delivery' : (order.paymentMethod || 'Payment Method').toUpperCase();
  
  box.innerHTML = `
    <div class="summary-row"><span class="summary-title">Order ID</span><span style="font-family: monospace;">#${order.id}</span></div>
    <div class="summary-row"><span class="summary-title">Payment</span><span>${method}</span></div>
    <div class="summary-row"><span class="summary-title">Amount</span><span style="font-weight: 700; color: #10b981;">${fmt(order.totals?.total)}</span></div>
    <div class="summary-row"><span class="summary-title">Delivering to</span><span>${addr}</span></div>
    <div class="items-list">
      ${(order.items||[]).map(it => `
        <div class="item">
          <img src="${it.image}" alt="${it.name}" onerror="this.src='../img/products/default.jpg'" />
          <div>
            <div class="name">${it.name}</div>
            <div class="meta">${it.brand} • Size ${it.size} • Qty ${it.quantity}</div>
          </div>
          <div style="font-weight: 600; color: #10b981;">${fmt(it.price * it.quantity)}</div>
        </div>
      `).join('')}
    </div>
  `;
};

window.clearTransientData = function(){ 
  try { 
    localStorage.removeItem('zylo_last_order'); 
    console.log('✅ Cleared order data'); 
  } catch {} 
};

window.initOrderSuccessPage = function(){ 
  window.renderOrderSummary(); 
  console.log('✅ Order success page initialized');
};

