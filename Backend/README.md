# Zylo Ecommerce Backend API

## Overview
A complete Node.js/Express backend for the Zylo Ecommerce platform with MongoDB database integration, JWT authentication, and comprehensive e-commerce functionality.

## Features Implemented

### ✅ Authentication & Authorization
- Email-based OTP login system
- JWT token-based authentication
- Admin role management
- Development mode OTP bypass (any 6-digit code works)

### ✅ Product Management
- Complete CRUD operations for products
- Product search and filtering (text search, category, brand, price range)
- Product seeding with 20 demo products
- Admin product management endpoints
- Category and brand listing

### ✅ User Management
- User profile management (name, phone, email)
- Address management (CRUD operations)
- Wishlist functionality
- User listing and management (admin only)

### ✅ Shopping Cart
- Cart management for authenticated users
- Add/remove/update cart items
- Cart synchronization when user logs in
- Persistent server-side cart storage

### ✅ Order Management  
- Order creation from cart
- Support for multiple payment methods (COD, card, wallet, UPI, netbanking)
- Order status tracking
- Order history for users
- Admin order management

### ✅ Admin Panel
- Dashboard statistics
- User management
- Order management and status updates
- Sales analytics and reporting
- Product management

### ✅ Security & Performance
- Helmet.js security headers
- Rate limiting
- CORS configuration
- Input validation with express-validator
- MongoDB connection with error handling

## API Endpoints

### Authentication
- `POST /api/auth/request-otp` - Request OTP for email
- `POST /api/auth/verify-otp` - Verify OTP and login

### Products
- `GET /api/products` - Get products with filtering
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product
- `GET /api/products/categories/list` - Get categories and brands
- `POST /api/products/seed` - Seed demo products

### Users
- `GET /api/users/me` - Get current user profile
- `PUT /api/users/me` - Update user profile
- `GET /api/users/me/addresses` - Get user addresses
- `POST /api/users/me/addresses` - Add address
- `PUT /api/users/me/addresses/:index` - Update address
- `DELETE /api/users/me/addresses/:index` - Delete address
- `GET /api/users/me/wishlist` - Get wishlist
- `POST /api/users/me/wishlist` - Add to wishlist
- `DELETE /api/users/me/wishlist/:productId` - Remove from wishlist

### Cart
- `GET /api/cart` - Get cart items
- `POST /api/cart` - Add to cart
- `PUT /api/cart` - Update cart item quantity
- `DELETE /api/cart` - Remove cart item
- `DELETE /api/cart/all` - Clear cart
- `POST /api/cart/sync` - Sync local cart with server

### Orders
- `POST /api/orders` - Create order from cart
- `POST /api/orders/:id/pay` - Mark order as paid
- `GET /api/orders/me` - Get user's orders
- `GET /api/orders/:id` - Get single order

### Wishlist
- `GET /api/wishlist` - Get wishlist
- `POST /api/wishlist` - Add to wishlist
- `DELETE /api/wishlist/:productId` - Remove from wishlist

### Admin (requires admin authentication)
- `GET /api/admin/dashboard` - Dashboard statistics
- `GET /api/admin/users` - Get all users
- `PUT /api/admin/users/:userId/admin` - Update user admin status
- `GET /api/admin/orders` - Get all orders
- `PUT /api/admin/orders/:orderId/status` - Update order status
- `GET /api/admin/analytics/sales` - Sales analytics
- `POST /api/admin/create-admin` - Create admin user (public, only works if no admin exists)

## Database Models

### User
- Email, name, phone
- Wishlist (product IDs)
- Addresses array
- Admin flag
- Password hash (for future password login)

### Product
- Unique ID, name, brand, price
- Category, sizes array, description
- Image URL, stock quantity
- Text search index

### Cart
- User reference
- Items array (productId, size, quantity)
- Update timestamp

### Order
- Unique order ID (ZY######)
- User reference, payment method, status
- Items snapshot with prices
- Totals (subtotal, tax, shipping, COD charges)
- Shipping address
- Timestamps

## Environment Variables

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/zylo-ecommerce
JWT_SECRET=your-super-secret-jwt-key-here-make-it-long-and-random
JWT_EXPIRES_IN=7d
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=Zylo Ecommerce <no-reply@zylo.com>
OTP_EXPIRES_IN=10
```

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set Environment Variables**
   - Copy `.env.example` to `.env`
   - Update MongoDB URI and email settings

3. **Start Server**
   ```bash
   npm start        # Production
   npm run dev      # Development with nodemon
   ```

4. **Seed Database**
   ```bash
   curl -X POST http://localhost:5000/api/products/seed
   ```

5. **Create Admin User**
   ```bash
   curl -X POST http://localhost:5000/api/admin/create-admin \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@zylo.com","name":"Admin User"}'
   ```

## Testing & Development

### Health Check
```bash
curl http://localhost:5000/api/health
```

### Login Flow (Development)
1. Request OTP: `POST /api/auth/request-otp` with `{"email":"user@example.com"}`
2. Verify with any 6-digit code: `POST /api/auth/verify-otp` with `{"email":"user@example.com","code":"123456"}`
3. Use returned JWT token in Authorization header: `Bearer <token>`

### Admin Access
1. Login with admin email (admin@zylo.com)
2. Use JWT token to access admin endpoints
3. Access admin dashboard at `/api/admin/dashboard`

## Frontend Integration

The backend is fully compatible with the existing frontend:
- Products are seeded with IDs matching frontend expectations (f1-f10, n1-n10)
- API responses match frontend data structures
- CORS configured for local development servers
- Cart/wishlist sync handles frontend localStorage integration

## Production Considerations

1. **Security**
   - Change JWT secret to a secure random string
   - Set up proper email service (not Gmail for production)
   - Configure MongoDB with authentication
   - Set NODE_ENV=production

2. **Database**
   - Use MongoDB Atlas or properly configured MongoDB instance
   - Set up database backups
   - Configure connection pooling

3. **Monitoring**
   - Add logging middleware
   - Set up error monitoring (e.g., Sentry)
   - Monitor API performance

4. **Deployment**
   - Use PM2 or similar process manager
   - Set up reverse proxy (nginx)
   - Configure SSL/TLS certificates
   - Set up CI/CD pipeline

The backend is now complete and ready for use with the frontend application!
