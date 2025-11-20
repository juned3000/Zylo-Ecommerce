// Account dashboard with backend integration and all fixes
(function() {
  // Check authentication status
  function isAuthenticated() {
    return window.API && window.API.isAuthenticated();
  }

  // Get user data from API
  async function getUserData() {
    try {
      const response = await API.endpoints.users.getProfile();
      if (response.success) {
        return response.user;
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error);
    }
    return null;
  }

  // Initialize profile header
  async function initializeProfileHeader() {
    const user = await getUserData();
    if (!user) return;

    const nameEl = document.getElementById('user-name');
    const emailEl = document.getElementById('user-email');
    const phoneEl = document.getElementById('user-phone');
    const avatarEl = document.getElementById('account-avatar');

    // Use firstName and lastName for display name
    const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User';
    
    if (nameEl) nameEl.textContent = displayName;
    if (emailEl) emailEl.textContent = user.email || '';
    if (phoneEl) phoneEl.textContent = user.phone || 'Not provided';
    if (avatarEl) {
      const initials = getInitials(displayName || user.email);
      avatarEl.textContent = initials;
    }
  }

  function getInitials(name) {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    const ini = (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
    return ini.toUpperCase() || 'U';
  }

  // Section state management
  function getSectionFromURL() {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab) return tab;
    try {
      return sessionStorage.getItem('zylo_account_tab') || 'overview';
    } catch {
      return 'overview';
    }
  }

  function setActiveSection(section) {
    console.log('Setting active section:', section);
    
    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(btn => {
      const s = btn.getAttribute('data-section');
      if (s) btn.classList.toggle('active', s === section);
    });

    // Handle logout
    if (section === 'logout') {
      handleLogout();
      return;
    }

    // Save current section
    try {
      sessionStorage.setItem('zylo_account_tab', section);
    } catch {}

    // Render section content
    renderSection(section);
  }

  function handleLogout() {
    if (window.ZYLO && typeof window.ZYLO.showLogoutModal === 'function') {
      window.ZYLO.showLogoutModal();
    } else if (confirm('Are you sure you want to log out?')) {
      API.clearToken();
      window.location.href = 'login.html';
    }
  }

  // Get or create section root element
  function ensureSectionRoot() {
    const content = document.querySelector('.account-content');
    if (!content) return null;
    
    let root = document.getElementById('section-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'section-root';
      root.style.minHeight = '200px';
      content.appendChild(root);
    }
    return root;
  }

  // Main section renderer
  function renderSection(section) {
    const root = ensureSectionRoot();
    if (!root) return;

    const tiles = document.querySelector('.tiles-grid');
    const profileCard = document.querySelector('.profile-card');

    if (section === 'overview') {
      if (tiles) tiles.style.display = '';
      if (profileCard) profileCard.style.display = '';
      root.innerHTML = '';
      return;
    }

    // Hide overview elements for other sections
    if (tiles) tiles.style.display = 'none';
    if (profileCard) profileCard.style.display = 'none';

    switch(section) {
      case 'orders':
        renderOrders(root);
        break;
      case 'payments':
        renderPayments(root);
        break;
      case 'wallet':
        renderWallet(root);
        break;
      case 'addresses':
        renderAddresses(root);
        break;
      case 'profile':
        renderProfile(root);
        break;
      default:
        renderOverview(root);
    }
  }

  // Render Orders Section
  async function renderOrders(root) {
    try {
      root.innerHTML = '<div style="text-align: center; padding: 40px;"><i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #10b981;"></i><p>Loading orders...</p></div>';
      
      const response = await API.endpoints.orders.getMy();
      if (!response.success) {
        throw new Error(response.message || 'Failed to load orders');
      }

      const orders = response.orders || [];
      
      if (!orders.length) {
        root.innerHTML = `
          <div class="empty-card">
            <div class="icon"><i class="fas fa-box-open"></i></div>
            <h3>No orders placed</h3>
            <p>When you place orders, they will appear here.</p>
            <a class="btn cta" href="shop.html">Start Shopping</a>
          </div>`;
        return;
      }

      root.innerHTML = `
        <div class="orders-section">
          <div class="orders-header">
            <div class="header-content">
              <h2 class="section-title">
                <i class="fas fa-box"></i>
                <span>My Orders</span>
              </h2>
              <p class="section-subtitle">Track and manage your order history</p>
            </div>
            <div class="orders-stats">
              <div class="stat-item">
                <span class="stat-number">${orders.length}</span>
                <span class="stat-label">Total Orders</span>
              </div>
            </div>
          </div>
          <div class="orders-list">
            ${orders.map(order => createOrderCard(order)).join('')}
          </div>
        </div>
      `;

      // Add event listeners for order expansion
      root.querySelectorAll('.order-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const section = root.querySelector(`.order-items-section[data-id="${id}"]`);
          const toggleIcon = btn.querySelector('.toggle-icon');
          const buttonText = btn.querySelector('span');
          
          section?.classList.toggle('expanded');
          toggleIcon?.classList.toggle('rotated');
          
          if (section?.classList.contains('expanded')) {
            buttonText.textContent = 'Hide Items';
          } else {
            buttonText.textContent = 'View Items';
          }
        });
      });

      // Add event listeners for review buttons
      root.querySelectorAll('.write-review-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const productId = btn.getAttribute('data-product-id');
          const productName = btn.getAttribute('data-product-name');
          const productImage = btn.getAttribute('data-product-image');
          const orderId = btn.getAttribute('data-order-id');
          const isEdit = btn.classList.contains('edit-review');
          const existingReview = btn.hasAttribute('data-review-id') ? {
            id: btn.getAttribute('data-review-id'),
            rating: parseInt(btn.getAttribute('data-rating')) || 5,
            title: btn.getAttribute('data-title') || '',
            comment: btn.getAttribute('data-comment') || ''
          } : null;
          
          showReviewModal({
            productId,
            productName,
            productImage,
            orderId,
            isEdit,
            existingReview
          });
        });
      });

      // Check existing reviews and update button states
      checkExistingReviews(root, orders);
    } catch (error) {
      console.error('Error loading orders:', error);
      root.innerHTML = `
        <div class="empty-card">
          <div class="icon"><i class="fas fa-exclamation-circle"></i></div>
          <h3>Failed to load orders</h3>
          <p>${error.message}</p>
          <button class="btn cta" onclick="location.reload()">Retry</button>
        </div>
      `;
    }
  }

  // Review Modal Functions
  function showReviewModal({ productId, productName, productImage, orderId, isEdit = false, existingReview = null }) {
    // Remove existing modal if any
    const existingModal = document.getElementById('review-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'review-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    `;

    modal.innerHTML = createReviewModalHTML({
      productId,
      productName,
      productImage,
      orderId,
      isEdit,
      existingReview
    });

    document.body.appendChild(modal);
    setupReviewModalEventListeners(modal, { productId, productName, orderId, isEdit, existingReview });
    
    // Focus on rating stars
    const firstStar = modal.querySelector('.rating-star[data-rating="5"]');
    if (firstStar) firstStar.focus();
  }

  function createReviewModalHTML({ productId, productName, productImage, orderId, isEdit, existingReview }) {
    const rating = existingReview?.rating || 0;
    const title = existingReview?.title || '';
    const comment = existingReview?.comment || '';
    
    return `
      <div class="modal-dialog" style="background:white;border-radius:12px;padding:24px;max-width:500px;width:100%;max-height:90vh;overflow-y:auto;">
        <div class="modal-header" style="margin-bottom:20px;">
          <h4 style="margin:0;display:flex;align-items:center;gap:12px;">
            <i class="fas fa-star" style="color:#facc15;"></i>
            ${isEdit ? 'Edit Review' : 'Write a Review'}
          </h4>
          <button type="button" class="review-modal-close" style="position:absolute;top:16px;right:16px;background:none;border:none;font-size:24px;cursor:pointer;color:#6b7280;">&times;</button>
        </div>
        
        <div class="modal-body">
          <!-- Product Info -->
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;padding:12px;background:#f9fafb;border-radius:8px;">
            ${productImage ? `<img src="${productImage}" alt="${productName}" style="width:50px;height:50px;border-radius:6px;object-fit:cover;">` : '<div style="width:50px;height:50px;background:#e5e7eb;border-radius:6px;display:flex;align-items:center;justify-content:center;"><i class="fas fa-image" style="color:#6b7280;"></i></div>'}
            <div>
              <div style="font-weight:600;margin-bottom:2px;">${productName}</div>
              <div style="color:#6b7280;font-size:14px;">Order #${orderId.slice(-8).toUpperCase()}</div>
            </div>
          </div>
          
          <!-- Rating -->
          <div style="margin-bottom:20px;">
            <label style="display:block;margin-bottom:8px;font-weight:600;">Rating *</label>
            <div class="rating-container" style="display:flex;gap:4px;margin-bottom:8px;">
              ${[5, 4, 3, 2, 1].map(num => `
                <button type="button" class="rating-star" data-rating="${num}" 
                        style="background:none;border:none;font-size:24px;cursor:pointer;color:${num <= rating ? '#facc15' : '#e5e7eb'};">
                  <i class="fas fa-star"></i>
                </button>
              `).join('')}
            </div>
            <div class="rating-text" style="color:#6b7280;font-size:14px;">Click stars to rate (5 = Excellent, 1 = Poor)</div>
          </div>
          
          <!-- Review Title -->
          <div style="margin-bottom:20px;">
            <label for="review-title" style="display:block;margin-bottom:8px;font-weight:600;">Review Title *</label>
            <input type="text" id="review-title" value="${title}" placeholder="Summarize your experience..." 
                   style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;" maxlength="100" />
            <div style="color:#6b7280;font-size:12px;margin-top:4px;">Maximum 100 characters</div>
          </div>
          
          <!-- Review Comment -->
          <div style="margin-bottom:20px;">
            <label for="review-comment" style="display:block;margin-bottom:8px;font-weight:600;">Your Review *</label>
            <textarea id="review-comment" placeholder="Share your detailed experience with this product..." 
                      style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;resize:vertical;height:100px;" 
                      maxlength="1000">${comment}</textarea>
            <div style="color:#6b7280;font-size:12px;margin-top:4px;">Minimum 10 characters, Maximum 1000 characters</div>
          </div>
          
          <!-- Image Upload (Optional) -->
          <div style="margin-bottom:20px;">
            <label style="display:block;margin-bottom:8px;font-weight:600;">Add Photos (Optional)</label>
            <input type="file" id="review-images" multiple accept="image/*" 
                   style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:8px;" />
            <div style="color:#6b7280;font-size:12px;margin-top:4px;">You can upload up to 5 images (JPG, PNG)</div>
          </div>
        </div>
        
        <div class="modal-footer" style="display:flex;gap:12px;margin-top:20px;">
          <button type="button" class="review-cancel-btn" style="flex:1;padding:12px;border:1px solid #e5e7eb;background:white;color:#6b7280;border-radius:8px;font-weight:600;cursor:pointer;">Cancel</button>
          <button type="button" class="review-submit-btn" disabled style="flex:1;padding:12px;background:#10b981;color:white;border:none;border-radius:8px;font-weight:600;cursor:not-allowed;">
            ${isEdit ? 'Update Review' : 'Submit Review'}
          </button>
        </div>
      </div>
    `;
  }

  function setupReviewModalEventListeners(modal, { productId, productName, orderId, isEdit, existingReview }) {
    const ratingStars = modal.querySelectorAll('.rating-star');
    const titleInput = modal.querySelector('#review-title');
    const commentTextarea = modal.querySelector('#review-comment');
    const submitBtn = modal.querySelector('.review-submit-btn');
    const cancelBtn = modal.querySelector('.review-cancel-btn');
    const closeBtn = modal.querySelector('.review-modal-close');
    
    let selectedRating = existingReview?.rating || 0;
    
    // Close modal function
    const closeModal = () => {
      modal.remove();
    };
    
    // Close modal events
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    
    // Rating stars
    ratingStars.forEach(star => {
      star.addEventListener('click', () => {
        selectedRating = parseInt(star.getAttribute('data-rating'));
        updateRatingDisplay();
        validateForm();
      });
      
      star.addEventListener('mouseenter', () => {
        const hoverRating = parseInt(star.getAttribute('data-rating'));
        highlightStars(hoverRating);
      });
    });
    
    modal.querySelector('.rating-container')?.addEventListener('mouseleave', () => {
      highlightStars(selectedRating);
    });
    
    function highlightStars(rating) {
      ratingStars.forEach(star => {
        const starRating = parseInt(star.getAttribute('data-rating'));
        star.style.color = starRating <= rating ? '#facc15' : '#e5e7eb';
      });
    }
    
    function updateRatingDisplay() {
      highlightStars(selectedRating);
      const ratingTexts = {
        5: 'Excellent',
        4: 'Very Good',
        3: 'Good',
        2: 'Fair',
        1: 'Poor'
      };
      const ratingText = modal.querySelector('.rating-text');
      if (ratingText && selectedRating > 0) {
        ratingText.textContent = `${ratingTexts[selectedRating]} (${selectedRating} star${selectedRating > 1 ? 's' : ''})`;
      }
    }
    
    // Form validation
    function validateForm() {
      const title = titleInput?.value.trim() || '';
      const comment = commentTextarea?.value.trim() || '';
      const isValid = selectedRating > 0 && title.length > 0 && comment.length >= 10;
      
      if (submitBtn) {
        submitBtn.disabled = !isValid;
        submitBtn.style.cursor = isValid ? 'pointer' : 'not-allowed';
        submitBtn.style.background = isValid ? '#10b981' : '#9ca3af';
      }
    }
    
    // Input validation
    titleInput?.addEventListener('input', validateForm);
    commentTextarea?.addEventListener('input', validateForm);
    
    // Submit review
    submitBtn?.addEventListener('click', async () => {
      if (submitBtn.disabled) return;
      
      const title = titleInput?.value.trim();
      const comment = commentTextarea?.value.trim();
      const images = modal.querySelector('#review-images')?.files;
      
      try {
        submitBtn.disabled = true;
        submitBtn.textContent = isEdit ? 'Updating...' : 'Submitting...';
        
        const reviewData = {
          productId,
          orderId,
          rating: selectedRating,
          title,
          comment,
          images: [] // TODO: Handle image upload if needed
        };
        
        console.log('Submitting review with data:', reviewData);
        console.log('User authenticated:', API.isAuthenticated());
        console.log('Auth token exists:', !!API.getToken());
        
        const response = isEdit 
          ? await API.endpoints.reviews.update(existingReview.id, reviewData)
          : await API.endpoints.reviews.submit(reviewData);
        
        console.log('Review submission response:', response);
        
        if (response.success) {
          window.API?.showSuccess?.(response.message || (isEdit ? 'Review updated successfully!' : 'Review submitted successfully!'));
          closeModal();
          // Refresh the orders section to update button states
          const root = document.getElementById('section-root');
          if (root) renderOrders(root);
        } else {
          throw new Error(response.message || 'Failed to submit review');
        }
      } catch (error) {
        console.error('❌ Error submitting review:', error);
        console.error('📄 Review data:', { productId, orderId, rating: selectedRating, title, comment });
        console.error('🔍 Error type:', error.name);
        console.error('🔍 Error message:', error.message);
        console.error('🔍 Full error stack:', error.stack);
        
        // Check if it's a network error
        if (error.message.includes('Connection failed')) {
          window.API?.showError?.('Connection failed - please check if the server is running on port 5000');
        } else if (error.message.includes('401')) {
          window.API?.showError?.('Authentication failed - please login again');
        } else if (error.message.includes('400')) {
          window.API?.showError?.('Invalid data - please check your input and try again');
        } else {
          window.API?.showError?.('Failed to submit review: ' + error.message);
        }
        
        submitBtn.disabled = false;
        submitBtn.textContent = isEdit ? 'Update Review' : 'Submit Review';
      }
    });
    
    // Initialize form state
    updateRatingDisplay();
    validateForm();
  }

  // Check existing reviews and update button states
  async function checkExistingReviews(root, orders) {
    try {
      // Get user's reviews
      const response = await API.endpoints.reviews.getMyReviews();
      if (!response.success) return;
      
      const userReviews = response.reviews || [];
      
      // Create a map of productId-orderId to review for quick lookup
      const reviewMap = new Map();
      userReviews.forEach(review => {
        const key = `${review.productId}-${review.orderId}`;
        reviewMap.set(key, review);
      });
      
      // Update each review button
      orders.forEach(order => {
        if (order.items) {
          order.items.forEach(item => {
            const key = `${item.id}-${order.id || order._id}`;
            const review = reviewMap.get(key);
            const containerId = `review-${item.id}-${order.id || order._id}`;
            const container = root.querySelector(`#${containerId}`);
            
            if (container && review) {
              // User has already reviewed this product
              updateReviewButtonState(container, item, order.id || order._id, review);
            }
          });
        }
      });
    } catch (error) {
      console.error('Error checking existing reviews:', error);
      // Don't show error to user, just continue with default state
    }
  }
  
  function updateReviewButtonState(container, item, orderId, review) {
    const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
    const reviewDate = new Date(review.createdAt).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    
    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:4px;">
          <span style="color:#facc15;font-size:14px;">${stars}</span>
          <span style="color:#6b7280;font-size:12px;">(${reviewDate})</span>
        </div>
        <div style="display:flex;gap:4px;">
          <button class="write-review-btn edit-review" 
                  data-product-id="${item.id}" 
                  data-product-name="${item.name}" 
                  data-product-image="${item.image || ''}" 
                  data-order-id="${orderId}"
                  data-review-id="${review.id}"
                  data-rating="${review.rating}"
                  data-title="${review.title}"
                  data-comment="${review.comment}"
                  style="background:#3b82f6;color:white;border:none;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;cursor:pointer;">
            <i class="fas fa-edit" style="margin-right:2px;"></i>Edit
          </button>
          <button class="view-review-btn" 
                  data-review-id="${review.id}"
                  data-product-name="${item.name}"
                  data-rating="${review.rating}"
                  data-title="${review.title}"
                  data-comment="${review.comment}"
                  style="background:#6b7280;color:white;border:none;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;cursor:pointer;">
            <i class="fas fa-eye" style="margin-right:2px;"></i>View
          </button>
        </div>
      </div>
      <div style="margin-top:4px;color:#374151;font-size:12px;font-weight:500;">
        "${review.title}"
      </div>
      ${!review.isApproved ? '<div style="color:#f59e0b;font-size:11px;margin-top:2px;"><i class="fas fa-clock"></i> Pending approval</div>' : ''}
    `;
    
    // Re-add event listeners for the new buttons
    const editBtn = container.querySelector('.edit-review');
    const viewBtn = container.querySelector('.view-review-btn');
    
    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showReviewModal({
          productId: item.id,
          productName: item.name,
          productImage: item.image,
          orderId: orderId,
          isEdit: true,
          existingReview: {
            id: review.id,
            rating: review.rating,
            title: review.title,
            comment: review.comment
          }
        });
      });
    }
    
    if (viewBtn) {
      viewBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showReviewViewModal({
          productName: item.name,
          review: review
        });
      });
    }
  }
  
  // Show review in view-only modal
  function showReviewViewModal({ productName, review }) {
    const existingModal = document.getElementById('review-view-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'review-view-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    `;

    const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
    const reviewDate = new Date(review.createdAt).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    modal.innerHTML = `
      <div class="modal-dialog" style="background:white;border-radius:12px;padding:24px;max-width:500px;width:100%;max-height:90vh;overflow-y:auto;">
        <div class="modal-header" style="margin-bottom:20px;position:relative;">
          <h4 style="margin:0;display:flex;align-items:center;gap:12px;">
            <i class="fas fa-star" style="color:#facc15;"></i>
            Your Review
          </h4>
          <button type="button" class="review-view-close" style="position:absolute;top:0;right:0;background:none;border:none;font-size:24px;cursor:pointer;color:#6b7280;">&times;</button>
        </div>
        
        <div class="modal-body">
          <div style="margin-bottom:20px;padding:12px;background:#f9fafb;border-radius:8px;">
            <div style="font-weight:600;margin-bottom:4px;">${productName}</div>
            <div style="color:#6b7280;font-size:14px;">Reviewed on ${reviewDate}</div>
          </div>
          
          <div style="margin-bottom:16px;">
            <div style="color:#facc15;font-size:20px;margin-bottom:4px;">${stars}</div>
            <div style="color:#6b7280;font-size:14px;">${review.rating} out of 5 stars</div>
          </div>
          
          <div style="margin-bottom:16px;">
            <h5 style="margin:0 0 8px 0;font-weight:600;">${review.title}</h5>
          </div>
          
          <div style="margin-bottom:16px;">
            <div style="background:#f9fafb;padding:12px;border-radius:8px;line-height:1.5;color:#374151;">
              ${review.comment}
            </div>
          </div>
          
          ${!review.isApproved ? `
            <div style="background:#fef3c7;border:1px solid #f59e0b;color:#92400e;padding:12px;border-radius:8px;font-size:14px;">
              <i class="fas fa-clock" style="margin-right:8px;"></i>
              Your review is pending approval and will be visible to other customers once approved.
            </div>
          ` : `
            <div style="background:#dcfce7;border:1px solid #16a34a;color:#15803d;padding:12px;border-radius:8px;font-size:14px;">
              <i class="fas fa-check-circle" style="margin-right:8px;"></i>
              Your review is live and visible to other customers.
            </div>
          `}
        </div>
        
        <div class="modal-footer" style="display:flex;justify-content:center;margin-top:20px;">
          <button type="button" class="review-view-close" style="padding:12px 24px;border:1px solid #e5e7eb;background:white;color:#374151;border-radius:8px;font-weight:600;cursor:pointer;">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    
    // Close modal events
    const closeModal = () => modal.remove();
    modal.querySelectorAll('.review-view-close').forEach(btn => {
      btn.addEventListener('click', closeModal);
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  function createOrderCard(order) {
    const formatPrice = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-IN');
    const date = new Date(order.createdAt).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    const status = (order.orderStatus || 'pending').replace(/_/g, ' ');
    const statusClass = {
      pending_payment: 'status-pending',
      pending: 'status-pending',
      confirmed: 'status-confirmed',
      processing: 'status-processing',
      packed: 'status-processing',
      shipped: 'status-shipped',
      delivered: 'status-delivered',
      cancelled: 'status-cancelled'
    }[order.orderStatus] || 'status-pending';

    const displayOrderId = (order.id && String(order.id).toUpperCase()) || (order._id ? String(order._id).slice(-8).toUpperCase() : 'UNKNOWN');
    return `
      <div class="modern-order-card">
        <div class="order-card-header">
          <div class="order-info">
            <div class="order-number">Order #${displayOrderId}</div>
            <div class="order-date">${date}</div>
          </div>
          <div class="order-summary">
            <div class="order-total">${formatPrice(order.totals?.total)}</div>
            <div class="order-status ${statusClass}">${status.toUpperCase()}</div>
          </div>
        </div>
        
        <div class="order-actions">
          <button class="order-toggle-btn" data-id="${order._id}">
            <i class="fas fa-box"></i>
            <span>View Items</span>
            <i class="fas fa-chevron-down toggle-icon"></i>
          </button>
        </div>
        
        <div class="order-items-section" data-id="${order._id}">
          <div class="order-items-content">
            ${createOrderItemsTable(order.items || [], order.id || order._id, order.orderStatus)}
            ${order.shippingAddress ? `
              <div class="delivery-address">
                <div class="address-label">
                  <i class="fas fa-map-marker-alt"></i>
                  <span>Delivery Address</span>
                </div>
                <div class="address-details">${formatAddress(order.shippingAddress)}</div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  function createOrderItemsTable(items, orderId, orderStatus) {
    if (!items.length) return '<div class="no-items">No items found</div>';
    
    return `
      <div class="order-items-list">
        ${items.map(item => `
          <div class="order-item">
            <div class="item-image">
              ${item.image ? `<img src="${item.image}" alt="${item.name}" />` : '<div class="item-placeholder"><i class="fas fa-image"></i></div>'}
            </div>
            <div class="item-details">
              <div class="item-name">${item.name}</div>
              <div class="item-specs">
                ${item.brand ? `<span class="item-brand">${item.brand}</span>` : ''}
                <span class="item-size">Size ${item.size}</span>
                <span class="item-quantity">Qty ${item.quantity}</span>
              </div>
              <div class="item-review">
                ${createReviewButton(item, orderId, orderStatus)}
              </div>
            </div>
            <div class="item-price">
              <div class="price-amount">Rs. ${(item.price * item.quantity).toLocaleString('en-IN')}</div>
              <div class="price-per-item">Rs. ${item.price.toLocaleString('en-IN')} each</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function createReviewButton(item, orderId, orderStatus) {
    // Only show review option for delivered orders
    if (orderStatus !== 'delivered') {
      return '<span style="color:#6b7280;font-size:12px;">Review available after delivery</span>';
    }
    
    // Check if review exists for this item (will be populated asynchronously)
    const reviewCheckId = `review-${item.id}-${orderId}`;
    
    return `
      <div id="${reviewCheckId}" class="review-button-container">
        <button class="write-review-btn" 
                data-product-id="${item.id}" 
                data-product-name="${item.name}" 
                data-product-image="${item.image || ''}" 
                data-order-id="${orderId}"
                style="background:#10b981;color:white;border:none;padding:4px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">
          <i class="fas fa-star" style="margin-right:4px;"></i>Write Review
        </button>
      </div>
    `;
  }

  function formatAddress(addr) {
    if (!addr) {
      return 'Address not provided';
    }
    
    // Priority 1: Use detailed address fields if available (new format)
    if (addr.firstName || addr.lastName || addr.line) {
      const name = `${addr.firstName || ''} ${addr.lastName || ''}`.trim();
      const addressLines = [];
      
      if (addr.line) addressLines.push(addr.line);
      if (addr.area) addressLines.push(addr.area);
      if (addr.landmark) addressLines.push(`Near ${addr.landmark}`);
      if (addr.city && addr.state && addr.zip) {
        addressLines.push(`${addr.city}, ${addr.state} - ${addr.zip}`);
      }
      if (addr.phone) addressLines.push(`Phone: ${addr.phone}`);
      
      return `${name ? `<strong>${name}</strong><br>` : ''}${addressLines.join('<br>')}`;
    }
    
    // Priority 2: Use formatted address text (legacy format)
    if (addr.name && addr.addressText) {
      return `<strong>${addr.name}</strong><br>${addr.addressText.replace(/\n/g, '<br>')}`;
    }
    
    // Priority 3: Use name only if that's all we have
    if (addr.name) {
      return `<strong>${addr.name}</strong><br>Address details not available`;
    }
    
    return 'Address not available';
  }

  // Render Payments Section - FIXED
  async function renderPayments(root) {
    try {
      root.innerHTML = '<div style="text-align: center; padding: 40px;"><i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #10b981;"></i><p>Loading payment methods...</p></div>';
      
      const response = await API.endpoints.payments.get();
      if (!response.success) {
        throw new Error(response.message || 'Failed to load payment methods');
      }

      const methods = response.paymentMethods || [];
      const cards = methods.filter(m => m.type === 'card');
      const upiMethods = methods.filter(m => m.type === 'upi');
      
      root.innerHTML = `
        <div class="payments-section">
          <h3>Payment Methods</h3>
          
          <!-- Cards Section -->
          <div class="payment-category" style="margin-bottom:32px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
              <h4 style="margin:0;">Debit & Credit Cards</h4>
              <button class="btn-add" id="add-card-btn" style="background:#10b981;color:white;border:none;padding:8px 16px;border-radius:8px;font-weight:600;cursor:pointer;">
                <i class="fas fa-plus"></i> Add Card
              </button>
            </div>
            <div class="cards-list">
              ${cards.length ? cards.map(card => createPaymentCard(card)).join('') : '<p style="color:#6b7280;">No cards saved</p>'}
            </div>
          </div>

          <!-- UPI Section -->
          <div class="payment-category">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
              <h4 style="margin:0;">UPI</h4>
              <button class="btn-add" id="add-upi-btn" style="background:#10b981;color:white;border:none;padding:8px 16px;border-radius:8px;font-weight:600;cursor:pointer;">
                <i class="fas fa-plus"></i> Add UPI
              </button>
            </div>
            <div class="upi-list">
              ${upiMethods.length ? upiMethods.map(upi => createUPICard(upi)).join('') : '<p style="color:#6b7280;">No UPI IDs saved</p>'}
            </div>
          </div>
        </div>

        <!-- Add UPI Modal -->
        <div class="modal" id="upi-modal" style="display:none;">
          <div class="modal-backdrop" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:999;"></div>
          <div class="modal-dialog" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;border-radius:12px;padding:24px;max-width:400px;width:90%;z-index:1000;">
            <div class="modal-header" style="margin-bottom:20px;">
              <h4 style="margin:0;">Add UPI ID</h4>
              <button type="button" class="modal-close" id="upi-close" style="position:absolute;top:16px;right:16px;background:none;border:none;font-size:24px;cursor:pointer;">&times;</button>
            </div>
            <div class="modal-body">
              <label style="display:block;margin-bottom:16px;">
                <span style="display:block;margin-bottom:8px;font-weight:600;">Enter UPI ID</span>
                <input type="text" id="upi-input" placeholder="yourname@bankname" style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;" />
              </label>
              <div style="color:#6b7280;font-size:14px;">UPI ID is in the format of yourname@bankname</div>
            </div>
            <div class="modal-footer" style="display:flex;gap:12px;margin-top:20px;">
              <button type="button" id="upi-cancel" style="flex:1;padding:10px;border:1px solid #e5e7eb;background:white;color:black;border-radius:8px;font-weight:600;">Cancel</button>
              <button type="button" id="upi-save" disabled style="flex:1;padding:10px;background:#10b981;color:white;border:none;border-radius:8px;font-weight:600;cursor:not-allowed;">Save</button>
            </div>
          </div>
        </div>

        <!-- Remove Payment Confirmation Modal -->
        <div class="modal" id="remove-payment-modal" style="display:none;">
          <div class="modal-backdrop" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:999;"></div>
          <div class="modal-dialog" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;border-radius:12px;padding:24px;max-width:400px;width:90%;z-index:1000;">
            <div class="modal-header" style="margin-bottom:20px;">
              <h4 style="margin:0;color:#ef4444;"><i class="fas fa-exclamation-triangle" style="margin-right:8px;"></i>Remove Payment Method</h4>
              <button type="button" class="modal-close" id="remove-payment-close" style="position:absolute;top:16px;right:16px;background:none;border:none;font-size:24px;cursor:pointer;">&times;</button>
            </div>
            <div class="modal-body">
              <p style="margin:0;color:#6b7280;line-height:1.5;">Are you sure you want to remove this payment method? This action cannot be undone.</p>
              <div id="payment-method-details" style="margin-top:16px;padding:12px;background:#f9fafb;border-radius:8px;font-weight:600;"></div>
            </div>
            <div class="modal-footer" style="display:flex;gap:12px;margin-top:20px;">
              <button type="button" id="remove-payment-cancel" style="flex:1;padding:10px;border:1px solid #e5e7eb;background:white;color:#6b7280;border-radius:8px;font-weight:600;">Cancel</button>
              <button type="button" id="remove-payment-confirm" style="flex:1;padding:10px;background:#ef4444;color:white;border:none;border-radius:8px;font-weight:600;">Remove</button>
            </div>
          </div>
        </div>
      `;

      // Setup payment method event listeners
      setupPaymentEventListeners(root);
    } catch (error) {
      console.error('Error loading payment methods:', error);
      root.innerHTML = `
        <div class="empty-card">
          <div class="icon"><i class="fas fa-exclamation-circle"></i></div>
          <h3>Failed to load payment methods</h3>
          <p>${error.message}</p>
          <button class="btn cta" onclick="location.reload()">Retry</button>
        </div>
      `;
    }
  }

  function createPaymentCard(card) {
    const cardBrand = card.brand || 'Card';
    const last4 = card.last4 || '****';
    const expiry = card.expiry || '';
    
    return `
      <div class="payment-card" style="display:flex;align-items:center;justify-content:space-between;padding:16px;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:12px;background:white;">
        <div style="display:flex;align-items:center;gap:12px;">
          <i class="fas fa-credit-card" style="font-size:20px;color:#6b7280;"></i>
          <div>
            <div style="font-weight:600;">${cardBrand} •••• ${last4}</div>
            ${expiry ? `<div style="color:#6b7280;font-size:14px;">Expires ${expiry}</div>` : ''}
          </div>
        </div>
        <button class="remove-payment" data-id="${card._id}" data-type="card" style="background:#ef4444;color:white;border:none;padding:6px 12px;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;">Remove</button>
      </div>
    `;
  }

  // FIXED: Use correct UPI properties
  function createUPICard(upi) {
    const upiId = upi.upiId || upi.displayName || 'Unknown';
    const isVerified = upi.verified || upi.isVerified || false;
    
    return `
      <div class="payment-card" style="display:flex;align-items:center;justify-content:space-between;padding:16px;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:12px;background:white;">
        <div style="display:flex;align-items:center;gap:12px;">
          <img src="../img/pay/UPI.jpg" alt="UPI" style="width:32px;height:32px;object-fit:contain;" onerror="this.style.display='none'">
          <div>
            <div style="font-weight:600;">${upiId}</div>
            ${isVerified ? '<div style="color:#10b981;font-size:14px;"><i class="fas fa-check-circle"></i> Verified</div>' : ''}
          </div>
        </div>
        <button class="remove-payment" data-id="${upi._id}" data-type="upi" style="background:#ef4444;color:white;border:none;padding:6px 12px;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;">Remove</button>
      </div>
    `;
  }

  function setupPaymentEventListeners(root) {
    const removeModal = root.querySelector('#remove-payment-modal');
    const confirmBtn = root.querySelector('#remove-payment-confirm');
    const cancelBtn = root.querySelector('#remove-payment-cancel');
    const closeBtn = root.querySelector('#remove-payment-close');
    const backdrop = removeModal?.querySelector('.modal-backdrop');
    const detailsDiv = root.querySelector('#payment-method-details');
    
    let pendingRemoval = null;
    
    // Remove payment method - Using Modal
    root.querySelectorAll('.remove-payment').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const type = btn.getAttribute('data-type');
        
        // Store the removal details
        pendingRemoval = { id, type, btn };
        
        // Get payment method details for display
        const paymentCard = btn.closest('.payment-card');
        let methodText = '';
        
        if (type === 'upi') {
          const upiText = paymentCard?.querySelector('div > div')?.textContent;
          methodText = `UPI ID: ${upiText}`;
        } else if (type === 'card') {
          const cardText = paymentCard?.querySelector('div > div')?.textContent;
          methodText = `Card: ${cardText}`;
        }
        
        // Update modal content
        if (detailsDiv) {
          detailsDiv.textContent = methodText;
        }
        
        // Show modal
        if (removeModal) {
          removeModal.style.display = 'block';
        }
      });
    });
    
    // Modal close handlers
    const closeModal = () => {
      if (removeModal) {
        removeModal.style.display = 'none';
      }
      pendingRemoval = null;
    };
    
    cancelBtn?.addEventListener('click', closeModal);
    closeBtn?.addEventListener('click', closeModal);
    backdrop?.addEventListener('click', closeModal);
    
    // Confirm removal
    confirmBtn?.addEventListener('click', async () => {
      if (!pendingRemoval) return;
      
      const { id, type, btn } = pendingRemoval;
      
      try {
        // Update button state
        btn.disabled = true;
        btn.textContent = 'Removing...';
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Removing...';
        
        const response = await API.endpoints.payments.delete(id);
        if (response.success) {
          window.API?.showSuccess?.('Payment method removed successfully');
          closeModal();
          renderPayments(root);
        } else {
          throw new Error(response.message || 'Failed to remove payment method');
        }
      } catch (error) {
        console.error('Error removing payment method:', error);
        btn.disabled = false;
        btn.textContent = 'Remove';
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Remove';
        window.API?.showError?.('Failed to remove payment method: ' + error.message);
        closeModal();
      }
    });

    // Add UPI modal handling
    const modal = root.querySelector('#upi-modal');
    const upiInput = root.querySelector('#upi-input');
    const saveBtn = root.querySelector('#upi-save');
    const upiPattern = /^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/;

    root.querySelector('#add-upi-btn')?.addEventListener('click', () => {
      modal.style.display = 'block';
      upiInput.value = '';
      saveBtn.disabled = true;
    });

    root.querySelector('#upi-close')?.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    root.querySelector('#upi-cancel')?.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    root.querySelector('.modal-backdrop')?.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    upiInput?.addEventListener('input', () => {
      const value = upiInput.value.trim();
      saveBtn.disabled = !upiPattern.test(value);
      saveBtn.style.cursor = saveBtn.disabled ? 'not-allowed' : 'pointer';
    });

    saveBtn?.addEventListener('click', async () => {
      const upiId = upiInput.value.trim();
      if (!upiPattern.test(upiId)) return;

      try {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        
        const response = await API.endpoints.payments.addUPI({ upiId });
        if (response.success) {
          window.API?.showSuccess?.('UPI ID added successfully');
          modal.style.display = 'none';
          renderPayments(root);
        }
      } catch (error) {
        window.API?.showError?.('Failed to add UPI ID');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
      }
    });

    // Add card button (placeholder for now)
    root.querySelector('#add-card-btn')?.addEventListener('click', () => {
      window.API?.showSuccess?.('Card addition feature coming soon!');
    });
  }

  // Render Wallet Section - FIXED with download button on right
  async function renderWallet(root) {
    try {
      root.innerHTML = '<div style="text-align: center; padding: 40px;"><i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #10b981;"></i><p>Loading wallet...</p></div>';
      
      const [walletResponse, transactionsResponse] = await Promise.all([
        API.endpoints.wallet.get(),
        API.endpoints.wallet.getTransactions({ limit: 10 })
      ]);

      if (!walletResponse.success) {
        throw new Error(walletResponse.message || 'Failed to load wallet');
      }

      const wallet = walletResponse.wallet;
      const transactions = transactionsResponse.transactions || [];
      const formatINR = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-IN');

      root.innerHTML = `
        <div class="wallet-section">
          <h3>My Wallet</h3>
          
          <!-- Wallet Cards -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;margin-bottom:32px;">
            <!-- Main Balance -->
            <div style="background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:24px;border-radius:16px;box-shadow:0 10px 20px rgba(0,0,0,0.1);">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
                <i class="fas fa-wallet" style="font-size:24px;"></i>
                <span style="font-weight:600;">Wallet Balance</span>
              </div>
              <div style="font-size:32px;font-weight:800;margin-bottom:16px;">${formatINR(wallet.balance)}</div>
              <button id="add-money-btn" style="background:white;color:#667eea;border:none;padding:10px 20px;border-radius:8px;font-weight:600;cursor:pointer;width:100%;">
                <i class="fas fa-plus"></i> Add Money
              </button>
            </div>

            <!-- Cashback Balance -->
            <div style="background:linear-gradient(135deg,#f093fb,#f5576c);color:white;padding:24px;border-radius:16px;box-shadow:0 10px 20px rgba(0,0,0,0.1);">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
                <i class="fas fa-gift" style="font-size:24px;"></i>
                <span style="font-weight:600;">Cashback Balance</span>
              </div>
              <div style="font-size:32px;font-weight:800;margin-bottom:16px;">${formatINR(wallet.cashbackBalance)}</div>
              <div style="font-size:14px;opacity:0.9;">Expires in 90 days</div>
            </div>

            <!-- Rewards Points -->
            <div style="background:linear-gradient(135deg,#fa709a,#fee140);color:white;padding:24px;border-radius:16px;box-shadow:0 10px 20px rgba(0,0,0,0.1);">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
                <i class="fas fa-star" style="font-size:24px;"></i>
                <span style="font-weight:600;">Rewards Points</span>
              </div>
              <div style="font-size:32px;font-weight:800;margin-bottom:16px;">${wallet.rewards?.points || 0} pts</div>
              <div style="font-size:14px;opacity:0.9;">${wallet.rewards?.level || 'Bronze'} Member</div>
            </div>
          </div>

          <!-- Recent Transactions with Download button on right -->
          <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
              <h4 style="margin:0;">Recent Transactions</h4>
              <button id="download-statement-btn" style="background:#10b981;color:white;border:none;padding:8px 16px;border-radius:8px;font-weight:600;cursor:pointer;">
                <i class="fas fa-download"></i> Download Statement
              </button>
            </div>
            
            ${transactions.length ? `
              <div class="transactions-list">
                ${transactions.map(tx => createTransactionRow(tx)).join('')}
              </div>
            ` : `
              <div style="text-align:center;padding:40px;color:#6b7280;">
                <i class="fas fa-receipt" style="font-size:48px;margin-bottom:16px;"></i>
                <p>No transactions yet</p>
              </div>
            `}
          </div>
        </div>

        <!-- Add Money Modal -->
        ${createAddMoneyModal()}
      `;

      setupWalletEventListeners(root, wallet);
    } catch (error) {
      console.error('Error loading wallet:', error);
      root.innerHTML = `
        <div class="empty-card">
          <div class="icon"><i class="fas fa-exclamation-circle"></i></div>
          <h3>Failed to load wallet</h3>
          <p>${error.message}</p>
          <button class="btn cta" onclick="location.reload()">Retry</button>
        </div>
      `;
    }
  }

  function createTransactionRow(tx) {
    const formatINR = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-IN');
    const date = new Date(tx.createdAt).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const typeConfig = {
      credit: { icon: 'fas fa-plus-circle', color: '#10b981', prefix: '+' },
      debit: { icon: 'fas fa-minus-circle', color: '#ef4444', prefix: '-' },
      cashback: { icon: 'fas fa-gift', color: '#10b981', prefix: '+' }
    };

    const config = typeConfig[tx.type] || typeConfig.credit;

    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 0;border-bottom:1px solid #f3f4f6;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:40px;height:40px;background:${config.color}20;border-radius:50%;display:flex;align-items:center;justify-content:center;">
            <i class="${config.icon}" style="color:${config.color};"></i>
          </div>
          <div>
            <div style="font-weight:600;">${tx.description || 'Transaction'}</div>
            <div style="color:#6b7280;font-size:14px;">${date}</div>
          </div>
        </div>
        <div style="font-weight:700;color:${config.color};">${config.prefix}${formatINR(tx.amount)}</div>
      </div>
    `;
  }

  function createAddMoneyModal() {
    return `
      <div class="modal" id="add-money-modal" style="display:none;">
        <div class="modal-backdrop" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:999;"></div>
        <div class="modal-dialog" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;border-radius:12px;padding:24px;max-width:500px;width:90%;z-index:1000;">
          <div class="modal-header" style="margin-bottom:20px;">
            <h4 style="margin:0;">Add Money to Wallet</h4>
            <button type="button" class="modal-close" id="add-money-close" style="position:absolute;top:16px;right:16px;background:none;border:none;font-size:24px;cursor:pointer;">&times;</button>
          </div>
          <div class="modal-body">
            <label style="display:block;margin-bottom:16px;">
              <span style="display:block;margin-bottom:8px;font-weight:600;">Select Amount</span>
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;">
                <button class="amount-preset" data-amount="500" style="padding:12px;border:1px solid #e5e7eb;background:white;border-radius:8px;font-weight:600;cursor:pointer;">₹500</button>
                <button class="amount-preset" data-amount="1000" style="padding:12px;border:1px solid #e5e7eb;background:white;border-radius:8px;font-weight:600;cursor:pointer;">₹1,000</button>
                <button class="amount-preset" data-amount="2000" style="padding:12px;border:1px solid #e5e7eb;background:white;border-radius:8px;font-weight:600;cursor:pointer;">₹2,000</button>
                <button class="amount-preset" data-amount="5000" style="padding:12px;border:1px solid #e5e7eb;background:white;border-radius:8px;font-weight:600;cursor:pointer;">₹5,000</button>
                <button class="amount-preset" data-amount="10000" style="padding:12px;border:1px solid #e5e7eb;background:white;border-radius:8px;font-weight:600;cursor:pointer;">₹10,000</button>
                <button class="amount-preset custom" style="padding:12px;border:1px solid #e5e7eb;background:white;border-radius:8px;font-weight:600;cursor:pointer;">Custom</button>
              </div>
            </label>
            <label style="display:block;margin-bottom:16px;">
              <span style="display:block;margin-bottom:8px;font-weight:600;">Enter Amount</span>
              <input type="number" id="amount-input" placeholder="Enter amount" min="100" max="50000" style="width:100%;padding:12px;border:1px solid #e5e7eb;border-radius:8px;font-size:16px;" />
              <span style="display:block;margin-top:4px;color:#6b7280;font-size:14px;">Min: ₹100 | Max: ₹50,000</span>
            </label>
          </div>
          <div class="modal-footer" style="display:flex;gap:12px;margin-top:20px;">
            <button type="button" id="add-money-cancel" style="flex:1;padding:12px;border:1px solid #e5e7eb;background:white;color:black;border-radius:8px;font-weight:600;">Cancel</button>
            <button type="button" id="add-money-confirm" disabled style="flex:1;padding:12px;background:#10b981;color:white;border:none;border-radius:8px;font-weight:600;cursor:not-allowed;">Add Money</button>
          </div>
        </div>
      </div>
    `;
  }

  function setupWalletEventListeners(root, wallet) {
    const modal = root.querySelector('#add-money-modal');
    const amountInput = root.querySelector('#amount-input');
    const confirmBtn = root.querySelector('#add-money-confirm');

    // Download statement button
    root.querySelector('#download-statement-btn')?.addEventListener('click', async () => {
      try {
        window.API?.showSuccess?.('Statement download feature coming soon!');
        // In production, this would download a PDF or CSV file
      } catch (error) {
        window.API?.showError?.('Failed to download statement');
      }
    });

    // Open modal
    root.querySelector('#add-money-btn')?.addEventListener('click', () => {
      modal.style.display = 'block';
      amountInput.value = '';
      confirmBtn.disabled = true;
    });

    // Close modal
    const closeModal = () => modal.style.display = 'none';
    root.querySelector('#add-money-close')?.addEventListener('click', closeModal);
    root.querySelector('#add-money-cancel')?.addEventListener('click', closeModal);
    root.querySelector('.modal-backdrop')?.addEventListener('click', closeModal);

    // Amount presets
    root.querySelectorAll('.amount-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        root.querySelectorAll('.amount-preset').forEach(b => b.style.background = 'white');
        btn.style.background = '#f3f4f6';
        
        if (!btn.classList.contains('custom')) {
          amountInput.value = btn.getAttribute('data-amount');
          validateAmount();
        } else {
          amountInput.focus();
        }
      });
    });

    // Validate amount
    const validateAmount = () => {
      const amount = parseInt(amountInput.value);
      const isValid = amount >= 100 && amount <= 50000;
      confirmBtn.disabled = !isValid;
      confirmBtn.style.cursor = isValid ? 'pointer' : 'not-allowed';
    };

    amountInput?.addEventListener('input', validateAmount);

    // Confirm add money
    confirmBtn?.addEventListener('click', async () => {
      const amount = parseInt(amountInput.value);
      if (amount < 100 || amount > 50000) return;

      try {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Processing...';
        
        const response = await API.endpoints.wallet.addMoney(
          amount,
          'online',
          'Money added to wallet'
        );

        if (response.success) {
          window.API?.showSuccess?.(`Successfully added ₹${amount.toLocaleString('en-IN')} to wallet`);
          closeModal();
          renderWallet(root);
        }
      } catch (error) {
        window.API?.showError?.('Failed to add money. Please try again.');
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Add Money';
      }
    });
  }

  // Render Addresses Section - FIXED with proper UI flow
  async function renderAddresses(root) {
    try {
      root.innerHTML = '<div style="text-align: center; padding: 40px;"><i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #10b981;"></i><p>Loading addresses...</p></div>';
      
      const response = await API.endpoints.addresses.getAll();
      if (!response.success) {
        throw new Error(response.message || 'Failed to load addresses');
      }

      const addresses = response.addresses || [];
      
      root.innerHTML = `
        <div class="addresses-section">
          <div style="margin-bottom:24px;">
            <h3 style="margin:0;">My Addresses</h3>
          </div>
          
          <div id="addresses-container">
            ${addresses.length ? `
              <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:20px;">
                ${addresses.map(addr => createAddressCard(addr)).join('')}
              </div>
            ` : `
              <div id="empty-address-container" style="border:2px dashed #e5e7eb;border-radius:12px;padding:60px;text-align:center;">
                <i class="fas fa-map-marker-alt" style="font-size:48px;color:#6b7280;margin-bottom:16px;"></i>
                <h4 style="margin:0 0 8px;">No addresses saved</h4>
                <p style="color:#6b7280;margin:0 0 20px;">Add your delivery addresses for faster checkout</p>
                <button id="add-first-address" style="background:#facc15;color:#111827;border:none;padding:10px 20px;border-radius:8px;font-weight:600;cursor:pointer;">
                  <i class="fas fa-plus"></i> Add Address
                </button>
              </div>
            `}
          </div>
          
          <!-- Address Form (hidden by default, will replace the button when clicked) -->
          <form id="address-form" style="display:none;background:white;border:1px solid #e5e7eb;border-radius:12px;padding:24px;margin-top:24px;">
            <h4 style="margin:0 0 20px;">Add/Edit Address</h4>
            <input type="hidden" id="addr-id" />
            
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px;">
              <label style="display:block;">
                <span style="display:block;margin-bottom:4px;font-weight:600;">First Name *</span>
                <input type="text" id="addr-firstName" required style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;" />
              </label>
              
              <label style="display:block;">
                <span style="display:block;margin-bottom:4px;font-weight:600;">Last Name</span>
                <input type="text" id="addr-lastName" style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;" />
              </label>
              
              <label style="display:block;">
                <span style="display:block;margin-bottom:4px;font-weight:600;">Phone *</span>
                <input type="tel" id="addr-phone" required pattern="[0-9]{10}" style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;" />
              </label>
              
              <label style="display:block;">
                <span style="display:block;margin-bottom:4px;font-weight:600;">PIN Code *</span>
                <input type="text" id="addr-zip" required pattern="[0-9]{6}" style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;" />
              </label>
              
              <label style="display:block;grid-column:1/-1;">
                <span style="display:block;margin-bottom:4px;font-weight:600;">Address Line *</span>
                <input type="text" id="addr-line" required placeholder="House/Flat No., Building, Street" style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;" />
              </label>
              
              <label style="display:block;">
                <span style="display:block;margin-bottom:4px;font-weight:600;">Area/Locality</span>
                <input type="text" id="addr-area" style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;" />
              </label>
              
              <label style="display:block;">
                <span style="display:block;margin-bottom:4px;font-weight:600;">Landmark</span>
                <input type="text" id="addr-landmark" style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;" />
              </label>
              
              <label style="display:block;">
                <span style="display:block;margin-bottom:4px;font-weight:600;">City *</span>
                <input type="text" id="addr-city" required style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;" />
              </label>
              
              <label style="display:block;">
                <span style="display:block;margin-bottom:4px;font-weight:600;">State *</span>
                <input type="text" id="addr-state" required style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;" />
              </label>
              
              <label style="display:block;">
                <span style="display:block;margin-bottom:4px;font-weight:600;">Country</span>
                <input type="text" id="addr-country" value="India" style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;" />
              </label>
              
              <label style="display:block;">
                <span style="display:block;margin-bottom:4px;font-weight:600;">Label</span>
                <select id="addr-label" style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;">
                  <option value="Home">Home</option>
                  <option value="Work">Work</option>
                  <option value="Other">Other</option>
                </select>
              </label>
              
              <label style="display:flex;align-items:center;gap:8px;">
                <input type="checkbox" id="addr-isDefault" />
                <span>Set as default address</span>
              </label>
            </div>
            
            <div style="display:flex;gap:12px;margin-top:20px;">
              <button type="submit" style="background:#facc15;color:#111827;border:none;padding:12px 24px;border-radius:8px;font-weight:600;cursor:pointer;">Save Address</button>
              <button type="button" id="addr-cancel" style="background:white;color:#6b7280;border:1px solid #e5e7eb;padding:12px 24px;border-radius:8px;font-weight:600;cursor:pointer;">Cancel</button>
            </div>
          </form>
        </div>
      `;

      // Add the "Add Address" button for when there are existing addresses
      if (addresses.length > 0) {
        const container = root.querySelector('#addresses-container');
        const addButtonContainer = document.createElement('div');
        addButtonContainer.style.marginTop = '20px';
        addButtonContainer.innerHTML = `
          <button id="add-address-btn" style="background:#facc15;color:#111827;border:none;padding:12px 20px;border-radius:8px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px;">
            <i class="fas fa-plus"></i>
            Add New Address
          </button>
        `;
        container.appendChild(addButtonContainer);
      }

      setupAddressEventListeners(root);
    } catch (error) {
      console.error('Error loading addresses:', error);
      root.innerHTML = `
        <div class="empty-card">
          <div class="icon"><i class="fas fa-exclamation-circle"></i></div>
          <h3>Failed to load addresses</h3>
          <p>${error.message}</p>
          <button class="btn cta" onclick="location.reload()">Retry</button>
        </div>
      `;
    }
  }

  function createAddressCard(addr) {
    return `
      <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:20px;position:relative;">
        ${addr.isDefault ? '<div style="position:absolute;top:12px;right:12px;background:#10b981;color:white;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;">DEFAULT</div>' : ''}
        <div style="margin-bottom:16px;">
          <div style="font-weight:700;font-size:16px;margin-bottom:4px;">${addr.firstName} ${addr.lastName || ''}</div>
          <div style="color:#6b7280;font-size:14px;">
            ${addr.line}<br>
            ${addr.area ? addr.area + '<br>' : ''}
            ${addr.landmark ? 'Near ' + addr.landmark + '<br>' : ''}
            ${addr.city}, ${addr.state} - ${addr.zip}<br>
            ${addr.country || 'India'}<br>
            Phone: ${addr.phone}
          </div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="edit-address" data-id="${addr._id}" style="background:white;color:#3b82f6;border:1px solid #3b82f6;padding:6px 16px;border-radius:6px;font-weight:600;cursor:pointer;">Edit</button>
          <button class="delete-address" data-id="${addr._id}" style="background:white;color:#ef4444;border:1px solid #ef4444;padding:6px 16px;border-radius:6px;font-weight:600;cursor:pointer;">Delete</button>
          ${!addr.isDefault ? `<button class="default-address" data-id="${addr._id}" style="background:white;color:#10b981;border:1px solid #10b981;padding:6px 16px;border-radius:6px;font-weight:600;cursor:pointer;">Set Default</button>` : ''}
        </div>
      </div>
    `;
  }

  function setupAddressEventListeners(root) {
    const form = root.querySelector('#address-form');
    const container = root.querySelector('#addresses-container');
    
    // Show form function - FIXED to replace the button/card
    const showForm = (address = null) => {
      // Hide the empty container or add button
      const emptyContainer = root.querySelector('#empty-address-container');
      const addBtn = root.querySelector('#add-address-btn');
      
      if (emptyContainer) {
        emptyContainer.style.display = 'none';
      }
      if (addBtn) {
        addBtn.style.display = 'none';
      }
      
      // Show form in place
      form.style.display = 'block';
      form.scrollIntoView({ behavior: 'smooth' });
      
      if (address) {
        // Edit mode
        form.querySelector('#addr-id').value = address._id;
        form.querySelector('#addr-firstName').value = address.firstName || '';
        form.querySelector('#addr-lastName').value = address.lastName || '';
        form.querySelector('#addr-phone').value = address.phone || '';
        form.querySelector('#addr-zip').value = address.zip || '';
        form.querySelector('#addr-line').value = address.line || '';
        form.querySelector('#addr-area').value = address.area || '';
        form.querySelector('#addr-landmark').value = address.landmark || '';
        form.querySelector('#addr-city').value = address.city || '';
        form.querySelector('#addr-state').value = address.state || '';
        form.querySelector('#addr-country').value = address.country || 'India';
        form.querySelector('#addr-label').value = address.label || 'Home';
        form.querySelector('#addr-isDefault').checked = address.isDefault || false;
      } else {
        // Add mode - clear form
        form.reset();
        form.querySelector('#addr-id').value = '';
        form.querySelector('#addr-country').value = 'India';
      }
    };

    // Add address button in empty state
    root.querySelector('#add-first-address')?.addEventListener('click', () => showForm());
    
    // Add address button click (when addresses exist)
    root.querySelector('#add-address-btn')?.addEventListener('click', () => showForm());

    // Cancel button - restore the button/card
    root.querySelector('#addr-cancel')?.addEventListener('click', () => {
      form.style.display = 'none';
      
      const emptyContainer = root.querySelector('#empty-address-container');
      const addBtn = root.querySelector('#add-address-btn');
      
      if (emptyContainer) {
        emptyContainer.style.display = 'block';
      }
      if (addBtn) {
        addBtn.style.display = 'flex';
      }
    });

    // Edit address
    root.querySelectorAll('.edit-address').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        try {
          const response = await API.endpoints.addresses.get(id);
          if (response.success) {
            showForm(response.address);
          }
        } catch (error) {
          window.API?.showError?.('Failed to load address details');
        }
      });
    });

    // Delete address
    root.querySelectorAll('.delete-address').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to delete this address?')) return;
        
        const id = btn.getAttribute('data-id');
        try {
          const response = await API.endpoints.addresses.delete(id);
          if (response.success) {
            window.API?.showSuccess?.('Address deleted successfully');
            renderAddresses(root);
          }
        } catch (error) {
          window.API?.showError?.('Failed to delete address');
        }
      });
    });

    // Set default address
    root.querySelectorAll('.default-address').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        try {
          const response = await API.endpoints.addresses.setDefault(id);
          if (response.success) {
            window.API?.showSuccess?.('Default address updated');
            renderAddresses(root);
            try {
              const rt = localStorage.getItem('zylo_return_to');
              if (rt === 'checkout.html') {
                localStorage.removeItem('zylo_return_to');
                window.location.href = 'checkout.html';
              }
            } catch {}
          }
        } catch (error) {
          window.API?.showError?.('Failed to update default address');
        }
      });
    });

    // Form submission
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const id = form.querySelector('#addr-id').value;
      const addressData = {
        firstName: form.querySelector('#addr-firstName').value,
        lastName: form.querySelector('#addr-lastName').value,
        phone: form.querySelector('#addr-phone').value,
        zip: form.querySelector('#addr-zip').value,
        line: form.querySelector('#addr-line').value,
        area: form.querySelector('#addr-area').value,
        landmark: form.querySelector('#addr-landmark').value,
        city: form.querySelector('#addr-city').value,
        state: form.querySelector('#addr-state').value,
        country: form.querySelector('#addr-country').value,
        label: form.querySelector('#addr-label').value,
        isDefault: form.querySelector('#addr-isDefault').checked
      };

      try {
        const response = id 
          ? await API.endpoints.addresses.update(id, addressData)
          : await API.endpoints.addresses.create(addressData);

        if (response.success) {
          window.API?.showSuccess?.(id ? 'Address updated successfully' : 'Address added successfully');
          form.style.display = 'none';
          renderAddresses(root);
          try {
            const rt = localStorage.getItem('zylo_return_to');
            if (rt === 'checkout.html') {
              localStorage.removeItem('zylo_return_to');
              window.location.href = 'checkout.html';
            }
          } catch {}
        }
      } catch (error) {
        window.API?.showError?.('Failed to save address. Please check the details.');
      }
    });
  }

  // Render Profile Section - UPDATED with new fields
  async function renderProfile(root) {
    try {
      const user = await getUserData();
      if (!user) throw new Error('User data not found');

      // Get firstName and lastName directly
      const firstName = user.firstName || '';
      const lastName = user.lastName || '';

      // Format date for input field
      const dobValue = user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : '';

      root.innerHTML = `
        <div class="profile-section" style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:24px;max-width:600px;">
          <h3 style="margin:0 0 24px;">Edit Profile</h3>
          
          <form id="profile-form">
            <div style="display:grid;gap:16px;">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                <label style="display:block;">
                  <span style="display:block;margin-bottom:4px;font-weight:600;">First Name *</span>
                  <input type="text" id="profile-firstName" value="${firstName}" required style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;" />
                </label>
                
                <label style="display:block;">
                  <span style="display:block;margin-bottom:4px;font-weight:600;">Last Name</span>
                  <input type="text" id="profile-lastName" value="${lastName}" style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;" />
                </label>
              </div>
              
              <label style="display:block;">
                <span style="display:block;margin-bottom:4px;font-weight:600;">Email</span>
                <input type="email" value="${user.email || ''}" disabled style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;color:#6b7280;" />
                <span style="display:block;margin-top:4px;color:#6b7280;font-size:14px;">Email cannot be changed</span>
              </label>
              
              <label style="display:block;">
                <span style="display:block;margin-bottom:4px;font-weight:600;">Phone</span>
                <input type="tel" id="profile-phone" value="${user.phone || ''}" pattern="[0-9]{10}" placeholder="10-digit mobile number" style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;" />
              </label>
              
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                <label style="display:block;">
                  <span style="display:block;margin-bottom:4px;font-weight:600;">Date of Birth</span>
                  <input type="date" id="profile-dob" value="${dobValue}" style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;" />
                </label>
                
                <label style="display:block;">
                  <span style="display:block;margin-bottom:4px;font-weight:600;">Gender</span>
                  <select id="profile-gender" style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;">
                    <option value="">Select Gender</option>
                    <option value="male" ${user.gender === 'male' ? 'selected' : ''}>Male</option>
                    <option value="female" ${user.gender === 'female' ? 'selected' : ''}>Female</option>
                    <option value="other" ${user.gender === 'other' ? 'selected' : ''}>Other</option>
                    <option value="prefer_not_to_say" ${user.gender === 'prefer_not_to_say' ? 'selected' : ''}>Prefer not to say</option>
                  </select>
                </label>
              </div>
              
              <div style="display:flex;gap:12px;margin-top:16px;">
                <button type="submit" style="background:#facc15;color:#111827;border:none;padding:12px 24px;border-radius:8px;font-weight:600;cursor:pointer;">Save Changes</button>
                <button type="button" id="profile-cancel" style="background:white;color:#6b7280;border:1px solid #e5e7eb;padding:12px 24px;border-radius:8px;font-weight:600;cursor:pointer;">Cancel</button>
              </div>
            </div>
          </form>
        </div>
      `;

      // Form submission
      root.querySelector('#profile-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const profileData = {
          firstName: root.querySelector('#profile-firstName').value.trim(),
          lastName: root.querySelector('#profile-lastName').value.trim(),
          phone: root.querySelector('#profile-phone').value.trim(),
          dateOfBirth: root.querySelector('#profile-dob').value || undefined,
          gender: root.querySelector('#profile-gender').value || undefined
        };

        // Remove empty values
        Object.keys(profileData).forEach(key => {
          if (profileData[key] === undefined || profileData[key] === '') {
            delete profileData[key];
          }
        });

        try {
          const response = await API.endpoints.users.updateProfile(profileData);
          if (response.success) {
            window.API?.showSuccess?.('Profile updated successfully');
            await initializeProfileHeader(); // Refresh header
            
            // Update localStorage with new profile data
            try {
              const currentUser = JSON.parse(localStorage.getItem('zylo_user') || '{}');
              const updatedUser = { ...currentUser, ...profileData };
              localStorage.setItem('zylo_user', JSON.stringify(updatedUser));
              console.log('LocalStorage updated with new profile data:', updatedUser);
            } catch (error) {
              console.error('Failed to update localStorage:', error);
            }
            
            // Dispatch event to update profile dropdown
            window.dispatchEvent(new CustomEvent('zylo:user-updated', {
              detail: profileData
            }));
          }
        } catch (error) {
          window.API?.showError?.('Failed to update profile');
        }
      });

      // Cancel button
      root.querySelector('#profile-cancel')?.addEventListener('click', () => {
        setActiveSection('overview');
      });
    } catch (error) {
      console.error('Error loading profile:', error);
      root.innerHTML = `
        <div class="empty-card">
          <div class="icon"><i class="fas fa-exclamation-circle"></i></div>
          <h3>Failed to load profile</h3>
          <p>${error.message}</p>
          <button class="btn cta" onclick="location.reload()">Retry</button>
        </div>
      `;
    }
  }

  // Render Overview (default)
  function renderOverview(root) {
    root.innerHTML = '';
    const tiles = document.querySelector('.tiles-grid');
    const profileCard = document.querySelector('.profile-card');
    if (tiles) tiles.style.display = '';
    if (profileCard) profileCard.style.display = '';
  }

  // Setup navigation
  function setupNavigation() {
    // Left navigation items
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const section = btn.getAttribute('data-section');
        if (!section) return;
        if (section !== 'logout') e.preventDefault();
        setActiveSection(section);
      });
    });

    // Tile quick links
    document.querySelectorAll('[data-section-link]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveSection(el.getAttribute('data-section-link'));
      });
    });

    // Edit profile button
    document.getElementById('edit-profile-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      setActiveSection('profile');
    });
  }

  // Initialize page
  document.addEventListener('DOMContentLoaded', async () => {
    console.log('Account page loaded');

    // Check authentication
    if (!isAuthenticated()) {
      console.log('User not authenticated, redirecting to login');
      sessionStorage.setItem('zylo_return_to', 'account.html');
      window.location.href = 'login.html';
      return;
    }

    // Initialize profile header
    await initializeProfileHeader();

    // Setup navigation
    setupNavigation();

    // Load initial section from URL or storage
    const initialSection = getSectionFromURL();
    setActiveSection(initialSection);
  });

  // Add custom styles for order items toggle
  const style = document.createElement('style');
  style.textContent = `.order-items.open { display: block !important; }`;
  document.head.appendChild(style);
})();