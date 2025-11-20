// Zylo Ecommerce - Checkout Page JavaScript with Backend Integration

class CheckoutManager {
  constructor() {
    this.cart = this.loadCart();
    this.selectedPaymentMethod = 'card';
    this.selectedWallet = null;
    this.selectedBank = null;
    this.selectedUpiApp = null;
    this.itemsExpanded = false;
    this.init();
  }

  loadCart() {
    try {
      return JSON.parse(localStorage.getItem('zylo_cart')) || [];
    } catch {
      return [];
    }
  }

  async init() {
    this.setupEventListeners();
    
    // Show loading state
    this.showLoadingState();
    
    try {
      await this.loadCartData();
      
      // Redirect to cart if no items
      if (this.cart.length === 0) {
        window.ZYLO?.toast?.('Your cart is empty. Redirecting to cart page...');
        setTimeout(() => {
          window.location.href = 'cart.html';
        }, 1000);
        return;
      }
      
      await this.loadUserAddress(); // Load user's address
      this.renderOrderSummary();
      
      // Force an additional update after a brief delay to ensure coupon display
      setTimeout(() => {
        console.log('🔄 Checkout: Force refreshing order summary...');
        this.updateOrderSummary();
      }, 100);
      
      this.setupFormValidation();
    } catch (error) {
      console.error('Failed to initialize checkout:', error);
      this.showMessage('Failed to load checkout data. Please try again.', 'error');
    } finally {
      this.hideLoadingState();
    }
  }

  setupEventListeners() {
    // Payment navigation switching
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => {
      btn.addEventListener('click', () => this.switchPaymentTab(btn.dataset.tab));
    });

    // Wallet selection
    const walletOptions = document.querySelectorAll('.wallet-option');
    walletOptions.forEach(option => {
      option.addEventListener('click', () => this.selectWallet(option.dataset.wallet));
    });

    // UPI app selection
    const upiApps = document.querySelectorAll('.upi-app');
    upiApps.forEach(app => {
      app.addEventListener('click', () => this.selectUpiApp(app.dataset.app));
    });

    // Bank selection
    const bankOptions = document.querySelectorAll('.bank-option');
    bankOptions.forEach(option => {
      option.addEventListener('click', () => this.selectBank(option.dataset.bank));
    });

    // Place order button
    const placeOrderBtn = document.getElementById('place-order-btn');
    if (placeOrderBtn) {
      placeOrderBtn.addEventListener('click', () => this.placeOrder());
    }

    // Change address button
    const changeBtn = document.querySelector('.change-btn');
    if (changeBtn) {
      changeBtn.addEventListener('click', () => this.changeAddress());
    }

