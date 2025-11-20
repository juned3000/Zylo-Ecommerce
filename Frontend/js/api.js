// API Configuration and Utilities for Zylo Ecommerce
(function() {
  // API Configuration
  const API_CONFIG = {
    BASE_URL: 'http://localhost:5000/api',
    TIMEOUT: 10000, // 10 seconds
  };

  // Global API utility
  window.API = {
    config: API_CONFIG,

    // Get stored JWT token
    getToken() {
      try {
        const userData = JSON.parse(localStorage.getItem('zylo_user') || '{}');
        return userData.token || null;
      } catch {
        return null;
      }
    },

    // Store JWT token with user data
    setToken(token, user) {
      try {
        const userData = { ...user, token, loggedInAt: new Date().toISOString() };
        localStorage.setItem('zylo_user', JSON.stringify(userData));
        return true;
      } catch {
        return false;
      }
    },

    // Remove token and user data
    clearToken() {
      try {
        localStorage.removeItem('zylo_user');
        return true;
      } catch {
        return false;
      }
    },

    // Check if user is logged in
    isAuthenticated() {
      return !!this.getToken();
    },

    // Get stored user data
    getUser() {
      try {
        const userData = JSON.parse(localStorage.getItem('zylo_user') || '{}');
        return userData.token ? userData : null;
      } catch {
        return null;
      }
    },

    // Make authenticated API request
    async request(endpoint, options = {}) {
      const url = `${API_CONFIG.BASE_URL}${endpoint}`;
      const token = this.getToken();

      const defaultOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        timeout: API_CONFIG.TIMEOUT,
      };

      const requestOptions = {
        ...defaultOptions,
        ...options,
        headers: {
          ...defaultOptions.headers,
          ...options.headers,
        },
      };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), requestOptions.timeout);

      const response = await fetch(url, {
        ...requestOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle 401 - token expired or invalid
      if (response.status === 401) {
        this.clearToken();
        // Redirect to login if on a protected page
        if (window.location.pathname.includes('account.html') || 
            window.location.pathname.includes('checkout.html')) {
          localStorage.setItem('zylo_return_to', window.location.pathname);
          window.location.href = 'login.html';
          return;
        }
      }

      // Handle 429 - rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || response.headers.get('RateLimit-Reset') || '60';
        console.warn(`⚠️ Rate limited. Retry after ${retryAfter} seconds`);
        throw new Error(`Too many requests. Please wait ${retryAfter} seconds before trying again.`);
      }

      const data = await response.json();

      if (!response.ok) {
        // Provide more specific error messages
        const errorMessage = data.message || data.error || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      return data;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your connection');
      }
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Connection failed - please check if the server is running');
      }
      throw error;
    }
    },

    // Convenience methods for different HTTP methods
    async get(endpoint, options = {}) {
      return this.request(endpoint, { ...options, method: 'GET' });
    },

    async post(endpoint, data = null, options = {}) {
      return this.request(endpoint, {
        ...options,
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined,
      });
    },

    async put(endpoint, data = null, options = {}) {
      return this.request(endpoint, {
        ...options,
        method: 'PUT',
        body: data ? JSON.stringify(data) : undefined,
      });
    },

    async delete(endpoint, options = {}) {
      return this.request(endpoint, { ...options, method: 'DELETE' });
    },
  };

  // API endpoint helpers
  window.API.endpoints = {
    // Authentication
    auth: {
      requestOTP: (email) => API.post('/auth/request-otp', { email }),
      verifyOTP: (email, code, name) => API.post('/auth/verify-otp', { email, code, name }),
    },

    // Products
    products: {
      getAll: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return API.get(`/products${query ? '?' + query : ''}`);
      },
      getById: (id) => API.get(`/products/${id}`),
      create: (productData) => API.post('/products', productData),
      update: (id, productData) => API.put(`/products/${id}`, productData),
      delete: (id) => API.delete(`/products/${id}`),
      getCategories: () => API.get('/products/categories/list'),
      seed: () => API.post('/products/seed'),
    },

    // Users
    users: {
      getProfile: () => API.get('/users/me'),
      updateProfile: (userData) => API.put('/users/me', userData),
      getAddresses: () => API.get('/users/me/addresses'),
      addAddress: (addressData) => API.post('/users/me/addresses', addressData),
      updateAddress: (index, addressData) => API.put(`/users/me/addresses/${index}`, addressData),
      deleteAddress: (index) => API.delete(`/users/me/addresses/${index}`),
      getWishlist: () => API.get('/users/me/wishlist'),
      addToWishlist: (productId) => API.post('/users/me/wishlist', { productId }),
      removeFromWishlist: (productId) => API.delete(`/users/me/wishlist/${productId}`),
    },

    // Addresses (separate endpoint)
    addresses: {
      getAll: () => API.get('/addresses'),
      get: (id) => API.get(`/addresses/${id}`),
      create: (addressData) => API.post('/addresses', addressData),
      update: (id, addressData) => API.put(`/addresses/${id}`, addressData),
      delete: (id) => API.delete(`/addresses/${id}`),
      setDefault: (id) => API.post(`/addresses/${id}/default`),
    },
    // Cart,
    cart: {
      get: () => API.get('/cart'),
      add: (productId, size = 'M', quantity = 1) => API.post('/cart', { productId, size, quantity }),
      update: (productId, size, quantity) => API.put('/cart', { productId, size, quantity }),
      remove: (productId, size) => API.request('/cart', {
        method: 'DELETE',
        body: JSON.stringify({ productId, size })
      }),
      clear: () => API.delete('/cart/all'),
      sync: (items) => API.post('/cart/sync', { items }),
      // Coupon operations
      applyCoupon: (couponCode) => API.post('/cart/coupon/apply', { couponCode }),
      removeCoupon: () => API.delete('/cart/coupon'),
      validateCoupon: (couponCode) => API.post('/cart/coupon/validate', { couponCode }),
    },

    // Coupons (public)
    coupons: {
      getAvailable: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return API.get(`/coupons/available${query ? '?' + query : ''}`);
      },
      validatePublic: (code, orderValue) => API.get(`/coupons/validate/${encodeURIComponent(code)}?orderValue=${encodeURIComponent(orderValue||0)}`)
    },

    // Orders
    orders: {
      create: (orderData) => API.post('/orders', orderData),
      pay: (orderId) => API.post(`/orders/${orderId}/pay`),
      getMy: () => API.get('/orders/me'),
      getById: (orderId) => API.get(`/orders/${orderId}`),
    },

    // Wishlist
    wishlist: {
      get: () => API.get('/wishlist'),
      add: (productId) => API.post('/wishlist', { productId }),
      remove: (productId) => API.delete(`/wishlist/${productId}`),
    },

    // Wallet
    wallet: {
      get: () => API.get('/wallet'),
      getTransactions: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return API.get(`/wallet/transactions${query ? '?' + query : ''}`);
      },
      addMoney: (amount, paymentMethod, description) => 
        API.post('/wallet/add-money', { amount, paymentMethod, description }),
      spend: (amount, orderId, description) => 
        API.post('/wallet/spend', { amount, orderId, description }),
      addCashback: (amount, orderId, description) => 
        API.post('/wallet/add-cashback', { amount, orderId, description }),
      getStatement: (fromDate, toDate, format = 'json') => {
        const params = { fromDate, toDate, format };
        const query = new URLSearchParams(params).toString();
        return API.get(`/wallet/statement${query ? '?' + query : ''}`);
      },
      getRewards: () => API.get('/wallet/rewards'),
    },

    // Payment Methods
    payments: {
      get: (type = null) => {
        const query = type ? new URLSearchParams({ type }).toString() : '';
        return API.get(`/payments${query ? '?' + query : ''}`);
      },
      addCard: (cardData) => API.post('/payments/card', cardData),
      addUPI: (upiData) => API.post('/payments/upi', upiData),
      addNetBanking: (netBankingData) => API.post('/payments/netbanking', netBankingData),
      verifyUPI: (id) => API.post(`/payments/${id}/verify-upi`),
      update: (id, data) => API.put(`/payments/${id}`, data),
      delete: (id) => API.delete(`/payments/${id}`),
      getDefault: (type = null) => {
        const query = type ? new URLSearchParams({ type }).toString() : '';
        return API.get(`/payments/default${query ? '?' + query : ''}`);
      },
      markUsed: (id) => API.post(`/payments/${id}/mark-used`),
    },

    // Reviews
    reviews: {
      getByProduct: (productId, params = {}) => {
        const query = new URLSearchParams(params).toString();
        return API.get(`/reviews/product/${productId}${query ? '?' + query : ''}`);
      },
      getMyReviews: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return API.get(`/reviews/my-reviews${query ? '?' + query : ''}`);
      },
      submit: (reviewData) => API.post('/reviews', reviewData),
      update: (reviewId, reviewData) => API.put(`/reviews/${reviewId}`, reviewData),
      delete: (reviewId) => API.delete(`/reviews/${reviewId}`),
      markHelpful: (reviewId) => API.post(`/reviews/${reviewId}/helpful`),
      report: (reviewId, reasons) => API.post(`/reviews/${reviewId}/report`, { reasons }),
      canUserReview: (productId, orderId) => {
        const params = new URLSearchParams({ productId, orderId }).toString();
        return API.get(`/reviews/can-review?${params}`);
      },
    },

    // Admin
    admin: {
      getDashboard: () => API.get('/admin/dashboard'),
      getUsers: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return API.get(`/admin/users${query ? '?' + query : ''}`);
      },
      updateUserAdmin: (userId, isAdmin) => API.put(`/admin/users/${userId}/admin`, { isAdmin }),
      getOrders: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return API.get(`/admin/orders${query ? '?' + query : ''}`);
      },
      updateOrderStatus: (orderId, orderStatus) => API.put(`/admin/orders/${orderId}/status`, { orderStatus }),
      getSalesAnalytics: (period = '30d') => API.get(`/admin/analytics/sales?period=${period}`),
      createAdmin: (email, name) => API.post('/admin/create-admin', { email, name }),
    },
  };

  // Show loading indicator
  window.API.showLoading = function(message = 'Loading...') {
    // Remove existing loading indicator
    const existing = document.getElementById('api-loading');
    if (existing) existing.remove();

    const loading = document.createElement('div');
    loading.id = 'api-loading';
    loading.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 20px 30px;
      border-radius: 8px;
      z-index: 10000;
      font-family: Arial, sans-serif;
      font-size: 16px;
      text-align: center;
    `;
    loading.innerHTML = `
      <div style="margin-bottom: 10px;">
        <div style="border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 20px; height: 20px; animation: spin 1s linear infinite; margin: 0 auto;"></div>
      </div>
      ${message}
      <style>
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      </style>
    `;
    document.body.appendChild(loading);
  };

  // Hide loading indicator
  window.API.hideLoading = function() {
    const loading = document.getElementById('api-loading');
    if (loading) loading.remove();
  };

  // Show API error message
  window.API.showError = function(message, duration = 5000) {
    const error = document.createElement('div');
    error.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #dc3545;
      color: white;
      padding: 15px 20px;
      border-radius: 5px;
      z-index: 10001;
      font-family: Arial, sans-serif;
      font-size: 14px;
      max-width: 300px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    error.textContent = message;
    document.body.appendChild(error);

    setTimeout(() => error.remove(), duration);
  };

  // Show API success message
  window.API.showSuccess = function(message, duration = 3000) {
    const success = document.createElement('div');
    success.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #28a745;
      color: white;
      padding: 15px 20px;
      border-radius: 5px;
      z-index: 10001;
      font-family: Arial, sans-serif;
      font-size: 14px;
      max-width: 300px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    success.textContent = message;
    document.body.appendChild(success);

    setTimeout(() => success.remove(), duration);
  };

  console.log('✅ API utilities loaded successfully');
})();
