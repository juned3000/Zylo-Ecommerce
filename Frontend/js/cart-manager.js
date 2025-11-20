// Integrated Cart Manager for Zylo Ecommerce
// Handles both localStorage (for guests) and database (for logged-in users)
(function() {
  const ZYLO = (window.ZYLO = window.ZYLO || {});

  // Cart Manager Class
  class CartManager {
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

    // Get cart from localStorage
    getLocalCart() {
      try {
        return JSON.parse(localStorage.getItem('zylo_cart') || '[]');
      } catch {
        return [];
      }
    }

    // Save cart to localStorage
    setLocalCart(cart) {
      try {
        localStorage.setItem('zylo_cart', JSON.stringify(cart));
      } catch (e) {
        console.error('Failed to save cart to localStorage:', e);
      }
    }

    // Add to cart (works for both guests and logged-in users)
    async addToCart(productId, size = 'M', quantity = 1) {
      console.log('🛒 CartManager.addToCart called:', { productId, size, quantity });
      
      const qty = Math.max(1, Number(quantity || 1));

      if (this.isLoggedIn()) {
        try {
          // For logged-in users: call backend API
          console.log('🔐 User is logged in, calling backend API...');
          const response = await API.endpoints.cart.add(productId, size, qty);
          
          if (response.success) {
            console.log('✅ Added to cart via API:', response.items);
            ZYLO.toast('Added to cart');
            this.updateCartBadge();
            return response.items;
          } else {
            throw new Error(response.message || 'Failed to add to cart');
          }
        } catch (error) {
          console.error('❌ API call failed, falling back to localStorage:', error);
          // Fallback to localStorage if API fails
          return this.addToLocalCart(productId, size, qty);
        }
      } else {
        // For guest users: use localStorage
        console.log('👤 Guest user, using localStorage...');
        return this.addToLocalCart(productId, size, qty);
      }
    }

    // Add to localStorage cart
    addToLocalCart(productId, size = 'M', quantity = 1) {
      const qty = Math.max(1, Number(quantity || 1));
      let cart = this.getLocalCart();
      
      const existingIndex = cart.findIndex(item => 
        item.productId === productId && item.size === size
      );
      
      if (existingIndex >= 0) {
        cart[existingIndex].quantity += qty;
      } else {
        cart.push({ productId, size, quantity: qty });
      }
      
      this.setLocalCart(cart);
      console.log('✅ Added to localStorage cart:', cart);
      ZYLO.toast('Added to cart');
      this.updateCartBadge();
      return cart;
    }

    // Get cart items (from API if logged in, localStorage if guest)
    async getCart() {
      if (this.isLoggedIn()) {
        try {
          const response = await API.endpoints.cart.get();
          return response.success ? response.items : [];
        } catch (error) {
          console.error('Failed to get cart from API:', error);
          return this.getLocalCart();
        }
      } else {
        return this.getLocalCart();
      }
    }

    // Update cart item quantity
    async updateCartItem(productId, size, quantity) {
      if (this.isLoggedIn()) {
        try {
          const response = await API.endpoints.cart.update(productId, size, quantity);
          if (response.success) {
            this.updateCartBadge();
            return response.items;
          }
        } catch (error) {
          console.error('Failed to update cart via API:', error);
        }
      }
      
      // Fallback to localStorage
      let cart = this.getLocalCart();
      const index = cart.findIndex(item => 
        item.productId === productId && item.size === size
      );
      
      if (index >= 0) {
        if (quantity <= 0) {
          cart.splice(index, 1);
        } else {
          cart[index].quantity = quantity;
        }
        this.setLocalCart(cart);
        this.updateCartBadge();
      }
      
      return cart;
    }

    // Remove item from cart
    async removeFromCart(productId, size) {
      if (this.isLoggedIn()) {
        try {
          const response = await API.endpoints.cart.remove(productId, size);
          if (response.success) {
            this.updateCartBadge();
            return response.items;
          }
        } catch (error) {
          console.error('Failed to remove from cart via API:', error);
        }
      }
      
      // Fallback to localStorage
      let cart = this.getLocalCart();
      cart = cart.filter(item => 
        !(item.productId === productId && item.size === size)
      );
      this.setLocalCart(cart);
      this.updateCartBadge();
      return cart;
    }

    // Sync localStorage cart with server cart (when user logs in)
    async syncCartAfterLogin() {
      if (!this.isLoggedIn()) return;

      const localCart = this.getLocalCart();
      if (localCart.length === 0) return;

      try {
        console.log('🔄 Syncing local cart with server:', localCart);
        const response = await API.endpoints.cart.sync(localCart);
        
        if (response.success) {
          console.log('✅ Cart synced successfully');
          // Clear localStorage cart after successful sync
          localStorage.removeItem('zylo_cart');
          this.updateCartBadge();
          return response.items;
        }
      } catch (error) {
        console.error('❌ Cart sync failed:', error);
      }
    }

    // Get cart count
    async getCartCount() {
      const items = await this.getCart();
      return items.reduce((total, item) => total + (item.quantity || 0), 0);
    }

    // Update cart badge in UI
    async updateCartBadge() {
      try {
        const count = await this.getCartCount();
        
        // Update text badge
        const textEl = document.querySelector('#cart-count');
        if (textEl) {
          textEl.textContent = `${count} ${count === 1 ? 'item' : 'items'}`;
        }
        
        // Update navbar badge
        const cartLink = document.querySelector('#navbar a[title="Cart"]');
        if (cartLink) {
          let badge = cartLink.querySelector('.cart-badge');
          if (!badge) {
            badge = document.createElement('span');
            badge.className = 'cart-badge';
            cartLink.appendChild(badge);
          }
          
          if (count > 0) {
            badge.textContent = String(Math.min(count, 99));
            badge.classList.add('show');
          } else {
            badge.textContent = '';
            badge.classList.remove('show');
          }
        }
      } catch (error) {
        console.error('Failed to update cart badge:', error);
      }
    }
  }

  // Create global cart manager instance
  window.cartManager = new CartManager();

  // Override ZYLO cart methods to use CartManager
  ZYLO.addToCart = function(productId, size, quantity) {
    return window.cartManager.addToCart(productId, size, quantity);
  };

  ZYLO.getCart = function() {
    return window.cartManager.getCart();
  };

  ZYLO.getCartCount = function() {
    return window.cartManager.getCartCount();
  };

  ZYLO.updateCartBadge = function() {
    return window.cartManager.updateCartBadge();
  };

  // Initialize cart manager when DOM loads
  document.addEventListener('DOMContentLoaded', () => {
    window.cartManager.updateCartBadge();
  });

  console.log('🛒 Cart Manager loaded successfully');
})();
