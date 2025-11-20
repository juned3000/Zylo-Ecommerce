
const LETTER_SIZES = ['XS','S','M','L','XL','2XL','3XL'];

function isNumericSizes(list) {
  return Array.isArray(list) && list.length > 0 && list.every(s => /^\d+$/.test(String(s)));
}

function getDisplaySizes(product) {
  if (isNumericSizes(product.sizes)) return product.sizes;
  return LETTER_SIZES;
}

function formatPriceINR(number) {
  try {
    return 'Rs. ' + Number(number).toLocaleString('en-IN');
  } catch { return 'Rs. ' + number; }
}

function getParamId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

async function findProductById(id) {
  // Wait for products to be loaded if they aren't already
  if (!window.PRODUCTS_LOADED && typeof window.ensureProductsLoaded === 'function') {
    await window.ensureProductsLoaded();
  }
  return (window.PRODUCTS || []).find(p => p.id === id);
}

function renderSizes(container, sizes) {
  container.innerHTML = '';
  (sizes && sizes.length ? sizes : []).forEach((size, idx) => {
    const id = `size-${size}`;
    const wrapper = document.createElement('div');
    wrapper.className = 'size-item';
    wrapper.innerHTML = `
      <input type="radio" id="${id}" name="size" value="${size}">
      <label for="${id}">${size}</label>
    `;
    container.appendChild(wrapper);
  });
}

function renderProduct(p) {
  const img = document.getElementById('main-image');
  img.src = p.image; img.alt = `${p.name} by ${p.brand}`;
  document.getElementById('brand').textContent = p.brand;
  document.getElementById('title').textContent = p.name;
  document.getElementById('crumb-title').textContent = p.name;
  document.getElementById('price').textContent = formatPriceINR(p.price);
  renderSizes(document.getElementById('sizes-container'), getDisplaySizes(p));
  renderProductDetails(p);
  renderProductDescription(p);
  renderProductRating(p); // Add rating display
}

// Add function to render product rating using database data
function renderProductRating(product) {
  if (!window.RatingSystem) return;
  
  // Use product data directly from database instead of getSampleRating
  const ratingData = {
    averageRating: product.averageRating || 0,
    totalRatings: product.totalRatings || 0,
    ratingDistribution: product.ratingDistribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  };
  
  // Display rating next to product title
  const productRatingElement = document.getElementById('product-rating');
  if (productRatingElement && ratingData.totalRatings > 0) {
    productRatingElement.innerHTML = window.RatingSystem.createStarRating(
      ratingData.averageRating,
      ratingData.totalRatings,
      'normal',
      true,
      false
    );
  }
  
  // Create detailed rating breakdown
  const ratingSectionElement = document.getElementById('rating-section');
  if (ratingSectionElement && ratingData.totalRatings > 0) {
    ratingSectionElement.innerHTML = window.RatingSystem.createRatingBreakdown(ratingData);
  }
  
  // Create rating input form
  const ratingInputElement = document.getElementById('rating-input-section');
  if (ratingInputElement) {
    ratingInputElement.innerHTML = window.RatingSystem.createRatingInput(product.id);
  }
}