    // Form input formatting
    this.setupInputFormatting();
  }

  setupInputFormatting() {
    // Card number formatting
    const cardNumberInput = document.getElementById('card-number');
    if (cardNumberInput) {
      cardNumberInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\s/g, '').replace(/[^0-9]/gi, '');
        let formattedValue = value.match(/.{1,4}/g)?.join(' ') || '';
        e.target.value = formattedValue;
      });
    }

    // Expiry date formatting
    const expiryInput = document.getElementById('expiry');
    if (expiryInput) {
      expiryInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length >= 2) {
          value = value.substring(0,2) + '/' + value.substring(2,4);
        }
        e.target.value = value;
      });
    }

    // CVV formatting
    const cvvInput = document.getElementById('cvv');
    if (cvvInput) {
      cvvInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
      });
    }
  }

  switchPaymentTab(tabName) {
    // Update active navigation button
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update active content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`${tabName}-content`).classList.add('active');

    this.selectedPaymentMethod = tabName;
    this.updateOrderSummary();
  }

  selectWallet(wallet) {
    document.querySelectorAll('.wallet-option').forEach(option => option.classList.remove('selected'));
    document.querySelector(`[data-wallet="${wallet}"]`).classList.add('selected');
    this.selectedWallet = wallet;
  }

  selectUpiApp(app) {
    document.querySelectorAll('.upi-app').forEach(option => option.classList.remove('selected'));
    document.querySelector(`[data-app="${app}"]`).classList.add('selected');
    this.selectedUpiApp = app;
  }

  selectBank(bank) {
    document.querySelectorAll('.bank-option').forEach(option => option.classList.remove('selected'));
    document.querySelector(`[data-bank="${bank}"]`).classList.add('selected');
    this.selectedBank = bank;
  }

  async loadCartData() {
    try {
      // If user is authenticated, load cart from API
      if (API && API.isAuthenticated()) {
        console.log('Loading cart from API...');
        const response = await API.endpoints.cart.get();
        if (response.success && response.items) {
          // Update local cart with server data
          this.cart = response.items;
          localStorage.setItem('zylo_cart', JSON.stringify(this.cart));
          
          // Store applied coupon information if available
          if (response.appliedCoupon) {
            localStorage.setItem('zylo_applied_coupon', JSON.stringify(response.appliedCoupon));
            console.log('✅ Loaded applied coupon from API:', response.appliedCoupon);
          } else {
            // Remove any stale coupon data
            localStorage.removeItem('zylo_applied_coupon');
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load cart from API, using localStorage:', error);
      // Fallback to localStorage cart already loaded in constructor
    }

    // Load product details for each cart item
    try {
      const productIds = [...new Set(this.cart.map(item => item.productId))];
      if (productIds.length === 0) {
        this.cartItems = [];
        return;
      }

      // Get products from API
      const response = await API.endpoints.products.getAll();
      
      if (response.success && response.items) {
        // Filter products to only include ones in the cart
        const cartProductIds = new Set(productIds);
        const relevantProducts = response.items.filter(p => cartProductIds.has(p.id));
        
        this.cartItems = this.cart.map(item => {
          const product = relevantProducts.find(p => p.id === item.productId);
          return product ? { 
            ...product, 
            cartSize: item.size, 
            cartQuantity: item.quantity 
          } : null;
        }).filter(Boolean);
      } else {
        throw new Error('Failed to load product details');
      }
    } catch (error) {
      console.error('Error loading cart items:', error);
      // Fallback to static products if available
      if (window.PRODUCTS) {
        this.cartItems = this.cart.map(item => {
          const product = window.PRODUCTS.find(p => p.id === item.productId);
          return product ? { 
            ...product, 
            cartSize: item.size, 
            cartQuantity: item.quantity 
          } : null;
        }).filter(Boolean);
      } else {
        this.cartItems = [];
      }
    }
  }

  renderOrderSummary() {
    this.renderItems();
    this.updateOrderSummary();
    
    // Add debug logging for coupon information
    const couponData = localStorage.getItem('zylo_applied_coupon');
    if (couponData) {
      console.log('🎫 Checkout: Found applied coupon data:', JSON.parse(couponData));
    } else {
      console.log('🎫 Checkout: No applied coupon found in localStorage');
    }
  }

  renderItems() {
    const itemsContent = document.getElementById('items-content');
    const itemsCount = document.getElementById('items-count');
    
    if (!this.cartItems || this.cartItems.length === 0) {
      itemsContent.innerHTML = '<p>No items in cart</p>';
      itemsCount.textContent = '0';
      return;
    }

    const totalItems = this.cartItems.reduce((sum, item) => sum + item.cartQuantity, 0);
    itemsCount.textContent = totalItems;

    // Calculate delivery date (3-5 days from now)
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + Math.floor(Math.random() * 3) + 3);
    const formattedDate = deliveryDate.toLocaleDateString('en-IN', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });

    itemsContent.innerHTML = this.cartItems.map(item => `
      <div class="checkout-item">
        <div class="item-image">
          <img src="${item.image}" alt="${item.name}">
        </div>
        <div class="item-info">
          <div class="brand">${item.brand}</div>
          <h4 class="product-name">${item.name}</h4>
          <div class="size-qty">Size: ${item.cartSize} | Qty: ${item.cartQuantity}</div>
          <div class="delivery-info">
            <i class="fas fa-check check-icon"></i>
            <span>Delivery by <span class="delivery-date">${formattedDate}</span></span>
          </div>
        </div>
      </div>
    `).join('');
  }

  calculateTotals() {
    const subtotal = this.cartItems.reduce((sum, item) => sum + (item.price * item.cartQuantity), 0);
    
    // Check for applied coupon
    let couponDiscount = 0;
    let appliedCoupon = null;
    
    try {
      const couponData = localStorage.getItem('zylo_applied_coupon');
      console.log('📊 Checkout: calculateTotals - raw coupon data:', couponData);
      
      if (couponData) {
        appliedCoupon = JSON.parse(couponData);
        // Prefer normalized discountAmount; fall back to other shapes or recompute from type/value
        if (typeof appliedCoupon.discountAmount === 'number') {
          couponDiscount = appliedCoupon.discountAmount;
        } else if (typeof appliedCoupon.discount === 'number') {
          couponDiscount = appliedCoupon.discount;
        } else if (appliedCoupon.discountType && appliedCoupon.discountValue != null) {
          if (appliedCoupon.discountType === 'percentage') {
            couponDiscount = Math.round((subtotal * Number(appliedCoupon.discountValue)) / 100);
            if (appliedCoupon.maximumDiscount && couponDiscount > appliedCoupon.maximumDiscount) {
              couponDiscount = appliedCoupon.maximumDiscount;
            }
          } else {
            couponDiscount = Number(appliedCoupon.discountValue) || 0;
          }
          couponDiscount = Math.min(couponDiscount, subtotal);
        }
        console.log('📊 Checkout: calculateTotals - parsed coupon:', appliedCoupon, 'discount:', couponDiscount);
      }
    } catch (error) {
      console.warn('Error loading applied coupon:', error);
    }
    
    // Calculate discounted subtotal for shipping calculation
    const discountedSubtotal = subtotal - couponDiscount;
    
    const tax = Math.round(discountedSubtotal * 0.18); // 18% GST on discounted amount
    let shipping = discountedSubtotal > 1500 ? 0 : 99; // Free shipping over Rs. 1500 after discount
    let codCharges = 0;
    
    // Add COD charges if selected
    if (this.selectedPaymentMethod === 'cod') {
      codCharges = 49;
    }
    
    const total = discountedSubtotal + tax + shipping + codCharges;

    return { 
      subtotal, 
      couponDiscount, 
      appliedCoupon,
      tax, 
      shipping, 
      codCharges, 
      total 
    };
  }

  updateOrderSummary() {
    const totals = this.calculateTotals();
    
    console.log('🎨 Checkout: Updating order summary with totals:', totals);
    
    document.getElementById('summary-subtotal').textContent = `Rs. ${totals.subtotal.toLocaleString('en-IN')}`;
    document.getElementById('summary-tax').textContent = `Rs. ${totals.tax.toLocaleString('en-IN')}`;
    document.getElementById('summary-shipping').textContent = totals.shipping === 0 ? 'Free' : `Rs. ${totals.shipping}`;
    document.getElementById('summary-total').textContent = `Rs. ${totals.total.toLocaleString('en-IN')}`;

    // Show/hide coupon discount
    const couponDiscountRow = document.getElementById('coupon-discount-row');
    const couponCodeDisplay = document.getElementById('coupon-code-display');
    const couponDiscountAmount = document.getElementById('coupon-discount-amount');
    
    console.log('🎫 Checkout: Coupon info - appliedCoupon:', totals.appliedCoupon, 'discount:', totals.couponDiscount);
    console.log('🎫 Checkout: Coupon elements - row:', couponDiscountRow, 'code:', couponCodeDisplay, 'amount:', couponDiscountAmount);
    
    if (totals.appliedCoupon && totals.couponDiscount > 0) {
      console.log('✅ Checkout: Showing coupon discount');
      couponCodeDisplay.textContent = totals.appliedCoupon.code;
      couponDiscountAmount.textContent = `-Rs. ${totals.couponDiscount.toLocaleString('en-IN')}`;
      couponDiscountRow.style.display = 'flex';
    } else {
      console.log('❌ Checkout: Hiding coupon discount');
      couponDiscountRow.style.display = 'none';
    }

    // Show/hide COD charges
    const codChargesRow = document.getElementById('cod-charges-row');
    if (this.selectedPaymentMethod === 'cod') {
      codChargesRow.style.display = 'flex';
    } else {
      codChargesRow.style.display = 'none';
    }
  }

  setupFormValidation() {
    // Real-time validation for card form
    const cardForm = document.querySelector('#card-content .payment-form');
    if (cardForm) {
      const inputs = cardForm.querySelectorAll('input');
      inputs.forEach(input => {
        input.addEventListener('blur', () => this.validateField(input));
        input.addEventListener('input', () => this.clearFieldError(input));
      });
    }

    // UPI ID validation
    const upiInput = document.getElementById('upi-id');
    if (upiInput) {
      upiInput.addEventListener('blur', () => this.validateUpiId(upiInput));
    }
  }

  validateField(input) {
    const value = input.value.trim();
    let isValid = true;
    let errorMessage = '';

    switch(input.id) {
      case 'card-number':
        const cardNumber = value.replace(/\s/g, '');
        if (!cardNumber) {
          isValid = false;
          errorMessage = 'Card number is required';
        } else if (cardNumber.length < 13 || cardNumber.length > 19) {
          isValid = false;
          errorMessage = 'Invalid card number';
        }
        break;
      
      case 'expiry':
        if (!value) {
          isValid = false;
          errorMessage = 'Expiry date is required';
        } else if (!/^\d{2}\/\d{2}$/.test(value)) {
          isValid = false;
          errorMessage = 'Invalid expiry date format';
        }
        break;
      
      case 'cvv':
        if (!value) {
          isValid = false;
          errorMessage = 'CVV is required';
        } else if (value.length < 3 || value.length > 4) {
          isValid = false;
          errorMessage = 'Invalid CVV';
        }
        break;
      
      case 'cardholder-name':
        if (!value) {
          isValid = false;
          errorMessage = 'Cardholder name is required';
        }
        break;
    }

    this.showFieldError(input, isValid, errorMessage);
    return isValid;
  }

  validateUpiId(input) {
    const value = input.value.trim();
    const upiRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/;
    
    if (!value) {
      this.showFieldError(input, false, 'UPI ID is required');
      return false;
    } else if (!upiRegex.test(value)) {
      this.showFieldError(input, false, 'Invalid UPI ID format');
      return false;
    }
    
    this.showFieldError(input, true, '');
    return true;
  }

  showFieldError(input, isValid, message) {
    // Remove existing error
    const existingError = input.parentNode.querySelector('.field-error');
    if (existingError) {
      existingError.remove();
    }

    if (!isValid) {
      input.style.borderColor = '#ef4444';
      const errorDiv = document.createElement('div');
      errorDiv.className = 'field-error';
      errorDiv.style.color = '#ef4444';
      errorDiv.style.fontSize = '12px';
      errorDiv.style.marginTop = '4px';
      errorDiv.textContent = message;
      input.parentNode.appendChild(errorDiv);
    } else {
      input.style.borderColor = '#22c55e';
    }
  }

  clearFieldError(input) {
    input.style.borderColor = '';
    const existingError = input.parentNode.querySelector('.field-error');
    if (existingError) {
      existingError.remove();
    }
  }

  async loadUserAddress() {
    const customerNameEl = document.getElementById('customer-name');
    const recipientNameEl = document.querySelector('.recipient-name');
    const addressEl = document.querySelector('.delivery-address .address');
    
    try {
      // If user is authenticated, load addresses from API
      if (API && API.isAuthenticated()) {
        console.log('Loading addresses from API...');
        const response = await API.endpoints.addresses.getAll();
        
        if (response.success && response.addresses && response.addresses.length > 0) {
          // Get default address or first address
          const defaultAddress = response.addresses.find(addr => addr.isDefault) || response.addresses[0];
          const fullName = `${defaultAddress.firstName || ''} ${defaultAddress.lastName || ''}`.trim();
          const formattedAddress = `${defaultAddress.line}${defaultAddress.area ? ', ' + defaultAddress.area : ''}<br>${defaultAddress.city}, ${defaultAddress.state} - ${defaultAddress.zip}<br>Phone: ${defaultAddress.phone}`;
          
          if (customerNameEl) customerNameEl.textContent = fullName;
          if (recipientNameEl) recipientNameEl.textContent = fullName;
          if (addressEl) addressEl.innerHTML = formattedAddress;
          
          // Store address data for order creation
          this.selectedAddress = defaultAddress;
          return;
        }
      }
    } catch (error) {
      console.warn('Failed to load addresses from API, using fallback:', error);
    }
    
    // Fallback to user data or default values
    try {
      const userData = this.loadLS('zylo_user', {});
      const userName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'Customer';
      const userPhone = userData.phone || '';
      
      if (customerNameEl) customerNameEl.textContent = userName;
      if (recipientNameEl) recipientNameEl.textContent = userName;
      if (addressEl) {
        if (userPhone) {
          addressEl.innerHTML = `No delivery address saved<br>Phone: ${userPhone}<br><span style="color:#ef4444;">Please add an address to continue</span>`;
        } else {
          addressEl.innerHTML = '<span style="color:#ef4444;">Please add a delivery address and phone number to continue</span>';
        }
      }
      
      // Store minimal address data
      this.selectedAddress = {
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        phone: userPhone,
        line: 'Address not provided',
        city: '',
        state: '',
        zip: ''
      };
    } catch (error) {
      console.error('Error loading user data:', error);
      
      // Set default values
      if (customerNameEl) customerNameEl.textContent = 'Customer';
      if (recipientNameEl) recipientNameEl.textContent = 'Customer';
      if (addressEl) {
        addressEl.innerHTML = '<span style="color:#ef4444;">Please log in and add a delivery address</span>';
      }
      
      this.selectedAddress = null;
    }
  }
  
  loadLS(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
    } catch {
      return fallback;
    }
  }

  changeAddress() {
    // Store current page as return destination
    try {
      localStorage.setItem('zylo_return_to', 'checkout.html');
    } catch {}
    
    // Redirect to account addresses section
    window.location.href = 'account.html?tab=addresses';
  }

  validatePaymentMethod() {
    switch(this.selectedPaymentMethod) {
      case 'card':
        const cardInputs = document.querySelectorAll('#card-content input[required], #card-content input');
        let allValid = true;
        cardInputs.forEach(input => {
          if (!this.validateField(input)) {
            allValid = false;
          }
        });
        return allValid;
      
      case 'wallet':
        if (!this.selectedWallet) {
          this.showMessage('Please select a wallet', 'error');
          return false;
        }
        return true;
      
      case 'upi':
        const upiInput = document.getElementById('upi-id');
        if (upiInput.value.trim()) {
          return this.validateUpiId(upiInput);
        } else if (this.selectedUpiApp) {
          return true;
        } else {
          this.showMessage('Please enter UPI ID or select an app', 'error');
          return false;
        }
      
      case 'netbanking':
        if (!this.selectedBank) {
          this.showMessage('Please select a bank', 'error');
          return false;
        }
        return true;
      
      case 'cod':
        return true;
      
      default:
        return false;
    }
  }

  async placeOrder() {
    if (!this.validatePaymentMethod()) {
      return;
    }

    // Show loading state
    const placeOrderBtn = document.getElementById('place-order-btn');
    if (placeOrderBtn) {
      placeOrderBtn.disabled = true;
      placeOrderBtn.textContent = 'Processing...';
    }

    try {
      // Collect address/name details
      const nameEl = document.getElementById('customer-name') || document.querySelector('.recipient-name');
      const addressEl = document.querySelector('.delivery-address .address');
      const customerName = (nameEl?.textContent || 'Customer').trim();
      const addressText = (addressEl?.textContent || 'Address not provided').trim();

      // Build cart items for order
      const items = (this.cartItems || []).map(item => ({
        productId: item.id,
        name: item.name,
        brand: item.brand,
        image: item.image,
        price: item.price,
        quantity: item.cartQuantity,
        size: item.cartSize
      }));

      // Totals
      const totals = this.calculateTotals();

      // Payment details from selected method
      let methodDetails = {};
      if (this.selectedPaymentMethod === 'card') {
        const cardNumber = (document.getElementById('card-number')?.value || '').replace(/\s/g, '');
        methodDetails = { last4: cardNumber.slice(-4) };
      } else if (this.selectedPaymentMethod === 'upi') {
        const upiId = document.getElementById('upi-id')?.value || null;
        methodDetails = { upiId, app: this.selectedUpiApp };
      } else if (this.selectedPaymentMethod === 'wallet') {
        methodDetails = { wallet: this.selectedWallet };
      } else if (this.selectedPaymentMethod === 'netbanking') {
        methodDetails = { bank: this.selectedBank };
      }

      // Create order via backend API if user is logged in
      if (API && API.isAuthenticated()) {
        const orderData = {
          paymentMethod: this.selectedPaymentMethod,
          methodDetails,
          shippingAddress: this.selectedAddress ? {
            name: `${this.selectedAddress.firstName || ''} ${this.selectedAddress.lastName || ''}`.trim(),
            addressText: `${this.selectedAddress.line}${this.selectedAddress.area ? ', ' + this.selectedAddress.area : ''}\n${this.selectedAddress.city}, ${this.selectedAddress.state} - ${this.selectedAddress.zip}\nPhone: ${this.selectedAddress.phone}`,
            // Include detailed fields for better order management
            firstName: this.selectedAddress.firstName,
            lastName: this.selectedAddress.lastName,
            line: this.selectedAddress.line,
            area: this.selectedAddress.area,
            city: this.selectedAddress.city,
            state: this.selectedAddress.state,
            zip: this.selectedAddress.zip,
            phone: this.selectedAddress.phone,
            landmark: this.selectedAddress.landmark
          } : {
            name: customerName,
            addressText: addressText
          }
        };

        const response = await API.endpoints.orders.create(orderData);
        
        if (response.success && response.order) {
          const order = response.order;
          
          // Store order locally for reference
          localStorage.setItem('zylo_last_order', JSON.stringify(order));
          
          // Clear cart after successful order
          localStorage.removeItem('zylo_cart');
          if (API && API.isAuthenticated()) {
            try {
              await API.endpoints.cart.clear();
            } catch (error) {
              console.warn('Failed to clear server cart:', error);
            }
          }
          
          // Redirect based on payment method
          if (this.selectedPaymentMethod === 'cod') {
            window.location.href = `order-success.html?orderId=${encodeURIComponent(order._id || order.id)}`;
          } else {
            // For online payments, redirect to payment processing
            localStorage.setItem('zylo_pending_payment', JSON.stringify(order));
            window.location.href = `payment.html?orderId=${encodeURIComponent(order._id || order.id)}`;
          }
          return;
        } else {
          throw new Error(response.message || 'Failed to create order');
        }
      } else {
        // Fallback to local order creation if not authenticated
        const orderId = 'ZY' + Date.now().toString().slice(-6);
        const order = {
          id: orderId,
          createdAt: new Date().toISOString(),
          paymentMethod: this.selectedPaymentMethod,
          paymentStatus: this.selectedPaymentMethod === 'cod' ? 'cod' : 'initiated',
          orderStatus: this.selectedPaymentMethod === 'cod' ? 'confirmed' : 'pending_payment',
          items,
          totals,
          appliedCoupon: totals.appliedCoupon, // Include coupon information
          shippingAddress: { name: customerName, addressText },
          methodDetails
        };

        // Save to local storage
        localStorage.setItem('zylo_last_order', JSON.stringify(order));
        
        // Save to order history
        const saveOrderToHistory = (ord) => {
          try {
            const orders = JSON.parse(localStorage.getItem('zylo_orders') || '[]');
            orders.unshift(ord);
            localStorage.setItem('zylo_orders', JSON.stringify(orders));
          } catch {}
        };
        saveOrderToHistory(order);
        
        // Clear cart
        localStorage.removeItem('zylo_cart');
        
        if (this.selectedPaymentMethod === 'cod') {
          window.location.href = 'order-success.html?orderId=' + encodeURIComponent(orderId);
        } else {
          localStorage.setItem('zylo_pending_payment', JSON.stringify(order));
          window.location.href = 'payment.html?orderId=' + encodeURIComponent(orderId);
        }
      }
    } catch (error) {
      console.error('Order creation failed:', error);
      this.showMessage(error.message || 'Failed to place order. Please try again.', 'error');
    } finally {
      // Restore button state
      if (placeOrderBtn) {
        placeOrderBtn.disabled = false;
        placeOrderBtn.textContent = 'Place Order';
      }
    }
  }

  showMessage(message, type = 'success') {
    // Use toast if available, otherwise fallback to inline messages
    if (window.ZYLO?.toast) {
      window.ZYLO.toast(message);
      return;
    }
    
    // Remove existing messages
    document.querySelectorAll('.success-message, .error-message').forEach(el => el.remove());

    const messageDiv = document.createElement('div');
    messageDiv.className = `${type}-message`;
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
      display: block;
      padding: 12px 16px;
      margin: 16px 0;
      border-radius: 8px;
      font-weight: 600;
      ${type === 'error' ? 'background: #fee; color: #c53030; border: 1px solid #fed7d7;' : 'background: #f0fff4; color: #22543d; border: 1px solid #c6f6d5;'}
    `;

    const paymentContentArea = document.querySelector('.payment-content-area');
    if (paymentContentArea) {
      paymentContentArea.insertBefore(messageDiv, paymentContentArea.firstChild);
    } else {
      document.body.appendChild(messageDiv);
    }

    // Auto-hide messages
    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.remove();
      }
    }, type === 'error' ? 7000 : 4000);
  }
  
  showLoadingState() {
    // Show loading spinner
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'checkout-loading';
    loadingDiv.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      flex-direction: column;
    `;
    loadingDiv.innerHTML = `
      <div style="border: 4px solid #f3f3f3; border-top: 4px solid #facc15; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite;"></div>
      <p style="margin-top: 16px; font-weight: 600; color: #374151;">Loading checkout...</p>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
    document.body.appendChild(loadingDiv);
  }
  
  hideLoadingState() {
    const loadingDiv = document.getElementById('checkout-loading');
    if (loadingDiv) {
      loadingDiv.remove();
    }
  }
}

// Global function for toggling items (called from HTML)
function toggleItems() {
  const itemsContent = document.getElementById('items-content');
  const toggleIcon = document.getElementById('items-toggle');
  
  if (itemsContent.classList.contains('expanded')) {
    itemsContent.classList.remove('expanded');
    toggleIcon.classList.remove('rotated');
  } else {
    itemsContent.classList.add('expanded');
    toggleIcon.classList.add('rotated');
  }
}

// Initialize checkout when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.checkoutManager = new CheckoutManager();
});

// Public API wrappers
window.initCheckoutPage = function(){ window.checkoutManager = new CheckoutManager(); };
window.populateItemsFromCart = function(){ window.checkoutManager.loadCartData(); window.checkoutManager.renderItems(); window.checkoutManager.updateOrderSummary(); };
window.bindPaymentNav = function(){ /* handlers are bound in constructor; stub provided for API */ };
window.setActivePaymentTab = function(tab){ window.checkoutManager.switchPaymentTab(tab); };
window.validatePaymentDetails = function(tab){ if (tab) window.checkoutManager.switchPaymentTab(tab); return window.checkoutManager.validatePaymentMethod(); };
window.computeSummary = function(){ return window.checkoutManager.calculateTotals(); };
window.updateSummaryUI = function(){ window.checkoutManager.updateOrderSummary(); };
window.placeOrder = function(){ window.checkoutManager.placeOrder(); };
window.persistOrderDraft = function(order){ try { localStorage.setItem('zylo_pending_payment', JSON.stringify(order)); } catch {} };

// Export for potential module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CheckoutManager;
}
