const express = require('express');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Coupon = require('../models/Coupon');
const Review = require('../models/Review');
const { body, validate } = require('../middleware/validate');
const { DataExporter, AnalyticsCalculator, BackupManager } = require('../utils/adminUtils');

const router = express.Router();

// Admin dashboard statistics
router.get('/dashboard', auth, admin, async (req, res, next) => {
  try {
    const [userCount, productCount, orderCount, pendingOrders, recentOrders, reviewStats] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments(),
      Order.countDocuments(),
      Order.countDocuments({ orderStatus: { $in: ['pending_payment', 'confirmed', 'processing'] } }),
      Order.find().sort({ createdAt: -1 }).limit(5).populate('userId', 'firstName lastName email'),
      Review.aggregate([
        {
          $group: {
            _id: null,
            totalReviews: { $sum: 1 },
            pendingReviews: {
              $sum: { $cond: [{ $eq: ['$isApproved', false] }, 1, 0] }
            },
            approvedReviews: {
              $sum: { $cond: [{ $eq: ['$isApproved', true] }, 1, 0] }
            },
            averageRating: { $avg: '$rating' },
            reportedReviews: {
              $sum: { $cond: [{ $eq: ['$isReported', true] }, 1, 0] }
            }
          }
        }
      ])
    ]);

    // Calculate total revenue from completed orders
    const revenueData = await Order.aggregate([
      { $match: { orderStatus: 'delivered' } },
      { $group: { _id: null, totalRevenue: { $sum: '$totals.total' } } }
    ]);

    const totalRevenue = revenueData.length > 0 ? revenueData[0].totalRevenue : 0;
    
    // Extract review statistics
    const reviews = reviewStats.length > 0 ? reviewStats[0] : {
      totalReviews: 0,
      pendingReviews: 0,
      approvedReviews: 0,
      averageRating: 0,
      reportedReviews: 0
    };

    res.json({
      success: true,
      stats: {
        totalUsers: userCount,
        totalProducts: productCount,
        totalOrders: orderCount,
        pendingOrders,
        totalRevenue,
        recentOrders,
        reviews: {
          total: reviews.totalReviews,
          pending: reviews.pendingReviews,
          approved: reviews.approvedReviews,
          reported: reviews.reportedReviews,
          averageRating: reviews.averageRating ? parseFloat(reviews.averageRating.toFixed(1)) : 0
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

// Get all users (admin only)
router.get('/users', auth, admin, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find().select('-passwordHash').sort({ createdAt: -1 }).limit(limit).skip(skip),
      User.countDocuments()
    ]);

    res.json({
      success: true,
      users,
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

// Update user admin status
router.put('/users/:userId/admin', auth, admin, async (req, res, next) => {
  try {
    const { isAdmin } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { isAdmin: Boolean(isAdmin) },
      { new: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
});

// Get all orders (admin only)
router.get('/orders', auth, admin, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status;

    const filter = status ? { orderStatus: status } : {};

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('userId', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip),
      Order.countDocuments(filter)
    ]);

    res.json({
      success: true,
      orders,
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

// Update order status (admin only)
router.put('/orders/:orderId/status', auth, admin, validate([
  body('orderStatus').isIn(['pending_payment', 'confirmed', 'processing', 'packed', 'shipped', 'delivered', 'cancelled'])
]), async (req, res, next) => {
  try {
    const { orderStatus } = req.body;
    const order = await Order.findOne({ id: req.params.orderId }).populate('userId', 'firstName lastName email');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Don't update if status is the same
    if (order.orderStatus === orderStatus) {
      return res.json({ success: true, order });
    }

    // Update order status
    order.orderStatus = orderStatus;

    // Initialize tracking if it doesn't exist
    if (!order.tracking) {
      const trackingNumber = 'BD' + Math.floor(1000000000 + Math.random() * 8999999999);
      const estimatedDelivery = new Date();
      estimatedDelivery.setDate(estimatedDelivery.getDate() + Math.floor(Math.random() * 3) + 3);
      
      order.tracking = {
        trackingNumber,
        carrier: ['BlueDart Express', 'DTDC Express', 'Delhivery', 'FedEx'][Math.floor(Math.random() * 4)],
        estimatedDelivery,
        updates: [],
        currentLocation: 'Processing Center'
      };
    }

    // Add tracking update for the status change
    const statusMessages = {
      'pending_payment': 'Order placed, awaiting payment confirmation',
      'confirmed': 'Payment confirmed - Order processing has begun',
      'processing': 'Order is being prepared for shipment',
      'packed': 'Order has been packed and is ready for shipment',
      'shipped': 'Package has been dispatched and is on the way',
      'delivered': 'Package has been delivered successfully',
      'cancelled': 'Order has been cancelled'
    };

    const statusLocations = {
      'pending_payment': 'Order System',
      'confirmed': 'Processing Center',
      'processing': 'Packaging Facility',
      'packed': 'Packaging Facility',
      'shipped': 'In Transit',
      'delivered': 'Delivered',
      'cancelled': 'Cancelled'
    };

    // Add tracking update if status has a message
    if (statusMessages[orderStatus]) {
      order.tracking.updates.push({
        status: orderStatus,
        message: statusMessages[orderStatus],
        location: statusLocations[orderStatus] || 'Unknown',
        timestamp: new Date()
      });
      
      order.tracking.currentLocation = statusLocations[orderStatus] || 'Unknown';
    }

    // Set actual delivery date if delivered
    if (orderStatus === 'delivered' && !order.tracking.actualDelivery) {
      order.tracking.actualDelivery = new Date();
    }

    await order.save();

    res.json({ success: true, order });
  } catch (err) {
    next(err);
  }
});

// Get sales analytics
router.get('/analytics/sales', auth, admin, async (req, res, next) => {
  try {
    const { period = '30d' } = req.query;
    
    // Calculate date range based on period
    const now = new Date();
    let startDate;
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Sales over time
    const salesOverTime = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          orderStatus: { $in: ['confirmed', 'processing', 'shipped', 'delivered'] }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$totals.total' },
          orders: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    // Top selling products
    const topProducts = await Order.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.id',
          name: { $first: '$items.name' },
          brand: { $first: '$items.brand' },
          totalSold: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 }
    ]);

    // Revenue by category
    const categoryRevenue = await Order.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.id',
          foreignField: 'id',
          as: 'product'
        }
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$product.category',
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          orders: { $sum: 1 }
        }
      },
      { $sort: { revenue: -1 } }
    ]);

    res.json({
      success: true,
      analytics: {
        salesOverTime,
        topProducts,
        categoryRevenue,
        period
      }
    });
  } catch (err) {
    next(err);
  }
});

// ===================
// REVIEW MANAGEMENT ROUTES
// ===================

// Get all reviews with filtering and pagination (admin only)
router.get('/reviews', auth, admin, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const {
      status, // 'pending', 'approved', 'reported'
      productId,
      rating,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    let filter = {};
    if (status === 'pending') filter.isApproved = false;
    if (status === 'approved') filter.isApproved = true;
    if (status === 'reported') filter.isReported = true;
    if (productId) filter.productId = productId;
    if (rating) filter.rating = parseInt(rating);

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const [reviews, total, stats] = await Promise.all([
      Review.find(filter)
        .populate('userId', 'name email')
        .populate('adminResponse.respondedBy', 'name email')
        .sort(sort)
        .limit(limit)
        .skip(skip),
      Review.countDocuments(filter),
      Review.aggregate([
        {
          $group: {
            _id: null,
            totalReviews: { $sum: 1 },
            pendingReviews: {
              $sum: { $cond: [{ $eq: ['$isApproved', false] }, 1, 0] }
            },
            approvedReviews: {
              $sum: { $cond: [{ $eq: ['$isApproved', true] }, 1, 0] }
            },
            reportedReviews: {
              $sum: { $cond: [{ $eq: ['$isReported', true] }, 1, 0] }
            },
            averageRating: { $avg: '$rating' }
          }
        }
      ])
    ]);

    res.json({
      success: true,
      reviews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      stats: stats.length > 0 ? stats[0] : {
        totalReviews: 0,
        pendingReviews: 0,
        approvedReviews: 0,
        reportedReviews: 0,
        averageRating: 0
      }
    });
  } catch (err) {
    next(err);
  }
});

