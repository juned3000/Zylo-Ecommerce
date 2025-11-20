const express = require('express');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const auth = require('../middleware/auth');
const { body, validate } = require('../middleware/validate');

const router = express.Router();

// Get cart
router.get('/', auth, async (req, res, next) => {
  try {
    let cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) cart = await Cart.create({ userId: req.user.id, items: [] });
    
    // Calculate cart totals if coupon is applied
    let cartTotal = 0;
    let finalTotal = 0;
    
    if (cart.items.length > 0) {
      for (const item of cart.items) {
        const product = await Product.findOne({ id: item.productId });
        if (product) {
          cartTotal += product.price * item.quantity;
        }
      }
      
      finalTotal = cartTotal;
      if (cart.appliedCoupon && cart.appliedCoupon.discountAmount) {
        finalTotal = cartTotal - cart.appliedCoupon.discountAmount;
      }
    }
    
    res.json({ 
      success: true, 
      items: cart.items,
      appliedCoupon: cart.appliedCoupon,
      cartTotal,
      finalTotal
    });
  } catch (err) { next(err); }
});

// Add to cart
router.post('/', auth, validate([
  body('productId').notEmpty(),
  body('size').optional().isString(),
  body('quantity').optional().isInt({ min: 1 })
]), async (req, res, next) => {
  try {
    const { productId, size = 'M', quantity = 1 } = req.body;
    const product = await Product.findOne({ id: productId });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    let cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) cart = await Cart.create({ userId: req.user.id, items: [] });

    const existing = cart.items.find(i => i.productId === productId && i.size === size);
    if (existing) existing.quantity += quantity;
    else cart.items.push({ productId, size, quantity });

    cart.updatedAt = new Date();
    await cart.save();
    res.status(201).json({ success: true, items: cart.items });
  } catch (err) { next(err); }
});

// Update quantity
router.put('/', auth, validate([
  body('productId').notEmpty(),
  body('size').notEmpty(),
  body('quantity').isInt({ min: 0 })
]), async (req, res, next) => {
  try {
    const { productId, size, quantity } = req.body;
    let cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

    const idx = cart.items.findIndex(i => i.productId === productId && i.size === size);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Item not in cart' });

    if (quantity <= 0) cart.items.splice(idx, 1);
    else cart.items[idx].quantity = quantity;

    cart.updatedAt = new Date();
    await cart.save();
    res.json({ success: true, items: cart.items });
  } catch (err) { next(err); }
});

// Remove item
router.delete('/', auth, validate([
  body('productId').notEmpty(),
  body('size').notEmpty()
]), async (req, res, next) => {
  try {
    const { productId, size } = req.body;
    let cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

    cart.items = cart.items.filter(i => !(i.productId === productId && i.size === size));
    cart.updatedAt = new Date();
    await cart.save();
    res.json({ success: true, items: cart.items });
  } catch (err) { next(err); }
});

// Clear cart
router.delete('/all', auth, async (req, res, next) => {
  try {
    let cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) return res.json({ success: true, items: [] });
    cart.items = [];
    cart.updatedAt = new Date();
    await cart.save();
    res.json({ success: true, items: cart.items });
  } catch (err) { next(err); }
});

// Sync local cart with server cart (when user logs in)
router.post('/sync', auth, validate([
  body('items').isArray().withMessage('Items must be an array')
]), async (req, res, next) => {
  try {
    const { items } = req.body;
    let cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) cart = await Cart.create({ userId: req.user.id, items: [] });

    // Merge local cart items with server cart
    for (const localItem of items) {
      const { productId, size = 'M', quantity = 1 } = localItem;
      // Verify product exists
      const product = await Product.findOne({ id: productId });
      if (!product) continue; // Skip invalid products

      const existing = cart.items.find(i => i.productId === productId && i.size === size);
      if (existing) {
        existing.quantity += quantity;
      } else {
        cart.items.push({ productId, size, quantity });
      }
    }

    cart.updatedAt = new Date();
    await cart.save();
    res.json({ success: true, items: cart.items });
  } catch (err) { next(err); }
});

// Apply coupon to cart
router.post('/coupon/apply', auth, validate([
  body('couponCode').notEmpty().trim()
]), async (req, res, next) => {
  try {
    const { couponCode } = req.body;
    
    // Get user's cart
    let cart = await Cart.findOne({ userId: req.user.id });
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    // Find and validate coupon
    const coupon = await Coupon.findOne({ 
      code: couponCode.toUpperCase(),
      isActive: true 
    });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Invalid coupon code'
      });
    }

    // Calculate cart total (you'll need to implement this based on your product pricing)
    let cartTotal = 0;
    for (const item of cart.items) {
      const product = await Product.findOne({ id: item.productId });
      if (product) {
        cartTotal += product.price * item.quantity;
      }
    }

    // Validate coupon for this order
    const validation = coupon.validateForOrder(cartTotal);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message
      });
    }

    // Check if user already used this coupon
    const existingUsage = coupon.usedBy.find(usage => 
      usage.user.toString() === req.user.id.toString()
    );
    
    if (existingUsage) {
      return res.status(400).json({
        success: false,
        message: 'You have already used this coupon'
      });
    }

    // Calculate discount
    const discountAmount = coupon.calculateDiscount(cartTotal);

    // Apply coupon to cart
    cart.appliedCoupon = {
      code: coupon.code,
      discountAmount,
      discountType: coupon.discountType,
      appliedAt: new Date()
    };
    cart.updatedAt = new Date();
    await cart.save();

    res.json({
      success: true,
      message: 'Coupon applied successfully',
      appliedCoupon: cart.appliedCoupon,
      cartTotal,
      discountAmount,
      finalTotal: cartTotal - discountAmount
    });
  } catch (err) { next(err); }
});

// Remove coupon from cart
router.delete('/coupon', auth, async (req, res, next) => {
  try {
    let cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    cart.appliedCoupon = undefined;
    cart.updatedAt = new Date();
    await cart.save();

    res.json({
      success: true,
      message: 'Coupon removed successfully'
    });
  } catch (err) { next(err); }
});

// Validate coupon for cart
router.post('/coupon/validate', auth, validate([
  body('couponCode').notEmpty().trim()
]), async (req, res, next) => {
  try {
    const { couponCode } = req.body;
    
    // Get user's cart
    let cart = await Cart.findOne({ userId: req.user.id });
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    // Find coupon
    const coupon = await Coupon.findOne({ 
      code: couponCode.toUpperCase(),
      isActive: true 
    });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Invalid coupon code'
      });
    }

    // Calculate cart total
    let cartTotal = 0;
    for (const item of cart.items) {
      const product = await Product.findOne({ id: item.productId });
      if (product) {
        cartTotal += product.price * item.quantity;
      }
    }

    // Validate coupon
    const validation = coupon.validateForOrder(cartTotal);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message
      });
    }

    // Check if user already used this coupon
    const existingUsage = coupon.usedBy.find(usage => 
      usage.user.toString() === req.user.id.toString()
    );
    
    if (existingUsage) {
      return res.status(400).json({
        success: false,
        message: 'You have already used this coupon'
      });
    }

    // Calculate discount
    const discountAmount = coupon.calculateDiscount(cartTotal);

    res.json({
      success: true,
      coupon: {
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount
      },
      cartTotal,
      finalTotal: cartTotal - discountAmount
    });
  } catch (err) { next(err); }
});

module.exports = router;
