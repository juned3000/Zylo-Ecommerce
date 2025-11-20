const express = require('express');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const auth = require('../middleware/auth');

const router = express.Router();

// Create order from cart (for COD or to initiate online payment)
router.post('/', auth, async (req, res, next) => {
  try {
    const { paymentMethod = 'cod', methodDetails = {}, shippingAddress } = req.body;

    // Load cart
    const cart = await Cart.findOne({ userId: req.user.id });
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    // Build items snapshot from cart
    const productIds = cart.items.map(i => i.productId);
    const products = await Product.find({ id: { $in: productIds } });
    const byId = new Map(products.map(p => [p.id, p]));
    
    const items = cart.items.map(i => {
      const p = byId.get(i.productId);
      if (!p) {
        throw new Error(`Product ${i.productId} not found`);
      }
      return { 
        id: p.id, 
        name: p.name, 
        brand: p.brand, 
        image: p.image, 
        price: p.price, 
        quantity: i.quantity, 
        size: i.size 
      };
    });

    // Calculate totals with coupon discount
    const originalSubtotal = items.reduce((s, it) => s + it.price * it.quantity, 0);
    let couponDiscount = 0;
    let appliedCouponInfo = null;
    
    // Check for applied coupon in cart
    if (cart.appliedCoupon && cart.appliedCoupon.code) {
      try {
        const coupon = await Coupon.findOne({ 
          code: cart.appliedCoupon.code.toUpperCase(),
          isActive: true 
        });
        
        if (coupon) {
          // Validate coupon is still applicable
          const validation = coupon.validateForOrder(originalSubtotal);
          if (validation.valid) {
            couponDiscount = coupon.calculateDiscount(originalSubtotal);
            
            // Record coupon usage
            coupon.usedBy.push({
              user: req.user.id,
              orderValue: originalSubtotal,
              discountApplied: couponDiscount
            });
            coupon.usedCount = coupon.usedBy.length;
            await coupon.save();
            
            appliedCouponInfo = {
              code: coupon.code,
              discountAmount: couponDiscount,
              discountType: coupon.discountType,
              originalTotal: originalSubtotal + Math.round(originalSubtotal * 0.18) + (originalSubtotal > 1500 ? 0 : 99),
              finalTotal: 0 // Will be calculated below
            };
          }
        }
      } catch (error) {
        console.warn('Error processing coupon during order creation:', error);
        // Continue without coupon if there's an error
      }
    }
    
    // Calculate final totals
    const subtotal = originalSubtotal - couponDiscount;
    const tax = Math.round(subtotal * 0.18);
    let shipping = subtotal > 1500 ? 0 : 99;
    let codCharges = paymentMethod === 'cod' ? 49 : 0;
    const total = subtotal + tax + shipping + codCharges;
    
    // Update applied coupon final total
    if (appliedCouponInfo) {
      appliedCouponInfo.finalTotal = total;
    }

    // Generate order id and tracking number
    const orderId = 'ZY' + Date.now().toString().slice(-6);
    const trackingNumber = 'BD' + Math.floor(1000000000 + Math.random() * 8999999999);
    
    // Calculate estimated delivery (3-5 business days)
    const estimatedDelivery = new Date();
    estimatedDelivery.setDate(estimatedDelivery.getDate() + Math.floor(Math.random() * 3) + 3);
    
    // Initialize tracking with first update
    const initialTracking = {
      trackingNumber,
      carrier: ['BlueDart Express', 'DTDC Express', 'Delhivery', 'FedEx'][Math.floor(Math.random() * 4)],
      estimatedDelivery,
      updates: [{
        status: paymentMethod === 'cod' ? 'confirmed' : 'pending_payment',
        message: paymentMethod === 'cod' ? 'Order confirmed and processing has begun' : 'Order placed, awaiting payment confirmation',
        timestamp: new Date()
      }],
      currentLocation: 'Processing Center'
    };

    const order = await Order.create({
      id: orderId,
      userId: req.user.id,
      paymentMethod,
      paymentStatus: paymentMethod === 'cod' ? 'cod' : 'initiated',
      orderStatus: paymentMethod === 'cod' ? 'confirmed' : 'pending_payment',
      items,
      totals: { 
        subtotal: originalSubtotal, // Keep original subtotal for reference
        tax, 
        shipping, 
        codCharges, 
        couponDiscount,
        total 
      },
      appliedCoupon: appliedCouponInfo,
      shippingAddress: shippingAddress || { 
        name: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || 'Customer', 
        addressText: 'Address not provided' 
      },
      tracking: initialTracking,
      methodDetails
    });

    if (paymentMethod === 'cod') {
      // Clear cart and applied coupon on COD
      cart.items = [];
      cart.appliedCoupon = undefined;
      await cart.save();
    }

    res.status(201).json({ success: true, order });
  } catch (err) { next(err); }
});