// Get reviews for a specific product (admin only)
router.get('/reviews/product/:productId', auth, admin, async (req, res, next) => {
  try {
    const { productId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [reviews, total, productStats] = await Promise.all([
      Review.find({ productId })
        .populate('userId', 'name email')
        .populate('adminResponse.respondedBy', 'name email')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip),
      Review.countDocuments({ productId }),
      Review.getProductStats(productId)
    ]);

    res.json({
      success: true,
      reviews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      productStats
    });
  } catch (err) {
    next(err);
  }
});

// Approve/Reject review (admin only)
router.put('/reviews/:reviewId/approve', auth, admin, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { isApproved } = req.body;

    const review = await Review.findOne({ id: reviewId })
      .populate('userId', 'name email');

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    review.isApproved = Boolean(isApproved);
    await review.save();

    res.json({
      success: true,
      message: `Review ${isApproved ? 'approved' : 'rejected'} successfully`,
      review
    });
  } catch (err) {
    next(err);
  }
});

// Bulk approve/reject reviews (admin only)
router.put('/reviews/bulk-action', auth, admin, validate([
  body('reviewIds').isArray().notEmpty(),
  body('action').isIn(['approve', 'reject', 'delete'])
]), async (req, res, next) => {
  try {
    const { reviewIds, action } = req.body;

    let result;
    switch (action) {
      case 'approve':
        result = await Review.updateMany(
          { id: { $in: reviewIds } },
          { isApproved: true }
        );
        break;
      case 'reject':
        result = await Review.updateMany(
          { id: { $in: reviewIds } },
          { isApproved: false }
        );
        break;
      case 'delete':
        result = await Review.deleteMany(
          { id: { $in: reviewIds } }
        );
        break;
    }

    res.json({
      success: true,
      message: `${result.modifiedCount || result.deletedCount} reviews ${action}d successfully`,
      result
    });
  } catch (err) {
    next(err);
  }
});

