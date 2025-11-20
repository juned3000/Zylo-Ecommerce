// Central product catalog for Zylo (loaded from backend API)
// Exposes a global window.PRODUCTS array for all pages to consume.
(function(){
  // Initialize with empty array
  window.PRODUCTS = [];
  window.PRODUCTS_LOADED = false;
  window.PRODUCTS_LOADING = false;

  // Helper function for retry logic with exponential backoff
  async function retryWithBackoff(operation, maxRetries = 3, baseDelay = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        console.warn(`Attempt ${attempt}/${maxRetries} failed:`, error.message);
        
        if (attempt === maxRetries) {
          throw error; // Final attempt failed
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 10000);
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Load products from backend API with retry logic
  async function loadProducts() {
    if (window.PRODUCTS_LOADING || window.PRODUCTS_LOADED) return;
    window.PRODUCTS_LOADING = true;

    try {
      console.log('📡 Starting product load from API...');
      
      const response = await retryWithBackoff(async () => {
        const result = await API.endpoints.products.getAll();
        if (!result) {
          throw new Error('No response from API');
        }
        if (!result.success) {
          throw new Error(result.message || 'API returned unsuccessful response');
        }
        return result;
      }, 3, 2000); // 3 retries with 2s base delay
      
      console.log('📡 Raw API response:', response);
      
      if (response.success && response.items) {
        console.log('📦 Processing', response.items.length, 'products from API');
        
        if (response.items.length > 0) {
          console.log('📦 First raw product:', response.items[0]);
        }
        
        window.PRODUCTS = response.items.map(product => {
          const mappedProduct = {
            id: product.id,
            name: product.name,
            brand: product.brand,
            price: product.price,
            image: product.image,
            sizes: product.sizes || [],
            category: product.category,
            description: product.description,
            stock: product.stock,
            // Include rating data from backend
            averageRating: product.averageRating || 0,
            totalRatings: product.totalRatings || 0,
            ratingDistribution: product.ratingDistribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
          };
          return mappedProduct;
        });
        
        window.PRODUCTS_LOADED = true;
        console.log('🎉 Final PRODUCTS array:', window.PRODUCTS.length, 'products');
        console.log('🎉 Product IDs available:', window.PRODUCTS.map(p => p.id).slice(0, 5), '...');
        
        // Notify pages that products have loaded
        window.dispatchEvent(new CustomEvent('productsLoaded', { 
          detail: { products: window.PRODUCTS, timestamp: Date.now() } 
        }));
        
        console.log('✅ Products loaded successfully:', window.PRODUCTS.length);
      } else {
        throw new Error('Invalid response format or no products in response');
      }
    } catch (error) {
      console.error('❌ Failed to load products from API after all retries:', error);
      
      // Show user-friendly error message
      if (typeof API !== 'undefined' && API.showError) {
        API.showError('Failed to load products. Please refresh the page.');
      }
      
      // Set empty array but don't mark as loaded so it can retry later
      window.PRODUCTS = [];
      window.PRODUCTS_LOADED = false;
      
      // Dispatch error event for pages to handle
      window.dispatchEvent(new CustomEvent('productsLoadError', { 
        detail: { error: error.message, timestamp: Date.now() } 
      }));
    } finally {
      window.PRODUCTS_LOADING = false;
    }
  }

  // Public function to ensure products are loaded
  window.ensureProductsLoaded = loadProducts;

  // Auto-load products when API is available
  if (typeof API !== 'undefined') {
    loadProducts();
  } else {
    // Wait for API to be loaded
    document.addEventListener('DOMContentLoaded', () => {
      if (typeof API !== 'undefined') {
        loadProducts();
      } else {
        console.warn('⚠️ API not available, products will not be loaded');
      }
    });
  }
})();

// Public product helpers (non-destructive)
(function(){
  const G = (window.PRODUCTS_UTIL = window.PRODUCTS_UTIL || {});
  function list(){ return Array.isArray(window.PRODUCTS) ? window.PRODUCTS : []; }

  if (typeof G.getProductById !== 'function') {
    G.getProductById = function(id){ return list().find(p => p.id === id) || null; };
  }

  if (typeof G.filterProducts !== 'function') {
    // opts: { query, category, brands (array), sizes (array), priceRange ('0-999' | '1000-1499' | '1500-2499' | '2500+') }
    G.filterProducts = function(opts){
      const q = opts?.query?.trim().toLowerCase() || '';
      const cat = opts?.category || '';
      const brands = new Set((opts?.brands || []).map(b => String(b).toLowerCase().replace(/[^a-z0-9]/g,'')));
      const sizes = new Set((opts?.sizes || []).map(s => String(s).toUpperCase()));
      const pr = opts?.priceRange || '';
      return list().filter(p => {
        if (q){ const hay = `${p.name} ${p.brand} ${p.category}`.toLowerCase(); if (!hay.includes(q)) return false; }
        if (cat && p.category !== cat) return false;
        if (brands.size){ const key = String(p.brand||'').toLowerCase().replace(/[^a-z0-9]/g,''); if (!brands.has(key)) return false; }
        if (pr){
          const price = p.price;
          if (pr === '0-999' && !(price <= 999)) return false;
          if (pr === '1000-1499' && !(price >= 1000 && price <= 1499)) return false;
          if (pr === '1500-2499' && !(price >= 1500 && price <= 2499)) return false;
          if (pr === '2500+' && !(price >= 2500)) return false;
        }
        if (sizes.size){
          const has = (p.sizes||[]).some(s => sizes.has(String(s).toUpperCase()));
          if (!has) return false;
        }
        return true;
      });
    };
  }

  if (typeof G.sortProducts !== 'function') {
    // sortKey: 'popular' | 'new' | 'price-asc' | 'price-desc'
    G.sortProducts = function(products, sortKey){
      const arr = (products || []).slice();
      switch(sortKey){
        case 'new': return arr.reverse();
        case 'price-asc': return arr.sort((a,b)=>a.price-b.price);
        case 'price-desc': return arr.sort((a,b)=>b.price-a.price);
        default: return arr; // popular
      }
    };
  }

  if (typeof G.getRelatedProducts !== 'function') {
    G.getRelatedProducts = function(product, limit){
      const base = list().filter(p => p.id !== product?.id && (product?.category ? p.category === product.category : true));
      return base.slice(0, Math.max(0, limit || 4));
    };
  }
})();

