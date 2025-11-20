// Modern Admin Panel JavaScript for Zylo Ecommerce
// API Base URL - adjust this to match your backend server
const API_BASE_URL = 'http://localhost:5000/api';

// Global state
let currentTab = 'dashboard';
let dashboardData = {};
let products = [];
let orders = [];
let users = [];
let coupons = [];
let reviews = [];
let categories = [];
let isLoading = false;
let authToken = null;
let currentUser = null;

// ======================
// AUTHENTICATION UTILITIES
// ======================

// Get auth token from localStorage
function getAuthToken() {
    return localStorage.getItem('admin_token');
}

// Set auth token in localStorage
function setAuthToken(token) {
    console.log('Setting auth token:', token);
    localStorage.setItem('admin_token', token);
    authToken = token;
    console.log('Token stored in localStorage:', localStorage.getItem('admin_token'));
}

// Remove auth token
function clearAuthToken() {
    localStorage.removeItem('admin_token');
    authToken = null;
}

// Check if user is authenticated
function isAuthenticated() {
    const token = getAuthToken();
    console.log('Checking authentication - token exists:', !!token);
    if (!token) return false;
    
    // Basic token validation - check if it looks like a JWT
    try {
        const parts = token.split('.');
        console.log('Token parts length:', parts.length);
        if (parts.length !== 3) return false;
        
        // Decode payload to check expiration
        const payload = JSON.parse(atob(parts[1]));
        const now = Math.floor(Date.now() / 1000);
        console.log('Token payload:', payload);
        console.log('Current timestamp:', now);
        console.log('Token exp:', payload.exp);
        
        // Check if token is expired
        if (payload.exp && payload.exp < now) {
            console.log('Token expired, clearing auth...');
            clearAuthToken();
            return false;
        }
        
        console.log('Token is valid');
        return true;
    } catch (error) {
        console.warn('Invalid token format, clearing auth...', error);
        clearAuthToken();
        return false;
    }
}

// Create authenticated fetch request
async function apiRequest(url, options = {}) {
    const token = getAuthToken();
    
    const config = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...options.headers
        }
    };
    
    const response = await fetch(`${API_BASE_URL}${url}`, config);
    
    if (response.status === 401) {
        // Token expired or invalid
        clearAuthToken();
        showLogin();
        throw new Error('Authentication required');
    }
    
    return response;
}

// ======================
// LOGIN FUNCTIONALITY
// ======================

function showLogin() {
    const loginModal = document.createElement('div');
    loginModal.className = 'admin-login-screen';
    loginModal.innerHTML = `
        <div class="login-container">
            <div class="login-card">
                <div class="login-header">
                    <div class="login-logo">
                        <i class="fas fa-cogs"></i>
                    </div>
                    <h1>Admin Panel</h1>
                    <p>Sign in to manage your Zylo Ecommerce</p>
                </div>
                <form id="login-form" class="login-form">
                    <div class="form-group">
                        <label class="form-label">Email Address</label>
                        <div class="input-wrapper">
                            <i class="fas fa-envelope input-icon"></i>
                            <input type="email" class="form-input" id="login-email" placeholder="Enter your email" required>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Password</label>
                        <div class="input-wrapper">
                            <i class="fas fa-lock input-icon"></i>
                            <input type="password" class="form-input" id="login-password" placeholder="Enter your password" required>
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary login-btn">
                        <i class="fas fa-sign-in-alt"></i>
                        <span>Sign In</span>
                    </button>
                </form>
                <div class="login-footer">
                    <small>© 2025 Zylo Ecommerce. Admin Access Only.</small>
                </div>
            </div>
        </div>
        <style>
            .admin-login-screen {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                animation: fadeIn 0.5s ease;
            }
            .login-container {
                width: 100%;
                max-width: 500px;
                padding: 2rem;
            }
            .login-card {
                background: white;
                border-radius: 16px;
                padding: 3rem 3.5rem;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                text-align: center;
                animation: slideUp 0.6s ease;
                min-width: 450px;
            }
            .login-header {
                margin-bottom: 2rem;
            }
            .login-logo {
                width: 60px;
                height: 60px;
                background: linear-gradient(135deg, #667eea, #764ba2);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 1rem;
                color: white;
                font-size: 1.5rem;
            }
            .login-header h1 {
                margin: 0 0 0.5rem 0;
                color: #1e293b;
                font-size: 1.75rem;
                font-weight: 700;
            }
            .login-header p {
                margin: 0;
                color: #64748b;
                font-size: 0.9rem;
            }
            .login-form {
                text-align: left;
            }
            .input-wrapper {
                position: relative;
            }
            .input-icon {
                position: absolute;
                left: 12px;
                top: 50%;
                transform: translateY(-50%);
                color: #9ca3af;
                font-size: 0.9rem;
            }
            .login-form .form-input {
                padding-left: 2.5rem;
                padding-right: 1rem;
                height: 52px;
                width: 100%;
                border: 2px solid #e5e7eb;
                border-radius: 8px;
                transition: all 0.2s ease;
                font-size: 1rem;
            }
            .login-form .form-group {
                margin-bottom: 1.5rem;
            }
            .login-form .form-input:focus {
                border-color: #667eea;
                box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
            }
            .login-btn {
                width: 100%;
                height: 54px;
                margin-top: 2rem;
                background: linear-gradient(135deg, #667eea, #764ba2);
                border: none;
                border-radius: 8px;
                font-size: 1.1rem;
                font-weight: 600;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.75rem;
                transition: all 0.2s ease;
                letter-spacing: 0.5px;
            }
            .login-btn:hover {
                transform: translateY(-1px);
                box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
            }
            .login-footer {
                margin-top: 1.5rem;
                color: #9ca3af;
            }
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideUp {
                from { transform: translateY(30px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            @keyframes slideDown {
                from { transform: translateY(0); opacity: 1; }
                to { transform: translateY(30px); opacity: 0; }
            }
            @media (max-width: 768px) {
                .login-container {
                    max-width: 90%;
                    padding: 1rem;
                }
                .login-card {
                    min-width: auto;
                    padding: 2rem;
                }
            }
        </style>
    `;
    
    document.body.appendChild(loginModal);
    
    const form = document.getElementById('login-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        
        // Add loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
        submitBtn.disabled = true;
        
        try {
            console.log('Attempting login for:', email);
            
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            
            console.log('Login response status:', response.status);
            
            const data = await response.json();
            console.log('Login response data:', data);
            
            if (data.success && data.user) {
                if (data.user.isAdmin) {
                    setAuthToken(data.token);
                    currentUser = data.user;
                    
                    // Add success animation before removing login screen
                    const loginCard = loginModal.querySelector('.login-card');
                    loginCard.style.animation = 'slideDown 0.5s ease';
                    
                    setTimeout(() => {
                        document.body.removeChild(loginModal);
                        showAlert('Login successful! Welcome to admin panel.', 'success');
                        initializeAdminPanel();
                    }, 300);
                } else {
                    showAlert('Access denied. Admin privileges required.', 'error');
                }
            } else {
                showAlert(data.message || 'Login failed. Please check your credentials.', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            showAlert('Network error. Please check if the backend server is running.', 'error');
        } finally {
            // Restore button state
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        clearAuthToken();
        currentUser = null;
        // Clear stored tab state
        localStorage.removeItem('admin_current_tab');
        showAlert('Logged out successfully', 'success');
        showLogin();
    }
}

// Initialize admin panel
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is already authenticated
    if (isAuthenticated()) {
        // User has valid token, restore session
        console.log('User already authenticated, restoring session...');
        restoreSession();
    } else {
        // No valid token, show login form
        console.log('No authentication found, showing login...');
        showLogin();
    }
});

// Restore user session after page refresh
function restoreSession() {
    // Get stored current tab or default to dashboard
    const lastTab = localStorage.getItem('admin_current_tab') || 'dashboard';
    currentTab = lastTab;
    
    // Initialize the admin panel
    initializeAdminPanel();
    
    // Restore the last active tab
    showTab(lastTab);
}

// Enhanced initialization
function initializeAdminPanel() {
    setupEventListeners();
    
    // Load dashboard data since dashboard is active by default
    showDashboardPlaceholder();
    loadDashboardData();
    
    checkApiHealth();
    
    // Set up real-time updates
    setInterval(() => {
        if (currentTab === 'dashboard') {
            refreshDashboardStats();
        }
    }, 30000); // Refresh every 30 seconds
}

// Setup all event listeners
function setupEventListeners() {
    // Tab switching is handled by onclick attributes in HTML
    // No additional setup needed as showTab is globally accessible
    
    // Modal close handlers
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            // Hide only the clicked modal instead of removing all
            e.target.classList.remove('active');
            e.target.style.display = 'none';
        }
    });
    
    // Setup coupon form submission handler when tab loads
    if (document.getElementById('coupon-form')) {
        const couponForm = document.getElementById('coupon-form');
        couponForm.addEventListener('submit', handleCouponSubmit);
    }
}


// Setup size checkbox interactions
function setupSizeCheckboxes() {
    const sizeCheckboxes = document.querySelectorAll('.size-checkbox');
    sizeCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('click', function() {
            const input = this.querySelector('input');
            input.checked = !input.checked;
            this.classList.toggle('selected', input.checked);
        });
    });
}

// Setup form submission
function setupFormSubmission() {
    const form = document.getElementById('add-product-form');
    form.addEventListener('submit', handleAddProduct);
}

// Handle adding new product
async function handleAddProduct(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const productData = {
        name: formData.get('name'),
        brand: formData.get('brand'),
        price: parseFloat(formData.get('price')),
        category: formData.get('category'),
        image: formData.get('image') || '../img/products/default.jpg',
        stock: parseInt(formData.get('stock')) || 100,
        description: formData.get('description') || '',
        sizes: []
    };

    // Get selected sizes
    const sizeInputs = document.querySelectorAll('input[name="sizes"]:checked');
    productData.sizes = Array.from(sizeInputs).map(input => input.value);

    try {
        const response = await fetch(`${API_BASE_URL}/products`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(productData)
        });

        const result = await response.json();

        if (result.success) {
            showAlert('Product added successfully!', 'success');
            e.target.reset();
            resetSizeCheckboxes();
            loadStatistics();
            
            // Switch to manage products tab to show the new product
            showTab('manage-products');
            loadProducts();
        } else {
            throw new Error(result.message || 'Failed to add product');
        }
    } catch (error) {
        console.error('Error adding product:', error);
        showAlert(`Error: ${error.message}`, 'error');
    }
}

// Reset size checkboxes
function resetSizeCheckboxes() {
    const sizeCheckboxes = document.querySelectorAll('.size-checkbox');
    sizeCheckboxes.forEach(checkbox => {
        const input = checkbox.querySelector('input');
        input.checked = false;
        checkbox.classList.remove('selected');
    });
}