// Admin respond to review
router.post('/reviews/:reviewId/respond', auth, admin, validate([
  body('message').notEmpty().trim().isLength({ max: 500 })
]), async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { message } = req.body;

    const review = await Review.findOne({ id: reviewId });
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    review.adminResponse = {
      message: message.trim(),
      respondedAt: new Date(),
      respondedBy: req.user._id
    };

    await review.save();
    await review.populate('adminResponse.respondedBy', 'name email');

    res.json({
      success: true,
      message: 'Response added successfully',
      review
    });
  } catch (err) {
    next(err);
  }
});

// Mark review as reported/unreported
router.put('/reviews/:reviewId/report', auth, admin, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { isReported, reportReasons = [] } = req.body;

    const review = await Review.findOne({ id: reviewId });
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    review.isReported = Boolean(isReported);
    review.reportReasons = isReported ? reportReasons : [];
    await review.save();

    res.json({
      success: true,
      message: `Review ${isReported ? 'marked as reported' : 'unmarked from reported'}`,
      review
    });
  } catch (err) {
    next(err);
  }
});

// Delete review (admin only)
router.delete('/reviews/:reviewId', auth, admin, async (req, res, next) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findOneAndDelete({ id: reviewId });
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    res.json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (err) {
    next(err);
  }
});

// Get review analytics
router.get('/reviews/analytics', auth, admin, async (req, res, next) => {
  try {
    const { period = '30d' } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate;
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Reviews over time
    const reviewsOverTime = await Review.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          totalReviews: { $sum: 1 },
          approvedReviews: {
            $sum: { $cond: [{ $eq: ['$isApproved', true] }, 1, 0] }
          },
          averageRating: { $avg: '$rating' }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    // Rating distribution
    const ratingDistribution = await Review.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          isApproved: true
        }
      },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    // Top reviewed products
    const topReviewedProducts = await Review.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          isApproved: true
        }
      },
      {
        $group: {
          _id: '$productId',
          reviewCount: { $sum: 1 },
          averageRating: { $avg: '$rating' }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: 'id',
          as: 'product'
        }
      },
      {
        $unwind: {
          path: '$product',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          productName: { $ifNull: ['$product.name', 'Unknown Product'] },
          productBrand: { $ifNull: ['$product.brand', 'Unknown Brand'] },
          reviewCount: 1,
          averageRating: { $round: ['$averageRating', 1] }
        }
      },
      { $sort: { reviewCount: -1 } },
      { $limit: 10 }
    ]);

    // Overall stats
    const overallStats = await Review.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          approvedReviews: {
            $sum: { $cond: [{ $eq: ['$isApproved', true] }, 1, 0] }
          },
          pendingReviews: {
            $sum: { $cond: [{ $eq: ['$isApproved', false] }, 1, 0] }
          },
          reportedReviews: {
            $sum: { $cond: [{ $eq: ['$isReported', true] }, 1, 0] }
          },
          averageRating: { $avg: '$rating' },
          reviewsWithImages: {
            $sum: {
              $cond: [
                { $gt: [{ $size: { $ifNull: ['$images', []] } }, 0] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const stats = overallStats.length > 0 ? overallStats[0] : {
      totalReviews: 0,
      approvedReviews: 0,
      pendingReviews: 0,
      reportedReviews: 0,
      averageRating: 0,
      reviewsWithImages: 0
    };

    res.json({
      success: true,
      analytics: {
        period,
        overallStats: {
          ...stats,
          averageRating: stats.averageRating ? parseFloat(stats.averageRating.toFixed(1)) : 0,
          approvalRate: stats.totalReviews > 0 ? ((stats.approvedReviews / stats.totalReviews) * 100).toFixed(1) : 0
        },
        reviewsOverTime,
        ratingDistribution: ratingDistribution.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }),
        topReviewedProducts
      }
    });
  } catch (err) {
    next(err);
  }
});

