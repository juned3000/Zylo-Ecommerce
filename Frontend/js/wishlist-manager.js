// Integrated Wishlist Manager for Zylo Ecommerce
// Handles both localStorage (for guests) and database (for logged-in users)
(function() {
  const ZYLO = (window.ZYLO = window.ZYLO || {});

  // Wishlist Manager Class
  class WishlistManager {
    constructor() {
      this.isInitialized = false;
    }

    // Check if user is logged in
    isLoggedIn() {
      try {
        return !!JSON.parse(localStorage.getItem('zylo_user') || 'null');
      } catch {
        return false;
      }
    }

    // Get wishlist from localStorage
    getLocalWishlist() {
      try {
        return JSON.parse(localStorage.getItem('zylo_wishlist') || '[]');
      } catch {
        return [];
      }
    }

    // Save wishlist to localStorage
    setLocalWishlist(wishlist) {
      try {
        localStorage.setItem('zylo_wishlist', JSON.stringify(wishlist));
      } catch (e) {
        console.error('Failed to save wishlist to localStorage:', e);
      }
    }

    // Add to wishlist (works for both guests and logged-in users)
    async addToWishlist(productId) {
      console.log('💖 WishlistManager.addToWishlist called:', { productId });

      if (this.isLoggedIn()) {
        try {
          // For logged-in users: call backend API
          console.log('🔐 User is logged in, calling backend API...');
          
          // First check if already in wishlist
          const currentWishlist = await this.getWishlist();
          if (currentWishlist.includes(productId)) {
            // Remove from wishlist if already in it
            return this.removeFromWishlist(productId);
          }
          
          const response = await API.endpoints.users.addToWishlist(productId);
          
          if (response.success) {
            console.log('✅ Added to wishlist via API:', response.wishlist);
            ZYLO.toast('Added to wishlist');
            this.updateWishlistBadge();
            this.updateWishlistIcons();
            return response.wishlist;
          } else {
            throw new Error(response.message || 'Failed to add to wishlist');
          }
        } catch (error) {
          console.error('❌ API call failed, falling back to localStorage:', error);
          // Fallback to localStorage if API fails
          return this.addToLocalWishlist(productId);
        }
      } else {
        // For guest users: use localStorage
        console.log('👤 Guest user, using localStorage...');
        return this.addToLocalWishlist(productId);
      }
    }

    // Add to localStorage wishlist
    addToLocalWishlist(productId) {
      let wishlist = this.getLocalWishlist();
      
      if (wishlist.includes(productId)) {
        // Remove if already in wishlist
        wishlist = wishlist.filter(id => id !== productId);
        this.setLocalWishlist(wishlist);
        console.log('✅ Removed from localStorage wishlist:', wishlist);
        ZYLO.toast('Removed from wishlist');
      } else {
        // Add if not in wishlist
        wishlist.push(productId);
        this.setLocalWishlist(wishlist);
        console.log('✅ Added to localStorage wishlist:', wishlist);
        ZYLO.toast('Added to wishlist');
      }
      
      this.updateWishlistBadge();
      this.updateWishlistIcons();
      return wishlist;
    }

    // Get wishlist items (from API if logged in, localStorage if guest)
    async getWishlist() {
      if (this.isLoggedIn()) {
        try {
          const response = await API.endpoints.users.getWishlist();
          return response.success ? response.wishlist : [];
        } catch (error) {
          console.error('Failed to get wishlist from API:', error);
          return this.getLocalWishlist();
        }
      } else {
        return this.getLocalWishlist();
      }
    }

    // Remove from wishlist
    async removeFromWishlist(productId) {
      console.log('💔 WishlistManager.removeFromWishlist called:', { productId });

      if (this.isLoggedIn()) {
        try {
          const response = await API.endpoints.users.removeFromWishlist(productId);
          if (response.success) {
            console.log('✅ Removed from wishlist via API:', response.wishlist);
            ZYLO.toast('Removed from wishlist');
            this.updateWishlistBadge();
            this.updateWishlistIcons();
            return response.wishlist;
          }
        } catch (error) {
          console.error('Failed to remove from wishlist via API:', error);
        }
      }
      
      // Fallback to localStorage
      let wishlist = this.getLocalWishlist();
      wishlist = wishlist.filter(id => id !== productId);
      this.setLocalWishlist(wishlist);
      console.log('✅ Removed from localStorage wishlist:', wishlist);
      ZYLO.toast('Removed from wishlist');
      this.updateWishlistBadge();
      this.updateWishlistIcons();
      return wishlist;
    }

    // Sync localStorage wishlist with server wishlist (when user logs in)
    async syncWishlistAfterLogin() {
      if (!this.isLoggedIn()) return;

      const localWishlist = this.getLocalWishlist();
      if (localWishlist.length === 0) return;

      try {
        console.log('🔄 Syncing local wishlist with server:', localWishlist);
        
        // Get current server wishlist
        const serverWishlist = await this.getWishlist();
        
        // Add each local item to server wishlist
        for (const productId of localWishlist) {
          if (!serverWishlist.includes(productId)) {
            try {
              await API.endpoints.users.addToWishlist(productId);
              console.log(`✅ Synced ${productId} to server wishlist`);
            } catch (error) {
              console.error(`❌ Failed to sync ${productId}:`, error);
            }
          }
        }
        
        // Clear localStorage wishlist after successful sync
        localStorage.removeItem('zylo_wishlist');
        this.updateWishlistBadge();
        this.updateWishlistIcons();
        console.log('✅ Wishlist synced successfully');
      } catch (error) {
        console.error('❌ Wishlist sync failed:', error);
      }
    }

    // Check if product is in wishlist
    async isInWishlist(productId) {
      const wishlist = await this.getWishlist();
      return wishlist.includes(productId);
    }

    // Update wishlist badge in UI
    async updateWishlistBadge() {
      try {
        const wishlist = await this.getWishlist();
        const count = wishlist.length;
        
        // Update text badge
        const textEl = document.querySelector('#wishlist-count');
        if (textEl) {
          textEl.textContent = `${count} ${count === 1 ? 'item' : 'items'}`;
        }
        
        // Remove wishlist badge from navbar (as requested by user)
        const wishlistLink = document.querySelector('#navbar a[title="Wishlist"]');
        if (wishlistLink) {
          const existingBadge = wishlistLink.querySelector('.wishlist-badge');
          if (existingBadge) {
            existingBadge.remove();
          }
        }
      } catch (error) {
        console.error('Failed to update wishlist badge:', error);
      }
    }

    // Update wishlist heart icons on product cards
    async updateWishlistIcons() {
      try {
        const wishlist = await this.getWishlist();
        
        // Update all wishlist icons on the page
        document.querySelectorAll('.wishlist-icon').forEach(icon => {
          // Extract product ID from onclick attribute or data attribute
          let productId = null;
          
          // Try onclick attribute first
          const onclickAttr = icon.getAttribute('onclick');
          if (onclickAttr) {
            const match = onclickAttr.match(/addToWishlist\(['"]([^'"]+)['"]\)/);
            if (match) productId = match[1];
          }
          
          // Try data-product-id attribute
          if (!productId) {
            productId = icon.getAttribute('data-product-id');
          }
          
          if (productId) {
            const heartIcon = icon.querySelector('i');
            if (wishlist.includes(productId)) {
              // Product is in wishlist - show filled heart
              icon.classList.add('active');
              if (heartIcon) {
                heartIcon.classList.remove('far');
                heartIcon.classList.add('fas');
              }
            } else {
              // Product not in wishlist - show empty heart
              icon.classList.remove('active');
              if (heartIcon) {
                heartIcon.classList.remove('fas');
                heartIcon.classList.add('far');
              }
            }
          }
        });
      } catch (error) {
        console.error('Failed to update wishlist icons:', error);
      }
    }

    // Render wishlist page (for wishlist.html)
    async renderWishlistPage() {
      try {
        // Wait for products to be loaded if they aren't already
        if (!window.PRODUCTS_LOADED && typeof window.ensureProductsLoaded === 'function') {
          await window.ensureProductsLoaded();
        }

        const wishlist = await this.getWishlist();
        const count = wishlist.length;
        
        // Update elements on the page
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
          if (emptyState) emptyState.style.display = 'block';
          if (itemsContainer) itemsContainer.style.display = 'none';
        } else {
          if (emptyState) emptyState.style.display = 'none';
          if (itemsContainer) itemsContainer.style.display = 'block';
          await this.renderWishlistItems(wishlist);
        }
      } catch (error) {
        console.error('Failed to render wishlist page:', error);
      }
    }

    // Render wishlist items on the page
    async renderWishlistItems(wishlistIds) {
      const container = document.getElementById('wishlist-items');
      if (!container) return;

      try {
        // Get product details for wishlist items
        const products = wishlistIds.map(id => {
          return (window.PRODUCTS || []).find(p => p.id === id);
        }).filter(Boolean); // Remove null/undefined entries

        if (products.length === 0) {
          container.innerHTML = '<div class="no-products">Unable to load wishlist products. Please refresh the page.</div>';
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
                  <div class="price">Rs. ${Number(product.price).toLocaleString('en-IN')}</div>
                </div>
                <div class="item-actions">
                  <button class="btn-add-cart" onclick="ZYLO.addToCartFromWishlist('${product.id}')" title="Add to Cart">
                    <i class="fas fa-shopping-cart"></i> Add to Cart
                  </button>
                  <button class="btn-remove" onclick="ZYLO.removeFromWishlist('${product.id}').then(() => wishlistManager.renderWishlistPage())" title="Remove from wishlist">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        `).join('');
      } catch (error) {
        console.error('Failed to render wishlist items:', error);
        container.innerHTML = '<div class="error">Error loading wishlist items. Please try refreshing the page.</div>';
      }
    }
  }

  // Create global wishlist manager instance
  window.wishlistManager = new WishlistManager();

  // Override ZYLO wishlist methods to use WishlistManager
  ZYLO.addToWishlist = function(productId) {
    return window.wishlistManager.addToWishlist(productId);
  };

  ZYLO.removeFromWishlist = function(productId) {
    return window.wishlistManager.removeFromWishlist(productId);
  };

  ZYLO.getWishlist = function() {
    return window.wishlistManager.getWishlist();
  };

  ZYLO.updateWishlistBadge = function() {
    return window.wishlistManager.updateWishlistBadge();
  };

  ZYLO.updateWishlistIcons = function() {
    return window.wishlistManager.updateWishlistIcons();
  };

  ZYLO.isInWishlist = function(productId) {
    return window.wishlistManager.isInWishlist(productId);
  };

  // Helper for adding to cart from wishlist
  ZYLO.addToCartFromWishlist = async function(productId) {
    // Wait for products to be loaded if they aren't already
    if (!window.PRODUCTS_LOADED && typeof window.ensureProductsLoaded === 'function') {
      await window.ensureProductsLoaded();
    }
    
    const product = (window.PRODUCTS || []).find(p => p.id === productId);
    if (product) {
      // Add to cart using shared helper
      if (ZYLO.addToCart) {
        const size = (product.sizes || [])[0] || 'M';
        ZYLO.addToCart(product.id, size, 1);
      } else {
        ZYLO.toast(`${product.name} added to cart!`);
      }
    }
  };

  // Clear wishlist helper
  ZYLO.clearWishlist = async function() {
    if (window.wishlistManager.isLoggedIn()) {
      try {
        // Clear on backend for logged-in users
        const wishlist = await window.wishlistManager.getWishlist();
        for (const productId of wishlist) {
          await API.endpoints.users.removeFromWishlist(productId);
        }
      } catch (error) {
        console.error('Failed to clear wishlist on backend:', error);
      }
    }
    
    // Clear local storage
    window.wishlistManager.setLocalWishlist([]);
    window.wishlistManager.updateWishlistBadge();
    window.wishlistManager.updateWishlistIcons();
    
    // Re-render wishlist page if on it
    if (window.location.pathname.includes('wishlist.html')) {
      window.wishlistManager.renderWishlistPage();
    }
    
    ZYLO.toast('Wishlist cleared');
  };

  // Initialize wishlist manager when DOM loads
  document.addEventListener('DOMContentLoaded', () => {
    window.wishlistManager.updateWishlistBadge();
    window.wishlistManager.updateWishlistIcons();
    
    // If on wishlist page, render it
    if (window.location.pathname.includes('wishlist.html')) {
      window.wishlistManager.renderWishlistPage();
      
      // Add clear button event listener
      const clearButton = document.getElementById('clear-wishlist');
      if (clearButton) {
        clearButton.addEventListener('click', () => {
          ZYLO.clearWishlist();
        });
      }
    }
  });
  
  // Also render when products are loaded
  window.addEventListener('productsLoaded', () => {
    if (window.location.pathname.includes('wishlist.html')) {
      window.wishlistManager.renderWishlistPage();
    }
  });

  console.log('💖 Wishlist Manager loaded successfully');
})();
