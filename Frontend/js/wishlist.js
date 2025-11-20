
// Wishlist management
class WishlistManager {
  constructor() {
    // Use the centralized ZYLO wishlist manager if available
    if (window.wishlistManager) {
      console.warn('Detected global wishlistManager. Deferring to centralized manager.');
      return;
    }

    this.wishlist = this.loadWishlist();
    this.isLoggedIn = API ? API.isAuthenticated() : false;
    this.init();
    this.syncWithBackend();
  }

  loadWishlist() {
    try {
      return JSON.parse(localStorage.getItem('zylo_wishlist')) || [];
    } catch {
      return [];
    }
  }

  saveWishlist() {
    localStorage.setItem('zylo_wishlist', JSON.stringify(this.wishlist));
  }

  // Sync wishlist with backend if user is logged in
  async syncWithBackend() {
    if (!API || !API.isAuthenticated()) return;
    
    try {
      // Get server wishlist
      const response = await API.endpoints.wishlist.get();
      if (response.success && response.items) {
        // Use server wishlist as authoritative
        this.wishlist = response.items;
        this.saveWishlist();
        this.render();
      }
    } catch (error) {
      console.warn('Wishlist sync failed:', error);
      // Continue with local wishlist
    }
  }

  async addToWishlist(productId) {
    if (!this.wishlist.includes(productId)) {
      this.wishlist.push(productId);
      this.saveWishlist();
      this.render();
      
      // Sync with backend if logged in
      if (API && API.isAuthenticated()) {
        try {
          await API.endpoints.wishlist.add(productId);
        } catch (error) {
          console.warn('Failed to sync wishlist addition with backend:', error);
        }
      }
      
      this.showNotification(`Added to wishlist`);
    }
  }

  async removeFromWishlist(productId) {
    this.wishlist = this.wishlist.filter(id => id !== productId);
    this.saveWishlist();
    this.render();
    
    // Sync with backend if logged in
    if (API && API.isAuthenticated()) {
      try {
        await API.endpoints.wishlist.remove(productId);
      } catch (error) {
        console.warn('Failed to sync wishlist removal with backend:', error);
      }
    }
    
    this.showNotification(`Removed from wishlist`);
  }

  clearWishlist() {
    if (this.wishlist.length === 0) return;
    // Clear immediately without confirmation as requested
    this.wishlist = [];
    this.saveWishlist();
    this.render();
    this.showNotification('Wishlist cleared');
  }

  async getWishlistProducts() {
    // Wait for products to be loaded if they aren't already
    if (!window.PRODUCTS_LOADED && typeof window.ensureProductsLoaded === 'function') {
      await window.ensureProductsLoaded();
    }
    
    return this.wishlist.map(id => (window.PRODUCTS || []).find(p => p.id === id)).filter(Boolean);
  }

  render() {
    const count = this.wishlist.length;
    const countElement = document.getElementById('wishlist-count');
    const emptyState = document.getElementById('empty-wishlist');
    const itemsContainer = document.getElementById('wishlist-items');
    const clearButton = document.getElementById('clear-wishlist');

    // Update count
    if (countElement) {
      countElement.textContent = `${count} ${count === 1 ? 'item' : 'items'}`;
    }

    // Show/hide clear button
    if (clearButton) {
      clearButton.style.display = count > 0 ? 'flex' : 'none';
    }

    if (count === 0) {
      emptyState.style.display = 'block';
      itemsContainer.style.display = 'none';
    } else {
      emptyState.style.display = 'none';
      itemsContainer.style.display = 'block';
      this.renderItems();
    }
  }