// Export reviews data
router.get('/reviews/export', auth, admin, async (req, res, next) => {
  try {
    const { format = 'csv', status, period = '30d' } = req.query;
    
    // Build filter
    let filter = {};
    if (status === 'approved') filter.isApproved = true;
    if (status === 'pending') filter.isApproved = false;
    if (status === 'reported') filter.isReported = true;
    
    if (period !== 'all') {
      const now = new Date();
      let startDate;
      
      switch (period) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
      }
      
      if (startDate) {
        filter.createdAt = { $gte: startDate };
      }
    }

    const reviews = await Review.find(filter)
      .populate('userId', 'name email')
      .populate('adminResponse.respondedBy', 'name email')
      .sort({ createdAt: -1 });

    if (format === 'csv') {
      const fs = require('fs').promises;
      const path = require('path');
      
      const exportsDir = path.join(__dirname, '../exports');
      try {
        await fs.access(exportsDir);
      } catch {
        await fs.mkdir(exportsDir, { recursive: true });
      }
      
      // Generate CSV
      let csv = 'Review ID,Product ID,Customer Name,Customer Email,Rating,Title,Comment,Status,Images,Reported,Created Date,Admin Response\n';
      
      reviews.forEach(review => {
        const csvLine = [
          review.id,
          review.productId,
          review.userId?.name || 'N/A',
          review.userId?.email || 'N/A',
          review.rating,
          `"${(review.title || '').replace(/"/g, '""')}"`,
          `"${(review.comment || '').replace(/"/g, '""')}"`,
          review.isApproved ? 'Approved' : 'Pending',
          review.images?.length || 0,
          review.isReported ? 'Yes' : 'No',
          review.createdAt.toISOString().split('T')[0],
          review.adminResponse?.message ? `"${review.adminResponse.message.replace(/"/g, '""')}"` : 'N/A'
        ].join(',');
        csv += csvLine + '\n';
      });
      
      const filename = `reviews-export-${Date.now()}.csv`;
      const filepath = path.join(exportsDir, filename);
      
      await fs.writeFile(filepath, csv);
      
      res.json({
        success: true,
        message: 'Reviews data exported successfully',
        filename,
        downloadUrl: `/api/admin/download/${filename}`,
        totalRecords: reviews.length
      });
    } else {
      res.json({
        success: true,
        reviews,
        totalRecords: reviews.length
      });
    }
  } catch (err) {
    next(err);
  }
});

// ===================
// END REVIEW MANAGEMENT ROUTES
// ===================

// Create admin user (only if no admin exists)
router.post('/create-admin', async (req, res, next) => {
  try {
    // Check if any admin user exists
    const adminExists = await User.findOne({ isAdmin: true });
    if (adminExists) {
      return res.status(400).json({ 
        success: false, 
        message: 'Admin user already exists' 
      });
    }

    const { email, name = 'Admin' } = req.body;
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }

    // Create admin user
    const adminUser = await User.create({
      email: email.toLowerCase(),
      name,
      isAdmin: true,
      wishlist: [],
      addresses: []
    });

    res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      user: {
        id: adminUser._id,
        email: adminUser.email,
        name: adminUser.name,
        isAdmin: adminUser.isAdmin
      }
    });
  } catch (err) {
    next(err);
  }
});

// Enhanced Analytics Routes
router.get('/analytics/comprehensive', auth, admin, async (req, res, next) => {
  try {
    const period = req.query.period || '30d';
    
    const [salesMetrics, topProducts, customerMetrics, inventoryMetrics] = await Promise.all([
      AnalyticsCalculator.calculateSalesMetrics(period),
      AnalyticsCalculator.calculateTopProducts(10, period),
      AnalyticsCalculator.calculateCustomerMetrics(),
      AnalyticsCalculator.calculateInventoryMetrics()
    ]);

    res.json({
      success: true,
      analytics: {
        sales: salesMetrics,
        topProducts,
        customers: customerMetrics,
        inventory: inventoryMetrics,
        period
      }
    });
  } catch (err) {
    next(err);
  }
});