function renderRelated(current) {
  const cont = document.getElementById('related-container');
  if (!cont) return;
  
  cont.innerHTML = '';

  // Show up to 5 products from the same category (excluding the current product)
  const list = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
  const related = list.filter(p => p.id !== current.id && current.category && p.category === current.category);
  
  // Always render exactly 5 slots
  const maxSlots = 5;
  const actualProducts = related.slice(0, maxSlots); // Take only first 5 products
  
  if (actualProducts.length === 0) {
    // Show message spanning all 5 columns
    cont.innerHTML = '<div class="no-related" style="grid-column: 1 / -1; text-align:center;color:#666;padding:40px;">No related products found in this category.</div>';
    return;
  }

  // Add actual product cards
  actualProducts.forEach(p => {
    const card = document.createElement('div');
    card.className = 'pro';
    
    // Get rating data directly from product (database data)
    const ratingData = {
      averageRating: p.averageRating || 0,
      totalRatings: p.totalRatings || 0,
      ratingDistribution: p.ratingDistribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    };
    const ratingHTML = ratingData.totalRatings > 0 && window.RatingSystem ? 
      window.RatingSystem.createStarRating(ratingData.averageRating, ratingData.totalRatings, 'small', true, false) : 
      '<div class="related-product-rating"><span class="rating-text small" style="color: #888;">No ratings yet</span></div>';
    
    card.innerHTML = `
      <div class="wishlist-icon" onclick="window.ZYLO?.addToWishlist('${p.id}')" title="Add to Wishlist">
        <i class="far fa-heart"></i>
      </div>
      <a href="singlepro.html?id=${p.id}"><img src="${p.image}" alt="${p.name} by ${p.brand}" onerror="this.src='../img/products/default.jpg'"></a>
      <div class="des">
        <span>${p.brand}</span>
        <h5>${p.name}</h5>
        ${ratingHTML}
        <h4>${formatPriceINR(p.price)}</h4>
      </div>
    `;
    cont.appendChild(card);
  });
  
  // Add empty placeholder slots for remaining spaces
  const emptySlots = maxSlots - actualProducts.length;
  for (let i = 0; i < emptySlots; i++) {
    const emptyCard = document.createElement('div');
    emptyCard.className = 'pro-placeholder';
    emptyCard.innerHTML = `<div class="empty-slot"></div>`;
    cont.appendChild(emptyCard);
  }
}

function attachHandlers(current) {
  const addToCart = document.getElementById('add-to-cart');
  const addToWishlist = document.getElementById('add-to-wishlist');
  const qtyInput = document.getElementById('qty-input');
  const dec = document.getElementById('qty-dec');
  const inc = document.getElementById('qty-inc');
  const checkPincode = document.getElementById('check-pincode');
  const pincodeInput = document.getElementById('pincode-input');

  if (dec && inc && qtyInput) {
    dec.addEventListener('click', () => {
      const val = Math.max(1, (parseInt(qtyInput.value, 10) || 1) - 1);
      qtyInput.value = val;
    });
    inc.addEventListener('click', () => {
      const val = Math.max(1, (parseInt(qtyInput.value, 10) || 1) + 1);
      qtyInput.value = val;
    });
  }

  if (checkPincode && pincodeInput) {
    checkPincode.addEventListener('click', () => {
      const pincode = pincodeInput.value.trim();
      checkDelivery(pincode);
    });
    
    pincodeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        checkPincode.click();
      }
    });
  }

  const onAddClick = () => {
    // If already switched, just navigate without re-adding
    if (addToCart.classList.contains('go-to-cart')) {
      window.location.href = 'cart.html';
      return;
    }

    const chosen = document.querySelector('input[name="size"]:checked');
    const size = chosen ? chosen.value : null;
    const qty = qtyInput ? Math.max(1, parseInt(qtyInput.value, 10) || 1) : 1;

    const sizeError = document.getElementById('size-error');
    if (!size) {
      if (sizeError) { sizeError.textContent = 'Please select a size'; }
      return;
    } else if (sizeError) { sizeError.textContent = ''; }

    if (window.ZYLO?.addToCart) {
      window.ZYLO.addToCart(current.id, size, qty);
      try { window.ZYLO.toast?.('Added to cart'); } catch {}
    } else {
      alert(`${current.name} x${qty} (${size}) added to cart.`);
    }

    // Change button to Go to Cart without keeping the old add handler effect
    addToCart.classList.add('go-to-cart');
    addToCart.innerHTML = '<i class="fas fa-shopping-cart" aria-hidden="true"></i> Go to Cart';
  };
  addToCart.addEventListener('click', onAddClick);

  addToWishlist.addEventListener('click', () => {
    if (window.ZYLO?.addToWishlist) {
      window.ZYLO.addToWishlist(current.id);
    } else {
      alert(`${current.name} saved to wishlist.`);
    }
  });

}