  async renderItems() {
    const container = document.getElementById('wishlist-items');
    if (!container) return;

    try {
      // Ensure products are loaded
      if (!window.PRODUCTS_LOADED && typeof window.ensureProductsLoaded === 'function') {
        await window.ensureProductsLoaded();
      }

      const products = await this.getWishlistProducts();
      if (!Array.isArray(products)) {
        throw new Error('Wishlist products not loaded');
      }

      if (products.length === 0) {
        // Show empty-state if nothing to render
        const emptyState = document.getElementById('empty-wishlist');
        if (emptyState) emptyState.style.display = 'block';
        container.innerHTML = '';
        return;
      }

      container.innerHTML = products.map(product => `
      <div class="wishlist-item" data-id="${product.id}">
        <div class="item-image">
          <a href="singlepro.html?id=${product.id}">
            <img src="${product.image}" alt="${product.name} by ${product.brand}" onerror="this.src='../img/products/default.jpg'">
          </a>
        </div>
        <div class="item-details">
          <div class="item-info">
            <div class="item-content">
              <span class="brand">${product.brand}</span>
              <h3 class="product-name">${product.name}</h3>
              <div class="price">Rs. ${product.price.toLocaleString('en-IN')}</div>
            </div>
            <div class="item-actions">
              <button class="btn-add-cart" onclick="addToCartFromWishlist('${product.id}')" title="Add to Cart">
                <i class="fas fa-shopping-cart"></i> Add to Cart
              </button>
              <button class="btn-remove" onclick="wishlistManager.removeFromWishlist('${product.id}')" title="Remove from wishlist">
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `).join('');
  }


  showNotification(message) {
  // Check if notification already exists
  let notification = document.querySelector('.notification');

  if (!notification) {
    notification = document.createElement('div');
    notification.className = 'notification';
    document.body.appendChild(notification);
  }

  // Set message
  notification.textContent = message;

  // Show animation
  notification.classList.add('show');

  // Hide after 3 seconds
  clearTimeout(this.notificationTimeout);
  this.notificationTimeout = setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}


  init() {
    this.render();
    
    // Attach event listeners
    const clearButton = document.getElementById('clear-wishlist');
    if (clearButton) {
      clearButton.addEventListener('click', () => this.clearWishlist());
    }
  }
}

// Global functions
async function addToCartFromWishlist(productId) {
  // Wait for products to be loaded if they aren't already
  if (!window.PRODUCTS_LOADED && typeof window.ensureProductsLoaded === 'function') {
    await window.ensureProductsLoaded();
  }
  
  const product = (window.PRODUCTS || []).find(p => p.id === productId);
  if (product) {
    // Add to cart using shared helper
    if (window.ZYLO?.addToCart) {
      const size = (product.sizes || [])[0] || 'M';
      window.ZYLO.addToCart(product.id, size, 1);
    } else {
      alert(`${product.name} added to cart!`);
    }
  }
}

// Initialize: if centralized wishlistManager exists, use it; otherwise fallback to this page's manager
let wishlistManager = window.wishlistManager || null;

(function(){
  // Gate wishlist page behind login as before
  let isLogged = false;
  try { isLogged = !!JSON.parse(localStorage.getItem('zylo_user') || 'null'); } catch { isLogged = false; }
  if (!isLogged) {
    try { localStorage.setItem('zylo_return_to', 'wishlist.html'); } catch {}
    window.location.href = 'login.html';
    return;
  }

  if (!wishlistManager) {
    wishlistManager = new WishlistManager();
  } else {
    // Ensure page renders using centralized manager
    wishlistManager.render?.();
  }
})();

// Public API wrappers
window.initWishlistPage = function(){ wishlistManager?.render(); };
window.loadWishlistAndRender = function(){ wishlistManager?.render(); };
window.onRemove = function(productId){ wishlistManager?.removeFromWishlist(productId); };
window.clearWishlist = function(){ wishlistManager?.clearWishlist(); };
window.moveToCart = function(productId){
  const p = (window.PRODUCTS || []).find(x => x.id === productId);
  if (!p){ alert('Product not found'); return; }
  const size = (p.sizes || [])[0] || 'M';
  if (window.ZYLO?.addToCart) {
    window.ZYLO.addToCart(productId, size, 1);
  } else {
    alert(`${p.name} added to cart!`);
  }
};
window.bindWishlistEvents = function(){ /* events bound in class init */ };