// Main analytics dashboard endpoint
router.get('/analytics', auth, admin, async (req, res, next) => {
  try {
    const { dateRange = '30d', category } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate, previousStartDate;
    
    switch (dateRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        previousStartDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        previousStartDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        previousStartDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        previousStartDate = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        previousStartDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    }
    
    // Build category filter
    const categoryFilter = category ? { 'items.category': category } : {};
    
    // Get current period metrics
    const currentPeriodMatch = {
      createdAt: { $gte: startDate },
      orderStatus: { $in: ['confirmed', 'processing', 'packed', 'shipped', 'delivered'] },
      ...categoryFilter
    };
    
    // Get previous period metrics for comparison
    const previousPeriodMatch = {
      createdAt: { $gte: previousStartDate, $lt: startDate },
      orderStatus: { $in: ['confirmed', 'processing', 'packed', 'shipped', 'delivered'] },
      ...categoryFilter
    };
    
    // Calculate current period metrics
    const [currentRevenue, currentOrders, currentCustomers, previousRevenue, previousOrders, previousCustomers] = await Promise.all([
      // Current period revenue
      Order.aggregate([
        { $match: currentPeriodMatch },
        { $group: { _id: null, total: { $sum: '$totals.total' } } }
      ]),
      // Current period order count
      Order.countDocuments(currentPeriodMatch),
      // Current period unique customers
      Order.aggregate([
        { $match: currentPeriodMatch },
        { $group: { _id: '$userId' } },
        { $count: 'uniqueCustomers' }
      ]),
      // Previous period revenue
      Order.aggregate([
        { $match: previousPeriodMatch },
        { $group: { _id: null, total: { $sum: '$totals.total' } } }
      ]),
      // Previous period order count
      Order.countDocuments(previousPeriodMatch),
      // Previous period unique customers
      Order.aggregate([
        { $match: previousPeriodMatch },
        { $group: { _id: '$userId' } },
        { $count: 'uniqueCustomers' }
      ])
    ]);
    
    // Extract values
    const totalRevenue = currentRevenue.length > 0 ? currentRevenue[0].total : 0;
    const totalOrders = currentOrders;
    const totalCustomers = currentCustomers.length > 0 ? currentCustomers[0].uniqueCustomers : 0;
    
    const prevRevenue = previousRevenue.length > 0 ? previousRevenue[0].total : 0;
    const prevOrders = previousOrders;
    const prevCustomersCount = previousCustomers.length > 0 ? previousCustomers[0].uniqueCustomers : 0;
    
    // Calculate percentage changes
    const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
    const ordersChange = prevOrders > 0 ? ((totalOrders - prevOrders) / prevOrders) * 100 : 0;
    const customersChange = prevCustomersCount > 0 ? ((totalCustomers - prevCustomersCount) / prevCustomersCount) * 100 : 0;
    
    // Calculate conversion rate (orders / unique visitors)
    const totalUsers = await User.countDocuments();
    const conversionRate = totalUsers > 0 ? (totalOrders / totalUsers) * 100 : 0;
    const conversionChange = 0; // Would need visitor tracking to calculate this
    
    // Sales trend data
    const salesTrend = await Order.aggregate([
      { $match: currentPeriodMatch },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$totals.total' },
          orders: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    // Top products data
    const topProductsData = await Order.aggregate([
      { $match: currentPeriodMatch },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.name',
          totalSold: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 5 }
    ]);
    
    // Revenue by category data
    const revenueByCategoryData = await Order.aggregate([
      { $match: currentPeriodMatch },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.id',
          foreignField: 'id',
          as: 'product'
        }
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ['$product.category', 'Unknown'] },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 7 }
    ]);
    
    // Customer growth data (simplified - new customers per period)
    const customerGrowthData = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          newCustomers: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    // Calculate cumulative customer count
    let cumulativeCustomers = await User.countDocuments({ createdAt: { $lt: startDate } });
    const customerGrowthWithTotal = customerGrowthData.map(day => {
      cumulativeCustomers += day.newCustomers;
      return {
        ...day,
        totalCustomers: cumulativeCustomers
      };
    });
    
    // Format chart data
    const formatChartData = {
      salesTrend: {
        labels: salesTrend.map(item => {
          const date = new Date(item._id);
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }),
        revenue: salesTrend.map(item => item.revenue),
        orders: salesTrend.map(item => item.orders)
      },
      topProducts: {
        labels: topProductsData.map(item => item._id),
        values: topProductsData.map(item => item.totalSold)
      },
      revenueByCategory: {
        labels: revenueByCategoryData.map(item => item._id),
        values: revenueByCategoryData.map(item => item.revenue)
      },
      customerGrowth: {
        labels: customerGrowthWithTotal.map(item => {
          const date = new Date(item._id);
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }),
        newCustomers: customerGrowthWithTotal.map(item => item.newCustomers),
        totalCustomers: customerGrowthWithTotal.map(item => item.totalCustomers)
      }
    };
    
    res.json({
      success: true,
      metrics: {
        totalRevenue,
        totalOrders,
        totalCustomers,
        conversionRate,
        revenueChange,
        ordersChange,
        customersChange,
        conversionChange
      },
      charts: formatChartData
    });
  } catch (err) {
    console.error('Analytics error:', err);
    next(err);
  }
});

