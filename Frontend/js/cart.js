// Cart management with backend API integration
class CartManager {
  constructor() {
    console.log('🛒 CartManager constructor called');
    this.cart = this.loadCart();
    this.appliedCoupon = this.loadAppliedCoupon();
    this.isLoggedIn = API ? API.isAuthenticated() : false;
    console.log('🛒 Initial cart state:', this.cart);
    console.log('🛒 Applied coupon:', this.appliedCoupon);
    console.log('🛒 API available:', !!API);
    console.log('🛒 User logged in:', this.isLoggedIn);
    
    // Defer initialization to ensure DOM is ready
    setTimeout(() => {
      console.log('🛒 Starting deferred initialization');
      this.init();
      if (this.isLoggedIn) {
        this.syncWithBackend();
      }
    }, 0);
  }

  loadCart() {
    try {
      return JSON.parse(localStorage.getItem('zylo_cart')) || [];
    } catch {
      return [];
    }
  }

  loadAppliedCoupon() {
    try {
      return JSON.parse(localStorage.getItem('zylo_applied_coupon')) || null;
    } catch {
      return null;
    }
  }

  saveCart() {
    localStorage.setItem('zylo_cart', JSON.stringify(this.cart));
  }

  // Sync cart with backend if user is logged in
  async syncWithBackend() {
    if (!API || !API.isAuthenticated()) return;
    
    console.log('🔄 Syncing cart and coupon data with backend...');
    
    try {
      // Get server cart
      const response = await API.endpoints.cart.get();
      if (response.success) {
        // Convert server cart format to local format
        if (response.items) {
          const serverCart = response.items.map(item => ({
            productId: item.productId,
            size: item.size,
            quantity: item.quantity
          }));
          
          // Use server cart as authoritative
          this.cart = serverCart;
          this.saveCart();
        }
        
        // Sync applied coupon from server
        if (response.appliedCoupon) {
          console.log('✅ Found applied coupon in backend:', response.appliedCoupon);
          this.appliedCoupon = response.appliedCoupon;
          localStorage.setItem('zylo_applied_coupon', JSON.stringify(response.appliedCoupon));
          
          // Trigger coupon system update if available
          if (window.CouponSystem && window.CouponSystem.updateSummary) {
            window.CouponSystem.updateSummary();
          }
        } else {
          console.log('❌ No applied coupon found in backend');
          this.appliedCoupon = null;
          localStorage.removeItem('zylo_applied_coupon');
        }
        
        this.render();
        
        // After rendering, refresh coupon UI if present
        if (window.CouponSystem && window.CouponSystem.refresh) {
          window.CouponSystem.refresh();
        }
      }
    } catch (error) {
      console.warn('Cart sync failed:', error);
      // Continue with local cart
    }
  }

  async addToCart(productId, size = 'M', quantity = 1) {
    // Update local cart first
    const existingItem = this.cart.find(item => item.productId === productId && item.size === size);
    
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      this.cart.push({ productId, size, quantity });
    }
    
    this.saveCart();
    this.render();
    try { window.ZYLO?.updateCartBadge?.(); } catch {}
    
    // Sync with backend if logged in
    if (API && API.isAuthenticated()) {
      try {
        await API.endpoints.cart.add(productId, size, quantity);
      } catch (error) {
        console.warn('Failed to sync cart addition with backend:', error);
      }
    }
    
