// Common UI helpers and cart/wishlist utilities for Zylo
(function(){
  const ZYLO = (window.ZYLO = window.ZYLO || {});

  // INR formatter
  ZYLO.formatINR = function(n){
    try { return 'Rs. ' + Number(n||0).toLocaleString('en-IN'); } catch { return 'Rs. ' + n; }
  };

  // Read and write localStorage safely
  function readLS(key, fallback){
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
  }
  function writeLS(key, value){
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  // Cart helpers (structure: [{productId, size, quantity}])
  ZYLO.getCart = function(){ return readLS('zylo_cart', []); };
  ZYLO.setCart = function(cart){ writeLS('zylo_cart', cart); };
  ZYLO.getCartCount = function(){ return ZYLO.getCart().reduce((s,i)=>s+(i.quantity||0), 0); };
  ZYLO.addToCart = function(productId, size, quantity){
    console.log('🛍️ ZYLO.addToCart called with:', { productId, size, quantity });
    
    // Use the CartManager if available to avoid duplication
    if (window.cartManager && typeof window.cartManager.addToCart === 'function') {
      console.log('🛍️ Using CartManager.addToCart');
      window.cartManager.addToCart(productId, size, quantity);
      return;
    }
    
    console.log('🛍️ Using fallback ZYLO.addToCart implementation');
    // Fallback implementation if CartManager not available
    const q = Math.max(1, Number(quantity || 1));
    let cart = ZYLO.getCart();
    console.log('🛍️ Current cart before adding:', cart);
    
    const idx = cart.findIndex(it => it.productId === productId && it.size === size);
    if (idx >= 0) {
      console.log('🛍️ Item exists, updating quantity');
      cart[idx].quantity += q;
    } else {
      console.log('🛍️ New item, adding to cart');
      cart.push({ productId, size, quantity: q });
    }
    
    ZYLO.setCart(cart);
    console.log('🛍️ Cart after adding:', cart);
    ZYLO.toast('Added to cart');
    ZYLO.updateCartBadge();
  };

  // Wishlist helpers (structure: [productId])
  ZYLO.getWishlist = function(){ return readLS('zylo_wishlist', []); };
  ZYLO.setWishlist = function(list){ writeLS('zylo_wishlist', list); };

  // Small toast notification
  ZYLO.toast = function(msg){
    const n = document.createElement('div');
    n.className = 'notification';
    n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(()=> n.classList.add('show'), 50);
    setTimeout(()=>{ n.classList.remove('show'); setTimeout(()=> n.remove(), 300); }, 1800);
  };

  // Navbar search: redirect to shop page with ?q= or live-update if already on shop
  function initSearch(){
    const input = document.querySelector('#navbar .search-bar');
    const icon = document.querySelector('#navbar .search-icon');
    function onSearch(){
      const q = (input?.value || '').trim();
      const isOnShop = /(^|\/)shop\.html(\?|$)/.test(window.location.pathname) || window.location.href.includes('shop.html');
      if (isOnShop){
        const params = new URLSearchParams(window.location.search);
        if (q) params.set('q', q); else params.delete('q');
        const newUrl = `${window.location.pathname}?${params.toString()}`.replace(/\?$/, '');
        if (newUrl !== window.location.pathname + window.location.search){
          history.replaceState(null, '', newUrl);
        }
        try {
          // Let shop page read updated URL and apply filters immediately
          window.readFiltersFromURL?.();
          window.applyFilters?.();
        } catch {}
      } else {
        const url = q ? `shop.html?q=${encodeURIComponent(q)}` : 'shop.html';
        window.location.href = url;
      }
    }
    if (input){
      input.addEventListener('keydown', (e)=>{ if (e.key === 'Enter'){ e.preventDefault(); onSearch(); } });
    }
    icon?.addEventListener('click', (e)=>{ e.preventDefault(); onSearch(); });
  }

  // Expose a public rebind for robustness
  if (typeof window.rebindNavbarSearch !== 'function') {
    window.rebindNavbarSearch = initSearch;
  }

  // Update a cart count if present
  ZYLO.updateCartBadge = function(){
    const cnt = ZYLO.getCartCount();
    // Text badge target if present
    const textEl = document.querySelector('#cart-count');
    if (textEl) textEl.textContent = `${cnt} ${cnt === 1 ? 'item' : 'items'}`;
    // Icon badge on navbar cart link
    const cartLink = document.querySelector('#navbar a[title="Cart"]');
    if (cartLink){
      let badge = cartLink.querySelector('.cart-badge');
      if (!badge){
        badge = document.createElement('span');
        badge.className = 'cart-badge';
        cartLink.appendChild(badge);
      }
      if (cnt > 0){
        badge.textContent = String(Math.min(cnt, 99));
        badge.classList.add('show');
      } else {
        badge.textContent = '';
        badge.classList.remove('show');
      }
    }
  };

  // Newsletter (demo)
  function initNewsletter(){
    const btn = document.querySelector('#newsletter .form button');
    const inp = document.querySelector('#newsletter .form input[type="email"]');
    btn?.addEventListener('click', ()=>{
      const email = (inp?.value || '').trim();
      if (!email) { ZYLO.toast('Please enter your email'); return; }
      ZYLO.toast('Thanks for subscribing!');
      if (inp) inp.value = '';
    });
  }

  function ensureLogoutModal(){
    if (document.getElementById('zylo-logout-modal')) return;
    const backdrop = document.createElement('div');
    backdrop.id = 'zylo-logout-modal';
    backdrop.className = 'zylo-modal-backdrop';
    backdrop.innerHTML = `
      <div class="zylo-modal" role="dialog" aria-modal="true" aria-labelledby="logout-title">
        <h3 id="logout-title">Log out?</h3>
        <p>Are you sure you want to log out of your account?</p>
        <div class="modal-actions">
          <button type="button" class="button-neutral" data-cancel>Cancel</button>
          <button type="button" data-confirm>Log out</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);
    const cancelBtn = backdrop.querySelector('[data-cancel]');
    const confirmBtn = backdrop.querySelector('[data-confirm]');
    cancelBtn?.addEventListener('click', ()=>{ backdrop.classList.remove('show'); });
    confirmBtn?.addEventListener('click', ()=>{
      try { localStorage.removeItem('zylo_user'); } catch {}
      window.location.href = 'login.html';
    });
  }

  ZYLO.showLogoutModal = function(){ ensureLogoutModal(); document.getElementById('zylo-logout-modal')?.classList.add('show'); };

  document.addEventListener('DOMContentLoaded', ()=>{
    initSearch();
    initNewsletter();
    ZYLO.updateCartBadge();

    // Intercept wishlist icon click to require login
    const wlLinks = Array.from(document.querySelectorAll('a[href$="wishlist.html"]'));
    wlLinks.forEach(a => {
      a.addEventListener('click', (e)=>{
        if (!ZYLO.isLoggedIn()){
          e.preventDefault();
          try { localStorage.setItem('zylo_return_to', 'wishlist.html'); } catch {}
          window.location.href = 'login.html';
        }
      });
    });

    // Profile dropdown (only when logged in)
    buildProfileDropdown();
  });

  // Ensure binding on bfcache navigations
  window.addEventListener('pageshow', ()=>{ try { initSearch(); } catch {} });

  function buildProfileDropdown(){
    try {
      const user = (()=>{ try { return JSON.parse(localStorage.getItem('zylo_user')||'null'); } catch { return null; } })();
      const isLogged = !!user;
      const accLink = document.querySelector('#navbar a[title="Account"]');
      if (!accLink) return;
      const container = accLink.closest('li') || accLink.parentElement;
      if (!container) return;
      container.classList.add('profile-container');

      if (isLogged){
        // Clicking profile icon should do nothing
        accLink.addEventListener('click', (e)=>{ e.preventDefault(); });
        // Build dropdown if not present
        if (!container.querySelector('.profile-dropdown')){
          const dropdown = document.createElement('div');
          dropdown.className = 'profile-dropdown';
          const displayName = user?.firstName || 'User';
          dropdown.innerHTML = `
            <div class="greeting">Welcome, <span class="profile-name">${displayName}</span></div>
            <div class="menu">
              <a href="account.html" class="item"><i class="fas fa-user-cog"></i> My Account</a>
              <a href="wishlist.html" class="item"><i class="far fa-heart"></i> My Wishlist</a>
              <a href="account.html" class="item" data-tab="orders"><i class="fas fa-box"></i> My Orders</a>
              <a href="account.html" class="item" data-tab="wallet"><i class="fas fa-wallet"></i> My Wallet</a>
              <button class="item logout" type="button"><i class="fas fa-sign-out-alt"></i> Logout</button>
            </div>`;
          container.appendChild(dropdown);

          // Hover to open/close
          container.addEventListener('mouseenter', ()=> container.classList.add('profile-open'));
          container.addEventListener('mouseleave', ()=> container.classList.remove('profile-open'));

          // Optional: handle tab intent via localStorage
          dropdown.querySelectorAll('a[data-tab]')?.forEach(a => {
            a.addEventListener('click', ()=>{
              try { localStorage.setItem('zylo_account_tab', a.getAttribute('data-tab') || ''); } catch {}
            });
          });

          // Logout handler with confirmation modal
          dropdown.querySelector('.logout')?.addEventListener('click', (e)=>{
            e.preventDefault();
            try { ZYLO.showLogoutModal(); } catch {
              // Fallback to native confirm if modal fails
              if (confirm('Are you sure you want to log out?')) {
                try { localStorage.removeItem('zylo_user'); } catch {}
                window.location.href = 'login.html';
              }
            }
          });
        }
      }
    } catch {}
  }
})();

// Public wrappers and extra helpers (non-destructive)
(function(){
  const ZYLO = (window.ZYLO = window.ZYLO || {});

  // Session helper
  if (typeof ZYLO.isLoggedIn !== 'function') {
    ZYLO.isLoggedIn = function(){
      try { return !!JSON.parse(localStorage.getItem('zylo_user') || 'null'); } catch { return false; }
    };
  }

  // Alias for currency formatting
  if (typeof window.formatPrice !== 'function') {
    window.formatPrice = function(amount){ return ZYLO.formatINR(amount); };
  }

  // Generic JSON storage helpers
  if (typeof ZYLO.loadJSON !== 'function') {
    ZYLO.loadJSON = function(key, fallback){
      try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
    };
  }
  if (typeof ZYLO.saveJSON !== 'function') {
    ZYLO.saveJSON = function(key, value){
      try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
    };
  }

  // Wishlist convenience APIs
  if (typeof ZYLO.addToWishlist !== 'function') {
    ZYLO.addToWishlist = function(productId){
      const list = ZYLO.getWishlist() || [];
      if (!list.includes(productId)){
        list.push(productId);
        ZYLO.setWishlist(list);
        ZYLO.toast('Saved to wishlist');
        // Update wishlist icon state
        ZYLO.updateWishlistIcons?.();
      } else {
        // Remove from wishlist if already in it
        const newList = list.filter(id => id !== productId);
        ZYLO.setWishlist(newList);
        ZYLO.toast('Removed from wishlist');
        ZYLO.updateWishlistIcons?.();
      }
      ZYLO.updateWishlistBadge?.();
    };
  }
  if (typeof ZYLO.removeFromWishlist !== 'function') {
    ZYLO.removeFromWishlist = function(productId){
      const list = (ZYLO.getWishlist() || []).filter(id => id !== productId);
      ZYLO.setWishlist(list);
      ZYLO.toast('Removed from wishlist');
      ZYLO.updateWishlistBadge?.();
    };
  }
  if (typeof ZYLO.updateWishlistBadge !== 'function') {
    ZYLO.updateWishlistBadge = function(){
      const el = document.querySelector('#wishlist-count');
      if (el){
        const count = (ZYLO.getWishlist() || []).length;
        el.textContent = `${count} ${count === 1 ? 'item' : 'items'}`;
      }
    };
  }
  if (typeof ZYLO.updateWishlistIcons !== 'function') {
    ZYLO.updateWishlistIcons = function(){
      const wishlist = ZYLO.getWishlist() || [];
      document.querySelectorAll('.wishlist-icon').forEach(icon => {
        const productId = icon.getAttribute('onclick')?.match(/addToWishlist\('([^']+)'\)/)?.[1];
        if (productId) {
          if (wishlist.includes(productId)) {
            icon.classList.add('active');
            const heartIcon = icon.querySelector('i');
            if (heartIcon) {
              heartIcon.classList.remove('far');
              heartIcon.classList.add('fas');
            }
          } else {
            icon.classList.remove('active');
            const heartIcon = icon.querySelector('i');
            if (heartIcon) {
              heartIcon.classList.remove('fas');
              heartIcon.classList.add('far');
            }
          }
        }
      });
    };
  }

  // Optional re-init entry point used by other pages/tests
  if (typeof window.initCommonUI !== 'function') {
    window.initCommonUI = function(){
      try {
        ZYLO.updateCartBadge();
        ZYLO.updateWishlistBadge?.();
        ZYLO.updateWishlistIcons?.();
        // Refresh profile dropdown name
        const u = (function(){ try { return (JSON.parse(localStorage.getItem('zylo_user')||'null')||{}); } catch { return {}; } })();
        const displayName = u.firstName || 'User';
        if (displayName){
          document.querySelectorAll('.profile-dropdown .profile-name').forEach(el => el.textContent = displayName);
        }
      } catch {}
    };
  }

  // Listen for profile updates from account page
  window.addEventListener('zylo:user-updated', (e)=>{
    const d = e?.detail || {};
    const displayName = d.firstName || 'User';
    if (displayName){
      document.querySelectorAll('.profile-dropdown .profile-name').forEach(el => el.textContent = displayName);
    }
  });
})();