// Analytics export endpoints
router.post('/analytics/export/pdf', auth, admin, async (req, res, next) => {
  try {
    const { dateRange = '30d' } = req.body;
    
    // Get analytics data
    const analyticsResponse = await fetch(`http://localhost:${process.env.PORT || 5000}/api/admin/analytics?dateRange=${dateRange}`, {
      headers: {
        'Authorization': req.headers.authorization
      }
    });
    
    if (!analyticsResponse.ok) {
      throw new Error('Failed to fetch analytics data');
    }
    
    const analyticsData = await analyticsResponse.json();
    
    // Generate PDF report using a simple HTML-to-PDF approach
    const fs = require('fs').promises;
    const path = require('path');
    
    // Create exports directory if it doesn't exist
    const exportsDir = path.join(__dirname, '../exports');
    try {
      await fs.access(exportsDir);
    } catch {
      await fs.mkdir(exportsDir, { recursive: true });
    }
    
    // Generate HTML content for PDF
    const htmlContent = generateAnalyticsHTML(analyticsData, dateRange);
    
    // For now, save as HTML file (in production, you'd use puppeteer or similar)
    const filename = `analytics-report-${Date.now()}.html`;
    const filepath = path.join(exportsDir, filename);
    
    await fs.writeFile(filepath, htmlContent);
    
    res.json({
      success: true,
      message: 'Analytics report generated successfully! (HTML format - PDF generation requires additional setup)',
      filename,
      downloadUrl: `/api/admin/download/${filename}`
    });
    
  } catch (err) {
    console.error('PDF Export error:', err);
    res.status(500).json({
      success: false,
      message: `PDF export failed: ${err.message}`
    });
  }
});

router.post('/analytics/export/excel', auth, admin, async (req, res, next) => {
  try {
    const { dateRange = '30d' } = req.body;
    
    // Get analytics data
    const analyticsResponse = await fetch(`http://localhost:${process.env.PORT || 5000}/api/admin/analytics?dateRange=${dateRange}`, {
      headers: {
        'Authorization': req.headers.authorization
      }
    });
    
    if (!analyticsResponse.ok) {
      throw new Error('Failed to fetch analytics data');
    }
    
    const analyticsData = await analyticsResponse.json();
    
    // Generate CSV data (Excel-compatible)
    const fs = require('fs').promises;
    const path = require('path');
    
    // Create exports directory if it doesn't exist
    const exportsDir = path.join(__dirname, '../exports');
    try {
      await fs.access(exportsDir);
    } catch {
      await fs.mkdir(exportsDir, { recursive: true });
    }
    
    // Generate CSV content
    const csvContent = generateAnalyticsCSV(analyticsData, dateRange);
    
    const filename = `analytics-data-${Date.now()}.csv`;
    const filepath = path.join(exportsDir, filename);
    
    await fs.writeFile(filepath, csvContent);
    
    res.json({
      success: true,
      message: 'Analytics data exported successfully! (CSV format - Excel compatible)',
      filename,
      downloadUrl: `/api/admin/download/${filename}`
    });
    
  } catch (err) {
    console.error('Excel Export error:', err);
    res.status(500).json({
      success: false,
      message: `Excel export failed: ${err.message}`
    });
  }
});