    this.showNotification('Added to cart');
  }

  async updateQuantity(productId, size, newQuantity) {
    if (newQuantity <= 0) {
      this.removeFromCart(productId, size);
      return;
    }

    const item = this.cart.find(item => item.productId === productId && item.size === size);
    if (item) {
      item.quantity = newQuantity;
      this.saveCart();
      this.render();
      try { window.ZYLO?.updateCartBadge?.(); } catch {}
      
      // Sync with backend if logged in
      if (API && API.isAuthenticated()) {
        try {
          await API.endpoints.cart.update(productId, size, newQuantity);
        } catch (error) {
          console.warn('Failed to sync cart update with backend:', error);
        }
      }
    }
  }

  async removeFromCart(productId, size) {
    this.cart = this.cart.filter(item => !(item.productId === productId && item.size === size));
    this.saveCart();
    this.render();
    try { window.ZYLO?.updateCartBadge?.(); } catch {} 
    
    // Sync with backend if logged in
    if (API && API.isAuthenticated()) {
      try {
        await API.endpoints.cart.remove(productId, size);
      } catch (error) {
        console.warn('Failed to sync cart removal with backend:', error);
      }
    }
    
    this.showNotification('Removed from cart');
  }

  async clearCart() {
    if (this.cart.length === 0) return;
    
    if (confirm('Are you sure you want to clear your cart?')) {
      this.cart = [];
      this.saveCart();
      this.render();
      try { window.ZYLO?.updateCartBadge?.(); } catch {} 
      
      // Sync with backend if logged in
      if (API && API.isAuthenticated()) {
        try {
          await API.endpoints.cart.clear();
        } catch (error) {
          console.warn('Failed to sync cart clear with backend:', error);
        }
      }
      
      this.showNotification('Cart cleared');
    }
  }

  async getCartItems() {
    console.log('🔍 getCartItems() called');
    console.log('Cart contents:', this.cart);
    console.log('Products loaded:', window.PRODUCTS_LOADED);
    console.log('Available products count:', window.PRODUCTS?.length || 0);
    
    // Ensure products are loaded before trying to get cart items
    if (!window.PRODUCTS_LOADED && typeof window.ensureProductsLoaded === 'function') {
      try {
        console.log('🔄 Loading products...');
        await window.ensureProductsLoaded();
        console.log('✅ Products loaded, count:', window.PRODUCTS?.length || 0);
      } catch (error) {
        console.error('❌ Failed to load products:', error);
        // proceed with whatever we have; we'll try on-demand fetch by id below
      }
    }
    
    // Helper to ensure a single product is available; fetch by ID if missing
    const ensureProductById = async (pid) => {
      const found = (window.PRODUCTS || []).find(p => String(p.id) === String(pid));
      if (found) return found;
      if (!window.API || !window.API.endpoints?.products?.getById) return null;
      try {
        console.log(`🛰️ Fetching product by id from API: ${pid}`);
        const res = await window.API.endpoints.products.getById(pid);
        const raw = res?.item;
        if (!raw) return null;
        const mapped = {
          id: raw.id,
          name: raw.name,
          brand: raw.brand,
          price: raw.price,
          image: raw.image,
          sizes: raw.sizes || [],
          category: raw.category,
          description: raw.description,
          stock: raw.stock
        };
        // Cache into PRODUCTS for future lookups
        window.PRODUCTS = Array.isArray(window.PRODUCTS) ? window.PRODUCTS.concat([mapped]) : [mapped];
        return mapped;
      } catch (e) {
        console.warn('Failed to fetch product by id:', pid, e);
        return null;
      }
    };

    console.log('🔍 Mapping cart items to products...');
    const mappedItems = (await Promise.all(this.cart.map(async (item, index) => {
      console.log(`Mapping item ${index}:`, item);
      let product = (window.PRODUCTS || []).find(p => {
        console.log(`Checking product ${p?.id} against cart item ${item.productId}`);
        return String(p?.id) === String(item.productId);
      });

      if (!product) {
        console.warn(`❌ Product not found for cart item locally, trying API:`, item);
        product = await ensureProductById(item.productId);
        if (!product) {
          console.warn('❌ Still not found for cart item after API fetch:', item);
          return null;
        }
      }
      
      console.log(`✅ Found product for item ${index}:`, product);
      const mappedItem = { ...product, cartSize: item.size, cartQuantity: item.quantity };
      console.log(`✅ Mapped item ${index}:`, mappedItem);
      return mappedItem;
    })) ).filter(Boolean);
    
    console.log('🎉 Final mapped items:', mappedItems);
    return mappedItems;
  }

  async calculateTotals() {
    const items = await this.getCartItems();
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.cartQuantity), 0);
    
    // Apply coupon discount if available
    let couponDiscount = 0;
    if (this.appliedCoupon) {
      if (typeof this.appliedCoupon.discountAmount === 'number') {
        couponDiscount = this.appliedCoupon.discountAmount;
      } else if (this.appliedCoupon.discountType === 'percentage') {
        couponDiscount = (subtotal * this.appliedCoupon.discountValue) / 100;
        if (this.appliedCoupon.maximumDiscount && couponDiscount > this.appliedCoupon.maximumDiscount) {
          couponDiscount = this.appliedCoupon.maximumDiscount;
        }
      } else if (this.appliedCoupon.discountValue != null) {
        couponDiscount = this.appliedCoupon.discountValue;
      }
      
      // Ensure discount doesn't exceed subtotal
      couponDiscount = Math.min(couponDiscount, subtotal);
    }
    
    const discountedSubtotal = subtotal - couponDiscount;
    const tax = Math.round(discountedSubtotal * 0.18); // 18% GST on discounted amount
    const shipping = discountedSubtotal > 1500 ? 0 : 99; // Free shipping over Rs. 1500 after discount
    const total = discountedSubtotal + tax + shipping;

    return { subtotal, couponDiscount, tax, shipping, total };
  }

  render() {
    console.log('🎨 render() method called');
    // Sync with persisted state in case it changed elsewhere
    this.cart = this.loadCart();
    const count = this.cart.reduce((sum, item) => sum + item.quantity, 0);
    console.log('🎨 Cart count:', count);
    console.log('🎨 Cart items:', this.cart);
    const countElement = document.getElementById('cart-count');
    const emptyState = document.getElementById('empty-cart');
    const itemsContainer = document.getElementById('cart-items');
    const orderSummary = document.querySelector('.order-summary');
    const layout = document.querySelector('.cart-layout');
    const checkoutBtn = document.getElementById('checkout-btn');
    const isLoggedIn = (function(){
      try { return !!JSON.parse(localStorage.getItem('zylo_user') || 'null'); } catch { return false; }
    })();

    // Update count - always show count
    if (countElement) {
      countElement.textContent = `${count} ${count === 1 ? 'item' : 'items'}`;
    }

    if (count === 0) {
      // Empty cart state
      if (emptyState) emptyState.style.display = 'block';
      if (itemsContainer) itemsContainer.style.display = 'none';
      if (orderSummary) orderSummary.style.display = 'none'; // Always hide when empty
      if (layout) layout.classList.add('is-empty');
      
      // Update empty state buttons based on login status
      this.updateEmptyCartButtons(isLoggedIn);
    } else {
      // Cart has items
      if (emptyState) emptyState.style.display = 'none';
      if (itemsContainer) itemsContainer.style.display = 'block';
      if (orderSummary) orderSummary.style.display = 'block'; // Show when has items
      if (layout) layout.classList.remove('is-empty');
      // Render items and summary asynchronously
      this.renderItemsAndSummary();
    }
    
    // Update checkout button text to indicate login requirement
    if (checkoutBtn){
      checkoutBtn.textContent = isLoggedIn ? 'Proceed to Checkout' : 'Login to Proceed';
      checkoutBtn.setAttribute('aria-label', isLoggedIn ? 'Proceed to checkout' : 'Login to proceed to checkout');
    }
    try { window.ZYLO?.updateCartBadge?.(); } catch {}

    // Keep coupon UI in sync with cart state
    try { window.CouponSystem?.refresh?.(); } catch {}
  }

  // Render both items and summary together to avoid race conditions
  async renderItemsAndSummary() {
    console.log('🛠️ renderItemsAndSummary() called');
    try {
      console.log('🛠️ Calling renderItems()');
      await this.renderItems();
      console.log('🛠️ Calling renderSummary()');
      await this.renderSummary();
      console.log('🛠️ renderItemsAndSummary() completed successfully');
    } catch (error) {
      console.error('❌ Error rendering cart items and summary:', error);
    }
  }

  

  async renderItems() {
    const container = document.getElementById('cart-items');
    if (!container) return;
    
    // Show loading state while fetching cart items
    container.innerHTML = '<div class="cart-loading">Loading cart items...</div>';
    
    try {
      const items = await this.getCartItems();
      
      if (items.length === 0) {
        container.innerHTML = '';
        return;
      }

      container.innerHTML = items.map(item => `
        <div class="cart-item" data-id="${item.id}" data-size="${item.cartSize}">
          <div class="item-image">
            <a href="singlepro.html?id=${item.id}">
              <img src="${item.image}" alt="${item.name} by ${item.brand}" onerror="this.src='../img/placeholder.jpg'">
            </a>
          </div>
          <div class="item-details">
            <div class="item-info">
              <span class="brand">${item.brand}</span>
              <h3 class="product-name">${item.name}</h3>
              <div class="size">Size: ${item.cartSize}</div>
              <div class="price">Rs. ${item.price.toLocaleString('en-IN')} each</div>
            </div>
            <div class="item-controls">
              <div class="quantity-control">
                <button class="qty-btn" onclick="onQtyDec('${item.id}', '${item.cartSize}')">
                  <i class="fas fa-minus"></i>
                </button>
                <span class="quantity">${item.cartQuantity}</span>
                <button class="qty-btn" onclick="onQtyInc('${item.id}', '${item.cartSize}')">
                  <i class="fas fa-plus"></i>
                </button>
              </div>
              <div class="item-total">Rs. ${(item.price * item.cartQuantity).toLocaleString('en-IN')}</div>
              <button class="btn-remove" onclick="onRemove('${item.id}', '${item.cartSize}')" title="Remove item">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      `).join('');
    } catch (error) {
      console.error('Error rendering cart items:', error);
      container.innerHTML = '<div class="cart-error">Error loading cart items. Please refresh the page.</div>';
    }
  }

  async renderSummary() {
    const totals = await this.calculateTotals();
    
    const subtotalEl = document.getElementById('subtotal');
    const taxEl = document.getElementById('tax');
    const shippingEl = document.getElementById('shipping');
    const totalEl = document.getElementById('total');
    
    if (subtotalEl) subtotalEl.textContent = `Rs. ${totals.subtotal.toLocaleString('en-IN')}`;
    if (taxEl) taxEl.textContent = `Rs. ${totals.tax.toLocaleString('en-IN')}`;
    if (shippingEl) shippingEl.textContent = totals.shipping === 0 ? 'Free' : `Rs. ${totals.shipping}`;
    if (totalEl) totalEl.textContent = `Rs. ${totals.total.toLocaleString('en-IN')}`;
    
    // Handle coupon discount display
    this.updateCouponDisplay(totals.couponDiscount || 0);
  }

  updateCouponDisplay(couponDiscount) {
    const summaryDetails = document.querySelector('.summary-details');
    if (!summaryDetails) return;

    // Remove existing coupon discount row if it exists
    const existingCouponRow = summaryDetails.querySelector('.coupon-discount-row');
    if (existingCouponRow) {
      existingCouponRow.remove();
    }

    // Add coupon discount row if there's a discount
    if (couponDiscount > 0 && this.appliedCoupon) {
      const couponRow = document.createElement('div');
      couponRow.className = 'summary-row coupon-discount-row';
      couponRow.innerHTML = `
        <span>Coupon (${this.appliedCoupon.code})</span>
        <span class="discount">-Rs. ${couponDiscount.toLocaleString('en-IN')}</span>
      `;
      
      // Insert before tax row
      const taxRow = summaryDetails.querySelector('.summary-row:nth-child(3)');
      if (taxRow) {
        summaryDetails.insertBefore(couponRow, taxRow);
      } else {
        summaryDetails.appendChild(couponRow);
      }
    }
  }

  // Update empty cart buttons based on login status
  updateEmptyCartButtons(isLoggedIn) {
    const emptyState = document.getElementById('empty-cart');
    if (!emptyState) return;
    
    // Find or create the actions container
    let actionsContainer = emptyState.querySelector('.empty-cart-actions');
    if (!actionsContainer) {
      // Create actions container if it doesn't exist
      actionsContainer = document.createElement('div');
      actionsContainer.className = 'empty-cart-actions';
      
      // Find the Continue Shopping link and move it to the container
      const continueShoppingLink = emptyState.querySelector('a[href="shop.html"]');
      if (continueShoppingLink) {
        actionsContainer.appendChild(continueShoppingLink);
      } else {
        // Create Continue Shopping button if it doesn't exist
        const continueBtn = document.createElement('a');
        continueBtn.href = 'shop.html';
        continueBtn.className = 'btn';
        continueBtn.textContent = 'Continue Shopping';
        actionsContainer.appendChild(continueBtn);
      }
      
      emptyState.appendChild(actionsContainer);
    }
    
    // Remove any existing dynamic buttons
    const existingLoginBtn = actionsContainer.querySelector('.btn-login-cart');
    if (existingLoginBtn) existingLoginBtn.remove();
    
    if (!isLoggedIn) {
      // Add Login button to actions container
      const loginBtn = document.createElement('button');
      loginBtn.className = 'btn btn-login-cart';
      loginBtn.textContent = 'Login';
      loginBtn.addEventListener('click', () => {
        try { localStorage.setItem('zylo_return_to', 'cart.html'); } catch {}
        window.location.href = 'login.html';
      });
      
      actionsContainer.appendChild(loginBtn);
    }
    // When logged in, only Continue Shopping button should be visible (already in HTML)
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 100);
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
  }

  async init() {
    // First ensure products are loaded before rendering
    try {
      console.log('🛒 CartManager init: ensuring products are loaded...');
      await window.ensureProductsLoaded();
      console.log('✅ CartManager init: products loaded, now rendering...');
    } catch (error) {
      console.error('❌ CartManager init: failed to load products:', error);
    }
    
    this.render();
    
    // Attach event listeners
    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', () => this.checkout());
    }

    const promoBtn = document.getElementById('apply-promo');
    if (promoBtn) {
      promoBtn.addEventListener('click', () => {
        if (promoBtn.classList.contains('remove-coupon')) {
          this.removeCoupon();
        } else {
          this.applyPromo();
        }
      });
    }
    
    // Initialize coupon display if there's an applied coupon
    this.initializeCouponDisplay();
    
    try { window.ZYLO?.updateCartBadge?.(); } catch {}
  }

  initializeCouponDisplay() {
    const promoInput = document.getElementById('promo-input');
    const applyBtn = document.getElementById('apply-promo');
    
    if (this.appliedCoupon && promoInput && applyBtn) {
      promoInput.value = this.appliedCoupon.code;
      promoInput.disabled = true;
      applyBtn.textContent = 'Remove';
      applyBtn.classList.add('remove-coupon');
    }
  }

  async applyPromo() {
    const promoInput = document.getElementById('promo-input');
    const applyBtn = document.getElementById('apply-promo');
    const code = promoInput.value.trim().toUpperCase();
    
    if (!code) {
      this.showNotification('Please enter a coupon code', 'error');
      return;
    }

    const totals = await this.calculateTotals();
    const isAuthed = !!(window.API && typeof window.API.isAuthenticated === 'function' && window.API.isAuthenticated());
    
    try {
      applyBtn.textContent = 'Applying...';
      applyBtn.disabled = true;
      
      if (isAuthed) {
        // Persist coupon on server cart when authenticated
        const data = await API.endpoints.cart.applyCoupon(code);
        if (!data || !data.success) {
          this.showNotification((data && data.message) || 'Failed to apply coupon', 'error');
        } else {
          // Normalize to server-applied shape
          this.appliedCoupon = {
            code: data.appliedCoupon.code,
            discountAmount: Number(data.appliedCoupon.discountAmount) || 0,
            discountType: data.appliedCoupon.discountType
          };
          try { localStorage.setItem('zylo_applied_coupon', JSON.stringify(this.appliedCoupon)); } catch {}
          await this.renderSummary();
          this.showNotification(`Coupon applied! You saved ₹${(data.discountAmount || this.appliedCoupon.discountAmount || 0).toLocaleString('en-IN')}`, 'success');
          applyBtn.textContent = 'Remove';
          applyBtn.classList.add('remove-coupon');
          promoInput.value = code;
          promoInput.disabled = true;
          return;
        }
      } else {
        // Validate publicly for guests; map result to discountAmount for consistency
        const apiBase = (window.API && window.API.config && window.API.config.BASE_URL) || 'http://localhost:5000/api';
        const resp = await fetch(`${apiBase}/coupons/validate/${encodeURIComponent(code)}?orderValue=${totals.subtotal}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        const result = await resp.json();
        if (result && result.success) {
          this.appliedCoupon = {
            code: result.coupon.code,
            description: result.coupon.description,
            discountType: result.coupon.discountType,
            discountValue: result.coupon.discountValue,
            discountAmount: Number(result.coupon.discount) || 0
          };
          try { localStorage.setItem('zylo_applied_coupon', JSON.stringify(this.appliedCoupon)); } catch {}
          await this.renderSummary();
          this.showNotification(`Coupon applied! You saved ₹${(this.appliedCoupon.discountAmount || 0).toLocaleString('en-IN')}`, 'success');
          applyBtn.textContent = 'Remove';
          applyBtn.classList.add('remove-coupon');
          promoInput.value = code;
          promoInput.disabled = true;
          return;
        } else {
          this.showNotification((result && result.message) || 'Invalid coupon code', 'error');
        }
      }
      
    } catch (error) {
      console.error('Error applying coupon:', error);
      this.showNotification('Failed to apply coupon. Please try again.', 'error');
    } finally {
      if (!this.appliedCoupon) {
        applyBtn.textContent = 'Apply';
        promoInput.value = '';
        promoInput.disabled = false;
      }
      applyBtn.disabled = false;
    }
  }

  removeCoupon() {
    this.appliedCoupon = null;
    localStorage.removeItem('zylo_applied_coupon');
    
    const promoInput = document.getElementById('promo-input');
    const applyBtn = document.getElementById('apply-promo');
    
    if (promoInput) {
      promoInput.value = '';
      promoInput.disabled = false;
    }
    
    if (applyBtn) {
      applyBtn.textContent = 'Apply';
      applyBtn.classList.remove('remove-coupon');
    }
    
    this.renderSummary();
    this.showNotification('Coupon removed', 'info');
  }

  async checkout() {
    if (this.cart.length === 0) {
      alert('Your cart is empty');
      return;
    }
    // Enforce login before checkout
    let isLoggedIn = false;
    try { isLoggedIn = !!JSON.parse(localStorage.getItem('zylo_user') || 'null'); } catch { isLoggedIn = false; }
    if (!isLoggedIn) {
      try { localStorage.setItem('zylo_return_to', 'checkout.html'); } catch {}
      window.location.href = 'login.html';
      return;
    }
    // Ensure address exists before checkout using backend (authoritative)
    let hasAddress = false;
    if (window.API && typeof window.API.isAuthenticated === 'function' && window.API.isAuthenticated()) {
      try {
        const resp = await window.API.endpoints.addresses.getAll();
        if (resp && resp.success && Array.isArray(resp.addresses)) {
          hasAddress = resp.addresses.length > 0;
          try { localStorage.setItem('zylo_addresses', JSON.stringify(resp.addresses)); } catch {}
        }
      } catch (e) {
        // Fallback to local cache if API fails
        try { hasAddress = (JSON.parse(localStorage.getItem('zylo_addresses') || '[]') || []).length > 0; } catch { hasAddress = false; }
      }
    }
    if (!hasAddress) {
      try { localStorage.setItem('zylo_return_to', 'checkout.html'); } catch {}
      window.location.href = 'account.html?tab=addresses';
      return;
    }

    // Redirect to checkout page
    window.location.href = 'checkout.html';
  }
}

// Initialize cart manager after DOM is ready
let cartManager = null;

function initCartManager() {
  if (cartManager) return cartManager; // Already initialized
  
  cartManager = new CartManager();
  // Expose for inline handlers if needed
  try { window.cartManager = cartManager; } catch {}
  
  // Sync with CouponSystem if it exists
  setTimeout(() => {
    if (window.CouponSystem && window.CouponSystem.syncWithCartManager) {
      console.log('🔄 CartManager initialized, syncing with CouponSystem');
      window.CouponSystem.syncWithCartManager();
    }
  }, 100);
  
  return cartManager;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCartManager);
} else {
  // DOM already loaded
  initCartManager();
}

// Public API wrappers - ensure cartManager is initialized before use
window.initCartPage = function(){ 
  const cm = cartManager || initCartManager();
  cm.render(); 
};
window.loadCartAndRender = function(){ 
  const cm = cartManager || initCartManager();
  cm.render(); 
};
window.renderCartItem = function(/* item */){ /* rendering handled in renderItems(); stub for API completeness */ };
window.onQtyInc = function(productId, size){
  const cm = cartManager || initCartManager();
  const it = cm.cart.find(i => i.productId === productId && i.size === size);
  const next = (it?.quantity || 0) + 1;
  cm.updateQuantity(productId, size, next);
};
window.onQtyDec = function(productId, size){
  const cm = cartManager || initCartManager();
  const it = cm.cart.find(i => i.productId === productId && i.size === size);
  const next = Math.max(0, (it?.quantity || 1) - 1);
  cm.updateQuantity(productId, size, next);
};
window.onQtyInput = function(productId, size, value){
  const cm = cartManager || initCartManager();
  const v = Math.max(0, Number(value||0));
  cm.updateQuantity(productId, size, v);
};
window.onRemove = function(productId, size){ 
  const cm = cartManager || initCartManager();
  cm.removeFromCart(productId, size); 
};
window.clearCart = function(){ 
  const cm = cartManager || initCartManager();
  cm.clearCart(); 
};
window.applyPromoCode = function(code){ 
  const cm = cartManager || initCartManager();
  const inp = document.getElementById('promo-input'); 
  if (inp) inp.value = code || ''; 
  cm.applyPromo(); 
};
window.computeSummary = function(){ 
  const cm = cartManager || initCartManager();
  return cm.calculateTotals(); 
};
window.renderSummary = function(){ 
  const cm = cartManager || initCartManager();
  cm.renderSummary(); 
};
window.proceedToCheckout = function(){ 
  const cm = cartManager || initCartManager();
  cm.checkout(); 
};

// Keep cart view in sync across tabs/pages and after bfcache restores
window.addEventListener('storage', function(e){
  if ((e && e.key) === 'zylo_cart') {
    try { 
      const cm = cartManager || initCartManager();
      cm.render(); 
    } catch {}
  }
});
window.addEventListener('pageshow', function(){
  try { 
    const cm = cartManager || initCartManager();
    cm.render(); 
  } catch {}
});