// Social sharing functions
function shareOnWhatsApp() {
  const url = encodeURIComponent(window.location.href);
  const text = encodeURIComponent(`Check out this amazing product: ${document.getElementById('title').textContent}`);
  window.open(`https://wa.me/?text=${text}%20${url}`, '_blank');
}

function shareOnFacebook() {
  const url = encodeURIComponent(window.location.href);
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
}

function shareOnTwitter() {
  const url = encodeURIComponent(window.location.href);
  const text = encodeURIComponent(`Check out this amazing product: ${document.getElementById('title').textContent}`);
  window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
}

function shareOnInstagram() {
  // Instagram doesn't have direct web sharing, so copy link to clipboard
  navigator.clipboard.writeText(window.location.href).then(() => {
    alert('Product link copied to clipboard! You can now paste it in your Instagram post or story.');
  }).catch(() => {
    alert('Please copy this link to share on Instagram: ' + window.location.href);
  });
}

// Pincode checker function
function checkDelivery(pincode) {
  const resultDiv = document.getElementById('pincode-result');
  
  if (!pincode || pincode.length !== 6 || !/^\d{6}$/.test(pincode)) {
    showPincodeResult('Please enter a valid 6-digit pincode', 'error');
    return;
  }

  // Simulate API call with setTimeout
  resultDiv.classList.add('hidden');
  document.getElementById('check-pincode').textContent = 'Checking...';
  
  setTimeout(() => {
    document.getElementById('check-pincode').textContent = 'Check';
    
    // Mock delivery check - you can replace this with actual API call
    const deliveryAvailable = Math.random() > 0.3; // 70% chance of delivery available
    
    if (deliveryAvailable) {
      showPincodeResult(`✅ Delivery available to ${pincode}. Expected delivery in 3-5 business days.`, 'success');
    } else {
      showPincodeResult(`❌ Sorry, delivery not available to ${pincode} at the moment.`, 'error');
    }
  }, 1000);
}

function showPincodeResult(message, type) {
  const resultDiv = document.getElementById('pincode-result');
  resultDiv.textContent = message;
  resultDiv.className = `pincode-result ${type}`;
  resultDiv.classList.remove('hidden');
}

// Product details renderer
function renderProductDetails(p) {
  const materialCare = document.getElementById('material-care');
  const countryOrigin = document.getElementById('country-origin');
  const manufacturer = document.getElementById('manufacturer');
  const seller = document.getElementById('seller');
  
  if (materialCare) {
    let material = '100% Cotton';
    if (p.category === 'jeans') material = '98% Cotton, 2% Elastane';
    else if (p.category === 'sweaters') material = '70% Wool, 30% Acrylic';
    else if (p.category === 'jackets') material = '100% Polyester';
    
    materialCare.textContent = `${material}. Machine wash cold, tumble dry low.`;
  }
  
  if (countryOrigin) countryOrigin.textContent = 'India';
  if (manufacturer) manufacturer.textContent = 'Zylo Textiles Pvt. Ltd.';
  if (seller) seller.textContent = 'Zylo Ecommerce';
}

// Product description renderer
function renderProductDescription(p) {
  const descElement = document.getElementById('product-description');
  if (!descElement) return;
  
  let description = `This ${p.name.toLowerCase()} by ${p.brand} combines comfort and style, perfect for both casual and semi-formal occasions.`;
  
  // Add category-specific descriptions
  if (p.category === 'shirts') {
    description += ' Made from premium cotton fabric with a comfortable fit that moves with you. The versatile design makes it perfect for office wear or weekend outings.';
  } else if (p.category === 'jeans') {
    description += ' Crafted from high-quality denim with just the right amount of stretch for comfort. Features classic five-pocket styling and a flattering fit.';
  } else if (p.category === 'sweaters') {
    description += ' Soft, warm knit perfect for cooler weather. The classic design pairs well with jeans or dress pants for a polished look.';
  } else if (p.category === 'jackets') {
    description += ' Versatile outer layer that adds style to any outfit. Lightweight yet durable construction with practical pockets.';
  } else {
    description += ' Made from premium quality fabric with attention to detail in every stitch.';
  }
  
  descElement.textContent = description;
}