// Helper function to generate HTML report
function generateAnalyticsHTML(data, dateRange) {
  const { metrics, charts } = data;
  
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Analytics Report - ${dateRange}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 40px;
            color: #333;
            line-height: 1.6;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 2px solid #667eea;
        }
        .header h1 {
            color: #667eea;
            margin: 0;
            font-size: 2.5rem;
        }
        .header p {
            color: #6b7280;
            margin: 10px 0 0 0;
            font-size: 1.1rem;
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin-bottom: 40px;
        }
        .metric-card {
            background: linear-gradient(145deg, #ffffff, #f8fafc);
            padding: 25px;
            border-radius: 12px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
            text-align: center;
            border-left: 4px solid #667eea;
        }
        .metric-title {
            font-size: 0.9rem;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 10px;
        }
        .metric-value {
            font-size: 2rem;
            font-weight: bold;
            color: #1e293b;
            margin-bottom: 5px;
        }
        .metric-change {
            font-size: 0.85rem;
            font-weight: 500;
        }
        .metric-change.positive { color: #059669; }
        .metric-change.negative { color: #dc2626; }
        .metric-change.neutral { color: #6b7280; }
        .section {
            margin-bottom: 40px;
        }
        .section h2 {
            color: #1e293b;
            font-size: 1.5rem;
            margin-bottom: 20px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 10px;
        }
        .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        .data-table th,
        .data-table td {
            padding: 12px 15px;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
        }
        .data-table th {
            background: #f8fafc;
            font-weight: 600;
            color: #374151;
        }
        .data-table tr:hover {
            background: #f9fafb;
        }
        .footer {
            text-align: center;
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            color: #6b7280;
            font-size: 0.9rem;
        }
        @media print {
            body { margin: 20px; }
            .metrics-grid { grid-template-columns: repeat(2, 1fr); }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 Analytics Report</h1>
        <p>Period: ${dateRange.toUpperCase()} | Generated on ${new Date().toLocaleDateString()}</p>
    </div>
    
    <div class="metrics-grid">
        <div class="metric-card">
            <div class="metric-title">Total Revenue</div>
            <div class="metric-value">₹${(metrics.totalRevenue || 0).toLocaleString('en-IN')}</div>
            <div class="metric-change ${metrics.revenueChange > 0 ? 'positive' : metrics.revenueChange < 0 ? 'negative' : 'neutral'}">
                ${metrics.revenueChange > 0 ? '↗' : metrics.revenueChange < 0 ? '↘' : '→'} ${metrics.revenueChange.toFixed(1)}%
            </div>
        </div>
        <div class="metric-card">
            <div class="metric-title">Total Orders</div>
            <div class="metric-value">${(metrics.totalOrders || 0).toLocaleString()}</div>
            <div class="metric-change ${metrics.ordersChange > 0 ? 'positive' : metrics.ordersChange < 0 ? 'negative' : 'neutral'}">
                ${metrics.ordersChange > 0 ? '↗' : metrics.ordersChange < 0 ? '↘' : '→'} ${metrics.ordersChange.toFixed(1)}%
            </div>
        </div>
        <div class="metric-card">
            <div class="metric-title">Total Customers</div>
            <div class="metric-value">${(metrics.totalCustomers || 0).toLocaleString()}</div>
            <div class="metric-change ${metrics.customersChange > 0 ? 'positive' : metrics.customersChange < 0 ? 'negative' : 'neutral'}">
                ${metrics.customersChange > 0 ? '↗' : metrics.customersChange < 0 ? '↘' : '→'} ${metrics.customersChange.toFixed(1)}%
            </div>
        </div>
        <div class="metric-card">
            <div class="metric-title">Conversion Rate</div>
            <div class="metric-value">${(metrics.conversionRate || 0).toFixed(1)}%</div>
            <div class="metric-change neutral">→ ${metrics.conversionChange.toFixed(1)}%</div>
        </div>
    </div>
    
    <div class="section">
        <h2>Top Products</h2>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Product Name</th>
                    <th>Units Sold</th>
                </tr>
            </thead>
            <tbody>
                ${charts.topProducts.labels.map((label, index) => `
                    <tr>
                        <td>${label}</td>
                        <td>${charts.topProducts.values[index]}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    
    <div class="section">
        <h2>Revenue by Category</h2>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Category</th>
                    <th>Revenue</th>
                </tr>
            </thead>
            <tbody>
                ${charts.revenueByCategory.labels.map((label, index) => `
                    <tr>
                        <td>${label}</td>
                        <td>₹${charts.revenueByCategory.values[index].toLocaleString('en-IN')}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    
    <div class="footer">
        <p>© ${new Date().getFullYear()} Zylo Ecommerce - Analytics Report</p>
    </div>
</body>
</html>
  `;
}

// Helper function to generate CSV data
function generateAnalyticsCSV(data, dateRange) {
  const { metrics, charts } = data;
  
  let csv = 'Analytics Report\n';
  csv += `Period,${dateRange}\n`;
  csv += `Generated,${new Date().toISOString()}\n\n`;
  
  // Key Metrics
  csv += 'KEY METRICS\n';
  csv += 'Metric,Value,Change\n';
  csv += `Total Revenue,₹${(metrics.totalRevenue || 0).toLocaleString('en-IN')},${metrics.revenueChange.toFixed(1)}%\n`;
  csv += `Total Orders,${metrics.totalOrders || 0},${metrics.ordersChange.toFixed(1)}%\n`;
  csv += `Total Customers,${metrics.totalCustomers || 0},${metrics.customersChange.toFixed(1)}%\n`;
  csv += `Conversion Rate,${(metrics.conversionRate || 0).toFixed(1)}%,${metrics.conversionChange.toFixed(1)}%\n\n`;
  
  // Sales Trend
  csv += 'SALES TREND\n';
  csv += 'Date,Revenue,Orders\n';
  charts.salesTrend.labels.forEach((label, index) => {
    csv += `${label},${charts.salesTrend.revenue[index] || 0},${charts.salesTrend.orders[index] || 0}\n`;
  });
  csv += '\n';
  
  // Top Products
  csv += 'TOP PRODUCTS\n';
  csv += 'Product Name,Units Sold\n';
  charts.topProducts.labels.forEach((label, index) => {
    csv += `${label},${charts.topProducts.values[index]}\n`;
  });
  csv += '\n';
  
  // Revenue by Category
  csv += 'REVENUE BY CATEGORY\n';
  csv += 'Category,Revenue\n';
  charts.revenueByCategory.labels.forEach((label, index) => {
    csv += `${label},₹${charts.revenueByCategory.values[index].toLocaleString('en-IN')}\n`;
  });
  csv += '\n';
  
  // Customer Growth
  csv += 'CUSTOMER GROWTH\n';
  csv += 'Date,New Customers,Total Customers\n';
  charts.customerGrowth.labels.forEach((label, index) => {
    csv += `${label},${charts.customerGrowth.newCustomers[index] || 0},${charts.customerGrowth.totalCustomers[index] || 0}\n`;
  });
  
  return csv;
}

// Data Export Routes
router.get('/export/users', auth, admin, async (req, res, next) => {
  try {
    const filePath = await DataExporter.exportUsersData();
    const fileName = filePath.split('/').pop();
    
    res.json({
      success: true,
      message: 'Users data exported successfully',
      filename: fileName,
      downloadUrl: `/api/admin/download/${fileName}`
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: `Export failed: ${err.message}`
    });
  }
});

router.get('/export/products', auth, admin, async (req, res, next) => {
  try {
    const filePath = await DataExporter.exportProductsData();
    const fileName = filePath.split('/').pop();
    
    res.json({
      success: true,
      message: 'Products data exported successfully',
      filename: fileName,
      downloadUrl: `/api/admin/download/${fileName}`
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: `Export failed: ${err.message}`
    });
  }
});

router.get('/export/orders', auth, admin, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const filePath = await DataExporter.exportOrdersData(startDate, endDate);
    const fileName = filePath.split('/').pop();
    
    res.json({
      success: true,
      message: 'Orders data exported successfully',
      filename: fileName,
      downloadUrl: `/api/admin/download/${fileName}`
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: `Export failed: ${err.message}`
    });
  }
});

router.get('/export/coupons', auth, admin, async (req, res, next) => {
  try {
    const filePath = await DataExporter.exportCouponsData();
    const fileName = filePath.split('/').pop();
    
    res.json({
      success: true,
      message: 'Coupons data exported successfully',
      filename: fileName,
      downloadUrl: `/api/admin/download/${fileName}`
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: `Export failed: ${err.message}`
    });
  }
});

// File download route
router.get('/download/:filename', auth, admin, async (req, res, next) => {
  try {
    const { filename } = req.params;
    const path = require('path');
    const filePath = path.join(__dirname, '../exports', filename);
    
    // Check if file exists
    const fs = require('fs').promises;
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    // Determine content type based on file extension
    let contentType = 'application/octet-stream';
    if (filename.endsWith('.csv')) {
      contentType = 'text/csv';
    } else if (filename.endsWith('.html')) {
      contentType = 'text/html';
    } else if (filename.endsWith('.pdf')) {
      contentType = 'application/pdf';
    } else if (filename.endsWith('.xlsx')) {
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }
    
    // Set headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', contentType);
    
    // Send file
    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
});

// Database Backup Routes
router.post('/backup/create', auth, admin, async (req, res, next) => {
  try {
    const backup = await BackupManager.createDatabaseBackup();
    
    res.json({
      success: true,
      message: 'Database backup created successfully',
      backup
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: `Backup failed: ${err.message}`
    });
  }
});

router.get('/backup/list', auth, admin, async (req, res, next) => {
  try {
    const backups = await BackupManager.listBackups();
    
    res.json({
      success: true,
      backups
    });
  } catch (err) {
    next(err);
  }
});

// Coupon management routes

// Get all coupons (admin only)
router.get('/coupons', auth, admin, async (req, res, next) => {
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

// Create coupon (admin only)
router.post('/coupons', auth, admin, validate([
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
    console.log('Creating coupon with req.user:', req.user);
    console.log('req.user._id:', req.user._id);
    console.log('req.user.id:', req.user.id);
    
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
      createdBy: req.user._id || req.user.id
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

// Update coupon (admin only)
router.put('/coupons/:id', auth, admin, validate([
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
router.delete('/coupons/:id', auth, admin, async (req, res, next) => {
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

module.exports = router;
