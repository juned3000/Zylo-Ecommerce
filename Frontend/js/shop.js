// Shop page dynamic rendering, filters and sorting
(function(){
  const state = {
    q: null,
    categories: new Set(),
    brands: new Set(),
    prices: new Set(),
    sizes: new Set(),
    ratings: new Set(), // Add rating filter support
    sort: 'popular',
    page: 1,
    pageSize: 8
  };

  function getParam(name){
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  function applyQueryFromURL(){
    const q = getParam('q');
    if (q) state.q = q.trim();
    const searchInput = document.getElementById('search');
    if (searchInput && state.q) searchInput.value = state.q;
  }

  function readFilters(){
    const sort = document.getElementById('sort');
    const searchInput = document.getElementById('search');

    // Handle price as multiple checkboxes now
    state.prices = new Set();
    document.querySelectorAll('input[name="price"]:checked').forEach(cb => state.prices.add(cb.value));
    
    state.sort = sort?.value || 'popular';
    const qFromUI = searchInput ? ((searchInput.value || '').trim()) : (state.q ?? null);
    state.q = qFromUI || null;

    state.categories.clear();
    document.querySelectorAll('input[name="category"]:checked').forEach(cb => {
      console.log(`📋 Adding category: '${cb.value}'`);
      state.categories.add(cb.value);
    });
    console.log(`📋 Total selected categories:`, Array.from(state.categories));

    state.brands.clear();
    document.querySelectorAll('input[name="brand"]:checked').forEach(cb => state.brands.add(cb.value));

    state.sizes.clear();
    document.querySelectorAll('input[name="size"]:checked').forEach(cb => state.sizes.add(cb.value.toUpperCase()));

    state.ratings.clear();
    document.querySelectorAll('input[name="rating"]:checked').forEach(cb => state.ratings.add(cb.value));

    // Toggle clear-all visibility
    const hasAnyFilter = !!(state.q || state.categories.size || state.prices.size || state.brands.size || state.sizes.size || state.ratings.size);
    const clearLink = document.getElementById('clear-filters');
    if (clearLink){ clearLink.style.display = hasAnyFilter ? 'inline' : 'none'; }
  }

  // Basic synonym mapping for category-like search terms
  const TERM_TO_CATEGORY = {
    'shirt': 'shirts', 'shirts': 'shirts',
    'tshirt': 'tshirt', 't-shirt': 'tshirt', 'tee': 'tshirt', 'tees': 'tshirt',
    'top': 'tops', 'tops': 'tops',
    'sweater': 'sweaters', 'sweaters': 'sweaters', 'jumper': 'sweaters',
    'short': 'shorts', 'shorts': 'shorts',
    'jacket': 'jackets', 'jackets': 'jackets',
    'jean': 'jeans', 'jeans': 'jeans', 'denim': 'jeans', 'denims': 'jeans',
    'accessory': 'accessories', 'accessories': 'accessories'
  };
  function normalize(str){ return String(str || '').toLowerCase().trim(); }
  function categoryForQuery(q){
    const term = normalize(q);
    if (!term) return '';
    if (TERM_TO_CATEGORY[term]) return TERM_TO_CATEGORY[term];
    if (term.endsWith('s') && TERM_TO_CATEGORY[term.slice(0,-1)]) return TERM_TO_CATEGORY[term.slice(0,-1)];
    if (TERM_TO_CATEGORY[term + 's']) return TERM_TO_CATEGORY[term + 's'];
    return '';
  }

  function productMatches(p){
    if (state.q){
      const qNorm = normalize(state.q);
      const hay = `${p.name} ${p.brand} ${p.category}`.toLowerCase();
      const catFromTerm = categoryForQuery(qNorm);
      const nameOrBrandMatch = hay.includes(qNorm);
      const categoryMatch = !!(catFromTerm && p.category === catFromTerm);
      if (!(nameOrBrandMatch || categoryMatch)) return false;
    }
    if (state.categories && state.categories.size > 0) {
      console.log(`🔍 Category Filter Debug for ${p.id}:`);
      console.log(`  - Product: ${p.id} (${p.name})`);
      console.log(`  - Product category: '${p.category}' (type: ${typeof p.category})`);
      console.log(`  - Selected categories:`, Array.from(state.categories));
      console.log(`  - Checking each selected category:`);
      for (const selectedCat of state.categories) {
        console.log(`    - '${selectedCat}' === '${p.category}' ? ${selectedCat === p.category}`);
      }
      console.log(`  - Final has match:`, state.categories.has(p.category));
      if (!state.categories.has(p.category)) {
        console.log(`  - ❌ Product ${p.id} filtered out (category mismatch)`);
        return false;
      } else {
        console.log(`  - ✅ Product ${p.id} matches category filter`);
      }
    }
    if (state.brands.size > 0){
      const brandKey = (p.brand || '').toLowerCase().replace(/[^a-z0-9]/g,'');
      // map examples used in filters: nike, hm, zara, levis, uniqlo
      if (!state.brands.has(brandKey)) return false;
    }
    if (state.prices.size > 0){
      const price = p.price;
      let priceMatches = false;
      
      for (const priceRange of state.prices) {
        if (priceRange === '0-999' && price <= 999) { priceMatches = true; break; }
        if (priceRange === '1000-1499' && price >= 1000 && price <= 1499) { priceMatches = true; break; }
        if (priceRange === '1500-2499' && price >= 1500 && price <= 2499) { priceMatches = true; break; }
        if (priceRange === '2500-2999' && price >= 2500 && price <= 2999) { priceMatches = true; break; }
        if (priceRange === '3000-3499' && price >= 3000 && price <= 3499) { priceMatches = true; break; }
        if (priceRange === '3500-3999' && price >= 3500 && price <= 3999) { priceMatches = true; break; }
        if (priceRange === '4000-4999' && price >= 4000 && price <= 4999) { priceMatches = true; break; }
        if (priceRange === '5000+' && price >= 5000) { priceMatches = true; break; }
      }
      
      if (!priceMatches) return false;
    }
    if (state.sizes.size > 0){
      const hasAny = (p.sizes || []).some(s => state.sizes.has(String(s).toUpperCase()));
      if (!hasAny) return false;
    }
    if (state.ratings.size > 0){
      const productRating = p.averageRating || 0;
      let ratingMatches = false;
      
      for (const ratingFilter of state.ratings) {
        if (ratingFilter === '4+' && productRating >= 4.0) { ratingMatches = true; break; }
        if (ratingFilter === '3+' && productRating >= 3.0) { ratingMatches = true; break; }
        if (ratingFilter === '2+' && productRating >= 2.0) { ratingMatches = true; break; }
        if (ratingFilter === '1+' && productRating >= 1.0) { ratingMatches = true; break; }
      }
      
      if (!ratingMatches) return false;
    }
    return true;
  }

  function sortProducts(list){
    const arr = list.slice();
    switch(state.sort){
      case 'new':
        return arr.reverse();
      case 'price-asc':
        return arr.sort((a,b)=>a.price-b.price);
      case 'price-desc':
        return arr.sort((a,b)=>b.price-a.price);
      case 'rating':
        // Sort by customer rating (highest first), then by total ratings as secondary sort
        return arr.sort((a,b) => {
          const ratingA = a.averageRating || 0;
          const ratingB = b.averageRating || 0;
          if (ratingA !== ratingB) {
            return ratingB - ratingA; // Higher ratings first
          }
          // If ratings are equal, sort by total number of ratings (more reviews first)
          const totalA = a.totalRatings || 0;
          const totalB = b.totalRatings || 0;
          return totalB - totalA;
        });
      default:
        return arr; // popular (no-op for demo)
    }
  }

  function paginate(list){
    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
    const currentPage = Math.min(Math.max(1, state.page), totalPages);
    const start = (currentPage - 1) * state.pageSize;
    const end = start + state.pageSize;
    return {
      items: list.slice(start, end),
      totalPages,
      currentPage
    };
  }

  function ensurePager(){
    let pager = document.querySelector('.pagination');
    if (!pager){
      const section = document.querySelector('.products-section');
      if (section){
        pager = document.createElement('nav');
        pager.className = 'pagination';
        pager.setAttribute('aria-label', 'Pagination');
        section.appendChild(pager);
      }
    }
    return pager;
  }

  function formatCount(n){
    const value = Math.max(0, Number(n||0));
    return `${value} ${value === 1 ? 'product' : 'products'}`;
  }

  function updateProductsHeader(totalCount){
    const header = document.querySelector('.products-header h2');
    if (!header) return;
    const countHTML = `<span class=\"products-count\">${formatCount(totalCount)}</span>`;
    if (state.q){
      header.innerHTML = `Search results for: \"${state.q}\" ${countHTML}`;
    } else {
      header.innerHTML = `Best Picks for You ${countHTML}`;
    }
  }

  function renderPagination(totalPages, currentPage){
    const pager = document.querySelector('.pagination');
    if (!pager) return;
    function pageLink(p){
      const current = p === currentPage ? ' aria-current="page"' : '';
      return `<a class=\"page-link${p===currentPage?' current':''}\" href=\"#\" data-page=\"${p}\" aria-label=\"Page ${p}\"${current}>${p}</a>`;
    }
    const prevDisabled = currentPage <= 1 ? ' aria-disabled="true"' : '';
    const nextDisabled = currentPage >= totalPages ? ' aria-disabled="true"' : '';
    const prev = `<a class=\"page-link prev\" href=\"#\" data-nav=\"prev\" aria-label=\"Previous page\"${prevDisabled}>Prev</a>`;
    const next = `<a class=\"page-link next\" href=\"#\" data-nav=\"next\" aria-label=\"Next page\"${nextDisabled}>Next</a>`;

    // Simple windowed pagination (max 5 pages shown)
    const windowSize = 5;
    const half = Math.floor(windowSize/2);
    let start = Math.max(1, currentPage - half);
    let end = Math.min(totalPages, start + windowSize - 1);
    start = Math.max(1, Math.min(start, end - windowSize + 1));
    const links = Array.from({length: end - start + 1}, (_,i)=>pageLink(start+i)).join('');

    pager.innerHTML = `${prev}${links}${next}`;

    const onPageChange = () => {
      const productsSection = document.querySelector('.products-section');
      if (productsSection && typeof productsSection.scrollIntoView === 'function'){
        productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    pager.querySelectorAll('.page-link').forEach(a => {
      a.addEventListener('click', (e)=>{
        e.preventDefault();
        const nav = a.getAttribute('data-nav');
        if (nav === 'prev' && state.page > 1){ state.page -= 1; renderProducts(); onPageChange(); return; }
        if (nav === 'next' && state.page < totalPages){ state.page += 1; renderProducts(); onPageChange(); return; }
        const pageAttr = a.getAttribute('data-page');
        if (pageAttr){
          const p = parseInt(pageAttr, 10) || 1;
          if (p !== state.page){ state.page = p; renderProducts(); onPageChange(); }
        }
      });
    });
  }

  function renderProducts(){
    const container = document.querySelector('.products-section .pro-container') || document.querySelector('.pro-container');
    if (!container){ return; }
    
    // Remove loading placeholder if present
    const loadingPlaceholder = container.querySelector('.loading-placeholder');
    if (loadingPlaceholder) {
      loadingPlaceholder.remove();
    }
    
    const products = (window.PRODUCTS || []);
    console.log(`📦 Products loaded:`, products.length);
    if (products.length > 0) {
      console.log(`📦 Product categories available:`, [...new Set(products.map(p => p.category))]);
      console.log(`📦 Sample products:`, products.slice(0, 3).map(p => ({ id: p.id, name: p.name, category: p.category })));
    }
    
    // Show message if no products are loaded yet
    if (products.length === 0 && !window.PRODUCTS_LOADED) {
      container.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;">Loading products...</div>';
      return;
    }
    
    const filteredAll = products.filter(productMatches);
    updateProductsHeader(filteredAll.length);
    
    // Show no results message if needed
    if (filteredAll.length === 0) {
      container.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;"><h3>No products found</h3><p>Try adjusting your filters or search terms.</p></div>';
      ensurePager();
      renderPagination(1, 1);
      return;
    }
    
    const filtered = sortProducts(filteredAll);
    const { items, totalPages, currentPage } = paginate(filtered);
    state.page = currentPage; // keep state in sync
    container.innerHTML = items.map(p => cardHTML(p)).join('');
    wireCardButtons(container);
    try { window.ZYLO?.updateWishlistIcons?.(); } catch {}
    ensurePager();
    renderPagination(totalPages, currentPage);
  }

  function cardHTML(p){
    const ratingData = {
      averageRating: p.averageRating || 0,
      totalRatings: p.totalRatings || 0,
      ratingDistribution: p.ratingDistribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    };
    const ratingHTML = ratingData.totalRatings > 0 && window.RatingSystem ? 
      window.RatingSystem.createStarRating(ratingData.averageRating, ratingData.totalRatings, 'small', true, false) : 
      '<div class="product-rating"><span class="rating-text small" style="color: #888;">No ratings yet</span></div>';
    
    return `
      <div class="pro">
        <div class="wishlist-icon" onclick="window.ZYLO?.addToWishlist('${p.id}')" title="Add to Wishlist">
          <i class="far fa-heart"></i>
        </div>
        <a href="singlepro.html?id=${p.id}"><img src="${p.image}" alt="${p.name} by ${p.brand}"></a>
        <div class="des">
          <span>${p.brand}</span>
          <h5>${p.name}</h5>
          ${ratingHTML}
          <h4>Rs. ${Number(p.price).toLocaleString('en-IN')}</h4>
        </div>
      </div>
    `;
  }

  function defaultSizeFor(p){
    const sizes = p.sizes || [];
    if (!sizes.length) return 'M';
    // prefer M/medium if available else first size
    const idx = sizes.findIndex(s => String(s).toUpperCase() === 'M');
    return idx >= 0 ? sizes[idx] : sizes[0];
  }

  function wireCardButtons(root){
    // Add-to-cart removed on shop grid per requirements
    root.querySelectorAll('.btn-wish, .wishlist-icon').forEach(btn => {
      btn.addEventListener('click', () => {
        // Inline onclick already toggles; this ensures icon refresh if handler differs
        try { window.ZYLO?.updateWishlistIcons?.(); } catch {}
      });
    });
  }

  function setupFilterForm(){
    const form = document.querySelector('.filters-form');
    if (!form) return;
    form.addEventListener('submit', (e)=>{ e.preventDefault(); state.page = 1; readFilters(); renderProducts(); });
    form.addEventListener('reset', ()=>{ setTimeout(()=>{ state.page = 1; readFilters(); renderProducts(); }, 0); });

    // dynamic reactions
    ['change','input'].forEach(ev => {
      form.addEventListener(ev, (e)=>{
        if (e.target && (e.target.matches('select') || e.target.matches('input[type="checkbox"]') || e.target.id === 'search')){
          state.page = 1; readFilters(); renderProducts();
        }
      });
    });

    // Enter key on search should not submit the page; already handled above
    const searchInput = document.getElementById('search');
    if (searchInput){
      searchInput.addEventListener('keyup', (e)=>{
        // basic debounce via keyup; fast enough for small lists
        state.page = 1; readFilters(); renderProducts();
      });
    }

    // Ensure sort changes are handled even if select is outside form scope
    const sortSelect = document.getElementById('sort');
    if (sortSelect){
      sortSelect.addEventListener('change', ()=>{ state.page = 1; readFilters(); renderProducts(); });
    }

    // Clear-all anchor
    const clearLink = document.getElementById('clear-filters');
    if (clearLink){
      clearLink.addEventListener('click', ()=>{
        // reset all form controls
        form.reset();
        // manually clear all filter sets and state
        state.page = 1;
        state.q = null;
        state.category = '';
        state.prices.clear();
        state.brands.clear();
        state.sizes.clear();
        state.ratings.clear(); // Clear rating filters
        readFilters();
        renderProducts();
      });
    }
  }

  function setupAccordions(){
    const groups = document.querySelectorAll('.accordion');
    groups.forEach(group => {
      const header = group.querySelector('.accordion-header');
      const content = group.querySelector('.accordion-content');
      const icon = header?.querySelector('i');
      if (!header || !content) return;

      // Prepare content for animated height
      content.style.overflow = 'hidden';
      content.style.transition = 'max-height 0.25s ease, opacity 0.2s ease';

      const setState = (open) => {
        header.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (icon) icon.style.transition = 'transform 0.25s ease';
        if (icon) icon.style.transform = open ? 'rotate(180deg)' : 'rotate(0deg)';
        if (open) {
          content.style.opacity = '1';
          content.style.maxHeight = content.scrollHeight + 'px';
        } else {
          content.style.opacity = '0';
          content.style.maxHeight = '0px';
        }
      };

      // Initialize state
      const initOpen = (header.getAttribute('aria-expanded') || 'true') === 'true';
      setState(initOpen);

      header.addEventListener('click', () => {
        const isOpen = (header.getAttribute('aria-expanded') || 'true') === 'true';
        setState(!isOpen);
      });

      // Recalculate heights on resize for open sections
      window.addEventListener('resize', () => {
        const isOpen = (header.getAttribute('aria-expanded') || 'true') === 'true';
        if (isOpen) {
          content.style.maxHeight = content.scrollHeight + 'px';
        }
      });
    });
  }

  function setupShowHideLists(){
    const groups = document.querySelectorAll('.filters-form .accordion .checkbox-group');
    groups.forEach(group => {
      if (group.dataset.enhanced === '1') return; // avoid double init
      const items = Array.from(group.querySelectorAll('.checkbox'));
      const VISIBLE = 5;
      if (items.length <= VISIBLE) { group.dataset.enhanced = '1'; return; }

      // Hide extras initially
      items.slice(VISIBLE).forEach(el => { el.style.display = 'none'; });

      // Build control
      const footer = document.createElement('div');
      footer.className = 'list-toggle-container';
      const ctrl = document.createElement('a');
      ctrl.href = '#';
      ctrl.className = 'list-toggle';
      ctrl.setAttribute('aria-expanded', 'false');
      ctrl.textContent = 'Show';
      footer.appendChild(ctrl);

      // Insert after the group
      group.parentElement?.insertBefore(footer, group.nextSibling);

      function recalcAccordionHeight(){
        const content = group.closest('.accordion-content');
        const header = content?.previousElementSibling;
        const isOpen = header && header.getAttribute('aria-expanded') === 'true';
        if (content && isOpen) {
          requestAnimationFrame(() => { content.style.maxHeight = content.scrollHeight + 'px'; });
        }
      }

      ctrl.addEventListener('click', (e)=>{
        e.preventDefault();
        const expanded = ctrl.getAttribute('aria-expanded') === 'true';
        if (expanded){
          // Collapse to first VISIBLE
          items.slice(VISIBLE).forEach(el => { el.style.display = 'none'; });
          ctrl.setAttribute('aria-expanded', 'false');
          ctrl.textContent = 'Show';
        } else {
          // Expand all
          items.slice(VISIBLE).forEach(el => { el.style.display = ''; });
          ctrl.setAttribute('aria-expanded', 'true');
          ctrl.textContent = 'Hide';
        }
        recalcAccordionHeight();
      });

      group.dataset.enhanced = '1';
    });
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    applyQueryFromURL();
    readFilters();
    setupFilterForm();
    setupAccordions();
    setupShowHideLists();
    renderProducts();
  });
  
  // Re-render when products are loaded from API
  window.addEventListener('productsLoaded', (event)=>{
    console.log('📦 Products loaded event received with', event.detail?.products?.length || 0, 'products');
    renderProducts();
  });
  
  // Handle products loading errors
  window.addEventListener('productsLoadError', (event)=>{
    console.error('❌ Products load error event:', event.detail?.error);
    
    const container = document.querySelector('.products-section .pro-container') || document.querySelector('.pro-container');
    if (container) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #666;">
          <h3>❌ Failed to Load Products</h3>
          <p>There was a problem loading products from the server.</p>
          <p><strong>Error:</strong> ${event.detail?.error || 'Unknown error'}</p>
          <button onclick="retryLoadProducts()" style="background: #088178; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin-top: 10px;">Retry Loading</button>
          <br><br>
          <p><small>If the problem persists, please refresh the page or try again later.</small></p>
        </div>
      `;
    }
  });
  
  // Global retry function
  window.retryLoadProducts = async function() {
    const container = document.querySelector('.products-section .pro-container') || document.querySelector('.pro-container');
    if (container) {
      container.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;">Retrying to load products...</div>';
    }
    
    // Reset loading state and try again
    window.PRODUCTS_LOADED = false;
    window.PRODUCTS_LOADING = false;
    
    if (typeof window.ensureProductsLoaded === 'function') {
      try {
        await window.ensureProductsLoaded();
      } catch (error) {
        console.error('Retry failed:', error);
      }
    }
  };

  // Public API wrappers
  if (typeof window.initShopPage !== 'function') {
    window.initShopPage = function(){ applyQueryFromURL(); readFilters(); setupFilterForm(); renderProducts(); };
  }
  if (typeof window.readFiltersFromURL !== 'function') {
    window.readFiltersFromURL = applyQueryFromURL;
  }
  if (typeof window.readFiltersFromUI !== 'function') {
    window.readFiltersFromUI = readFilters;
  }
  if (typeof window.applyFilters !== 'function') {
    window.applyFilters = function(){ readFilters(); renderProducts(); };
  }
  if (typeof window.applySort !== 'function') {
    window.applySort = function(sortKey){
      const sel = document.getElementById('sort');
      if (sel) sel.value = sortKey;
      readFilters();
      renderProducts();
    };
  }
  if (typeof window.renderProducts === 'undefined') {
    window.renderProducts = renderProducts;
  }
  if (typeof window.handleAddToCart !== 'function') {
    window.handleAddToCart = function(productId){
      const p = (window.PRODUCTS || []).find(x=>x.id===productId);
      if (!p) return;
      const size = (p.sizes||[])[0] || 'M';
      window.ZYLO?.addToCart(productId, size, 1);
    };
  }
  if (typeof window.handleAddToWishlist !== 'function') {
    window.handleAddToWishlist = function(productId){ window.ZYLO?.addToWishlist?.(productId); };
  }
})();