// Simulate payment success
router.post('/:id/pay', auth, async (req, res, next) => {
  try {
    const order = await Order.findOne({ id: req.params.id, userId: req.user.id });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    order.paymentStatus = 'paid';
    order.orderStatus = 'confirmed';
    
    // Add payment confirmation tracking update
    if (order.tracking && !order.tracking.updates.some(u => u.status === 'confirmed')) {
      order.tracking.updates.push({
        status: 'confirmed',
        message: 'Payment confirmed - Order processing has begun',
        timestamp: new Date()
      });
    } else if (!order.tracking) {
      // Initialize tracking if it doesn't exist
      const trackingNumber = 'BD' + Math.floor(1000000000 + Math.random() * 8999999999);
      const estimatedDelivery = new Date();
      estimatedDelivery.setDate(estimatedDelivery.getDate() + Math.floor(Math.random() * 3) + 3);
      
      order.tracking = {
        trackingNumber,
        carrier: ['BlueDart Express', 'DTDC Express', 'Delhivery', 'FedEx'][Math.floor(Math.random() * 4)],
        estimatedDelivery,
        updates: [{
          status: 'confirmed',
          message: 'Payment confirmed - Order processing has begun',
          timestamp: new Date()
        }],
        currentLocation: 'Processing Center'
      };
    }
    
    await order.save();

    // Clear cart and applied coupon on success
    const cart = await Cart.findOne({ userId: req.user.id });
    if (cart) { 
      cart.items = [];
      cart.appliedCoupon = undefined;
      await cart.save(); 
    }

    res.json({ success: true, order });
  } catch (err) { next(err); }
});

// Get my orders
router.get('/me', auth, async (req, res, next) => {
  try {
    const orders = await Order.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (err) { next(err); }
});

// Get one order (authenticated)
router.get('/:id', auth, async (req, res, next) => {
  try {
    const order = await Order.findOne({ id: req.params.id, userId: req.user.id });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, order });
  } catch (err) { next(err); }
});

// Track order without authentication (public endpoint)
router.post('/track', async (req, res, next) => {
  try {
    const { orderId, email } = req.body;
    
    if (!orderId || !email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Order ID and email are required' 
      });
    }

    // Find order and populate user email
    const order = await Order.findOne({ id: orderId.toUpperCase() })
      .populate('userId', 'email firstName lastName');
    
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }

    // Verify email matches
    if (order.userId?.email?.toLowerCase() !== email.toLowerCase()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Email does not match order records' 
      });
    }

    // Update tracking status with simulated progression
    await simulateTrackingProgress(order);

    res.json({ success: true, order });
  } catch (err) { next(err); }
});

