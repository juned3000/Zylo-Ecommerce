// Track Order Page JavaScript
(function() {
  const API_BASE_URL = 'http://localhost:5000/api';
  const trackForm = document.getElementById('track-form');
  const orderStatus = document.getElementById('order-status');
  const trackAnother = document.getElementById('track-another');
  
  let currentOrder = null;
  let refreshInterval = null;

  // Sample order data for fallback
  const sampleOrders = {
    'ZY123456': {
      id: 'ZY123456',
      email: 'john.doe@example.com',
      date: 'Jan 8, 2025',
      status: 'In Transit',
      carrier: 'BlueDart Express',
      trackingId: 'BD1234567890',
      expectedDelivery: 'Tomorrow, Jan 10, 2025',
      currentStep: 3,
      steps: {
        1: { completed: true, time: 'Jan 8, 2025 - 10:30 AM' },
        2: { completed: true, time: 'Jan 8, 2025 - 2:15 PM' },
        3: { completed: true, time: 'Jan 9, 2025 - 9:00 AM' },
        4: { completed: false, time: 'Expected: Jan 10, 2025' }
      },
      address: {
        name: 'John Doe',
        address: '123 MG Road, Near Central Mall<br>Bangalore, Karnataka - 560001<br>Phone: +91 98765 43210'
      },
      items: [
        {
          id: 'f1',
          name: 'Abstract Summer Shirt',
          brand: 'Nike',
          size: 'L',
          quantity: 1,
          price: 1299,
          image: '../img/products/f1.jpg'
        }
      ]
    },
    'ZY789012': {
      id: 'ZY789012',
      email: 'test@example.com',
      date: 'Jan 7, 2025',
      status: 'Delivered',
      carrier: 'DTDC Express',
      trackingId: 'DT9876543210',
      expectedDelivery: 'Delivered on Jan 9, 2025',
      currentStep: 4,
      steps: {
        1: { completed: true, time: 'Jan 7, 2025 - 11:00 AM' },
        2: { completed: true, time: 'Jan 7, 2025 - 4:30 PM' },
        3: { completed: true, time: 'Jan 8, 2025 - 10:15 AM' },
        4: { completed: true, time: 'Jan 9, 2025 - 3:45 PM' }
      },
      address: {
        name: 'Test User',
        address: '456 Park Street, Sector 5<br>Delhi, Delhi - 110001<br>Phone: +91 87654 32109'
      },
      items: [
        {
          id: 'f2',
          name: 'Tropical Leaf Shirt',
          brand: 'H&M',
          size: 'M',
          quantity: 2,
          price: 1199,
          image: '../img/products/f2.jpg'
        }
      ]
    }
  };

  function loadLastOrder() {
    try { return JSON.parse(localStorage.getItem('zylo_last_order') || 'null'); } catch { return null; }
  }
  function loadUserEmail() {
    try { return (JSON.parse(localStorage.getItem('zylo_user') || 'null') || {}).email || null; } catch { return null; }
  }
  function mapOrderForView(o, fallbackEmail) {
    if (!o) return null;
    const email = (fallbackEmail || '').toLowerCase();
    const created = new Date();
    const fmtDate = created.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const addDays = (d)=>{ const dt = new Date(created); dt.setDate(dt.getDate()+d); return dt.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };
    const addressText = (o.shippingAddress?.addressText || '').replace(/\n/g,'<br>');
    const addrName = o.shippingAddress?.name || 'Customer';
    const items = (o.items||[]).map(it => ({ id: it.id||it.productId||'', name: it.name||'', brand: it.brand||'', size: it.size||'', quantity: it.quantity||1, price: it.price||0, image: it.image||'' }));
    return {
      id: String(o.id || '').toUpperCase(),
      email: email || 'unknown@example.com',
      date: fmtDate,
      status: 'Order Confirmed',
      carrier: 'BlueDart Express',
      trackingId: 'BD' + Math.floor(1000000000 + Math.random()*8999999999),
      expectedDelivery: `By ${addDays(3)}`,
      currentStep: 2,
      steps: {
        1: { completed: true,  time: fmtDate + ' - ' + created.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
        2: { completed: true,  time: fmtDate + ' - ' + created.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
        3: { completed: false, time: `Expected: ${addDays(1)}` },
        4: { completed: false, time: `Expected: ${addDays(3)}` }
      },
      address: {
        name: addrName,
        address: addressText || 'Address not available'
      },
      items
    };
  }

  // Track form submission with real API
  if (trackForm) {
    trackForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const orderId = document.getElementById('order-id').value.trim().toUpperCase();
      const email = document.getElementById('email').value.trim().toLowerCase();
      
      if (!orderId || !email) {
        showNotification('Please enter both Order ID and Email address', 'error');
        return;
      }
      
      const submitBtn = trackForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching...';
      submitBtn.disabled = true;
      
      try {
        const response = await fetch(`${API_BASE_URL}/orders/track`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ orderId, email })
        });
        
        const data = await response.json();
        
        if (data.success && data.order) {
          currentOrder = data.order;
          const displayData = transformOrderData(data.order);
          displayOrderStatus(displayData);
          document.querySelector('.track-form-card').style.display = 'none';
          orderStatus.style.display = 'block';
          
          // Save tracking state for page refresh persistence
          saveTrackingState(orderId, email, data.order, displayData);
          
          // Start live updates every 30 seconds
          startLiveUpdates(orderId, email);
        } else {
          showNotification(data.message || 'Order not found', 'error');
        }
      } catch (error) {
        console.error('Tracking error:', error);
        
        // Check if it's a network error vs server error
        if (error.name === 'TypeError' || error.message.includes('fetch')) {
          // Network error - fallback to sample data
          showNotification('Unable to connect to server. Trying demo data...', 'info');
          await fallbackTrackOrder(orderId, email);
        } else {
          // Server error
          showNotification('Server error. Please try again later.', 'error');
        }
      }
      
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    });
  }

  // Show notification helper
  function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `track-notification ${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <i class="fas fa-${type === 'error' ? 'exclamation-triangle' : 'info-circle'}"></i>
        <span>${message}</span>
        <button class="notification-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
      </div>
    `;
    
    // Add styles
    notification.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 9999; 
      background: ${type === 'error' ? '#fee' : '#e1f5fe'}; 
      color: ${type === 'error' ? '#c53030' : '#0277bd'};
      border: 1px solid ${type === 'error' ? '#fbb' : '#b3e5fc'};
      border-radius: 8px; padding: 12px 16px; max-width: 400px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1); animation: slideInRight 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  }
  
  // Start live updates
  function startLiveUpdates(orderId, email) {
    // Clear any existing interval
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
    
    refreshInterval = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/orders/track`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, email })
        });
        
        const data = await response.json();
        
        if (data.success && data.order) {
          const newOrder = transformOrderData(data.order);
          
          // Check if status changed
          if (currentOrder && currentOrder.orderStatus !== newOrder.orderStatus) {
            showNotification(`Order status updated: ${formatStatus(newOrder.orderStatus)}`, 'info');
          }
          
          currentOrder = data.order;
          displayOrderStatus(newOrder);
          
          // Update saved state with latest data
          const savedState = localStorage.getItem('track_order_state');
          if (savedState) {
            try {
              const state = JSON.parse(savedState);
              saveTrackingState(state.orderId, state.email, data.order, newOrder);
            } catch (e) {
              console.error('Error updating saved state:', e);
            }
          }
        }
      } catch (error) {
        console.error('Live update error:', error);
        // Don't show error for background updates
      }
    }, 30000); // Update every 30 seconds
  }
  
  // Transform API order data to display format
  function transformOrderData(order) {
    const statusMap = {
      'pending_payment': 1,
      'confirmed': 1, // Order Confirmed
      'processing': 1.5, // Processing (between confirmed and packed)
      'packed': 2, // Order Packed 
      'shipped': 3, // In Transit
      'delivered': 4 // Delivered
    };
    
    const formatDate = (date) => {
      return new Date(date).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
      });
    };
    
    const formatDateTime = (date) => {
      return new Date(date).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    };
    
    return {
      id: order.id,
      email: order.userId?.email || '',
      date: formatDate(order.createdAt),
      status: formatStatus(order.orderStatus),
      carrier: order.tracking?.carrier || 'BlueDart Express',
      trackingId: order.tracking?.trackingNumber || 'N/A',
      expectedDelivery: order.tracking?.estimatedDelivery ? 
        `Expected: ${formatDate(order.tracking.estimatedDelivery)}` : 
        'Calculating...',
      currentStep: statusMap[order.orderStatus] || 1,
      orderStatus: order.orderStatus,
      steps: {
        1: { 
          completed: statusMap[order.orderStatus] >= 1, 
          time: formatDateTime(order.createdAt),
          processing: order.orderStatus === 'processing' // Show as processing if status is processing
        },
        2: { 
          completed: statusMap[order.orderStatus] >= 2,
          time: order.tracking?.updates?.find(u => ['packed'].includes(u.status))?.timestamp ? 
            formatDateTime(order.tracking.updates.find(u => ['packed'].includes(u.status)).timestamp) :
            statusMap[order.orderStatus] >= 2 ? formatDateTime(order.createdAt) : 'Awaiting packing...'
        },
        3: { 
          completed: statusMap[order.orderStatus] >= 3,
          time: order.tracking?.updates?.find(u => u.status === 'shipped')?.timestamp ?
            formatDateTime(order.tracking.updates.find(u => u.status === 'shipped').timestamp) :
            'Awaiting shipment'
        },
        4: { 
          completed: statusMap[order.orderStatus] >= 4,
          time: order.tracking?.updates?.find(u => u.status === 'delivered')?.timestamp ?
            formatDateTime(order.tracking.updates.find(u => u.status === 'delivered').timestamp) :
            order.tracking?.estimatedDelivery ? `Expected: ${formatDate(order.tracking.estimatedDelivery)}` : 'Calculating...'
        }
      },
      address: {
        name: order.shippingAddress?.name || 'Customer',
        address: order.shippingAddress?.addressText || 'Address not available'
      },
      items: order.items || [],
      trackingUpdates: order.tracking?.updates || []
    };
  }
  
  // Format status for display
  function formatStatus(status) {
    const statusNames = {
      'pending_payment': 'Pending Payment',
      'confirmed': 'Confirmed',
      'processing': 'Processing',
      'packed': 'Packed',
      'shipped': 'Shipped',
      'delivered': 'Delivered'
    };
    return statusNames[status] || status;
  }
  
  // Fallback to sample data when API is not available
  async function fallbackTrackOrder(orderId, email) {
    const ordersById = { ...sampleOrders };
    const last = loadLastOrder();
    const userEmail = loadUserEmail();
    
    if (last && last.id) {
      const mapped = mapOrderForView(last, userEmail || email);
      if (mapped) ordersById[String(last.id).toUpperCase()] = mapped;
    }

    const order = ordersById[orderId];
    
    if (order && (!order.email || order.email.toLowerCase() === email)) {
      currentOrder = order;
      displayOrderStatus(order);
      document.querySelector('.track-form-card').style.display = 'none';
      orderStatus.style.display = 'block';
      
      // Save fallback state (without live updates)
      saveTrackingState(orderId, email, order, order);
      
      showNotification('Using demo data - API not available', 'info');
    } else {
      showNotification('No matching order found for the provided details', 'error');
    }
  }

  // Refresh tracking button
  const refreshBtn = document.getElementById('refresh-tracking');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async function() {
      if (!currentOrder) return;
      
      const savedState = localStorage.getItem('track_order_state');
      if (!savedState) return;
      
      try {
        const state = JSON.parse(savedState);
        
        // Show loading state
        const icon = refreshBtn.querySelector('i');
        const originalClass = icon.className;
        icon.className = 'fas fa-spinner fa-spin';
        refreshBtn.disabled = true;
        
        // Fetch latest data
        const response = await fetch(`${API_BASE_URL}/orders/track`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: state.orderId, email: state.email })
        });
        
        const data = await response.json();
        
        if (data.success && data.order) {
          const newOrder = transformOrderData(data.order);
          currentOrder = data.order;
          displayOrderStatus(newOrder);
          saveTrackingState(state.orderId, state.email, data.order, newOrder);
          showNotification('Tracking data refreshed', 'info');
        } else {
          showNotification('Failed to refresh tracking data', 'error');
        }
        
        // Restore button state
        icon.className = originalClass;
        refreshBtn.disabled = false;
        
      } catch (error) {
        console.error('Refresh error:', error);
        showNotification('Failed to refresh tracking data', 'error');
        
        // Restore button state
        const icon = refreshBtn.querySelector('i');
        icon.className = 'fas fa-sync-alt';
        refreshBtn.disabled = false;
      }
    });
  }
  
  // Track another order button
  if (trackAnother) {
    trackAnother.addEventListener('click', function() {
      // Clear live updates
      if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
      }
      
      // Clear saved state
      localStorage.removeItem('track_order_state');
      
      orderStatus.style.display = 'none';
      document.querySelector('.track-form-card').style.display = 'block';
      
      // Clear form
      document.getElementById('order-id').value = '';
      document.getElementById('email').value = '';
      currentOrder = null;
    });
  }

  function displayOrderStatus(order) {
    // Update order info
    document.getElementById('display-order-id').textContent = order.id;
    document.getElementById('display-order-date').textContent = `Ordered on ${order.date}`;
    
    // Update shipping details
    document.getElementById('carrier').textContent = order.carrier;
    document.getElementById('tracking-id').textContent = order.trackingId;
    document.getElementById('expected-delivery').textContent = order.expectedDelivery;
    
    // Update delivery address
    document.getElementById('delivery-address').innerHTML = `
      <p><strong>${order.address.name}</strong></p>
      <p>${order.address.address.replace(/\n/g, '<br>')}</p>
    `;
    
    // Update progress steps
    updateProgressSteps(order);
    
    // Update order items
    displayOrderItems(order.items);
    
    // Add tracking timeline if available
    if (order.trackingUpdates && order.trackingUpdates.length > 0) {
      addTrackingTimeline(order.trackingUpdates);
    }
  }
  
  // Add tracking timeline section
  function addTrackingTimeline(updates) {
    let timelineSection = document.getElementById('tracking-timeline');
    const shippingDetails = document.querySelector('.shipping-details');
    
    if (!timelineSection) {
      // Create timeline section if it doesn't exist
      timelineSection = document.createElement('div');
      timelineSection.id = 'tracking-timeline';
      timelineSection.className = 'detail-section';
      
      if (shippingDetails) {
        // Append inside the shipping-details container so width matches other cards
        shippingDetails.appendChild(timelineSection);
      }
    } else if (shippingDetails && timelineSection.parentElement !== shippingDetails) {
      // If it exists but is outside, move it inside for consistent width
      shippingDetails.appendChild(timelineSection);
    }
    
    timelineSection.innerHTML = `
      <h4><i class="fas fa-history"></i> Tracking Timeline</h4>
      <div class="tracking-timeline">
        ${updates.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)).map(update => `
          <div class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <div class="timeline-header">
                <strong>${update.message}</strong>
                <span class="timeline-time">${new Date(update.timestamp).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                  hour: '2-digit', minute: '2-digit'
                })}</span>
              </div>
              ${update.location ? `<div class="timeline-location">
                <i class="fas fa-map-marker-alt"></i> ${update.location}
              </div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
    
    // Add timeline styles if not already added
    if (!document.getElementById('tracking-timeline-styles')) {
      const style = document.createElement('style');
      style.id = 'tracking-timeline-styles';
      style.textContent = `
        .tracking-timeline {
          position: relative;
          padding-left: 30px;
        }
        .tracking-timeline::before {
          content: '';
          position: absolute;
          left: 8px;
          top: 0;
          bottom: 0;
          width: 2px;
          background: #e2e8f0;
        }
        .timeline-item {
          position: relative;
          margin-bottom: 20px;
        }
        .timeline-dot {
          position: absolute;
          left: -26px;
          top: 6px;
          width: 12px;
          height: 12px;
          background: #3b82f6;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 0 0 2px #3b82f6;
        }
        .timeline-content {
          background: #f8fafc;
          border-radius: 8px;
          padding: 12px;
          border: 1px solid #e2e8f0;
        }
        .timeline-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }
        .timeline-time {
          font-size: 0.875rem;
          color: #6b7280;
        }
        .timeline-location {
          color: #6b7280;
          font-size: 0.875rem;
        }
      `;
      document.head.appendChild(style);
    }
  }

  function updateProgressSteps(order) {
    const steps = document.querySelectorAll('.progress-step');
    const tracker = document.querySelector('.progress-tracker');

      steps.forEach((step, index) => {
      const stepNumber = index + 1;
      const stepData = order.steps[stepNumber];
      
      step.classList.remove('completed', 'active', 'processing');
      
      // Always reset icons and titles to default first
      const icon = step.querySelector('.step-icon i');
      const title = step.querySelector('.step-info h4');
      
      if (stepNumber === 1) {
        if (icon) icon.className = 'fas fa-check';
        if (title) title.textContent = 'Order Confirmed';
      } else if (stepNumber === 2) {
        if (icon) icon.className = 'fas fa-box';
        if (title) title.textContent = 'Order Packed';
      } else if (stepNumber === 3) {
        if (icon) icon.className = 'fas fa-truck';
        if (title) title.textContent = 'In Transit';
      } else if (stepNumber === 4) {
        if (icon) icon.className = 'fas fa-home';
        if (title) title.textContent = 'Delivered';
      }
      
      // Handle step states
      if (stepNumber === 1) {
        // Step 1 is always completed if order is confirmed or beyond
        if (order.orderStatus !== 'pending_payment') {
          step.classList.add('completed');
        }
        // Show processing state if currently processing
        if (order.orderStatus === 'processing') {
          step.classList.add('processing');
          if (icon) icon.className = 'fas fa-sync-alt fa-spin';
          if (title) title.textContent = 'Processing Order';
        }
      }
      // Handle other steps normally
      else if (stepNumber < order.currentStep || (stepNumber === order.currentStep && order.currentStep === 4)) {
        step.classList.add('completed');
      }
      else if (stepNumber === order.currentStep) {
        step.classList.add('active');
      }
      
      // Update step time
      const timeElement = step.querySelector('.step-time');
      if (timeElement && stepData) {
        timeElement.textContent = stepData.time;
      }
    });

    // Update horizontal progress percentage across 3 segments (between 4 steps)
    let segments = 0;
    
    // Calculate segments based on order status
    if (order.orderStatus === 'pending_payment') {
      segments = 0;
    } else if (order.orderStatus === 'confirmed') {
      segments = 0; // Just completed step 1, no line extension yet
    } else if (order.orderStatus === 'processing') {
      segments = 0.5; // Extend line halfway to step 2
    } else if (order.orderStatus === 'packed') {
      segments = 1; // Complete line to step 2
    } else if (order.orderStatus === 'shipped') {
      segments = 2; // Complete line to step 3
    } else if (order.orderStatus === 'delivered') {
      segments = 3; // Complete line to step 4
    }
    
    const percent = Math.max(0, Math.min(100, (segments / 3) * 100));
    if (tracker) {
      tracker.style.setProperty('--progress-percent', percent + '%');
      // For vertical mobile fallback, approximate same as percent
      tracker.style.setProperty('--progress-vertical', percent + '%');
    }
  }

  function displayOrderItems(items) {
    const container = document.getElementById('order-items');
    
    if (!items || items.length === 0) {
      container.innerHTML = '<p>No items found</p>';
      return;
    }
    
    let itemsHTML = items.map(item => `
      <div class="order-item" style="display: flex; align-items: center; gap: 12px; padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 8px;">
        <img src="${item.image}" alt="${item.name}" style="width: 60px; height: 60px; border-radius: 8px; object-fit: cover;">
        <div style="flex: 1;">
          <h5 style="margin: 0 0 4px 0; font-size: 14px;">${item.name}</h5>
          <p style="margin: 0; color: #6b7280; font-size: 12px;">${item.brand} • Size: ${item.size} • Qty: ${item.quantity}</p>
        </div>
        <div style="font-weight: 600;">Rs. ${(item.price * item.quantity).toLocaleString('en-IN')}</div>
      </div>
    `).join('');
    
    // Add coupon information if available
    if (currentOrder && currentOrder.appliedCoupon && currentOrder.appliedCoupon.discountAmount > 0) {
      itemsHTML += `
        <div style="margin-top: 16px; padding: 12px; background: linear-gradient(135deg, #f8f5ff 0%, #f0ebff 100%); border: 1px solid #e6d9ff; border-radius: 8px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <i class="fas fa-tags" style="color: #7c3aed;"></i>
            <h5 style="margin: 0; color: #7c3aed; font-size: 14px;">Coupon Applied</h5>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: #374151; font-size: 13px;">Coupon Code: <strong style="font-family: monospace;">${currentOrder.appliedCoupon.code}</strong></span>
            <span style="color: #7c3aed; font-weight: 600;">-Rs. ${currentOrder.appliedCoupon.discountAmount.toLocaleString('en-IN')}</span>
          </div>
          <div style="margin-top: 4px; font-size: 12px; color: #6b7280;">
            You saved Rs. ${currentOrder.appliedCoupon.discountAmount.toLocaleString('en-IN')} on this order! 🎉
          </div>
        </div>
      `;
    }

    // Append order totals summary if available
    if (currentOrder && currentOrder.totals) {
      const totals = currentOrder.totals;
      const couponDisc = typeof totals.couponDiscount === 'number' ? totals.couponDiscount : (currentOrder.appliedCoupon?.discountAmount || 0);
      const shippingText = typeof totals.shipping === 'number' ? (totals.shipping === 0 ? 'Free' : `Rs. ${totals.shipping.toLocaleString('en-IN')}`) : '—';
      itemsHTML += `
        <div class="order-totals">
          <div class="total-row"><span>Subtotal</span><span>Rs. ${(Number(totals.subtotal||0)).toLocaleString('en-IN')}</span></div>
          ${couponDisc > 0 ? `<div class="total-row discount"><span>Coupon (${currentOrder.appliedCoupon?.code || ''})</span><span>-Rs. ${couponDisc.toLocaleString('en-IN')}</span></div>` : ''}
          <div class="total-row"><span>Shipping</span><span>${shippingText}</span></div>
          <div class="total-row"><span>Tax</span><span>Rs. ${(Number(totals.tax||0)).toLocaleString('en-IN')}</span></div>
          ${Number(totals.codCharges||0) > 0 ? `<div class="total-row"><span>COD Charges</span><span>Rs. ${Number(totals.codCharges).toLocaleString('en-IN')}</span></div>` : ''}
          <div class="total-row grand"><span>Total</span><span>Rs. ${(Number(totals.total||0)).toLocaleString('en-IN')}</span></div>
        </div>
      `;
    }
    
    container.innerHTML = itemsHTML;
  }

  // Restore tracking state on page load
  function restoreTrackingState() {
    try {
      const savedState = localStorage.getItem('track_order_state');
      if (savedState) {
        const state = JSON.parse(savedState);
        const stateAge = Date.now() - state.timestamp;
        
        // Only restore if state is less than 1 hour old
        if (stateAge < 60 * 60 * 1000 && state.orderData) {
          console.log('Restoring tracking state from localStorage');
          
          // Restore form values
          document.getElementById('order-id').value = state.orderId || '';
          document.getElementById('email').value = state.email || '';
          
          // Show order status
          currentOrder = state.orderData;
          displayOrderStatus(state.displayData);
          document.querySelector('.track-form-card').style.display = 'none';
          orderStatus.style.display = 'block';
          
          // Restart live updates
          if (state.orderId && state.email) {
            startLiveUpdates(state.orderId, state.email);
          }
          
          // Add a subtle indicator that data was restored
          const restoredIndicator = document.createElement('div');
          restoredIndicator.style.cssText = `
            position: fixed; top: 70px; right: 20px; z-index: 9998;
            background: #e8f5e8; color: #2d5016; border: 1px solid #a7d8a7;
            padding: 8px 12px; border-radius: 6px; font-size: 0.875rem;
            animation: fadeInOut 4s ease;
          `;
          restoredIndicator.innerHTML = '✓ Tracking restored';
          document.body.appendChild(restoredIndicator);
          
          setTimeout(() => {
            if (restoredIndicator.parentElement) {
              restoredIndicator.remove();
            }
          }, 4000);
          return true;
        } else {
          // Clear expired state
          localStorage.removeItem('track_order_state');
        }
      }
    } catch (error) {
      console.error('Error restoring tracking state:', error);
      localStorage.removeItem('track_order_state');
    }
    return false;
  }
  
  // Save tracking state to localStorage
  function saveTrackingState(orderId, email, orderData, displayData) {
    try {
      const state = {
        orderId,
        email,
        orderData,
        displayData,
        timestamp: Date.now()
      };
      localStorage.setItem('track_order_state', JSON.stringify(state));
    } catch (error) {
      console.error('Error saving tracking state:', error);
    }
  }
  
  // Auto-populate demo data if URL parameters are present or restore previous state
  const urlParams = new URLSearchParams(window.location.search);
  const demoOrderId = urlParams.get('orderId');
  const demoEmail = urlParams.get('email');
  
  // First try to restore previous state, then try URL params
  if (!restoreTrackingState()) {
    if (demoOrderId && demoEmail) {
      document.getElementById('order-id').value = demoOrderId;
      document.getElementById('email').value = demoEmail;
      
      // Auto-submit after a short delay
      setTimeout(() => {
        trackForm.querySelector('button[type="submit"]').click();
      }, 500);
    }
  }
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
    // State will persist for next page load unless explicitly cleared
  });
  
  // Clear state when navigating away from the page (not refresh)
  window.addEventListener('pagehide', (event) => {
    // Only clear state if it's not a page refresh
    if (!event.persisted) {
      // This is a navigation away, not a refresh - we might want to keep state
      // For now, let's keep the state for 1 hour as defined in restoreTrackingState
    }
  });

})();