// Load and display statistics
async function loadStatistics() {
    try {
        const [productsResponse, categoriesResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/products`),
            fetch(`${API_BASE_URL}/products/categories/list`)
        ]);

        if (productsResponse.ok && categoriesResponse.ok) {
            const productsData = await productsResponse.json();
            const categoriesData = await categoriesResponse.json();

            const products = productsData.items || [];
            const totalProducts = products.length;
            const totalCategories = categoriesData.categories ? categoriesData.categories.length : 0;
            const totalBrands = categoriesData.brands ? categoriesData.brands.length : 0;
            const avgPrice = products.length > 0 
                ? Math.round(products.reduce((sum, p) => sum + p.price, 0) / products.length)
                : 0;

            // Update statistics display
            document.getElementById('total-products').textContent = totalProducts;
            document.getElementById('total-categories').textContent = totalCategories;
            document.getElementById('total-brands').textContent = totalBrands;
            document.getElementById('avg-price').textContent = `₹${avgPrice}`;
        }
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

// Load and display products
async function loadProducts() {
    try {
        showLoading('products-table-body');
        
        const response = await apiRequest('/products?limit=100');
        const data = await response.json();
        
        if (data.success && data.items) {
            products = data.items;
            displayProductsTable(products);
            console.log(`Loaded ${products.length} products`);
        } else {
            throw new Error('Failed to load products');
        }
    } catch (error) {
        console.error('Error loading products:', error);
        if (error.message !== 'Authentication required') {
            showAlert('Failed to load products', 'error');
        }
        const tbody = document.getElementById('products-table-body');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="9" class="loading">Error loading products</td></tr>';
        }
    }
}

// Display products in table format
function displayProductsTable(products) {
    const tbody = document.getElementById('products-table-body');
    if (!tbody) return;
    
    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="loading">No products found</td></tr>';
        return;
    }
    
    tbody.innerHTML = products.map(product => {
        // Generate star rating display
        const rating = product.averageRating || 0;
        const totalRatings = product.totalRatings || 0;
        let ratingDisplay = '';
        
        if (totalRatings > 0) {
            let stars = '';
            for (let i = 1; i <= 5; i++) {
                stars += i <= rating ? '<i class="fas fa-star" style="color: #fbbf24; font-size: 12px;"></i>' : '<i class="far fa-star" style="color: #d1d5db; font-size: 12px;"></i>';
            }
            ratingDisplay = `
                <div style="display: flex; align-items: center; gap: 4px;">
                    ${stars}
                    <small style="color: #6b7280; margin-left: 4px;">${rating.toFixed(1)} (${totalRatings})</small>
                </div>
            `;
        } else {
            ratingDisplay = '<small style="color: #9ca3af;">No ratings</small>';
        }
        
        // Product status badge
        const status = product.status || 'active';
        let statusClass = 'badge-success';
        let statusText = 'Active';
        
        switch (status.toLowerCase()) {
            case 'active':
                statusClass = 'badge-success';
                statusText = 'Active';
                break;
            case 'inactive':
                statusClass = 'badge-secondary';
                statusText = 'Inactive';
                break;
            case 'out_of_stock':
                statusClass = 'badge-danger';
                statusText = 'Out of Stock';
                break;
            default:
                statusClass = 'badge-info';
                statusText = status.charAt(0).toUpperCase() + status.slice(1);
        }
        
        return `
            <tr>
                <td>
                    <img src="${product.image || '../img/products/default.jpg'}" 
                         alt="${product.name}" 
                         class="product-image-small"
                         onerror="this.src='../img/products/default.jpg'"
                         style="width: 50px; height: 50px; object-fit: cover; border-radius: 8px;">
                </td>
                <td><strong>${product.name}</strong></td>
                <td>${product.brand}</td>
                <td>${product.category}</td>
                <td><strong>₹${product.price?.toLocaleString('en-IN') || '0'}</strong></td>
                <td>${ratingDisplay}</td>
                <td>
                    <span class="badge ${(product.stock || 0) > 0 ? 'badge-info' : 'badge-warning'}" style="font-size: 11px;">
                        ${product.stock || 0} units
                    </span>
                </td>
                <td>
                    <span class="badge ${statusClass}">
                        ${statusText}
                    </span>
                </td>
                <td>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-small btn-secondary" onclick="editProduct('${product.id}')" title="Edit Product">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-small btn-danger" onclick="deleteProduct('${product.id}')" title="Delete Product">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Create product card element
function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    
    const sizesHtml = product.sizes && product.sizes.length > 0 
        ? product.sizes.join(', ') 
        : 'No sizes specified';

    card.innerHTML = `
        <img src="${product.image || '../img/products/default.jpg'}" 
             alt="${product.name}" 
             class="product-image"
             onerror="this.src='../img/products/default.jpg'">
        <div class="product-info">
            <div class="brand">${product.brand}</div>
            <h3>${product.name}</h3>
            <div class="price">₹${product.price}</div>
            <div style="margin: 10px 0;">
                <strong>Category:</strong> ${product.category}<br>
                <strong>Stock:</strong> ${product.stock}<br>
                <strong>Sizes:</strong> ${sizesHtml}<br>
                <strong>ID:</strong> ${product.id}
            </div>
            ${product.description ? `<p style="font-size: 14px; color: #666;">${product.description.substring(0, 100)}${product.description.length > 100 ? '...' : ''}</p>` : ''}
        </div>
        <div class="product-actions">
            <button onclick="editProduct('${product.id}')" class="btn btn-secondary" style="flex: 1; font-size: 14px;">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button onclick="deleteProduct('${product.id}')" class="btn btn-danger" style="flex: 1; font-size: 14px;">
                <i class="fas fa-trash"></i> Delete
            </button>
        </div>
    `;
    
    return card;
}

// Edit product
function editProduct(productId) {
    const product = products.find(p => p.id === productId);
    if (product) {
        showProductForm(product);
    } else {
        showAlert('Product not found', 'error');
    }
}

// Delete product
async function deleteProduct(productId) {
    const product = products.find(p => p.id === productId);
    const productName = product ? product.name : productId;
    
    if (!confirm(`Are you sure you want to delete "${productName}"?\n\nThis action cannot be undone.`)) {
        return;
    }

    try {
        const response = await apiRequest(`/products/${productId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            showAlert('Product deleted successfully!', 'success');
            await loadProducts();
            // Refresh dashboard if we're on it
            if (currentTab === 'dashboard') {
                refreshDashboardStats();
            }
        } else {
            throw new Error(result.message || 'Failed to delete product');
        }
    } catch (error) {
        console.error('Error deleting product:', error);
        if (error.message !== 'Authentication required') {
            showAlert(`Error: ${error.message}`, 'error');
        }
    }
}

// ======================
// NAVIGATION
// ======================

// Tab switching functionality with modern animations
function showTab(tabName) {
    if (isLoading) return;
    
    // Update current tab and save to localStorage
    currentTab = tabName;
    localStorage.setItem('admin_current_tab', tabName);
    
    // Hide all tab contents with fade effect
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(tab => {
        tab.classList.remove('active');
        tab.style.opacity = '0';
    });
    
    // Remove active class from all nav tabs
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => tab.classList.remove('active'));
    
    // Show selected tab content with fade in effect
    setTimeout(() => {
        const selectedTab = document.getElementById(tabName);
        const activeTab = Array.from(navTabs).find(tab => 
            tab.textContent.toLowerCase().trim().includes(tabName.toLowerCase())
        );
        
        if (selectedTab) {
            selectedTab.classList.add('active');
            selectedTab.style.opacity = '1';
        }
        
        if (activeTab) {
            activeTab.classList.add('active');
        }
        
        // Update page title
        updatePageTitle(tabName);
        
        // Load tab-specific data
        loadTabData(tabName);
    }, 150);
}

// Update page title based on current tab
function updatePageTitle(tabName) {
    const pageTitle = document.getElementById('page-title');
    const titles = {
        'dashboard': 'Dashboard',
        'products': 'Product Management',
        'orders': 'Order Management',
        'users': 'User Management',
        'categories': 'Category Management',
        'coupons': 'Coupon Management',
        'reviews': 'Review Management',
        'analytics': 'Analytics & Reports',
        'settings': 'System Settings'
    };
    
    if (pageTitle) {
        pageTitle.textContent = titles[tabName] || 'Admin Panel';
    }
}

// Load tab-specific data
function loadTabData(tabName) {
    // Cleanup previous tab resources
    cleanupTabResources(currentTab);
    
    switch(tabName) {
        case 'dashboard':
            showDashboardPlaceholder();
            loadDashboardData();
            break;
        case 'orders':
            loadOrders();
            break;
        case 'products':
            loadProducts();
            break;
        case 'users':
            loadUsers();
            setTimeout(setupUserSearch, 100); // Setup search after DOM is ready
            break;
        case 'categories':
            loadCategories();
            break;
        case 'coupons':
            loadCoupons();
            setupCouponFormHandler();
            break;
        case 'reviews':
            loadReviews();
            break;
        case 'analytics':
            loadAnalytics();
            break;
        case 'settings':
            loadSettings();
            break;
    }
}

// Clean up resources when switching tabs
function cleanupTabResources(previousTab) {
    if (previousTab === 'analytics') {
        // Stop any pending analytics loading
        analyticsLoading = false;
        
        // Clean up charts to free memory
        if (chartsInitialized) {
            console.log('Cleaning up analytics charts');
            destroyAllCharts();
        }
    }
}

// Demo Tools Functions

// Seed demo products
async function seedDemoProducts() {
    if (!confirm('This will add/update demo products in your database. Continue?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/products/seed`, {
            method: 'POST'
        });

        const result = await response.json();

        if (result.success) {
            showAlert(`Successfully seeded ${result.count} demo products!`, 'success');
            loadStatistics();
            loadProducts();
        } else {
            throw new Error(result.message || 'Failed to seed products');
        }
    } catch (error) {
        console.error('Error seeding products:', error);
        showAlert(`Error: ${error.message}`, 'error');
    }
}

// Clear all products
async function clearAllProducts() {
    if (!confirm('⚠️ This will DELETE ALL products from your database. This action cannot be undone. Are you absolutely sure?')) {
        return;
    }

    if (!confirm('Last chance! This will permanently delete ALL products. Continue?')) {
        return;
    }

    try {
        // Get all products first
        const response = await fetch(`${API_BASE_URL}/products`);
        const data = await response.json();

        if (data.success && data.items) {
            const deletePromises = data.items.map(product => 
                fetch(`${API_BASE_URL}/products/${product.id}`, { method: 'DELETE' })
            );

            await Promise.all(deletePromises);
            showAlert('All products deleted successfully!', 'success');
            loadStatistics();
            loadProducts();
        }
    } catch (error) {
        console.error('Error clearing products:', error);
        showAlert(`Error: ${error.message}`, 'error');
    }
}

// Add random product for testing
async function addRandomProduct() {
    const randomProducts = [
        {
            name: 'Vintage Denim Jacket',
            brand: 'Vintage Co',
            price: 2199,
            category: 'jackets',
            sizes: ['S', 'M', 'L'],
            description: 'Classic vintage-style denim jacket with premium quality fabric.'
        },
        {
            name: 'Striped Cotton T-Shirt',
            brand: 'StripeWear',
            price: 899,
            category: 'tshirt',
            sizes: ['S', 'M', 'L', 'XL'],
            description: 'Comfortable striped cotton t-shirt perfect for casual wear.'
        },
        {
            name: 'Premium Wool Sweater',
            brand: 'WarmWool',
            price: 3299,
            category: 'sweaters',
            sizes: ['M', 'L', 'XL'],
            description: 'Luxurious wool sweater to keep you warm and stylish.'
        },
        {
            name: 'Cargo Shorts',
            brand: 'AdventureWear',
            price: 1499,
            category: 'shorts',
            sizes: ['S', 'M', 'L', 'XL'],
            description: 'Durable cargo shorts with multiple pockets for utility and style.'
        },
        {
            name: 'Silk Formal Shirt',
            brand: 'SilkLux',
            price: 4599,
            category: 'shirts',
            sizes: ['S', 'M', 'L', 'XL'],
            description: 'Elegant silk formal shirt perfect for business meetings.'
        }
    ];

    const randomProduct = randomProducts[Math.floor(Math.random() * randomProducts.length)];
    
    try {
        const response = await fetch(`${API_BASE_URL}/products`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(randomProduct)
        });

        const result = await response.json();

        if (result.success) {
            showAlert(`Random product "${randomProduct.name}" added successfully!`, 'success');
            loadStatistics();
            
            // Switch to manage products tab to show the new product
            showTab('manage-products');
            loadProducts();
        } else {
            throw new Error(result.message || 'Failed to add random product');
        }
    } catch (error) {
        console.error('Error adding random product:', error);
        showAlert(`Error: ${error.message}`, 'error');
    }
}

// Show alert message
function showAlert(message, type = 'success') {
    const alert = document.getElementById('alert');
    const alertMessage = document.getElementById('alert-message');
    
    alertMessage.textContent = message;
    alert.className = `alert ${type}`;
    alert.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        alert.style.display = 'none';
    }, 5000);
    
    // Scroll to top to make alert visible
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ======================
// DASHBOARD FUNCTIONS
// ======================

// Show immediate dashboard placeholder while loading data
function showDashboardPlaceholder() {
    const dashboardTab = document.getElementById('dashboard');
    const quickActionsCard = dashboardTab.querySelector('.card');
    
    // Check if dashboard stats already exist
    let existingStats = dashboardTab.querySelector('.dashboard-stats');
    
    if (!existingStats && quickActionsCard) {
        // Create loading placeholder immediately
        const placeholderHTML = `
            <div class="dashboard-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
                <div class="card">
                    <div class="card-content" style="text-align: center;">
                        <div style="font-size: 2.5rem; font-weight: 700; color: #3b82f6; margin-bottom: 0.5rem;">
                            <div class="loading-skeleton" style="width: 60px; height: 40px; background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: loading 1.5s infinite; margin: 0 auto; border-radius: 8px;"></div>
                        </div>
                        <div style="color: #6b7280; font-weight: 500;">Total Orders</div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-content" style="text-align: center;">
                        <div style="font-size: 2.5rem; font-weight: 700; color: #10b981; margin-bottom: 0.5rem;">
                            <div class="loading-skeleton" style="width: 80px; height: 40px; background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: loading 1.5s infinite; margin: 0 auto; border-radius: 8px;"></div>
                        </div>
                        <div style="color: #6b7280; font-weight: 500;">Total Revenue</div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-content" style="text-align: center;">
                        <div style="font-size: 2.5rem; font-weight: 700; color: #8b5cf6; margin-bottom: 0.5rem;">
                            <div class="loading-skeleton" style="width: 60px; height: 40px; background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: loading 1.5s infinite; margin: 0 auto; border-radius: 8px;"></div>
                        </div>
                        <div style="color: #6b7280; font-weight: 500;">Total Users</div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-content" style="text-align: center;">
                        <div style="font-size: 2.5rem; font-weight: 700; color: #f59e0b; margin-bottom: 0.5rem;">
                            <div class="loading-skeleton" style="width: 60px; height: 40px; background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: loading 1.5s infinite; margin: 0 auto; border-radius: 8px;"></div>
                        </div>
                        <div style="color: #6b7280; font-weight: 500;">Total Products</div>
                    </div>
                </div>
            </div>
            <style>
                @keyframes loading {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
            </style>
        `;
        
        // Insert placeholder before quick actions
        quickActionsCard.insertAdjacentHTML('beforebegin', placeholderHTML);
    }
}