// Simulate tracking progress based on order age
async function simulateTrackingProgress(order) {
  const now = new Date();
  const orderAge = Math.floor((now - order.createdAt) / (1000 * 60 * 60)); // hours
  
  // Initialize tracking if it doesn't exist (for existing orders)
  if (!order.tracking) {
    const trackingNumber = 'BD' + Math.floor(1000000000 + Math.random() * 8999999999);
    const estimatedDelivery = new Date();
    estimatedDelivery.setDate(estimatedDelivery.getDate() + Math.floor(Math.random() * 3) + 3);
    
    const initialTracking = {
      trackingNumber,
      carrier: ['BlueDart Express', 'DTDC Express', 'Delhivery', 'FedEx'][Math.floor(Math.random() * 4)],
      estimatedDelivery,
      updates: [{
        status: order.orderStatus,
        message: `Order ${order.orderStatus === 'confirmed' ? 'confirmed and processing has begun' : 'placed successfully'}`,
        timestamp: order.createdAt
      }],
      currentLocation: 'Processing Center'
    };
    
    // Update the order in database with tracking info
    await Order.updateOne(
      { _id: order._id },
      { tracking: initialTracking }
    );
    
    // Update the order object for this session
    order.tracking = initialTracking;
  }
  
  // Only update if order is confirmed and not already delivered
  if (order.orderStatus === 'pending_payment' || order.orderStatus === 'delivered') {
    return;
  }

  const updates = order.tracking.updates || [];
  let newStatus = order.orderStatus;
  let newLocation = order.tracking.currentLocation || 'Processing Center';
  
  // Only simulate progression if admin hasn't manually updated the status
  // Check if there are manual admin updates by looking for recent tracking updates
  const recentUpdate = updates.find(u => {
    const updateTime = new Date(u.timestamp);
    const timeDiff = now.getTime() - updateTime.getTime();
    return timeDiff < 5 * 60 * 1000; // Within last 5 minutes
  });
  
  // Skip simulation if there's a recent manual update
  if (recentUpdate) {
    return;
  }
  
  // Simulate progression based on time
  if (orderAge >= 2 && orderAge < 12 && order.orderStatus === 'confirmed') {
    newStatus = 'processing';
    newLocation = 'Packaging Facility';
    if (!updates.some(u => u.status === 'processing')) {
      updates.push({
        status: 'processing',
        message: 'Order is being prepared for shipment',
        location: newLocation,
        timestamp: new Date(order.createdAt.getTime() + 2 * 60 * 60 * 1000) // 2 hours after order
      });
    }
  }
  
  if (orderAge >= 12 && orderAge < 48 && ['confirmed', 'processing', 'packed'].includes(order.orderStatus)) {
    newStatus = 'shipped';
    newLocation = 'In Transit - Mumbai Sorting Center';
    if (!updates.some(u => u.status === 'shipped')) {
      updates.push({
        status: 'shipped',
        message: 'Package has been dispatched and is on the way',
        location: newLocation,
        timestamp: new Date(order.createdAt.getTime() + 12 * 60 * 60 * 1000) // 12 hours after order
      });
    }
  }
  
  if (orderAge >= 48 && order.orderStatus !== 'delivered') {
    newStatus = 'delivered';
    newLocation = 'Delivered';
    const deliveryTime = new Date();
    if (!updates.some(u => u.status === 'delivered')) {
      updates.push({
        status: 'delivered',
        message: 'Package has been delivered successfully',
        location: newLocation,
        timestamp: deliveryTime
      });
      
      // Ensure tracking object exists before setting actualDelivery
      if (order.tracking) {
        order.tracking.actualDelivery = deliveryTime;
      }
    }
  }

  // Add random in-transit updates for shipped orders
  if (newStatus === 'shipped' && orderAge >= 24) {
    const locations = [
      'Delhi Distribution Center',
      'Bangalore Sorting Facility', 
      'Out for Delivery - Local Facility',
      'With Delivery Partner'
    ];
    
    const lastLocation = updates[updates.length - 1]?.location;
    const nextLocationIndex = locations.findIndex(loc => loc === lastLocation) + 1;
    
    if (nextLocationIndex < locations.length && nextLocationIndex > 0) {
      newLocation = locations[nextLocationIndex];
      updates.push({
        status: 'shipped',
        message: `Package arrived at ${newLocation}`,
        location: newLocation,
        timestamp: new Date()
      });
    }
  }

  // Update order if status changed
  if (newStatus !== order.orderStatus || newLocation !== order.tracking?.currentLocation) {
    const updateFields = {
      orderStatus: newStatus,
      'tracking.updates': updates,
      'tracking.currentLocation': newLocation
    };
    
    // Add actualDelivery if order is delivered and tracking exists
    if (newStatus === 'delivered' && order.tracking?.actualDelivery) {
      updateFields['tracking.actualDelivery'] = order.tracking.actualDelivery;
    }
    
    await Order.updateOne(
      { _id: order._id },
      updateFields
    );
    
    // Update the order object for response
    order.orderStatus = newStatus;
    if (order.tracking) {
      order.tracking.updates = updates;
      order.tracking.currentLocation = newLocation;
    }
  }
}

module.exports = router;