// Add notification animation styles
if (!document.getElementById('notification-styles')) {
  const style = document.createElement('style');
  style.id = 'notification-styles';
  style.textContent = `
    @keyframes slideInRight {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes fadeInOut {
      0% { opacity: 0; transform: translateY(-10px); }
      20% { opacity: 1; transform: translateY(0); }
      80% { opacity: 1; transform: translateY(0); }
      100% { opacity: 0; transform: translateY(-10px); }
    }
    .track-notification {
      animation: slideInRight 0.3s ease;
      z-index: 10000;
    }
    .notification-content {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .notification-close {
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      padding: 0;
      margin-left: auto;
    }
    .notification-close:hover {
      opacity: 0.7;
    }
    .status-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.5rem;
    }
    .header-left h3 {
      margin-bottom: 0.5rem;
    }
    .btn-refresh {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 10px;
      cursor: pointer;
      transition: all 0.2s ease;
      color: #64748b;
    }
    .btn-refresh:hover {
      background: #e2e8f0;
      color: #3b82f6;
      border-color: #cbd5e1;
    }
    .btn-refresh:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .btn-refresh i {
      font-size: 14px;
    }
  `;
  document.head.appendChild(style);
}

// Helper function to format currency
window.formatCurrency = function(amount) {
  try {
    return 'Rs. ' + Number(amount || 0).toLocaleString('en-IN');
  } catch {
    return 'Rs. ' + amount;
  }
};

// Public API for external access
window.trackOrder = function(orderId, email) {
  document.getElementById('order-id').value = orderId || '';
  document.getElementById('email').value = email || '';
  
  if (orderId && email) {
    document.getElementById('track-form').querySelector('button[type="submit"]').click();
  }
};
