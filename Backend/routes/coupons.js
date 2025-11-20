const express = require('express');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const Coupon = require('../models/Coupon');
const { body, validate } = require('../middleware/validate');

const router = express.Router();

// Get all coupons (admin only)
router.get('/', auth, admin, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status;

    let filter = {};
    if (status) {
      filter.isActive = status === 'active';
    }

    const [coupons, total] = await Promise.all([
      Coupon.find(filter)
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip),
      Coupon.countDocuments(filter)
    ]);

    res.json({
      success: true,
      coupons,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
});

// Public: Get active coupons for banner display
router.get('/active', async (req, res, next) => {
  try {
    const now = new Date();
    const limit = 5; // Only get top 5 active coupons for banner

    const coupons = await Coupon.find({
      isActive: true,
      validFrom: { $lte: now },
      validTo: { $gte: now }
    })
    .select('code description discountType discountValue minimumOrderValue maximumDiscount validFrom validTo')
    .sort({ createdAt: -1 })
    .limit(limit);

    res.json({
      success: true,
      coupons
    });
  } catch (err) {
    next(err);
  }
});

// Public: list currently active coupons (safe fields only)
router.get('/available', async (req, res, next) => {
  try {
    const now = new Date();
    const limit = Math.min(parseInt(req.query.limit) || 100, 200);
    const minOrder = req.query.minOrder ? parseFloat(req.query.minOrder) : null;

    const filter = {
      isActive: true,
      validFrom: { $lte: now },
      validTo: { $gte: now }
    };

    const query = Coupon.find(filter)
      .select('code description discountType discountValue minimumOrderValue maximumDiscount')
      .sort({ createdAt: -1 })
      .limit(limit);

    const coupons = await query.exec();

    // Optional client-side filter by minimum order if provided
    const items = Array.isArray(coupons) ? coupons.filter(c => {
      if (minOrder == null) return true;
      return (c.minimumOrderValue || 0) <= minOrder;
    }) : [];

    res.json({ success: true, items });
  } catch (err) {
    next(err);
  }
});

// Create a new coupon (admin only)
router.post('/', auth, admin, validate([
  body('code').isLength({ min: 3, max: 20 }).trim(),
  body('description').notEmpty().trim(),
  body('discountType').isIn(['percentage', 'fixed']),
  body('discountValue').isNumeric().isFloat({ min: 0 }),
  body('validFrom').isISO8601(),
  body('validTo').isISO8601(),
  body('minimumOrderValue').optional().isNumeric(),
  body('maximumDiscount').optional().isNumeric(),
  body('usageLimit').optional().isInt({ min: 1 })
]), async (req, res, next) => {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      minimumOrderValue,
      maximumDiscount,
      usageLimit,
      validFrom,
      validTo,
      applicableCategories,
      applicableProducts
    } = req.body;

    // Check if coupon code already exists
    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code already exists'
      });
    }

    // Validate date range
    const fromDate = new Date(validFrom);
    const toDate = new Date(validTo);
    if (fromDate >= toDate) {
      return res.status(400).json({
        success: false,
        message: 'Valid to date must be after valid from date'
      });
    }

    // Create coupon
    const coupon = await Coupon.create({
      code: code.toUpperCase(),
      description,
      discountType,
      discountValue,
      minimumOrderValue: minimumOrderValue || 0,
      maximumDiscount,
      usageLimit,
      validFrom: fromDate,
      validTo: toDate,
      applicableCategories: applicableCategories || [],
      applicableProducts: applicableProducts || [],
      createdBy: req.user._id
    });

    res.status(201).json({
      success: true,
      message: 'Coupon created successfully',
      coupon
    });
  } catch (err) {
    next(err);
  }
});

// Get coupon by code (for validation during checkout)
router.get('/validate/:code', async (req, res, next) => {
  try {
    const { code } = req.params;
    const { orderValue, products } = req.query;

    const coupon = await Coupon.findOne({ 
      code: code.toUpperCase(),
      isActive: true 
    });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found or inactive'
      });
    }

    // Validate coupon
    const validation = coupon.validateForOrder(
      parseFloat(orderValue) || 0,
      products ? JSON.parse(products) : []
    );

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message
      });
    }

    // Calculate discount
    const discount = coupon.calculateDiscount(parseFloat(orderValue) || 0);

    res.json({
      success: true,
      coupon: {
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discount
      }
    });
  } catch (err) {
    next(err);
  }
});

// Apply coupon (during order creation)
router.post('/apply', auth, async (req, res, next) => {
  try {
    const { code, orderValue, orderId } = req.body;

    const coupon = await Coupon.findOne({ 
      code: code.toUpperCase(),
      isActive: true 
    });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Invalid coupon code'
      });
    }

    // Validate coupon
    const validation = coupon.validateForOrder(orderValue);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message
      });
    }

    // Check if user already used this coupon
    const existingUsage = coupon.usedBy.find(usage => 
      usage.user.toString() === req.user._id.toString()
    );
    
    if (existingUsage) {
      return res.status(400).json({
        success: false,
        message: 'You have already used this coupon'
      });
    }

    // Calculate discount
    const discount = coupon.calculateDiscount(orderValue);

    // Record usage
    coupon.usedBy.push({
      user: req.user._id,
      orderValue,
      discountApplied: discount
    });
    coupon.usedCount = coupon.usedBy.length;

    await coupon.save();

    res.json({
      success: true,
      message: 'Coupon applied successfully',
      discount
    });
  } catch (err) {
    next(err);
  }
});

// Update coupon (admin only)
router.put('/:id', auth, admin, validate([
  body('description').optional().notEmpty().trim(),
  body('isActive').optional().isBoolean(),
  body('usageLimit').optional().isInt({ min: 1 })
]), async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Don't allow updating certain fields after creation
    delete updates.code;
    delete updates.discountType;
    delete updates.discountValue;
    delete updates.validFrom;
    delete updates.validTo;
    delete updates.createdBy;
    delete updates.usedBy;
    delete updates.usedCount;

    const coupon = await Coupon.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    );

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    res.json({
      success: true,
      message: 'Coupon updated successfully',
      coupon
    });
  } catch (err) {
    next(err);
  }
});

// Delete coupon (admin only)
router.delete('/:id', auth, admin, async (req, res, next) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    // Check if coupon has been used
    if (coupon.usedCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete coupon that has been used. Consider deactivating it instead.'
      });
    }

    await Coupon.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Coupon deleted successfully'
    });
  } catch (err) {
    next(err);
  }
});

// Get coupon usage statistics (admin only)
router.get('/:id/stats', auth, admin, async (req, res, next) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findById(id)
      .populate('usedBy.user', 'name email')
      .populate('createdBy', 'name email');

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    const stats = {
      totalUsage: coupon.usedCount,
      usageLimit: coupon.usageLimit,
      totalDiscount: coupon.usedBy.reduce((sum, usage) => sum + usage.discountApplied, 0),
      averageOrderValue: coupon.usedBy.length > 0 
        ? coupon.usedBy.reduce((sum, usage) => sum + usage.orderValue, 0) / coupon.usedBy.length 
        : 0,
      usageHistory: coupon.usedBy.sort((a, b) => new Date(b.usedAt) - new Date(a.usedAt))
    };

    res.json({
      success: true,
      coupon,
      stats
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