async function loadDashboardData() {
    try {
        console.log('Loading dashboard data...');
        
        const response = await apiRequest('/admin/dashboard');
        const data = await response.json();
        
        if (data.success) {
            dashboardData = data.stats;
            updateDashboardDisplay(data.stats);
        } else {
            showAlert('Failed to load dashboard data', 'error');
        }
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        if (error.message !== 'Authentication required') {
            showAlert('Failed to connect to server', 'error');
        }
    }
}

// Update dashboard display with real data
function updateDashboardDisplay(stats) {
    const dashboardTab = document.getElementById('dashboard');
    const quickActionsCard = dashboardTab.querySelector('.card');
    
    // Check if dashboard stats already exist
    let existingStats = dashboardTab.querySelector('.dashboard-stats');
    
    if (existingStats) {
        // Update existing stats instead of creating new ones
        const statElements = existingStats.querySelectorAll('.card-content div:first-child');
        if (statElements.length >= 4) {
            // Replace skeleton loaders or update existing values
            statElements[0].innerHTML = stats.totalOrders || 0;
            statElements[1].innerHTML = `₹${(stats.totalRevenue || 0).toLocaleString('en-IN')}`;
            statElements[2].innerHTML = stats.totalUsers || 0;
            statElements[3].innerHTML = stats.totalProducts || 0;
        }
    } else {
        // Create statistics section only if it doesn't exist
        const statsHTML = `
            <div class="dashboard-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
                <div class="card">
                    <div class="card-content" style="text-align: center;">
                        <div style="font-size: 2.5rem; font-weight: 700; color: #3b82f6; margin-bottom: 0.5rem;">
                            ${stats.totalOrders || 0}
                        </div>
                        <div style="color: #6b7280; font-weight: 500;">Total Orders</div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-content" style="text-align: center;">
                        <div style="font-size: 2.5rem; font-weight: 700; color: #10b981; margin-bottom: 0.5rem;">
                            ₹${(stats.totalRevenue || 0).toLocaleString('en-IN')}
                        </div>
                        <div style="color: #6b7280; font-weight: 500;">Total Revenue</div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-content" style="text-align: center;">
                        <div style="font-size: 2.5rem; font-weight: 700; color: #8b5cf6; margin-bottom: 0.5rem;">
                            ${stats.totalUsers || 0}
                        </div>
                        <div style="color: #6b7280; font-weight: 500;">Total Users</div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-content" style="text-align: center;">
                        <div style="font-size: 2.5rem; font-weight: 700; color: #f59e0b; margin-bottom: 0.5rem;">
                            ${stats.totalProducts || 0}
                        </div>
                        <div style="color: #6b7280; font-weight: 500;">Total Products</div>
                    </div>
                </div>
            </div>
        `;
        
        // Insert stats before quick actions
        if (quickActionsCard) {
            quickActionsCard.insertAdjacentHTML('beforebegin', statsHTML);
        }
    }
    
    console.log('Dashboard updated with real data:', stats);
}

// Refresh dashboard stats silently
async function refreshDashboardStats() {
    try {
        const response = await apiRequest('/admin/dashboard');
        const data = await response.json();
        
        if (data.success) {
            // Update existing stat values without rebuilding UI
            const statElements = document.querySelectorAll('.dashboard-stats .card-content div:first-child');
            if (statElements.length >= 4) {
                statElements[0].textContent = data.stats.totalOrders || 0;
                statElements[1].textContent = `₹${(data.stats.totalRevenue || 0).toLocaleString('en-IN')}`;
                statElements[2].textContent = data.stats.totalUsers || 0;
                statElements[3].textContent = data.stats.totalProducts || 0;
            }
        }
    } catch (error) {
        console.error('Error refreshing dashboard stats:', error);
    }
}

// ======================
// PLACEHOLDER FUNCTIONS
// ======================

// Load and display orders
async function loadOrders() {
    try {
        showLoading('orders-table-body');
        
        const response = await apiRequest('/admin/orders?limit=50');
        const data = await response.json();
        
        if (data.success && data.orders) {
            orders = data.orders;
            displayOrdersTable(orders);
            console.log(`Loaded ${orders.length} orders`);
        } else {
            throw new Error('Failed to load orders');
        }
    } catch (error) {
        console.error('Error loading orders:', error);
        if (error.message !== 'Authentication required') {
            showAlert('Failed to load orders', 'error');
        }
        const tbody = document.getElementById('orders-table-body');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7" class="loading">Error loading orders</td></tr>';
        }
    }
}

// Display orders in table format
function displayOrdersTable(orders) {
    const tbody = document.getElementById('orders-table-body');
    if (!tbody) return;
    
    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading">No orders found</td></tr>';
        return;
    }
    
    tbody.innerHTML = orders.map(order => `
        <tr>
            <td><strong>#${order.id}</strong></td>
            <td>
                ${order.userId ? `${order.userId.firstName || ''} ${order.userId.lastName || ''}`.trim() || order.userId.email?.split('@')[0] || 'Unknown' : 'Unknown'}<br>
                <small style="color: #6b7280;">${order.userId?.email || ''}</small>
            </td>
            <td>${formatDate(order.createdAt)}</td>
            <td>${order.items?.length || 0} items</td>
            <td><strong>₹${order.totals?.total || 0}</strong></td>
            <td>
                <select class="form-select" onchange="updateOrderStatus('${order.id}', this.value)" style="font-size: 0.875rem; padding: 0.25rem;">
                    <option value="pending_payment" ${order.orderStatus === 'pending_payment' ? 'selected' : ''}>Pending Payment</option>
                    <option value="confirmed" ${order.orderStatus === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                    <option value="processing" ${order.orderStatus === 'processing' ? 'selected' : ''}>Processing</option>
                    <option value="packed" ${order.orderStatus === 'packed' ? 'selected' : ''}>Packed</option>
                    <option value="shipped" ${order.orderStatus === 'shipped' ? 'selected' : ''}>Shipped</option>
                    <option value="delivered" ${order.orderStatus === 'delivered' ? 'selected' : ''}>Delivered</option>
                    <option value="cancelled" ${order.orderStatus === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
            </td>
            <td>
                <button class="btn btn-small btn-info" onclick="viewOrderDetails('${order.id}')" title="View Details">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Update order status
async function updateOrderStatus(orderId, newStatus) {
    try {
        const response = await apiRequest(`/admin/orders/${orderId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ orderStatus: newStatus })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Order status updated successfully!', 'success');
            
            // Update local data
            const order = orders.find(o => o.id === orderId);
            if (order) {
                order.orderStatus = newStatus;
            }
            
            // Refresh dashboard if we're on it
            if (currentTab === 'dashboard') {
                refreshDashboardStats();
            }
        } else {
            throw new Error(result.message || 'Failed to update order status');
        }
    } catch (error) {
        console.error('Error updating order status:', error);
        if (error.message !== 'Authentication required') {
            showAlert(`Error: ${error.message}`, 'error');
        }
        // Reload orders to reset the dropdown
        loadOrders();
    }
}

