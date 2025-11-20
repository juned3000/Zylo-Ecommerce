// Enhanced Cart Coupon System
(function() {
    'use strict';

    // Global coupon state
    let appliedCoupon = null;
    let availableCoupons = [];
    let cartTotal = 0;

    // Mock coupon data - replace with API calls in production
    const MOCK_COUPONS = [
        {
            code: 'OOF15',
            title: 'Get EXTRA 15% Discount on all Products',
            description: 'Get EXTRA 15% Discount on all Products. Coupon code - OOF15',
            discountType: 'percentage',
            discountValue: 15,
            minimumOrderValue: 100, // Reduced from 500 to 100 for easier testing
            maximumDiscount: 500
        },
        {
            code: 'SAVE100',
            title: 'Flat ₹100 Off',
            description: 'Save ₹100 on orders above ₹1000',
            discountType: 'fixed',
            discountValue: 100,
            minimumOrderValue: 1000,
            maximumDiscount: null
        },
        {
            code: 'FASHION20',
            title: 'Fashion Sale',
            description: 'Get 20% off on fashion items',
            discountType: 'percentage',
            discountValue: 20,
            minimumOrderValue: 800,
            maximumDiscount: 300
        },
        {
            code: 'NEWUSER25',
            title: 'New Customer Special',
            description: 'Get 25% off your first purchase',
            discountType: 'percentage',
            discountValue: 25,
            minimumOrderValue: 600,
            maximumDiscount: 750
        }
    ];

    // Initialize coupon system
    function initCouponSystem() {
        console.log('🎫 Initializing enhanced coupon system...');
        
        // Load applied coupon from localStorage
        loadAppliedCoupon();
        
        // Load available coupons
        loadAvailableCoupons();
        
        // Attach event listeners
        attachEventListeners();
        
        // Revalidate any applied coupon to ensure it's properly applied
        revalidateAppliedCouponIfNeeded();
        
        // Update display
        updateCouponDisplay();
        
        // Delayed sync with CartManager in case it loads after us
        setTimeout(() => {
            if (window.cartManager && appliedCoupon) {
                console.log('🔄 Delayed sync with CartManager:', appliedCoupon);
                window.cartManager.appliedCoupon = appliedCoupon;
                try { window.cartManager.renderSummary(); } catch {}
            }
        }, 1000);
        
        console.log('✅ Coupon system initialized');
    }

    function loadAppliedCoupon() {
        try {
            const stored = localStorage.getItem('zylo_applied_coupon');
            appliedCoupon = stored ? JSON.parse(stored) : null;
            console.log('📋 Loaded applied coupon:', appliedCoupon?.code || 'None');
            if (appliedCoupon) {
                console.log('📊 Coupon discount amount:', appliedCoupon.discountAmount);
            }
            
            // Sync with CartManager immediately if it exists
            if (window.cartManager) {
                console.log('🔄 Initial sync with CartManager:', appliedCoupon);
                window.cartManager.appliedCoupon = appliedCoupon;
            }
        } catch (error) {
            console.warn('Failed to load applied coupon:', error);
            appliedCoupon = null;
        }
    }

    async function loadAvailableCoupons() {
        try {
            if (window.API && window.API.endpoints?.coupons?.getAvailable) {
                const res = await window.API.endpoints.coupons.getAvailable();
                if (res && res.success && Array.isArray(res.items)) {
                    availableCoupons = res.items.map(c => ({
                        code: c.code,
                        title: c.description || `${c.discountType === 'percentage' ? c.discountValue + '% OFF' : '₹' + c.discountValue + ' OFF'}`,
                        description: c.description || '',
                        discountType: c.discountType,
                        discountValue: c.discountValue,
                        minimumOrderValue: c.minimumOrderValue || 0,
                        maximumDiscount: c.maximumDiscount || null
                    }));
                    console.log('📦 Loaded', availableCoupons.length, 'available coupons from API');
                    setFeaturedCouponFromAvailable();
                    return;
                }
            }
        } catch (e) {
            console.warn('Failed to load coupons from API, using mock list:', e?.message || e);
        }
        // Fallback to local mock
        availableCoupons = [...MOCK_COUPONS];
        setFeaturedCouponFromAvailable();
        console.log('📦 Loaded', availableCoupons.length, 'available coupons (fallback)');
    }

    function attachEventListeners() {
        // Apply More Coupons button (original)
        const applyMoreBtn = document.getElementById('apply-more-coupons');
        if (applyMoreBtn) {
            applyMoreBtn.addEventListener('click', openCouponModal);
        }

        // Apply More Link (new)
        const applyMoreLink = document.getElementById('apply-more-link');
        if (applyMoreLink) {
            applyMoreLink.addEventListener('click', function(e) {
                e.preventDefault();
                openCouponModal();
            });
        }

        // Featured coupon apply/remove button
        const applyFeaturedBtn = document.getElementById('apply-featured-coupon');
        if (applyFeaturedBtn) {
            applyFeaturedBtn.addEventListener('click', function(e) {
                e.preventDefault();
                const codeEl = document.getElementById('featured-coupon-code');
                const featuredCode = (codeEl?.textContent || '').trim().toUpperCase();
                if (!featuredCode) return;
                
                // Check if coupon is already applied
                if (appliedCoupon && appliedCoupon.code === featuredCode) {
                    console.log('🗑️ Remove button clicked for', featuredCode);
                    removeCoupon();
                } else {
                    console.log('🎫 Apply button clicked for', featuredCode);
                    applyCouponByCode(featuredCode);
                }
            });
        }

        // Best coupon apply button (original)
        const applyBestBtn = document.getElementById('apply-best-coupon');
        if (applyBestBtn) {
            applyBestBtn.addEventListener('click', applyBestCoupon);
        }

        // Remove coupon button
        const removeCouponBtn = document.getElementById('remove-coupon');
        if (removeCouponBtn) {
            removeCouponBtn.addEventListener('click', removeCoupon);
        }

        // Modal event listeners
        attachModalEventListeners();

        // ESC key to close modal
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeCouponModal();
            }
        });

        console.log('🔗 Event listeners attached');
    }

    function attachModalEventListeners() {
        const modal = document.getElementById('coupon-modal');
        const closeBtn = document.getElementById('close-modal');
        const modalApplyBtn = document.getElementById('modal-apply-coupon');
        const modalInput = document.getElementById('modal-coupon-input');

        if (closeBtn) {
            closeBtn.addEventListener('click', closeCouponModal);
        }

        if (modal) {
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    closeCouponModal();
                }
            });
        }

        if (modalApplyBtn && modalInput) {
            modalApplyBtn.addEventListener('click', function() {
                const code = modalInput.value.trim().toUpperCase();
                if (code) {
                    applyCouponByCode(code);
                }
            });

            modalInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const code = e.target.value.trim().toUpperCase();
                    if (code) {
                        applyCouponByCode(code);
                    }
                }
            });
        }
    }

    // Helper: check if there are items in cart (by localStorage)
    function hasCartItems() {
        try {
            const cart = JSON.parse(localStorage.getItem('zylo_cart') || '[]');
            return Array.isArray(cart) && cart.reduce((s,i)=> s + (Number(i.quantity)||0), 0) > 0;
        } catch { return false; }
    }

    // Ensure totals reflect latest discount when needed
    async function revalidateAppliedCouponIfNeeded() {
        try {
            if (!appliedCoupon || !appliedCoupon.code) return;
            
            // If already have a positive discountAmount, skip revalidation
            if (typeof appliedCoupon.discountAmount === 'number' && appliedCoupon.discountAmount > 0) return;
            
            // If coupon has zero discount, it means it's not properly applied - clear it
            if (typeof appliedCoupon.discountAmount === 'number' && appliedCoupon.discountAmount === 0) {
                console.log('🧹 Clearing coupon with zero discount:', appliedCoupon.code);
                appliedCoupon = null;
                try { localStorage.removeItem('zylo_applied_coupon'); } catch {}
                
                // Sync with CartManager
                if (window.cartManager) {
                    console.log('🔄 Clearing invalid coupon from CartManager');
                    window.cartManager.appliedCoupon = null;
                }
                
                updateCouponDisplay();
                try { window.cartManager?.renderSummary?.(); } catch {}
                return;
            }

            // If logged in, use backend cart validation (respects per-user usage rules)
            const isAuthed = !!(window.API && typeof window.API.isAuthenticated === 'function' && window.API.isAuthenticated());
            if (isAuthed) {
                try {
                    const data = await API.endpoints.cart.validateCoupon(appliedCoupon.code);
                    if (data && data.success && data.coupon) {
                        appliedCoupon.discountAmount = Number(data.coupon.discountAmount || data.coupon.discount) || 0;
                        appliedCoupon.discountType = data.coupon.discountType || appliedCoupon.discountType;
                        appliedCoupon.discountValue = data.coupon.discountValue ?? appliedCoupon.discountValue;
                        try { localStorage.setItem('zylo_applied_coupon', JSON.stringify(appliedCoupon)); } catch {}
                        try { window.cartManager?.renderSummary?.(); } catch {}
                        try { updateOrderSummary(); } catch {}
                    } else {
                        // Not valid for this cart/user - clear it
                        appliedCoupon = null;
                        try { localStorage.removeItem('zylo_applied_coupon'); } catch {}
                        try { window.cartManager?.renderSummary?.(); } catch {}
                        updateCouponDisplay();
                    }
                    return;
                } catch (e) {
                    // Fall through to public validation if needed
                }
            }

            // Guest/public validation fallback using current subtotal from UI
            const subtotalEl = document.getElementById('subtotal');
            if (!subtotalEl) return;
            const text = subtotalEl.textContent || '';
            const clean = text.replace(/[^0-9,]/g, '');
            const currentTotal = parseFloat(clean.replace(/,/g, '')) || 0;
            if (currentTotal <= 0) return;
            
            const apiBase = (window.API && window.API.config && window.API.config.BASE_URL) || 'http://localhost:5000/api';
            const resp = await fetch(`${apiBase}/coupons/validate/${encodeURIComponent(appliedCoupon.code)}?orderValue=${currentTotal}`, {
                method: 'GET', headers: { 'Content-Type': 'application/json' }
            });
            const result = await resp.json();
            if (result && result.success) {
                appliedCoupon.discountAmount = Number(result.coupon.discount) || 0;
                // Also keep type/value for completeness
                appliedCoupon.discountType = result.coupon.discountType;
                appliedCoupon.discountValue = result.coupon.discountValue;
                try { localStorage.setItem('zylo_applied_coupon', JSON.stringify(appliedCoupon)); } catch {}
                // Refresh summaries
                try { window.cartManager?.renderSummary?.(); } catch {}
                try { updateOrderSummary(); } catch {}
            } else {
                // If validation fails, clear coupon silently
                appliedCoupon = null;
                try { localStorage.removeItem('zylo_applied_coupon'); } catch {}
                try { window.cartManager?.renderSummary?.(); } catch {}
                updateCouponDisplay();
            }
        } catch {}
    }

    function updateCouponDisplay() {
        const mainContent = document.querySelector('.coupon-main-content');
        const appliedSection = document.getElementById('applied-coupon-section');
        const bestOfferTag = document.querySelector('.best-offer-tag');
        const applyMoreLink = document.getElementById('apply-more-link');
        const applyButton = document.getElementById('apply-featured-coupon');
        const couponOffer = document.querySelector('.coupon-offer');
        const couponSubtitle = document.querySelector('.coupon-subtitle');
        const featuredCodeEl = document.getElementById('featured-coupon-code');
        const couponSection = document.querySelector('.coupon-section');

        // Hide coupon UI entirely when cart is empty
        if (!hasCartItems()) {
            if (couponSection) couponSection.style.display = 'none';
            // Also clear any stale applied coupon when cart is empty
            appliedCoupon = null;
            try { localStorage.removeItem('zylo_applied_coupon'); } catch {}
            return;
        } else {
            if (couponSection) couponSection.style.display = '';
        }

        // Harden: reload from localStorage if code missing
        if (appliedCoupon && !appliedCoupon.code) {
            try {
                const stored = JSON.parse(localStorage.getItem('zylo_applied_coupon') || 'null');
                if (stored) appliedCoupon = stored;
            } catch {}
        }

        // Check if coupon is actually applied with valid discount
        const isValidlyApplied = appliedCoupon && appliedCoupon.code && 
            (typeof appliedCoupon.discountAmount === 'number' ? appliedCoupon.discountAmount > 0 : calculateDiscount(appliedCoupon) > 0);

        if (isValidlyApplied) {
            // Update best offer tag
            if (bestOfferTag) {
                bestOfferTag.innerHTML = '<i class="fas fa-trophy icon"></i><span>Best offer applied!</span>';
            }
            
            // Ensure the left code badge shows the code
            if (featuredCodeEl) {
                featuredCodeEl.textContent = appliedCoupon.code || featuredCodeEl.textContent || 'COUPON';
            }

            // Update coupon text to show applied state (avoid duplicating code string)
            if (couponOffer) {
                couponOffer.textContent = 'coupon is applied successfully!';
            }
            
            if (couponSubtitle) {
                const computed = (typeof appliedCoupon.discountAmount === 'number')
                  ? appliedCoupon.discountAmount
                  : calculateDiscount(appliedCoupon);
                const savingsText = (Number(computed) || 0).toLocaleString('en-IN');
                couponSubtitle.innerHTML = `You saved <span class="coupon-code-text">₹${savingsText}</span> with this coupon`;
            }
            
            // Change apply button to remove button
            if (applyButton) {
                applyButton.textContent = 'Remove';
                applyButton.classList.add('remove-state');
            }
            
            // Hide applied section, show main content with updated text
            if (appliedSection) appliedSection.style.display = 'none';
            if (mainContent) mainContent.style.display = 'flex';
            if (bestOfferTag) bestOfferTag.style.display = 'inline-flex';
            if (applyMoreLink) applyMoreLink.style.display = 'flex';
        } else {
            // Reset to original state
            if (bestOfferTag) {
                bestOfferTag.innerHTML = '<i class="fas fa-star icon"></i><span>Best offer unlocked!</span>';
            }
            
            if (couponOffer) {
                couponOffer.textContent = 'Get EXTRA 15% Discount on all Products.';
            }
            
            if (couponSubtitle) {
                couponSubtitle.innerHTML = 'Coupon code - <span class="coupon-code-text">OOF15</span>';
            }
            
            // Reset apply button
            if (applyButton) {
                applyButton.textContent = 'Apply';
                applyButton.classList.remove('remove-state');
            }
            
            // Show main coupon content, hide applied section
            if (appliedSection) appliedSection.style.display = 'none';
            if (mainContent) mainContent.style.display = 'flex';
            if (bestOfferTag) bestOfferTag.style.display = 'inline-flex';
            if (applyMoreLink) applyMoreLink.style.display = 'flex';
        }
    }

    function setFeaturedCouponFromAvailable() {
        // Pick best coupon by potential savings using current subtotal
        const best = getBestCoupon();
        const featuredCodeEl = document.getElementById('featured-coupon-code');
        const couponOffer = document.querySelector('.coupon-offer');
        const couponSubtitle = document.querySelector('.coupon-subtitle');
        if (!best) return;
        if (featuredCodeEl) featuredCodeEl.textContent = best.code;
        if (couponOffer) couponOffer.textContent = best.title || (best.discountType === 'percentage' ? `${best.discountValue}% OFF` : `₹${best.discountValue} OFF`);
        if (couponSubtitle) couponSubtitle.innerHTML = `Coupon code - <span class="coupon-code-text">${best.code}</span>`;
    }

    function showBestCoupon() {
        if (availableCoupons.length === 0) return;

        const bestCoupon = getBestCoupon();
        if (!bestCoupon) return;

        const elements = {
            discount: document.getElementById('best-coupon-discount'),
            title: document.getElementById('best-coupon-title'),
            desc: document.getElementById('best-coupon-desc'),
            savings: document.getElementById('best-coupon-savings')
        };

        if (elements.discount) {
            const discountText = bestCoupon.discountType === 'percentage'
                ? `${bestCoupon.discountValue}% OFF`
                : `₹${bestCoupon.discountValue} OFF`;
            elements.discount.textContent = discountText;
        }

        if (elements.title) {
            elements.title.textContent = bestCoupon.title;
        }

        if (elements.desc) {
            elements.desc.textContent = bestCoupon.description;
        }

        if (elements.savings) {
            const maxSaving = bestCoupon.maximumDiscount || bestCoupon.discountValue;
            elements.savings.textContent = `Save up to ₹${maxSaving}`;
        }
    }

    function showAppliedCoupon() {
        if (!appliedCoupon) return;

        const elements = {
            title: document.getElementById('applied-coupon-title'),
            desc: document.getElementById('applied-coupon-desc'),
            code: document.getElementById('applied-coupon-code'),
            savings: document.getElementById('applied-coupon-savings')
        };

        if (elements.title) {
            elements.title.textContent = 'Coupon Applied!';
        }

        if (elements.desc) {
            elements.desc.textContent = appliedCoupon.description || '';
        }

        if (elements.code) {
            elements.code.textContent = appliedCoupon.code;
        }

        if (elements.savings) {
            const computed = typeof appliedCoupon.discountAmount === 'number' ? appliedCoupon.discountAmount : calculateDiscount(appliedCoupon);
            const savings = Number(computed) || 0;
            elements.savings.textContent = `Saved ₹${savings.toLocaleString('en-IN')}`;
        }
    }

    function getBestCoupon() {
        // Get current cart total with improved parsing
        const subtotalEl = document.getElementById('subtotal');
        let cartTotal = 0;
        if (subtotalEl) {
            const text = subtotalEl.textContent || '';
            const cleanText = text.replace(/[^0-9,]/g, '');
            cartTotal = parseFloat(cleanText.replace(/,/g, '')) || 0;
        }

        // Filter applicable coupons based on minimum order value
        const applicable = availableCoupons.filter(coupon => 
            cartTotal >= coupon.minimumOrderValue
        );

        if (applicable.length === 0) return null;

        // Sort by potential savings (descending) and return the best
        return applicable.sort((a, b) => {
            const savingsA = calculateDiscount(a);
            const savingsB = calculateDiscount(b);
            return savingsB - savingsA;
        })[0];
    }

    function calculateDiscount(coupon) {
        if (!coupon) return 0;

        // Get current cart total with improved parsing
        const subtotalEl = document.getElementById('subtotal');
        let currentTotal = 0;
        if (subtotalEl) {
            const text = subtotalEl.textContent || '';
            const cleanText = text.replace(/[^0-9,]/g, '');
            currentTotal = parseFloat(cleanText.replace(/,/g, '')) || 0;
        }

        if (coupon.discountType === 'percentage') {
            let discount = (currentTotal * coupon.discountValue) / 100;
            if (coupon.maximumDiscount) {
                discount = Math.min(discount, coupon.maximumDiscount);
            }
            return Math.round(discount);
        } else {
            return Math.min(coupon.discountValue, currentTotal);
        }
    }

    function applyBestCoupon() {
        const bestCoupon = getBestCoupon();
        if (bestCoupon) {
            applyCoupon(bestCoupon);
        }
    }

    async function applyCouponByCode(code) {
        try {
            console.log('🎫 Attempting to apply coupon:', code);

            const isAuthed = !!(window.API && typeof window.API.isAuthenticated === 'function' && window.API.isAuthenticated());

            if (!isAuthed) {
                // Validate via public backend endpoint and normalize shape for guests
                // Parse current subtotal from UI
                const subtotalEl = document.getElementById('subtotal');
                let currentTotal = 0;
                if (subtotalEl) {
                    const text = subtotalEl.textContent || '';
                    const cleanText = text.replace(/[^0-9,]/g, '');
                    currentTotal = parseFloat(cleanText.replace(/,/g, '')) || 0;
                }

                const apiBase = (window.API && window.API.config && window.API.config.BASE_URL) || 'http://localhost:5000/api';
                const resp = await fetch(`${apiBase}/coupons/validate/${encodeURIComponent(code)}?orderValue=${currentTotal}`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });
                const result = await resp.json();

                if (!result || !result.success) {
                    showNotification(result?.message || 'Invalid coupon code', 'error');
                    return;
                }

                // Normalize to a consistent shape expected across app
                appliedCoupon = {
                    code: result.coupon.code,
                    discountAmount: Number(result.coupon.discount) || 0,
                    discountType: result.coupon.discountType,
                    discountValue: result.coupon.discountValue,
                    description: result.coupon.description
                };
                
                console.log('🎉 Successfully applied coupon via API:', appliedCoupon);
                console.log('💵 Discount amount from backend:', result.coupon.discount);

                try { localStorage.setItem('zylo_applied_coupon', JSON.stringify(appliedCoupon)); } catch {}
                
                // Sync with CartManager if it exists
                if (window.cartManager) {
                    console.log('🔄 Syncing coupon with CartManager:', appliedCoupon);
                    window.cartManager.appliedCoupon = appliedCoupon;
                }
                
            updateCouponDisplay();
            updateOrderSummary();
            // Refresh cart summary to ensure totals reflect discount
            try { window.cartManager?.renderSummary?.(); } catch {}
            closeCouponModal();
            
            showNotification(`Coupon applied! You saved ₹${(appliedCoupon.discountAmount || 0).toLocaleString('en-IN')}`,'success');
            console.log('✅ Coupon applied via public validation:', appliedCoupon);
            return;
            }

            // Authenticated users: apply coupon to server cart for persistence
            const data = await API.endpoints.cart.applyCoupon(code);
            if (!data || !data.success) {
                showNotification((data && data.message) || 'Failed to apply coupon', 'error');
                // Clear any stale coupon if present
                appliedCoupon = null;
                try { localStorage.removeItem('zylo_applied_coupon'); } catch {}
                updateCouponDisplay();
                try { window.cartManager?.renderSummary?.(); } catch {}
                return;
            }

            // Use server-provided appliedCoupon (already normalized)
            appliedCoupon = {
                code: data.appliedCoupon.code,
                discountAmount: Number(data.appliedCoupon.discountAmount) || 0,
                discountType: data.appliedCoupon.discountType
            };

            try { localStorage.setItem('zylo_applied_coupon', JSON.stringify(appliedCoupon)); } catch {}
            
            // Sync with CartManager if it exists
            if (window.cartManager) {
                console.log('🔄 Syncing coupon with CartManager (authenticated):', appliedCoupon);
                window.cartManager.appliedCoupon = appliedCoupon;
            }

            updateCouponDisplay();
            updateOrderSummary();
            // Refresh cart summary to ensure totals reflect discount
            try { window.cartManager?.renderSummary?.(); } catch {}
            closeCouponModal();

            showNotification(`Coupon applied! You saved ₹${(data.discountAmount || appliedCoupon.discountAmount || 0).toLocaleString('en-IN')}`, 'success');
            console.log('✅ Coupon applied via backend:', appliedCoupon);
        } catch (error) {
            console.error('❌ Error applying coupon:', error);
            const msg = String(error?.message || '');
            if (/already used/i.test(msg)) {
                showNotification('You have already used this coupon', 'error');
                // Ensure UI does not keep stale applied state
                appliedCoupon = null;
                try { localStorage.removeItem('zylo_applied_coupon'); } catch {}
                updateCouponDisplay();
                try { window.cartManager?.renderSummary?.(); } catch {}
                return;
            }
            showNotification('Failed to apply coupon. Please try again.', 'error');
        }
    }

    function applyCoupon(coupon) {
        if (appliedCoupon && appliedCoupon.code === coupon.code) {
            showNotification('This coupon is already applied', 'info');
            return;
        }

        // Calculate discount amount if not already set
        const discountAmount = calculateDiscount(coupon);
        appliedCoupon = {
            ...coupon,
            discountAmount: discountAmount
        };
        
        console.log('🎫 Applying coupon:', appliedCoupon);
        console.log('💰 Calculated discount:', discountAmount);
        
        // Save to localStorage
        try {
            localStorage.setItem('zylo_applied_coupon', JSON.stringify(appliedCoupon));
        } catch (error) {
            console.warn('Failed to save applied coupon:', error);
        }
        
        // Sync with CartManager if it exists
        if (window.cartManager) {
            console.log('🔄 Syncing coupon with CartManager (local):', appliedCoupon);
            window.cartManager.appliedCoupon = appliedCoupon;
        }

        // Update displays
        updateCouponDisplay();
        updateOrderSummary();
        closeCouponModal();

        // Show success notification
        showNotification(`Coupon applied! You saved ₹${discountAmount}`, 'success');

        console.log('✅ Coupon applied:', appliedCoupon.code, 'with discount:', discountAmount);
    }
    async function removeCoupon() {
        if (!appliedCoupon) {
            // Nothing to remove; ensure UI is clean
            updateCouponDisplay();
            updateOrderSummary();
            try { window.cartManager?.renderSummary?.(); } catch {}
            return;
        }
        
        try {
            const isAuthed = !!(window.API && typeof window.API.isAuthenticated === 'function' && window.API.isAuthenticated());
            if (isAuthed && hasCartItems()) {
                try {
                    const data = await API.endpoints.cart.removeCoupon();
                    if (!data || !data.success) {
                        // If backend says cart not found/empty, proceed to local removal without error
                        const msg = (data && data.message) || '';
                        if (!/cart is empty|cart not found/i.test(msg)) {
                            console.warn('Backend removeCoupon reported:', msg);
                        }
                    }
                } catch (e) {
                    // Network or server error - proceed to local removal
                    console.warn('removeCoupon backend error, proceeding locally:', e?.message || e);
                }
            }
            
            appliedCoupon = null;
            try { localStorage.removeItem('zylo_applied_coupon'); } catch {}
            
            // Sync with CartManager if it exists
            if (window.cartManager) {
                console.log('🔄 Clearing coupon from CartManager');
                window.cartManager.appliedCoupon = null;
            }

            updateCouponDisplay();
            updateOrderSummary();
            try { window.cartManager?.renderSummary?.(); } catch {}
            
            showNotification('Coupon removed', 'info');
            console.log('🗑️ Coupon removed');
        } catch (error) {
            console.error('❌ Error removing coupon:', error);
            // Even on error, ensure UI is consistent
            appliedCoupon = null;
            try { localStorage.removeItem('zylo_applied_coupon'); } catch {}
            updateCouponDisplay();
            updateOrderSummary();
            try { window.cartManager?.renderSummary?.(); } catch {}
        }
    }
    function updateOrderSummary() {
        console.log('🧮 Updating order summary, appliedCoupon:', appliedCoupon);
        const summaryDetails = document.querySelector('.summary-details');
        if (!summaryDetails) {
            console.warn('❌ Summary details element not found');
            return;
        }

        // Remove existing coupon discount row
        const existingRow = summaryDetails.querySelector('.coupon-discount-row');
        if (existingRow) {
            existingRow.remove();
            console.log('🗑️ Removed existing coupon row');
        }

        // Add coupon discount row if coupon is applied
        if (appliedCoupon) {
            const computed = typeof appliedCoupon.discountAmount === 'number' ? appliedCoupon.discountAmount : calculateDiscount(appliedCoupon);
            const discount = Number(computed) || 0;
            console.log('💰 Computed discount:', discount, 'from coupon:', appliedCoupon);
            
            if (discount > 0) {
                const couponRow = document.createElement('div');
                couponRow.className = 'summary-row coupon-discount-row';
                couponRow.innerHTML = `
                    <span>Coupon (${appliedCoupon.code})</span>
                    <span class="discount">-Rs. ${discount.toLocaleString('en-IN')}</span>
                `;
                
                // Insert before shipping row (2nd row)
                const shippingRow = summaryDetails.querySelector('.summary-row:nth-child(2)');
                if (shippingRow) {
                    summaryDetails.insertBefore(couponRow, shippingRow);
                    console.log('✅ Added coupon discount row to summary');
                } else {
                    // Fallback: append to end if shipping row not found
                    const totalRow = summaryDetails.querySelector('.summary-row.total');
                    if (totalRow) {
                        summaryDetails.insertBefore(couponRow, totalRow);
                        console.log('✅ Added coupon discount row before total row');
                    } else {
                        summaryDetails.appendChild(couponRow);
                        console.log('✅ Appended coupon discount row to end');
                    }
                }
            } else {
                console.log('❌ Discount is zero, revalidating coupon');
                // Try revalidating in background if discount is zero
                revalidateAppliedCouponIfNeeded();
            }
        }

        // Recalculate total
        recalculateTotal();
    }

    function recalculateTotal() {
        const subtotalEl = document.getElementById('subtotal');
        const shippingEl = document.getElementById('shipping');
        const taxEl = document.getElementById('tax');
        const totalEl = document.getElementById('total');

        if (!subtotalEl || !totalEl) return;

        // Improved currency parsing for subtotal
        let subtotal = 0;
        if (subtotalEl) {
            const text = subtotalEl.textContent || '';
            const cleanText = text.replace(/[^0-9,]/g, '');
            subtotal = parseFloat(cleanText.replace(/,/g, '')) || 0;
        }
        
        const computed = (appliedCoupon && typeof appliedCoupon.discountAmount === 'number') ? appliedCoupon.discountAmount : (appliedCoupon ? calculateDiscount(appliedCoupon) : 0);
        const discount = Number(computed) || 0;
        const discountedSubtotal = subtotal - discount;
        
        // Calculate shipping and tax on discounted amount
        const shipping = discountedSubtotal > 1500 ? 0 : 99; // Free shipping over ₹1500
        const tax = Math.round(discountedSubtotal * 0.18); // 18% tax
        const total = discountedSubtotal + shipping + tax;

        // Update shipping display
        if (shippingEl) {
            shippingEl.textContent = shipping === 0 ? 'Free' : `Rs. ${shipping}`;
        }

        // Update tax display
        if (taxEl) {
            taxEl.textContent = `Rs. ${tax.toLocaleString('en-IN')}`;
        }

        // Update total display
        totalEl.textContent = `Rs. ${total.toLocaleString('en-IN')}`;
    }

    function openCouponModal() {
        const modal = document.getElementById('coupon-modal');
        if (!modal) return;

        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);

        // Load coupons in modal
        populateModalCoupons();

        // Focus on input
        const input = document.getElementById('modal-coupon-input');
        if (input) {
            setTimeout(() => input.focus(), 300);
        }

        console.log('📱 Coupon modal opened');
    }

    function closeCouponModal() {
        const modal = document.getElementById('coupon-modal');
        if (!modal) return;

        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = 'none';
            // Clear input
            const input = document.getElementById('modal-coupon-input');
            if (input) input.value = '';
        }, 300);

        console.log('📱 Coupon modal closed');
    }

    function populateModalCoupons() {
        const couponsList = document.getElementById('modal-coupons-list');
        const couponsCount = document.getElementById('coupons-count');

        if (!couponsList) return;

        // Update count
        if (couponsCount) {
            couponsCount.textContent = `${availableCoupons.length} Available`;
        }

        // Get current cart total for calculations with improved parsing
        const subtotalEl = document.getElementById('subtotal');
        let currentTotal = 0;
        if (subtotalEl) {
            const text = subtotalEl.textContent || '';
            const cleanText = text.replace(/[^0-9,]/g, '');
            currentTotal = parseFloat(cleanText.replace(/,/g, '')) || 0;
        }

        // Generate coupon cards HTML
        const couponsHTML = availableCoupons.map(coupon => {
            const discountText = coupon.discountType === 'percentage'
                ? `${coupon.discountValue}% OFF`
                : `₹${coupon.discountValue} OFF`;
            
            const savings = calculateDiscount(coupon);
            const isApplicable = currentTotal >= coupon.minimumOrderValue;
            const isApplied = appliedCoupon && appliedCoupon.code === coupon.code;

            return `
                <div class="modal-coupon-card ${!isApplicable ? 'not-applicable' : ''}" data-code="${coupon.code}">
                    <div class="modal-coupon-discount">${discountText}</div>
                    <div class="modal-coupon-info">
                        <h5>${coupon.description}</h5>
                        <div class="modal-coupon-saving">Save ₹${savings}</div>
                        <div class="modal-coupon-code">Code: ${coupon.code}</div>
                        ${!isApplicable ? `<div class="min-order-note">Min order: ₹${coupon.minimumOrderValue}</div>` : ''}
                    </div>
                    <button class="btn-modal-coupon-apply" data-code="${coupon.code}" 
                            ${!isApplicable ? 'disabled' : ''} 
                            ${isApplied ? 'disabled' : ''}>
                        ${isApplied ? '<i class="fas fa-check"></i>' : !isApplicable ? '<i class="fas fa-lock"></i>' : ''}
                        ${isApplied ? 'Applied' : !isApplicable ? 'Locked' : 'Apply'}
                    </button>
                </div>
            `;
        }).join('');

        couponsList.innerHTML = couponsHTML;

        // Attach click handlers to apply buttons
        couponsList.querySelectorAll('.btn-modal-coupon-apply:not([disabled])').forEach(btn => {
            btn.addEventListener('click', function() {
                const code = this.dataset.code;
                applyCouponByCode(code);
            });
        });
    }

    function showNotification(message, type = 'info') {
        // Remove existing notifications
        const existing = document.querySelectorAll('.coupon-notification');
        existing.forEach(n => n.remove());

        // Create notification
        const notification = document.createElement('div');
        notification.className = `coupon-notification notification-${type}`;
        notification.textContent = message;
        
        // Style the notification
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            z-index: 10001;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Hide and remove notification
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 4000);
    }

    // Debug helper function
    function debugOrderSummary() {
        console.log('🔍 Order Summary Debug Info:');
        const summaryDetails = document.querySelector('.summary-details');
        console.log('Summary details element:', summaryDetails);
        if (summaryDetails) {
            const rows = summaryDetails.querySelectorAll('.summary-row');
            console.log('Summary rows found:', rows.length);
            rows.forEach((row, i) => {
                console.log(`Row ${i+1}:`, row.textContent.trim(), row.className);
            });
        }
        console.log('Applied coupon:', appliedCoupon);
        const subtotalEl = document.getElementById('subtotal');
        console.log('Subtotal element text:', subtotalEl?.textContent);
        if (appliedCoupon) {
            const discount = calculateDiscount(appliedCoupon);
            console.log('Calculated discount:', discount);
        }
    }

    // Function to sync with CartManager
    function syncWithCartManager() {
        if (window.cartManager) {
            console.log('🔄 Syncing coupon system with CartManager:', appliedCoupon);
            window.cartManager.appliedCoupon = appliedCoupon;
            try { window.cartManager.renderSummary(); } catch {}
            return true;
        }
        return false;
    }

    // Public API
    window.CouponSystem = {
        init: initCouponSystem,
        applyCode: applyCouponByCode,
        remove: removeCoupon,
        getApplied: () => appliedCoupon,
        updateSummary: updateOrderSummary,
        debug: debugOrderSummary,
        syncWithCartManager: syncWithCartManager,
        refresh: function() {
            console.log('🔄 Refreshing coupon system...');
            loadAppliedCoupon();
            updateCouponDisplay();
            updateOrderSummary();
            syncWithCartManager();
        }
    };

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCouponSystem);
    } else {
        initCouponSystem();
    }

    console.log('🎫 Enhanced coupon system loaded');

})();