async function initProductPage() {
  try {
    const id = getParamId();
    if (!id) {
      console.error('No product ID provided');
      document.body.innerHTML = '<div class="error-message">Product not found. Please check the URL.</div>';
      return;
    }
    
    console.log('🔍 Looking for product with ID:', id);
    
    // Show loading indicator
    const mainContent = document.querySelector('#product-detail');
    if (mainContent) {
      mainContent.style.opacity = '0.5';
    }
    
    // Try multiple approaches to ensure products are loaded
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max wait
    
    while (!window.PRODUCTS_LOADED && attempts < maxAttempts) {
      if (typeof window.ensureProductsLoaded === 'function') {
        try {
          await window.ensureProductsLoaded();
        } catch (e) {
          console.warn('Error calling ensureProductsLoaded:', e);
        }
      }
      
      if (!window.PRODUCTS_LOADED) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
    }
    
    if (mainContent) {
      mainContent.style.opacity = '1';
    }
    
    console.log('📦 Products loaded:', window.PRODUCTS?.length || 0);
    console.log('🔍 Available product IDs:', (window.PRODUCTS || []).map(p => p.id).slice(0, 10));
    
    const product = await findProductById(id);
    if (!product) {
      console.error('Product not found:', id, 'Available products:', window.PRODUCTS?.length || 0);
      document.body.innerHTML = '<div class="error-message">Product not found. It may have been removed or the link is incorrect.</div>';
      return;
    }
    
    console.log('✅ Found product:', product.name);
    
    renderProduct(product);
    renderRelated(product);
    attachHandlers(product);
    
    // Update wishlist icons
    try {
      if (window.ZYLO && window.ZYLO.updateWishlistIcons) {
        window.ZYLO.updateWishlistIcons();
      }
    } catch (e) {
      console.warn('Failed to update wishlist icons:', e);
    }
  } catch (error) {
    console.error('Failed to initialize product page:', error);
    document.body.innerHTML = '<div class="error-message">Failed to load product. Please try refreshing the page.</div>';
  }
}

// Initialize when DOM is ready and API is available
document.addEventListener('DOMContentLoaded', () => {
  if (typeof API !== 'undefined') {
    initProductPage();
  } else {
    // Wait a bit more for API to load
    setTimeout(() => {
      if (typeof API !== 'undefined') {
        initProductPage();
      } else {
        console.error('API not available, cannot load product');
        document.body.innerHTML = '<div class="error-message">Failed to load API. Please refresh the page.</div>';
      }
    }, 1000);
  }
});

// Also listen for the products loaded event
window.addEventListener('productsLoaded', () => {
  console.log('📦 Products loaded event received');
});
 
// Make social sharing functions global
window.shareOnWhatsApp = shareOnWhatsApp;
window.shareOnFacebook = shareOnFacebook;
window.shareOnTwitter = shareOnTwitter;
window.shareOnInstagram = shareOnInstagram;

// Public API additions
window.checkPincode = checkDelivery;
window.showPincodeResult = showPincodeResult;
window.addCurrentToCart = async function(){
  const id = getParamId();
  const p = await findProductById(id);
  if (!p) return;
  const chosen = document.querySelector('input[name="size"]:checked');
  const size = chosen ? chosen.value : (p.sizes && p.sizes[0]) || 'M';
  const qtyInput = document.getElementById('qty-input');
  const qty = qtyInput ? Math.max(1, parseInt(qtyInput.value, 10) || 1) : 1;
  if (window.ZYLO?.addToCart) {
    window.ZYLO.addToCart(p.id, size, qty);
  } else {
    alert(`${p.name} x${qty} (${size}) added to cart.`);
  }
};
window.addCurrentToWishlist = async function(){
  const id = getParamId();
  const p = await findProductById(id);
  if (!p) return;
  if (window.ZYLO?.addToWishlist) {
    window.ZYLO.addToWishlist(p.id);
  } else {
    alert(`${p.name} saved to wishlist.`);
  }
};