// View order details
function viewOrderDetails(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) {
        showAlert('Order not found', 'error');
        return;
    }
    
    const modalHTML = `
        <div class="modal active">
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-receipt"></i> Order Details - #${order.id}</h3>
                    <button class="modal-close" onclick="hideOrderDetails()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid two-column">
                        <div>
                            <h4>Customer Information</h4>
                            <p><strong>Name:</strong> ${order.userId ? `${order.userId.firstName || ''} ${order.userId.lastName || ''}`.trim() || order.userId.email?.split('@')[0] || 'Unknown' : 'Unknown'}</p>
                            <p><strong>Email:</strong> ${order.userId?.email || 'N/A'}</p>
                            <p><strong>Order Date:</strong> ${formatDate(order.createdAt)}</p>
                            <p><strong>Status:</strong> <span class="badge badge-${getStatusColor(order.orderStatus)}">${formatStatus(order.orderStatus)}</span></p>
                        </div>
                        <div>
                            <h4>Order Summary</h4>
                            <p><strong>Items:</strong> ${order.items?.length || 0}</p>
                            <p><strong>Subtotal:</strong> ₹${order.totals?.subtotal || 0}</p>
                            <p><strong>Tax:</strong> ₹${order.totals?.tax || 0}</p>
                            <p><strong>Shipping:</strong> ₹${order.totals?.shipping || 0}</p>
                            <p><strong>Total:</strong> <strong>₹${order.totals?.total || 0}</strong></p>
                        </div>
                    </div>
                    
                    <h4>Items Ordered</h4>
                    <div class="table-container">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Brand</th>
                                    <th>Size</th>
                                    <th>Quantity</th>
                                    <th>Price</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${order.items?.map(item => `
                                    <tr>
                                        <td>${item.name}</td>
                                        <td>${item.brand}</td>
                                        <td>${item.size || 'N/A'}</td>
                                        <td>${item.quantity}</td>
                                        <td>₹${item.price}</td>
                                        <td>₹${item.price * item.quantity}</td>
                                    </tr>
                                `).join('') || '<tr><td colspan="6">No items found</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                    
                    ${order.shippingAddress ? `
                        <h4>Shipping Address</h4>
                        <p>${order.shippingAddress.street || ''}<br>
                        ${order.shippingAddress.city || ''}, ${order.shippingAddress.state || ''} ${order.shippingAddress.zipCode || ''}<br>
                        ${order.shippingAddress.country || ''}</p>
                    ` : ''}
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="hideOrderDetails()">
                        Close
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to body
    const modalElement = document.createElement('div');
    modalElement.innerHTML = modalHTML;
    modalElement.id = 'order-details-modal';
    document.body.appendChild(modalElement.firstElementChild);
}

// Hide order details modal
function hideOrderDetails() {
    const modal = document.getElementById('order-details-modal');
    if (modal) {
        modal.remove();
    } else {
        // Fallback to remove any modal
        const anyModal = document.querySelector('.modal');
        if (anyModal) {
            anyModal.remove();
        }
    }
}

// Load and display users
async function loadUsers() {
    try {
        showLoading('users-table-body');
        
        const response = await apiRequest('/admin/users?limit=50');
        const data = await response.json();
        
        if (data.success && data.users) {
            users = data.users;
            displayUsersTable(users);
            console.log(`Loaded ${users.length} users`);
        } else {
            throw new Error('Failed to load users');
        }
    } catch (error) {
        console.error('Error loading users:', error);
        if (error.message !== 'Authentication required') {
            showAlert('Failed to load users', 'error');
        }
        const tbody = document.getElementById('users-table-body');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7" class="loading">Error loading users</td></tr>';
        }
    }
}

// Display users in table format
function displayUsersTable(users) {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading">No users found</td></tr>';
        return;
    }
    
    tbody.innerHTML = users.map(user => {
        // Handle different name formats (name vs firstName/lastName)
        let displayName = 'Unknown';
        if (user.name) {
            displayName = user.name;
        } else if (user.firstName || user.lastName) {
            displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        } else if (user.email) {
            displayName = user.email.split('@')[0]; // Use email username as fallback
        }
        
        return `
        <tr>
            <td><code style="font-size: 0.75rem; background: #f3f4f6; padding: 0.25rem; border-radius: 4px;">${user._id}</code></td>
            <td><strong>${displayName}</strong></td>
            <td>${user.email || 'No email'}</td>
            <td>${formatDate(user.createdAt)}</td>
            <td>0</td> <!-- Orders count would need to be calculated -->
            <td>
                <span class="badge ${user.isAdmin ? 'badge-warning' : 'badge-success'}">
                    ${user.isAdmin ? 'Admin' : 'Customer'}
                </span>
            </td>
            <td>
                <button class="btn btn-small ${user.isAdmin ? 'btn-secondary' : 'btn-warning'}" 
                        onclick="toggleAdminStatus('${user._id}', ${!user.isAdmin})" 
                        title="${user.isAdmin ? 'Remove admin privileges' : 'Grant admin privileges'}">
                    <i class="fas fa-user-shield"></i>
                </button>
            </td>
        </tr>
        `;
    }).join('');
}

// Toggle user admin status
async function toggleAdminStatus(userId, makeAdmin) {
    const action = makeAdmin ? 'grant admin privileges to' : 'remove admin privileges from';
    const user = users.find(u => u._id === userId);
    
    // Get user name with fallback logic
    let userName = 'this user';
    if (user) {
        if (user.name) {
            userName = user.name;
        } else if (user.firstName || user.lastName) {
            userName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        } else if (user.email) {
            userName = user.email.split('@')[0];
        }
    }
    
    if (!confirm(`Are you sure you want to ${action} ${userName}?`)) {
        return;
    }
    
    try {
        const response = await apiRequest(`/admin/users/${userId}/admin`, {
            method: 'PUT',
            body: JSON.stringify({ isAdmin: makeAdmin })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert(`User ${makeAdmin ? 'promoted to admin' : 'demoted from admin'} successfully!`, 'success');
            await loadUsers();
        } else {
            throw new Error(result.message || 'Failed to update user status');
        }
    } catch (error) {
        console.error('Error updating user status:', error);
        if (error.message !== 'Authentication required') {
            showAlert(`Error: ${error.message}`, 'error');
        }
    }
}

// Search users functionality
function searchUsers() {
    const searchInput = document.getElementById('user-search');
    if (!searchInput) {
        console.error('Search input not found');
        return;
    }
    
    const searchTerm = searchInput.value.trim().toLowerCase();
    
    // Check if users array is loaded
    if (!users || users.length === 0) {
        console.log('No users loaded yet or users array is empty');
        const tbody = document.getElementById('users-table-body');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7" class="loading">Please wait while users are loading...</td></tr>';
        }
        return;
    }
    
    if (!searchTerm) {
        // If search is empty, show all users
        displayUsersTable(users);
        return;
    }
    
    // Filter users based on search term (make search more robust)
    const filteredUsers = users.filter(user => {
        // Build searchable name from available fields
        let searchableName = '';
        if (user.name) {
            searchableName = user.name;
        } else if (user.firstName || user.lastName) {
            searchableName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        }
        
        const name = searchableName.toLowerCase();
        const firstName = (user.firstName || '').toLowerCase();
        const lastName = (user.lastName || '').toLowerCase();
        const email = (user.email || '').toLowerCase();
        const id = (user._id || '').toLowerCase();
        
        return name.includes(searchTerm) || 
               firstName.includes(searchTerm) ||
               lastName.includes(searchTerm) ||
               email.includes(searchTerm) || 
               id.includes(searchTerm);
    });
    
    displayUsersTable(filteredUsers);
    console.log(`Found ${filteredUsers.length} users matching "${searchTerm}"`);
}

// Add real-time search as user types
function setupUserSearch() {
    const searchInput = document.getElementById('user-search');
    if (searchInput) {
        console.log('Setting up user search functionality');
        
        // Remove any existing event listeners to prevent duplicates
        searchInput.removeEventListener('input', searchInput._searchHandler);
        searchInput.removeEventListener('keypress', searchInput._keypressHandler);
        
        // Create new event handlers
        searchInput._searchHandler = () => {
            // Debounce the search to avoid too many calls
            clearTimeout(searchInput.searchTimeout);
            searchInput.searchTimeout = setTimeout(searchUsers, 300);
        };
        
        searchInput._keypressHandler = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                clearTimeout(searchInput.searchTimeout);
                searchUsers();
            }
        };
        
        // Add event listeners
        searchInput.addEventListener('input', searchInput._searchHandler);
        searchInput.addEventListener('keypress', searchInput._keypressHandler);
        
        console.log('User search event listeners added successfully');
    } else {
        console.warn('User search input not found when setting up search');
    }
}

// ======================
// COUPON MANAGEMENT
// ======================

// Setup coupon form event handlers
function setupCouponFormHandler() {
    setTimeout(() => {
        const couponForm = document.getElementById('coupon-form');
        if (couponForm && !couponForm.hasEventListener) {
            couponForm.addEventListener('submit', handleCouponSubmit);
            couponForm.hasEventListener = true;
            console.log('Coupon form handler setup complete');
        }
    }, 100);
}

// Show coupon form modal
function showCouponForm(coupon = null) {
    const modal = document.getElementById('coupon-form-modal');
    const form = document.getElementById('coupon-form');
    const title = document.getElementById('coupon-form-title');
    
    if (!modal || !form) {
        console.error('Coupon form modal not found');
        return;
    }
    
    // Reset form
    form.reset();
    
    if (coupon) {
        // Edit mode
        title.textContent = 'Edit Coupon';
        
        // Populate form with coupon data
        document.getElementById('coupon-code').value = coupon.code || '';
        document.getElementById('coupon-description').value = coupon.description || '';
        document.getElementById('discount-type').value = coupon.discountType || 'percentage';
        document.getElementById('discount-value').value = coupon.discountValue || '';
        document.getElementById('min-order-value').value = coupon.minimumOrderValue || 0;
        document.getElementById('max-discount').value = coupon.maximumDiscount || '';
        document.getElementById('usage-limit').value = coupon.usageLimit || '';
        
        // Format dates for datetime-local input
        if (coupon.validFrom) {
            document.getElementById('valid-from').value = formatDateTimeLocal(coupon.validFrom);
        }
        if (coupon.validTo) {
            document.getElementById('valid-to').value = formatDateTimeLocal(coupon.validTo);
        }
        
        // Store coupon ID for update
        form.dataset.couponId = coupon._id;
        
        // Update submit button text
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Coupon';
        }
    } else {
        // Create mode
        title.textContent = 'Create New Coupon';
        delete form.dataset.couponId;
        
        // Set default dates (valid from now, valid to 30 days from now)
        const now = new Date();
        const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        
        document.getElementById('valid-from').value = formatDateTimeLocal(now);
        document.getElementById('valid-to').value = formatDateTimeLocal(thirtyDaysLater);
        
        // Update submit button text
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Create Coupon';
        }
    }
    
    // Make modal visible per CSS contract
    modal.style.display = 'flex';
    modal.classList.add('active');
    
    // Focus on first input
    setTimeout(() => {
        const firstInput = form.querySelector('input');
        if (firstInput) firstInput.focus();
    }, 50);
}

// Hide coupon form modal
function hideCouponForm() {
    const modal = document.getElementById('coupon-form-modal');
    const form = document.getElementById('coupon-form');
    
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
    
    if (form) {
        form.reset();
        delete form.dataset.couponId;
    }
}

// Format date for datetime-local input
function formatDateTimeLocal(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Handle coupon form submission
async function handleCouponSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const couponId = form.dataset.couponId;
    const isEditing = !!couponId;
    
    // Get form data using element IDs (since the form might not have correct name attributes)
    const code = document.getElementById('coupon-code')?.value || '';
    const description = document.getElementById('coupon-description')?.value || '';
    const discountType = document.getElementById('discount-type')?.value || '';
    const discountValue = document.getElementById('discount-value')?.value || '';
    const minimumOrderValue = document.getElementById('min-order-value')?.value || '';
    const maximumDiscount = document.getElementById('max-discount')?.value || '';
    const usageLimit = document.getElementById('usage-limit')?.value || '';
    const validFromRaw = document.getElementById('valid-from')?.value || '';
    const validToRaw = document.getElementById('valid-to')?.value || '';
    
    // Build coupon data object - only include optional fields if they have values
    if (!currentUser || !currentUser._id) {
        showAlert('Error: Admin user not identified. Please log in again.', 'error');
        return;
    }

    const couponData = {
        code: code.trim().toUpperCase(),
        description: description.trim(),
        discountType: discountType,
        discountValue: parseFloat(discountValue),
        minimumOrderValue: parseFloat(minimumOrderValue) || 0,
        validFrom: validFromRaw ? new Date(validFromRaw).toISOString() : null,
        validTo: validToRaw ? new Date(validToRaw).toISOString() : null,
        createdBy: currentUser._id
    };
    
    // Only add optional fields if they have valid values
    if (maximumDiscount && maximumDiscount.trim() !== '') {
        couponData.maximumDiscount = parseFloat(maximumDiscount);
    }
    
    if (usageLimit && usageLimit.trim() !== '') {
        couponData.usageLimit = parseInt(usageLimit);
    }
    
    // Debug logging
    console.log('Authentication status:');
    console.log('  Auth token:', getAuthToken() ? 'Present' : 'Missing');
    console.log('  Current user:', currentUser);
    console.log('  Is authenticated:', isAuthenticated());
    console.log('Raw form values:');
    console.log('  code:', code);
    console.log('  description:', description);
    console.log('  discountType:', discountType);
    console.log('  discountValue:', discountValue);
    console.log('  minimumOrderValue:', minimumOrderValue);
    console.log('  maximumDiscount:', maximumDiscount);
    console.log('  usageLimit:', usageLimit);
    console.log('  validFrom:', validFromRaw);
    console.log('  validTo:', validToRaw);
    console.log('Processed coupon data:', couponData);
    console.log('JSON payload:', JSON.stringify(couponData, null, 2));
    
    // Validation
    if (!couponData.code || couponData.code.length < 3) {
        showAlert('Coupon code must be at least 3 characters long', 'error');
        return;
    }
    
    if (!couponData.description) {
        showAlert('Description is required', 'error');
        return;
    }
    
    if (!couponData.discountType) {
        showAlert('Discount type is required', 'error');
        return;
    }
    
    if (isNaN(couponData.discountValue) || couponData.discountValue <= 0) {
        showAlert('Discount value must be greater than 0', 'error');
        return;
    }
    
    if (couponData.discountType === 'percentage' && couponData.discountValue > 100) {
        showAlert('Percentage discount cannot exceed 100%', 'error');
        return;
    }
    
    if (!couponData.validFrom || !couponData.validTo) {
        showAlert('Both valid from and valid to dates are required', 'error');
        return;
    }
    
    const validFrom = new Date(couponData.validFrom);
    const validTo = new Date(couponData.validTo);
    
    if (validFrom >= validTo) {
        showAlert('Valid To date must be after Valid From date', 'error');
        return;
    }
    
    // Show loading state
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    submitBtn.disabled = true;
    
    try {
        const url = isEditing ? `/admin/coupons/${couponId}` : '/admin/coupons';
        const method = isEditing ? 'PUT' : 'POST';
        
        const response = await apiRequest(url, {
            method: method,
            body: JSON.stringify(couponData)
        });
        
        const result = await response.json();
        console.log('Backend response:', result);
        
        if (result.success) {
            showAlert(`Coupon ${isEditing ? 'updated' : 'created'} successfully!`, 'success');
            hideCouponForm();
            await loadCoupons();
            
            // Refresh dashboard if we're on it
            if (currentTab === 'dashboard') {
                refreshDashboardStats();
            }
        } else {
            // Handle validation errors from backend
            let errorMessage = result.message || `Failed to ${isEditing ? 'update' : 'create'} coupon`;
            
            // If there are validation errors, show them in detail
            if (result.errors && Array.isArray(result.errors)) {
                console.log('Detailed validation errors:', result.errors);
                const errorDetails = result.errors.map(err => {
                    // Handle different error object structures
                    if (typeof err === 'string') {
                        // MongoDB validation errors are sometimes just strings
                        return err;
                    } else {
                        const field = err.param || err.path || 'unknown field';
                        const message = err.msg || err.message || 'invalid value';
                        const value = err.value !== undefined ? ` (received: ${err.value})` : '';
                        return `${field}: ${message}${value}`;
                    }
                }).join('\n');
                errorMessage = `Validation Errors:\n${errorDetails}`;
            }
            
            throw new Error(errorMessage);
        }
    } catch (error) {
        console.error('Error saving coupon:', error);
        if (error.message !== 'Authentication required') {
            showAlert(`Error: ${error.message}`, 'error');
        }
    } finally {
        // Restore button state
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Edit coupon
function editCoupon(couponId) {
    const coupon = coupons.find(c => c._id === couponId);
    if (coupon) {
        showCouponForm(coupon);
    } else {
        showAlert('Coupon not found', 'error');
    }
}

// Delete coupon
async function deleteCoupon(couponId) {
    const coupon = coupons.find(c => c._id === couponId);
    const couponCode = coupon ? coupon.code : couponId;
    
    if (!confirm(`Are you sure you want to delete coupon "${couponCode}"?\n\nThis action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await apiRequest(`/admin/coupons/${couponId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Coupon deleted successfully!', 'success');
            await loadCoupons();
            
            // Refresh dashboard if we're on it
            if (currentTab === 'dashboard') {
                refreshDashboardStats();
            }
        } else {
            throw new Error(result.message || 'Failed to delete coupon');
        }
    } catch (error) {
        console.error('Error deleting coupon:', error);
        if (error.message !== 'Authentication required') {
            showAlert(`Error: ${error.message}`, 'error');
        }
    }
}

async function loadCoupons() {
    try {
        showLoading('coupons-table-body');
        
        const response = await apiRequest('/admin/coupons?limit=50');
        const data = await response.json();
        
        if (data.success && data.coupons) {
            coupons = data.coupons;
            displayCouponsTable(coupons);
            console.log(`Loaded ${coupons.length} coupons`);
        } else {
            throw new Error('Failed to load coupons');
        }
    } catch (error) {
        console.error('Error loading coupons:', error);
        if (error.message !== 'Authentication required') {
            showAlert('Failed to load coupons', 'error');
        }
        const tbody = document.getElementById('coupons-table-body');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8" class="loading">Error loading coupons</td></tr>';
        }
    }
}

// Display coupons in table format
function displayCouponsTable(coupons) {
    const tbody = document.getElementById('coupons-table-body');
    if (!tbody) return;
    
    if (coupons.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading">No coupons found</td></tr>';
        return;
    }
    
    tbody.innerHTML = coupons.map(coupon => {
        const validFrom = new Date(coupon.validFrom);
        const validTo = new Date(coupon.validTo);
        const now = new Date();
        
        let status = 'Active';
        let statusClass = 'success';
        
        if (now < validFrom) {
            status = 'Scheduled';
            statusClass = 'warning';
        } else if (now > validTo) {
            status = 'Expired';
            statusClass = 'danger';
        } else if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
            status = 'Used Up';
            statusClass = 'danger';
        }
        
        return `
        <tr>
            <td><strong>${coupon.code}</strong></td>
            <td>${coupon.description}</td>
            <td>
                <span class="badge badge-info">
                    ${coupon.discountType === 'percentage' ? 'Percentage' : 'Fixed Amount'}
                </span>
            </td>
            <td>
                ${coupon.discountType === 'percentage' 
                    ? `${coupon.discountValue}%` 
                    : `₹${coupon.discountValue}`}
                ${coupon.maximumDiscount ? `<br><small>Max: ₹${coupon.maximumDiscount}</small>` : ''}
            </td>
            <td>
                <small>${formatDate(coupon.validFrom)}<br>to<br>${formatDate(coupon.validTo)}</small>
            </td>
            <td>
                ${coupon.usedCount || 0}${coupon.usageLimit ? `/${coupon.usageLimit}` : '/∞'}
            </td>
            <td>
                <span class="badge badge-${statusClass}">${status}</span>
            </td>
            <td>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-small btn-secondary" onclick="editCoupon('${coupon._id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-small btn-danger" onclick="deleteCoupon('${coupon._id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
        `;
    }).join('');
}

// ======================
// REVIEW MANAGEMENT
// ======================

// Review management state
let currentReviewPage = 1;
let totalReviewPages = 1;
let selectedReviews = new Set();
let currentReviewId = null;
let reviewStats = {};

// Load and display reviews
async function loadReviews(page = 1) {
    try {
        showLoading('reviews-table-body');
        
        // Get filter values
        const status = document.getElementById('review-status-filter')?.value || '';
        const rating = document.getElementById('review-rating-filter')?.value || '';
        const sortBy = document.getElementById('review-sort')?.value || 'createdAt';
        
        // Build API parameters
        const params = new URLSearchParams({
            page: page,
            limit: 10,
            status: status,
            rating: rating,
            sortBy: sortBy,
            sortOrder: 'desc'
        });
        
        const response = await apiRequest(`/admin/reviews?${params}`);
        const data = await response.json();
        
        if (data.success) {
            reviews = data.reviews || [];
            currentReviewPage = data.pagination?.page || 1;
            totalReviewPages = data.pagination?.pages || 1;
            reviewStats = data.stats || {};
            
            displayReviewsTable(reviews);
            updateReviewStats(reviewStats);
            updateReviewPagination();
            
            console.log(`Loaded ${reviews.length} reviews`);
        } else {
            throw new Error(data.message || 'Failed to load reviews');
        }
    } catch (error) {
        console.error('Error loading reviews:', error);
        if (error.message !== 'Authentication required') {
            showAlert('Failed to load reviews', 'error');
        }
        const tbody = document.getElementById('reviews-table-body');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8" class="loading">Error loading reviews</td></tr>';
        }
    }
}

// Display reviews in table format
function displayReviewsTable(reviews) {
    const tbody = document.getElementById('reviews-table-body');
    if (!tbody) {
        console.error('❌ Reviews table body not found');
        return;
    }
    
    if (!reviews || reviews.length === 0) {
        console.log('📝 No reviews to display');
        tbody.innerHTML = '<tr><td colspan="8" class="loading">No reviews found</td></tr>';
        return;
    }
    
    console.log(`📝 Displaying ${reviews.length} reviews`);
    console.log('Sample review structure:', reviews[0]);
    
    tbody.innerHTML = reviews.map(review => {
        const customerName = review.userId?.name || 'Anonymous';
        const reviewId = review._id || review.id; // Support both _id and id
        const isSelected = selectedReviews.has(reviewId);
        const statusClass = review.isReported ? 'reported' : (review.isApproved ? 'approved' : 'pending');
        const statusText = review.isReported ? 'Reported' : (review.isApproved ? 'Approved' : 'Pending');
        
        return `
        <tr class="review-row ${statusClass}" data-review-id="${reviewId}">
            <td>
                <input type="checkbox" 
                       class="review-checkbox" 
                       value="${reviewId}" 
                       ${isSelected ? 'checked' : ''}
                       onchange="toggleReviewSelection('${reviewId}')">
            </td>
            <td>
                <div class="review-preview">
                    <div class="review-title">
                        <strong>${truncateText(review.title, 30)}</strong>
                    </div>
                    <div class="review-comment">
                        ${truncateText(review.comment, 60)}
                    </div>
                    ${review.images && review.images.length > 0 ? 
                        `<small class="text-muted"><i class="fas fa-camera"></i> ${review.images.length} image(s)</small>` : ''
                    }
                </div>
            </td>
            <td>
                <div class="product-info">
                    <small class="text-muted">Product ID:</small><br>
                    <code>${review.productId}</code>
                </div>
            </td>
            <td>
                <div class="customer-info">
                    <strong>${customerName}</strong><br>
                    <small class="text-muted">${review.userId?.email || ''}</small>
                </div>
            </td>
            <td>
                <div class="rating-display">
                    ${generateStarRating(review.rating)}
                    <span class="rating-value">${review.rating}/5</span>
                </div>
            </td>
            <td>
                <small>${formatDate(review.createdAt)}</small>
            </td>
            <td>
                <span class="badge badge-${getReviewStatusClass(statusClass)}">${statusText}</span>
                ${review.adminResponse ? '<br><small class="text-info"><i class="fas fa-reply"></i> Responded</small>' : ''}
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-small btn-info" 
                            onclick="viewReviewDetails('${reviewId}')" 
                            title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${!review.isApproved ? 
                        `<button class="btn btn-small btn-success" 
                                onclick="quickApproveReview('${reviewId}')" 
                                title="Quick Approve">
                            <i class="fas fa-check"></i>
                        </button>` : 
                        `<button class="btn btn-small btn-warning" 
                                onclick="quickRejectReview('${reviewId}')" 
                                title="Reject">
                            <i class="fas fa-times"></i>
                        </button>`
                    }
                    <button class="btn btn-small btn-danger" 
                            onclick="deleteReview('${reviewId}')" 
                            title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
        `;
    }).join('');
}

// Update review statistics display
function updateReviewStats(stats) {
    document.getElementById('total-reviews-count').textContent = stats.totalReviews || 0;
    document.getElementById('average-rating').textContent = 
        stats.averageRating ? stats.averageRating.toFixed(1) : '0.0';
    document.getElementById('pending-reviews').textContent = stats.pendingReviews || 0;
    document.getElementById('approved-reviews').textContent = stats.approvedReviews || 0;
    document.getElementById('reported-reviews').textContent = stats.reportedReviews || 0;
}

// Generate star rating HTML
function generateStarRating(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= rating) {
            stars += '<i class="fas fa-star text-warning"></i>';
        } else {
            stars += '<i class="far fa-star text-muted"></i>';
        }
    }
    return stars;
}

// Get review status CSS class
function getReviewStatusClass(status) {
    switch (status) {
        case 'approved': return 'success';
        case 'pending': return 'warning';
        case 'reported': return 'danger';
        default: return 'secondary';
    }
}

// Truncate text for display
function truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// Filter reviews based on current filter settings
function filterReviews() {
    currentReviewPage = 1;
    selectedReviews.clear();
    updateBulkActionsDisplay();
    loadReviews();
}

// Search reviews
function searchReviews() {
    const searchInput = document.getElementById('review-search');
    if (!searchInput) return;
    
    const searchTerm = searchInput.value.trim().toLowerCase();
    
    if (!reviews || reviews.length === 0) {
        console.log('No reviews loaded yet');
        return;
    }
    
    if (!searchTerm) {
        displayReviewsTable(reviews);
        return;
    }
    
    const filteredReviews = reviews.filter(review => {
        const title = (review.title || '').toLowerCase();
        const comment = (review.comment || '').toLowerCase();
        const customerName = (review.userId?.name || '').toLowerCase();
        const customerEmail = (review.userId?.email || '').toLowerCase();
        const productId = (review.productId || '').toLowerCase();
        
        return title.includes(searchTerm) ||
               comment.includes(searchTerm) ||
               customerName.includes(searchTerm) ||
               customerEmail.includes(searchTerm) ||
               productId.includes(searchTerm);
    });
    
    displayReviewsTable(filteredReviews);
    console.log(`Found ${filteredReviews.length} reviews matching "${searchTerm}"`);
}

// Toggle review selection
function toggleReviewSelection(reviewId) {
    if (selectedReviews.has(reviewId)) {
        selectedReviews.delete(reviewId);
    } else {
        selectedReviews.add(reviewId);
    }
    updateBulkActionsDisplay();
}

// Toggle all reviews selection
function toggleAllReviews() {
    const checkbox = document.getElementById('select-all-reviews');
    const reviewCheckboxes = document.querySelectorAll('.review-checkbox');
    
    reviewCheckboxes.forEach(cb => {
        cb.checked = checkbox.checked;
        const reviewId = cb.value;
        if (checkbox.checked) {
            selectedReviews.add(reviewId);
        } else {
            selectedReviews.delete(reviewId);
        }
    });
    
    updateBulkActionsDisplay();
}

// Update bulk actions display
function updateBulkActionsDisplay() {
    const bulkActionsBar = document.getElementById('bulk-actions-bar');
    const selectedCount = document.getElementById('selected-count');
    
    if (selectedReviews.size > 0) {
        bulkActionsBar.style.display = 'block';
        selectedCount.textContent = `${selectedReviews.size} selected`;
    } else {
        bulkActionsBar.style.display = 'none';
    }
}

// Clear selection
function clearSelection() {
    selectedReviews.clear();
    document.getElementById('select-all-reviews').checked = false;
    document.querySelectorAll('.review-checkbox').forEach(cb => cb.checked = false);
    updateBulkActionsDisplay();
}

// View review details
function viewReviewDetails(reviewId) {
    console.log('📝 Opening review details for ID:', reviewId);
    console.log('📝 Available reviews:', reviews.length);
    
    const review = reviews.find(r => (r._id || r.id) === reviewId);
    if (!review) {
        console.error('❌ Review not found with ID:', reviewId);
        console.log('Available review IDs:', reviews.map(r => r._id || r.id));
        showAlert('Review not found', 'error');
        return;
    }
    
    console.log('✅ Found review:', review);
    currentReviewId = reviewId;
    
    const modal = document.getElementById('review-modal');
    const content = document.getElementById('review-details-content');
    
    content.innerHTML = `
        <div class="review-details">
            <div class="row">
                <div class="col-md-6">
                    <h5>Customer Information</h5>
                    <p><strong>Name:</strong> ${review.userId?.name || 'Anonymous'}</p>
                    <p><strong>Email:</strong> ${review.userId?.email || 'N/A'}</p>
                    <p><strong>Verified Purchase:</strong> 
                        ${review.isVerifiedPurchase ? 
                            '<span class="badge badge-success">Yes</span>' : 
                            '<span class="badge badge-secondary">No</span>'
                        }
                    </p>
                </div>
                <div class="col-md-6">
                    <h5>Review Information</h5>
                    <p><strong>Product ID:</strong> ${review.productId}</p>
                    <p><strong>Rating:</strong> ${generateStarRating(review.rating)} ${review.rating}/5</p>
                    <p><strong>Date:</strong> ${formatDate(review.createdAt)}</p>
                    <p><strong>Status:</strong> 
                        <span class="badge badge-${getReviewStatusClass(review.isReported ? 'reported' : (review.isApproved ? 'approved' : 'pending'))}">
                            ${review.isReported ? 'Reported' : (review.isApproved ? 'Approved' : 'Pending')}
                        </span>
                    </p>
                </div>
            </div>
            
            <div class="review-content" style="margin: 1.5rem 0;">
                <h5>Review Content</h5>
                <div class="review-title" style="font-weight: 600; margin-bottom: 0.5rem;">
                    ${review.title}
                </div>
                <div class="review-comment" style="line-height: 1.6; color: #495057;">
                    ${review.comment}
                </div>
            </div>
            
            ${review.images && review.images.length > 0 ? `
                <div class="review-images" style="margin: 1.5rem 0;">
                    <h5>Review Images</h5>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        ${review.images.map(img => `
                            <img src="${img.url}" alt="${img.alt}" 
                                 style="width: 100px; height: 100px; object-fit: cover; border-radius: 4px; cursor: pointer;"
                                 onclick="window.open('${img.url}', '_blank')">
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${review.isReported && review.reportReasons && review.reportReasons.length > 0 ? `
                <div class="report-info" style="margin: 1.5rem 0; padding: 1rem; background: #fff3cd; border-radius: 4px;">
                    <h5 style="color: #856404;">Report Information</h5>
                    <p><strong>Reasons:</strong> ${review.reportReasons.join(', ')}</p>
                </div>
            ` : ''}
            
            ${review.adminResponse ? `
                <div class="admin-response" style="margin: 1.5rem 0; padding: 1rem; background: #d1ecf1; border-radius: 4px;">
                    <h5 style="color: #0c5460;">Admin Response</h5>
                    <p><strong>Response:</strong> ${review.adminResponse.message}</p>
                    <p><small><strong>By:</strong> ${review.adminResponse.respondedBy?.name || 'Admin'} 
                       on ${formatDate(review.adminResponse.respondedAt)}</small></p>
                </div>
            ` : ''}
            
            <div class="helpful-stats" style="margin: 1.5rem 0;">
                <h5>Engagement</h5>
                <p><strong>Helpful votes:</strong> ${review.isHelpful || 0}</p>
            </div>
        </div>
    `;
    
    // Update modal action buttons based on review status
    updateReviewModalButtons(review);
    
    modal.style.display = 'block';
}

// Update review modal buttons based on review status
function updateReviewModalButtons(review) {
    const approveBtn = document.getElementById('approve-review-btn');
    const rejectBtn = document.getElementById('reject-review-btn');
    
    if (review.isApproved) {
        approveBtn.style.display = 'none';
        rejectBtn.style.display = 'inline-block';
        rejectBtn.innerHTML = '<i class="fas fa-times"></i> Reject';
    } else {
        approveBtn.style.display = 'inline-block';
        rejectBtn.style.display = 'none';
    }
}

// Hide review modal
function hideReviewModal() {
    document.getElementById('review-modal').style.display = 'none';
    currentReviewId = null;
}

// Quick approve review
async function quickApproveReview(reviewId) {
    console.log('✅ Quick approving review:', reviewId);
    await updateReviewStatus(reviewId, true);
}

// Quick reject review
async function quickRejectReview(reviewId) {
    console.log('❌ Quick rejecting review:', reviewId);
    await updateReviewStatus(reviewId, false);
}

// Approve current review from modal
async function approveCurrentReview() {
    if (currentReviewId) {
        await updateReviewStatus(currentReviewId, true);
        hideReviewModal();
    }
}

// Reject current review from modal
async function rejectCurrentReview() {
    if (currentReviewId) {
        await updateReviewStatus(currentReviewId, false);
        hideReviewModal();
    }
}

// Update review status
async function updateReviewStatus(reviewId, isApproved) {
    try {
        const response = await apiRequest(`/admin/reviews/${reviewId}/approve`, {
            method: 'PUT',
            body: JSON.stringify({ isApproved })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert(`Review ${isApproved ? 'approved' : 'rejected'} successfully!`, 'success');
            await loadReviews(currentReviewPage);
        } else {
            throw new Error(result.message || 'Failed to update review status');
        }
    } catch (error) {
        console.error('Error updating review status:', error);
        if (error.message !== 'Authentication required') {
            showAlert(`Error: ${error.message}`, 'error');
        }
    }
}

// Show response modal
function showRespondModal() {
    if (!currentReviewId) {
        showAlert('Please select a review first', 'error');
        return;
    }
    
    document.getElementById('admin-response-text').value = '';
    document.getElementById('admin-response-modal').style.display = 'block';
}

// Hide response modal
function hideResponseModal() {
    document.getElementById('admin-response-modal').style.display = 'none';
}

// Submit admin response
async function submitAdminResponse(event) {
    event.preventDefault();
    
    if (!currentReviewId) {
        showAlert('No review selected', 'error');
        return;
    }
    
    const message = document.getElementById('admin-response-text').value.trim();
    if (!message) {
        showAlert('Please enter a response message', 'error');
        return;
    }
    
    try {
        const response = await apiRequest(`/admin/reviews/${currentReviewId}/respond`, {
            method: 'POST',
            body: JSON.stringify({ message })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Response added successfully!', 'success');
            hideResponseModal();
            await loadReviews(currentReviewPage);
            
            // Refresh review details modal if open
            if (document.getElementById('review-modal').style.display === 'block') {
                viewReviewDetails(currentReviewId);
            }
        } else {
            throw new Error(result.message || 'Failed to submit response');
        }
    } catch (error) {
        console.error('Error submitting response:', error);
        if (error.message !== 'Authentication required') {
            showAlert(`Error: ${error.message}`, 'error');
        }
    }
}

// Delete review
async function deleteReview(reviewId) {
    console.log('🗑️ Deleting review:', reviewId);
    const review = reviews.find(r => (r._id || r.id) === reviewId);
    if (!review) {
        console.error('❌ Review not found for deletion:', reviewId);
        showAlert('Review not found', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete this review by ${review.userId?.name || 'Anonymous'}?\n\nThis action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await apiRequest(`/admin/reviews/${reviewId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Review deleted successfully!', 'success');
            selectedReviews.delete(reviewId);
            updateBulkActionsDisplay();
            await loadReviews(currentReviewPage);
        } else {
            throw new Error(result.message || 'Failed to delete review');
        }
    } catch (error) {
        console.error('Error deleting review:', error);
        if (error.message !== 'Authentication required') {
            showAlert(`Error: ${error.message}`, 'error');
        }
    }
}

// Delete current review from modal
async function deleteCurrentReview() {
    if (currentReviewId) {
        hideReviewModal();
        await deleteReview(currentReviewId);
    }
}

// Bulk operations
async function bulkApproveReviews() {
    if (selectedReviews.size === 0) {
        showAlert('Please select reviews to approve', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to approve ${selectedReviews.size} selected reviews?`)) {
        return;
    }
    
    await performBulkAction('approve');
}

async function bulkRejectReviews() {
    if (selectedReviews.size === 0) {
        showAlert('Please select reviews to reject', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to reject ${selectedReviews.size} selected reviews?`)) {
        return;
    }
    
    await performBulkAction('reject');
}

async function bulkDeleteReviews() {
    if (selectedReviews.size === 0) {
        showAlert('Please select reviews to delete', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${selectedReviews.size} selected reviews?\n\nThis action cannot be undone.`)) {
        return;
    }
    
    await performBulkAction('delete');
}

// Perform bulk action
async function performBulkAction(action) {
    try {
        const response = await apiRequest('/admin/reviews/bulk-action', {
            method: 'PUT',
            body: JSON.stringify({
                reviewIds: Array.from(selectedReviews),
                action: action
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert(result.message, 'success');
            clearSelection();
            await loadReviews(currentReviewPage);
        } else {
            throw new Error(result.message || `Failed to ${action} reviews`);
        }
    } catch (error) {
        console.error(`Error performing bulk ${action}:`, error);
        if (error.message !== 'Authentication required') {
            showAlert(`Error: ${error.message}`, 'error');
        }
    }
}

// Review pagination
function updateReviewPagination() {
    const pagination = document.getElementById('reviews-pagination');
    const pageInfo = document.getElementById('reviews-page-info');
    const prevBtn = document.getElementById('reviews-prev-btn');
    const nextBtn = document.getElementById('reviews-next-btn');
    
    if (totalReviewPages > 1) {
        pagination.style.display = 'flex';
        pageInfo.textContent = `Page ${currentReviewPage} of ${totalReviewPages}`;
        prevBtn.disabled = currentReviewPage <= 1;
        nextBtn.disabled = currentReviewPage >= totalReviewPages;
    } else {
        pagination.style.display = 'none';
    }
}

// Change review page
function changeReviewPage(direction) {
    if (direction === 'prev' && currentReviewPage > 1) {
        loadReviews(currentReviewPage - 1);
    } else if (direction === 'next' && currentReviewPage < totalReviewPages) {
        loadReviews(currentReviewPage + 1);
    }
}

// Export reviews
async function exportReviews() {
    try {
        const status = document.getElementById('review-status-filter')?.value || '';
        const params = new URLSearchParams({
            format: 'csv',
            status: status,
            period: '30d'
        });
        
        const response = await apiRequest(`/admin/reviews/export?${params}`);
        const data = await response.json();
        
        if (data.success && data.downloadUrl) {
            // Create download link
            const link = document.createElement('a');
            link.href = data.downloadUrl;
            link.download = data.filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showAlert(`Exported ${data.totalRecords} reviews successfully!`, 'success');
        } else {
            throw new Error(data.message || 'Export failed');
        }
    } catch (error) {
        console.error('Error exporting reviews:', error);
        if (error.message !== 'Authentication required') {
            showAlert(`Export failed: ${error.message}`, 'error');
        }
    }
}

async function loadAnalytics() {
    // Prevent multiple concurrent analytics loads
    if (analyticsLoading) {
        console.log('Analytics already loading, skipping...');
        return;
    }
    
    analyticsLoading = true;
    console.log('Loading analytics dashboard...');
    
    // Show loading state for all metrics
    showAnalyticsLoading();
    
    try {
        // Clear any existing charts first to prevent multiple instances
        destroyAllCharts();
        
        // Fetch analytics data from backend
        const response = await apiRequest('/admin/analytics');
        const data = await response.json();
        
        if (data.success) {
            // Update metrics cards
            updateAnalyticsMetrics(data.metrics);
            
            // Render charts with a slight delay to ensure DOM is ready
            setTimeout(() => {
                renderSalesChart(data.charts.salesTrend);
                renderTopProductsChart(data.charts.topProducts);
                renderRevenueByCategoryChart(data.charts.revenueByCategory);
                renderCustomerGrowthChart(data.charts.customerGrowth);
                
                chartsInitialized = true;
                console.log('Analytics dashboard loaded successfully');
            }, 100);
        } else {
            throw new Error(data.message || 'Failed to load analytics data');
        }
    } catch (error) {
        console.error('Error loading analytics:', error);
        showAnalyticsError(error.message);
        
        if (error.message !== 'Authentication required') {
            showAlert('Failed to load analytics data', 'error');
        }
    } finally {
        // Reset loading state
        analyticsLoading = false;
    }
}

// Show loading state for analytics dashboard
function showAnalyticsLoading() {
    const metricValues = document.querySelectorAll('.metric-value');
    metricValues.forEach(value => {
        value.innerHTML = '<div class="loading-skeleton" style="width: 60px; height: 32px; background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: loading 1.5s infinite; border-radius: 8px;"></div>';
    });
    
    const chartContainers = document.querySelectorAll('.chart-canvas');
    chartContainers.forEach(container => {
        container.innerHTML = `
            <div class="chart-loading">
                <div class="spinner"></div>
                <p>Loading chart data...</p>
            </div>
        `;
    });
}

// Show error state for analytics
function showAnalyticsError(message) {
    const chartContainers = document.querySelectorAll('.chart-canvas');
    chartContainers.forEach(container => {
        container.innerHTML = `
            <div class="chart-error">
                <i class="chart-error-icon fas fa-exclamation-triangle"></i>
                <div class="chart-error-message">
                    <p>Failed to load chart data</p>
                    <small>${message}</small>
                </div>
                <button class="retry-btn" onclick="loadAnalytics()">
                    <i class="fas fa-retry"></i> Retry
                </button>
            </div>
        `;
    });
}

// Update analytics metrics cards
function updateAnalyticsMetrics(metrics) {
    const metricElements = {
        revenue: document.querySelector('.metric-card.revenue .metric-value'),
        orders: document.querySelector('.metric-card.orders .metric-value'),
        customers: document.querySelector('.metric-card.customers .metric-value'),
        conversion: document.querySelector('.metric-card.conversion .metric-value')
    };
    
    const changeElements = {
        revenue: document.querySelector('.metric-card.revenue .metric-change'),
        orders: document.querySelector('.metric-card.orders .metric-change'),
        customers: document.querySelector('.metric-card.customers .metric-change'),
        conversion: document.querySelector('.metric-card.conversion .metric-change')
    };
    
    // Update revenue metric
    if (metricElements.revenue) {
        metricElements.revenue.textContent = `₹${(metrics.totalRevenue || 0).toLocaleString('en-IN')}`;
    }
    if (changeElements.revenue && metrics.revenueChange !== undefined) {
        updateMetricChange(changeElements.revenue, metrics.revenueChange);
    }
    
    // Update orders metric
    if (metricElements.orders) {
        metricElements.orders.textContent = formatNumber(metrics.totalOrders || 0);
    }
    if (changeElements.orders && metrics.ordersChange !== undefined) {
        updateMetricChange(changeElements.orders, metrics.ordersChange);
    }
    
    // Update customers metric
    if (metricElements.customers) {
        metricElements.customers.textContent = formatNumber(metrics.totalCustomers || 0);
    }
    if (changeElements.customers && metrics.customersChange !== undefined) {
        updateMetricChange(changeElements.customers, metrics.customersChange);
    }
    
    // Update conversion rate metric
    if (metricElements.conversion) {
        metricElements.conversion.textContent = `${(metrics.conversionRate || 0).toFixed(1)}%`;
    }
    if (changeElements.conversion && metrics.conversionChange !== undefined) {
        updateMetricChange(changeElements.conversion, metrics.conversionChange);
    }
    
    // Animate metric cards
    document.querySelectorAll('.metric-card').forEach(card => {
        card.classList.add('animate');
    });
}

// Update metric change indicator
function updateMetricChange(element, changeValue) {
    const isPositive = changeValue > 0;
    const isNegative = changeValue < 0;
    const isNeutral = changeValue === 0;
    
    element.className = `metric-change ${
        isPositive ? 'positive' : isNegative ? 'negative' : 'neutral'
    }`;
    
    const arrow = isPositive ? '↗' : isNegative ? '↘' : '→';
    const sign = isPositive ? '+' : '';
    
    element.innerHTML = `
        <span class="change-arrow">${arrow}</span>
        <span>${sign}${changeValue.toFixed(1)}% vs last month</span>
    `;
}

// Global chart instances to avoid memory leaks
let salesChart = null;
let topProductsChart = null;
let revenueCategoryChart = null;
let customerGrowthChart = null;

// Analytics loading state
let analyticsLoading = false;
let chartsInitialized = false;

// Destroy all chart instances to prevent memory leaks and duplicates
function destroyAllCharts() {
    if (salesChart) {
        salesChart.destroy();
        salesChart = null;
    }
    if (topProductsChart) {
        topProductsChart.destroy();
        topProductsChart = null;
    }
    if (revenueCategoryChart) {
        revenueCategoryChart.destroy();
        revenueCategoryChart = null;
    }
    if (customerGrowthChart) {
        customerGrowthChart.destroy();
        customerGrowthChart = null;
    }
    
    chartsInitialized = false;
    console.log('All charts destroyed');
}

// Render sales trend chart
function renderSalesChart(data) {
    const canvas = document.getElementById('sales-trend-chart');
    if (!canvas) {
        console.warn('Sales trend chart canvas not found');
        return;
    }
    
    // Don't render if no data provided
    if (!data || (!data.labels && !data.revenue && !data.orders)) {
        console.warn('No data provided for sales trend chart');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    
    // Destroy existing chart
    if (salesChart) {
        try {
            salesChart.destroy();
            salesChart = null;
        } catch (error) {
            console.warn('Error destroying existing sales chart:', error);
        }
    }
    
    salesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels || [],
            datasets: [{
                label: 'Revenue (₹)',
                data: data.revenue || [],
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#667eea',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8
            }, {
                label: 'Orders',
                data: data.orders || [],
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 3,
                fill: false,
                tension: 0.4,
                pointBackgroundColor: '#10b981',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8,
                yAxisID: 'y1'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: {
                            size: 12,
                            weight: '500'
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: 'rgba(102, 126, 234, 0.3)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.datasetIndex === 0) {
                                label += '₹' + formatNumber(context.parsed.y);
                            } else {
                                label += formatNumber(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#6b7280',
                        font: {
                            size: 11
                        }
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    grid: {
                        color: 'rgba(107, 114, 128, 0.1)'
                    },
                    ticks: {
                        color: '#6b7280',
                        font: {
                            size: 11
                        },
                        callback: function(value) {
                            return '₹' + formatNumber(value);
                        }
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: {
                        drawOnChartArea: false,
                    },
                    ticks: {
                        color: '#6b7280',
                        font: {
                            size: 11
                        }
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

// Render top products chart
function renderTopProductsChart(data) {
    const canvas = document.getElementById('top-products-chart');
    if (!canvas) {
        console.warn('Top products chart canvas not found');
        return;
    }
    
    // Don't render if no data provided
    if (!data || (!data.labels && !data.values)) {
        console.warn('No data provided for top products chart');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    
    // Destroy existing chart
    if (topProductsChart) {
        try {
            topProductsChart.destroy();
            topProductsChart = null;
        } catch (error) {
            console.warn('Error destroying existing top products chart:', error);
        }
    }
    
    topProductsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels || [],
            datasets: [{
                label: 'Sales',
                data: data.values || [],
                backgroundColor: [
                    '#667eea',
                    '#10b981',
                    '#f59e0b',
                    '#ef4444',
                    '#8b5cf6'
                ],
                borderColor: [
                    '#5a6fd8',
                    '#059669',
                    '#d97706',
                    '#dc2626',
                    '#7c3aed'
                ],
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    cornerRadius: 8,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            return 'Sales: ' + formatNumber(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#6b7280',
                        font: {
                            size: 11
                        },
                        maxRotation: 45
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(107, 114, 128, 0.1)'
                    },
                    ticks: {
                        color: '#6b7280',
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

// Render revenue by category chart
function renderRevenueByCategoryChart(data) {
    const canvas = document.getElementById('revenue-category-chart');
    if (!canvas) {
        console.warn('Revenue category chart canvas not found');
        return;
    }
    
    // Don't render if no data provided
    if (!data || (!data.labels && !data.values)) {
        console.warn('No data provided for revenue category chart');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    
    // Destroy existing chart
    if (revenueCategoryChart) {
        try {
            revenueCategoryChart.destroy();
            revenueCategoryChart = null;
        } catch (error) {
            console.warn('Error destroying existing revenue category chart:', error);
        }
    }
    
    revenueCategoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.labels || [],
            datasets: [{
                data: data.values || [],
                backgroundColor: [
                    '#667eea',
                    '#10b981',
                    '#f59e0b',
                    '#ef4444',
                    '#8b5cf6',
                    '#06b6d4',
                    '#84cc16'
                ],
                borderColor: '#ffffff',
                borderWidth: 3,
                hoverBorderWidth: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    cornerRadius: 8,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return context.label + ': ₹' + formatNumber(context.parsed) + ' (' + percentage + '%)';
                        }
                    }
                }
            },
            cutout: '60%'
        }
    });
}

// Render customer growth chart
function renderCustomerGrowthChart(data) {
    const canvas = document.getElementById('customer-growth-chart');
    if (!canvas) {
        console.warn('Customer growth chart canvas not found');
        return;
    }
    
    // Don't render if no data provided
    if (!data || (!data.labels && !data.newCustomers && !data.totalCustomers)) {
        console.warn('No data provided for customer growth chart');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    
    // Destroy existing chart
    if (customerGrowthChart) {
        try {
            customerGrowthChart.destroy();
            customerGrowthChart = null;
        } catch (error) {
            console.warn('Error destroying existing customer growth chart:', error);
        }
    }
    
    customerGrowthChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels || [],
            datasets: [{
                label: 'New Customers',
                data: data.newCustomers || [],
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#8b5cf6',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7
            }, {
                label: 'Total Customers',
                data: data.totalCustomers || [],
                borderColor: '#06b6d4',
                backgroundColor: 'rgba(6, 182, 212, 0.1)',
                borderWidth: 3,
                fill: false,
                tension: 0.4,
                pointBackgroundColor: '#06b6d4',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    cornerRadius: 8,
                    padding: 12
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#6b7280',
                        font: {
                            size: 11
                        }
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(107, 114, 128, 0.1)'
                    },
                    ticks: {
                        color: '#6b7280',
                        font: {
                            size: 11
                        }
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

// Handle analytics filters
function handleAnalyticsFilter() {
    const dateRange = document.getElementById('analytics-date-range')?.value;
    const category = document.getElementById('analytics-category')?.value;
    
    console.log('Analytics filters changed:', { dateRange, category });
    
    // Reload analytics with filters
    loadAnalyticsWithFilters({ dateRange, category });
}

// Load analytics with filters
async function loadAnalyticsWithFilters(filters = {}) {
    // Prevent multiple concurrent filter loads
    if (analyticsLoading) {
        console.log('Analytics already loading, skipping filter request...');
        return;
    }
    
    analyticsLoading = true;
    
    try {
        showAnalyticsLoading();
        
        // Clear existing charts before applying filters
        destroyAllCharts();
        
        const queryParams = new URLSearchParams();
        if (filters.dateRange) queryParams.append('dateRange', filters.dateRange);
        if (filters.category) queryParams.append('category', filters.category);
        
        const response = await apiRequest(`/admin/analytics?${queryParams.toString()}`);
        const data = await response.json();
        
        if (data.success) {
            updateAnalyticsMetrics(data.metrics);
            
            // Render charts with delay to prevent racing conditions
            setTimeout(() => {
                renderSalesChart(data.charts.salesTrend);
                renderTopProductsChart(data.charts.topProducts);
                renderRevenueByCategoryChart(data.charts.revenueByCategory);
                renderCustomerGrowthChart(data.charts.customerGrowth);
            }, 100);
        } else {
            throw new Error(data.message || 'Failed to load filtered analytics');
        }
    } catch (error) {
        console.error('Error loading filtered analytics:', error);
        showAnalyticsError(error.message);
    } finally {
        analyticsLoading = false;
    }
}

// Export analytics functions
async function exportAnalyticsPDF() {
    try {
        const response = await apiRequest('/admin/analytics/export/pdf', {
            method: 'POST'
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `analytics-report-${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            showAlert('Analytics report exported successfully!', 'success');
        } else {
            throw new Error('Failed to export PDF');
        }
    } catch (error) {
        console.error('Error exporting PDF:', error);
        showAlert('Failed to export PDF report', 'error');
    }
}

async function exportAnalyticsExcel() {
    try {
        const response = await apiRequest('/admin/analytics/export/excel', {
            method: 'POST'
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `analytics-data-${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            showAlert('Analytics data exported successfully!', 'success');
        } else {
            throw new Error('Failed to export Excel');
        }
    } catch (error) {
        console.error('Error exporting Excel:', error);
        showAlert('Failed to export Excel file', 'error');
    }
}

// Refresh analytics data
function refreshAnalytics() {
    console.log('Refreshing analytics data...');
    
    // If already loading, don't start another load
    if (analyticsLoading) {
        console.log('Analytics refresh skipped - already loading');
        return;
    }
    
    loadAnalytics();
}

async function loadSettings() {
    console.log('Loading settings...');
    // Settings forms are already in HTML
}

// Show product form modal
function showProductForm(product = null) {
    const isEdit = !!product;
    const modalHTML = `
        <div class="modal active">
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-${isEdit ? 'edit' : 'plus'}"></i> ${isEdit ? 'Edit' : 'Add'} Product</h3>
                    <button class="modal-close" onclick="hideProductForm()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="product-form">
                        <div class="form-grid two-column">
                            <div class="form-group">
                                <label class="form-label">Product Name *</label>
                                <input type="text" class="form-input" id="product-name" required value="${product?.name || ''}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Brand *</label>
                                <input type="text" class="form-input" id="product-brand" required value="${product?.brand || ''}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Price (₹) *</label>
                                <input type="number" class="form-input" id="product-price" required min="1" value="${product?.price || ''}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Category *</label>
                                <select class="form-select" id="product-category" required>
                                    <option value="">Select Category</option>
                                    <option value="tshirt" ${product?.category === 'tshirt' ? 'selected' : ''}>T-shirt</option>
                                    <option value="shirts" ${product?.category === 'shirts' ? 'selected' : ''}>Shirts</option>
                                    <option value="tops" ${product?.category === 'tops' ? 'selected' : ''}>Tops</option>
                                    <option value="sweaters" ${product?.category === 'sweaters' ? 'selected' : ''}>Sweaters</option>
                                    <option value="hoodies" ${product?.category === 'hoodies' ? 'selected' : ''}>Hoodies</option>
                                    <option value="sweatshirts" ${product?.category === 'sweatshirts' ? 'selected' : ''}>Sweatshirts</option>
                                    <option value="jackets" ${product?.category === 'jackets' ? 'selected' : ''}>Jackets</option>
                                    <option value="coats" ${product?.category === 'coats' ? 'selected' : ''}>Coats</option>
                                    <option value="blazers" ${product?.category === 'blazers' ? 'selected' : ''}>Blazers</option>
                                    <option value="jeans" ${product?.category === 'jeans' ? 'selected' : ''}>Jeans</option>
                                    <option value="trousers" ${product?.category === 'trousers' ? 'selected' : ''}>Trousers</option>
                                    <option value="pants" ${product?.category === 'pants' ? 'selected' : ''}>Pants</option>
                                    <option value="chinos" ${product?.category === 'chinos' ? 'selected' : ''}>Chinos</option>
                                    <option value="joggers" ${product?.category === 'joggers' ? 'selected' : ''}>Joggers</option>
                                    <option value="shorts" ${product?.category === 'shorts' ? 'selected' : ''}>Shorts</option>
                                    <option value="skirts" ${product?.category === 'skirts' ? 'selected' : ''}>Skirts</option>
                                    <option value="dresses" ${product?.category === 'dresses' ? 'selected' : ''}>Dresses</option>
                                    <option value="activewear" ${product?.category === 'activewear' ? 'selected' : ''}>Activewear</option>
                                    <option value="sportswear" ${product?.category === 'sportswear' ? 'selected' : ''}>Sportswear</option>
                                    <option value="loungewear" ${product?.category === 'loungewear' ? 'selected' : ''}>Loungewear</option>
                                    <option value="sleepwear" ${product?.category === 'sleepwear' ? 'selected' : ''}>Sleepwear</option>
                                    <option value="innerwear" ${product?.category === 'innerwear' ? 'selected' : ''}>Innerwear</option>
                                    <option value="accessories" ${product?.category === 'accessories' ? 'selected' : ''}>Accessories</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Stock Quantity</label>
                                <input type="number" class="form-input" id="product-stock" min="0" value="${product?.stock || 100}">
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Product Image</label>
                            <div class="file-upload-container">
                                <input type="file" class="form-input file-input" id="product-image" accept="image/*">
                                <div class="file-upload-info">
                                    <i class="fas fa-cloud-upload-alt"></i>
                                    <span>Choose image file</span>
                                </div>
                                ${product?.image ? `<div class="current-image-preview">
                                    <img src="${product.image}" alt="Current image" style="max-width: 100px; max-height: 100px; object-fit: cover; border-radius: 8px; margin-top: 0.5rem;">
                                    <small style="display: block; margin-top: 0.25rem; color: #6b7280;">Current image</small>
                                </div>` : ''}
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Available Sizes</label>
                            <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 0.5rem;">
                                ${['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'].map(size => `
                                    <label style="display: flex; align-items: center; gap: 0.25rem; cursor: pointer;">
                                        <input type="checkbox" name="sizes" value="${size}" ${product?.sizes?.includes(size) ? 'checked' : ''}>
                                        ${size}
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Description</label>
                            <textarea class="form-textarea" id="product-description" rows="4">${product?.description || ''}</textarea>
                        </div>
                        <div class="modal-footer">
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-save"></i> ${isEdit ? 'Update' : 'Add'} Product
                            </button>
                            <button type="button" class="btn btn-secondary" onclick="hideProductForm()">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if any
    hideProductForm();
    
    // Add modal to body
    const modalElement = document.createElement('div');
    modalElement.innerHTML = modalHTML;
    modalElement.id = 'product-modal';
    document.body.appendChild(modalElement.firstElementChild);
    
    // Setup form submission
    const form = document.getElementById('product-form');
    form.addEventListener('submit', (e) => handleProductSubmit(e, product));
    
    // Setup file input handling
    const fileInput = document.getElementById('product-image');
    const fileInfo = fileInput.parentNode.querySelector('.file-upload-info span');
    const fileIcon = fileInput.parentNode.querySelector('.file-upload-info i');
    
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            fileInfo.textContent = file.name;
            fileIcon.className = 'fas fa-check-circle';
            
            // Show image preview
            const reader = new FileReader();
            reader.onload = (e) => {
                let previewContainer = fileInput.parentNode.querySelector('.image-preview');
                if (!previewContainer) {
                    previewContainer = document.createElement('div');
                    previewContainer.className = 'image-preview';
                    previewContainer.style.cssText = 'margin-top: 1rem; text-align: center;';
                    fileInput.parentNode.appendChild(previewContainer);
                }
                
                previewContainer.innerHTML = `
                    <img src="${e.target.result}" alt="Preview" 
                         style="max-width: 150px; max-height: 150px; object-fit: cover; border-radius: 8px; border: 2px solid #e2e8f0;">
                    <small style="display: block; margin-top: 0.5rem; color: #6b7280;">Image preview</small>
                `;
            };
            reader.readAsDataURL(file);
        } else {
            fileInfo.textContent = 'Choose image file';
            fileIcon.className = 'fas fa-cloud-upload-alt';
            
            // Remove preview
            const previewContainer = fileInput.parentNode.querySelector('.image-preview');
            if (previewContainer) {
                previewContainer.remove();
            }
        }
    });
}

// Hide product form modal
function hideProductForm() {
    const modal = document.getElementById('product-modal');
    if (modal) {
        modal.remove();
    }
}

// Handle product form submission
async function handleProductSubmit(e, existingProduct = null) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData();
    
    // Get form values
    const name = document.getElementById('product-name').value.trim();
    const brand = document.getElementById('product-brand').value.trim();
    const price = parseFloat(document.getElementById('product-price').value);
    const category = document.getElementById('product-category').value;
    const stock = parseInt(document.getElementById('product-stock').value) || 0;
    const description = document.getElementById('product-description').value.trim();
    const sizes = Array.from(document.querySelectorAll('input[name="sizes"]:checked')).map(input => input.value);
    const imageFile = document.getElementById('product-image').files[0];
    
    // Validation
    if (!name || !brand || !category) {
        showAlert('Please fill in all required fields', 'error');
        return;
    }
    
    if (price <= 0) {
        showAlert('Price must be greater than 0', 'error');
        return;
    }
    
    // Append data to FormData
    formData.append('name', name);
    formData.append('brand', brand);
    formData.append('price', price);
    formData.append('category', category);
    formData.append('stock', stock);
    formData.append('description', description);
    formData.append('sizes', JSON.stringify(sizes));
    
    // Append image file if selected
    if (imageFile) {
        formData.append('image', imageFile);
    } else if (!existingProduct) {
        // Use default image for new products if no image selected
        formData.append('image', '../img/products/default.jpg');
    }
    
    try {
        const isEdit = !!existingProduct;
        const url = isEdit ? `/products/${existingProduct.id}` : '/products';
        const method = isEdit ? 'PUT' : 'POST';
        
        const token = getAuthToken();
        const response = await fetch(`${API_BASE_URL}${url}`, {
            method,
            headers: {
                ...(token && { Authorization: `Bearer ${token}` })
                // Don't set Content-Type for FormData, let browser set it
            },
            body: formData
        });
        
        if (response.status === 401) {
            clearAuthToken();
            showLogin();
            throw new Error('Authentication required');
        }
        
        const result = await response.json();
        
        if (result.success) {
            showAlert(`Product ${isEdit ? 'updated' : 'created'} successfully!`, 'success');
            hideProductForm();
            await loadProducts();
            
            // Refresh dashboard if we're on it
            if (currentTab === 'dashboard') {
                refreshDashboardStats();
            }
        } else {
            throw new Error(result.message || `Failed to ${isEdit ? 'update' : 'create'} product`);
        }
    } catch (error) {
        console.error('Error submitting product:', error);
        if (error.message !== 'Authentication required') {
            showAlert(`Error: ${error.message}`, 'error');
        }
    }
}


function importProducts() {
    showAlert('Product import feature will be implemented soon', 'info');
}

function exportProducts() {
    showAlert('Product export feature will be implemented soon', 'info');
}

function exportOrders() {
    showAlert('Order export feature will be implemented soon', 'info');
}


// ======================
// API HEALTH CHECK
// ======================

async function checkApiHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        const data = await response.json();
        console.log('API Health:', data);
        return data.status === 'OK';
    } catch (error) {
        console.error('API Health Check Failed:', error);
        return false;
    }
}

// ======================
// UTILITY FUNCTIONS
// ======================

function formatNumber(num) {
    return new Intl.NumberFormat('en-IN').format(num);
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatStatus(status) {
    if (!status) return 'Unknown';
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function getStatusColor(status) {
    const statusColors = {
        'pending_payment': 'warning',
        'confirmed': 'info',
        'processing': 'info',
        'shipped': 'info',
        'delivered': 'success',
        'cancelled': 'danger'
    };
    return statusColors[status] || 'secondary';
}

function showLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
    }
}

// Enhanced filter function for orders
function filterOrders() {
    const statusFilter = document.getElementById('order-status-filter')?.value;
    if (!statusFilter) {
        displayOrdersTable(orders);
        return;
    }
    
    const filteredOrders = orders.filter(order => order.orderStatus === statusFilter);
    displayOrdersTable(filteredOrders);
    console.log(`Filtered ${filteredOrders.length} orders with status: ${statusFilter}`);
}

// Initialize everything properly
if (typeof window !== 'undefined') {
    // Make functions globally accessible
    window.showTab = showTab;
    if (typeof toggleSidebar === 'function') {
        window.toggleSidebar = toggleSidebar;
    }
    if (typeof closeMobileMenu === 'function') {
        window.closeMobileMenu = closeMobileMenu;
    }
    window.showProductForm = showProductForm;
    window.hideProductForm = hideProductForm;
    window.editProduct = editProduct;
    window.deleteProduct = deleteProduct;
    window.updateOrderStatus = updateOrderStatus;
    window.viewOrderDetails = viewOrderDetails;
    window.hideOrderDetails = hideOrderDetails;
    window.toggleAdminStatus = toggleAdminStatus;
    window.filterOrders = filterOrders;
    window.exportProducts = exportProducts;
    window.exportOrders = exportOrders;
    window.importProducts = importProducts;
    window.searchUsers = searchUsers;
    window.logout = logout;
    window.handleAnalyticsFilter = handleAnalyticsFilter;
    window.refreshAnalytics = refreshAnalytics;
    window.exportAnalyticsPDF = exportAnalyticsPDF;
    window.exportAnalyticsExcel = exportAnalyticsExcel;
    // Coupon management functions
    window.showCouponForm = showCouponForm;
    window.hideCouponForm = hideCouponForm;
    window.editCoupon = editCoupon;
    window.deleteCoupon = deleteCoupon;
    
    // Review management functions
    window.viewReviewDetails = viewReviewDetails;
    window.hideReviewModal = hideReviewModal;
    window.quickApproveReview = quickApproveReview;
    window.quickRejectReview = quickRejectReview;
    window.approveCurrentReview = approveCurrentReview;
    window.rejectCurrentReview = rejectCurrentReview;
    window.deleteReview = deleteReview;
    window.deleteCurrentReview = deleteCurrentReview;
    window.showRespondModal = showRespondModal;
    window.hideResponseModal = hideResponseModal;
    window.submitAdminResponse = submitAdminResponse;
    window.toggleReviewSelection = toggleReviewSelection;
    window.toggleAllReviews = toggleAllReviews;
    window.clearSelection = clearSelection;
    window.bulkApproveReviews = bulkApproveReviews;
    window.bulkRejectReviews = bulkRejectReviews;
    window.bulkDeleteReviews = bulkDeleteReviews;
    window.filterReviews = filterReviews;
    window.searchReviews = searchReviews;
    window.changeReviewPage = changeReviewPage;
    window.exportReviews = exportReviews;
    
    // Debug function
    window.testReviewFunctions = function() {
        console.log('🗋 Testing review functions...');
        console.log('Available functions:', {
            viewReviewDetails: typeof window.viewReviewDetails,
            quickApproveReview: typeof window.quickApproveReview,
            quickRejectReview: typeof window.quickRejectReview,
            deleteReview: typeof window.deleteReview
        });
        console.log('Reviews loaded:', reviews?.length || 0);
        if (reviews?.length > 0) {
            console.log('Sample review ID:', reviews[0]._id || reviews[0].id);
        }
    };
}

// ======================
// UTILITY FUNCTIONS
// ======================

// Format date for display
function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Invalid Date';
    
    // Format date as DD MMM YYYY, HH:MM
    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

// Format number with commas
function formatNumber(num) {
    if (num === null || num === undefined) return '0';
    return new Intl.NumberFormat('en-IN').format(num);
}

// Format order status for display
function formatStatus(status) {
    if (!status) return 'Unknown';
    
    const statuses = {
        'pending_payment': 'Pending Payment',
        'confirmed': 'Confirmed',
        'processing': 'Processing',
        'packed': 'Packed',
        'shipped': 'Shipped',
        'delivered': 'Delivered',
        'cancelled': 'Cancelled'
    };
    
    return statuses[status] || status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
}

// Get status color for badges
function getStatusColor(status) {
    const colors = {
        'pending_payment': 'warning',
        'confirmed': 'info',
        'processing': 'info',
        'packed': 'info',
        'shipped': 'primary',
        'delivered': 'success',
        'cancelled': 'danger'
    };
    
    return colors[status] || 'secondary';
}

// Show loading state in table
function showLoading(tableBodyId) {
    const tbody = document.getElementById(tableBodyId);
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="10" class="loading">Loading data...</td></tr>';
    }
}

// Check API health
async function checkApiHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        return response.ok;
    } catch (error) {
        console.error('API health check failed:', error);
        return false;
    }
}

// ======================
// EXPORT FUNCTIONS
// ======================

// Export products (placeholder)
function exportProducts() {
    showAlert('Export products functionality will be implemented soon', 'info');
}

// Export orders (placeholder)
function exportOrders() {
    showAlert('Export orders functionality will be implemented soon', 'info');
}

// Import products (placeholder)
function importProducts() {
    showAlert('Import products functionality will be implemented soon', 'info');
}

// Export users (placeholder)
function exportUsers() {
    showAlert('Export users functionality will be implemented soon', 'info');
}

// Category management functions (placeholders)
function loadCategories() {
    showAlert('Category management will be implemented soon', 'info');
}

function showCategoryForm() {
    showAlert('Category form will be implemented soon', 'info');
}

// The main coupon functions are defined above

// Settings management functions (placeholders)
function backupDatabase() {
    if (confirm('Are you sure you want to backup the database?')) {
        showAlert('Database backup functionality will be implemented soon', 'info');
    }
}

function clearAllData() {
    if (confirm('⚠️ This will delete ALL data. Are you sure?') && 
        confirm('This action cannot be undone. Continue?')) {
        showAlert('Clear all data functionality will be implemented soon', 'info');
    }
}

// Run API health check on load - only if authenticated
setTimeout(() => {
    if (isAuthenticated()) {
        checkApiHealth().then(isHealthy => {
            if (!isHealthy) {
                console.warn('Backend API is not available');
            } else {
                console.log('✅ Backend API is healthy');
            }
        });
    }
}, 1000);
