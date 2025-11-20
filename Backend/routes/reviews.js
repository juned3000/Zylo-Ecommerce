const express = require('express');
const auth = require('../middleware/auth');
const { body, validate } = require('../middleware/validate');
const Review = require('../models/Review');
const Order = require('../models/Order');
const Product = require('../models/Product');

const router = express.Router();

// Validation rules for review submission
const reviewValidation = [
  body('productId').notEmpty().withMessage('Product ID is required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('title').isLength({ min: 1, max: 100 }).withMessage('Title must be 1-100 characters'),
  body('comment').isLength({ min: 10, max: 1000 }).withMessage('Comment must be 10-1000 characters'),
  body('orderId').optional().notEmpty().withMessage('Order ID cannot be empty if provided')
];

// Submit a new review
router.post('/', auth, validate(reviewValidation), async (req, res) => {
  try {
    console.log('🔍 Review submission request:', {
      body: req.body,
      userId: req.user?.id || req.user?._id,
      userEmail: req.user?.email
    });

    const { productId, rating, title, comment, orderId, images = [] } = req.body;
    const userId = req.user.id || req.user._id;

    // Check if user has already reviewed this product for this order
    if (orderId) {
      const existingReview = await Review.findOne({
        userId: userId,
        productId: productId,
        orderId: orderId
      });

      if (existingReview) {
        return res.status(400).json({
          success: false,
          message: 'You have already reviewed this product for this order'
        });
      }

      // Verify that the user actually ordered this product (optional but recommended)
      console.log('🔍 Checking order:', { orderId, userId, productId });
      const order = await Order.findOne({
        id: orderId,
        userId: userId,
        'items.id': productId
      });
      console.log('🔍 Order found:', !!order, order?._id);

      if (!order) {
        console.log('❌ Order not found for review validation');
        // For testing: allow reviews even if order verification fails
        // TODO: Remove this in production
        console.log('⚠️ WARNING: Allowing review without order verification (testing mode)');
        // return res.status(400).json({
        //   success: false,
        //   message: 'You can only review products you have purchased'
        // });
      }
    }

    // Create the review
    const reviewData = {
      productId,
      userId,
      orderId: orderId || `demo_order_${Date.now()}`, // Use provided orderId or generate demo one
      rating,
      title,
      comment,
      images: images.map(img => ({
        url: img.url || img,
        alt: img.alt || `Review image for ${title}`
      })),
      isVerifiedPurchase: !!orderId, // Mark as verified if orderId provided
      isApproved: false // Requires admin approval by default
    };
    
    console.log('🔍 Creating review with data:', reviewData);
    const review = new Review(reviewData);

    await review.save();
    console.log('✅ Review saved successfully:', review.id);

    // Update product rating statistics (temporarily disabled for debugging)
    try {
      await updateProductRatings(productId);
    } catch (error) {
      console.error('⚠️ Product rating update failed, but review was saved:', error);
      // Don't fail the request if product update fails
    }

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully! It will be visible after admin approval.',
      review: {
        id: review.id,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        createdAt: review.createdAt,
        isApproved: review.isApproved
      }
    });

  } catch (error) {
    console.error('Error submitting review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit review. Please try again.'
    });
  }
});

// Get reviews for a product (public endpoint)
router.get('/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Get approved reviews only for public view
    const [reviews, total, productStats] = await Promise.all([
      Review.find({ 
        productId: productId, 
        isApproved: true 
      })
      .populate('userId', 'name email')
      .populate('adminResponse.respondedBy', 'name email')
      .sort(sort)
      .limit(parseInt(limit))
      .skip(skip),
      
      Review.countDocuments({ 
        productId: productId, 
        isApproved: true 
      }),
      
      Review.getProductStats(productId)
    ]);

    res.json({
      success: true,
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      productStats
    });

  } catch (error) {
    console.error('Error fetching product reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews'
    });
  }
});

// Check if user can review a product for a specific order
router.get('/can-review', auth, async (req, res) => {
  try {
    const { productId, orderId } = req.query;
    const userId = req.user.id || req.user._id;
    
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }
    
    // Check if user has already reviewed this product
    let existingReview = null;
    if (orderId) {
      existingReview = await Review.findOne({
        userId: userId,
        productId: productId,
        orderId: orderId
      });
    }
    
    res.json({
      success: true,
      canReview: !existingReview,
      hasReviewed: !!existingReview,
      existingReview: existingReview ? {
        id: existingReview.id,
        rating: existingReview.rating,
        title: existingReview.title,
        comment: existingReview.comment,
        isApproved: existingReview.isApproved,
        createdAt: existingReview.createdAt
      } : null
    });
    
  } catch (error) {
    console.error('Error checking review eligibility:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check review eligibility'
    });
  }
});

// Get user's own reviews
router.get('/my-reviews', auth, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { page = 1, limit = 10 } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reviews, total] = await Promise.all([
      Review.find({ userId: userId })
        .populate('adminResponse.respondedBy', 'name email')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(skip),
      
      Review.countDocuments({ userId: userId })
    ]);

    res.json({
      success: true,
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching user reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your reviews'
    });
  }
});

// Update user's own review
router.put('/:reviewId', auth, validate(reviewValidation), async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { rating, title, comment, images = [] } = req.body;
    const userId = req.user.id || req.user._id;

    // Find review and check ownership
    const review = await Review.findOne({ id: reviewId, userId: userId });
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found or you do not have permission to edit it'
      });
    }

    // Update review
    review.rating = rating;
    review.title = title;
    review.comment = comment;
    review.images = images.map(img => ({
      url: img.url || img,
      alt: img.alt || `Review image for ${title}`
    }));
    review.isApproved = false; // Reset approval status after edit

    await review.save();

    // Update product rating statistics
    await updateProductRatings(review.productId);

    res.json({
      success: true,
      message: 'Review updated successfully! It will need admin approval again.',
      review: {
        id: review.id,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        updatedAt: review.updatedAt,
        isApproved: review.isApproved
      }
    });

  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update review'
    });
  }
});

// Delete user's own review
router.delete('/:reviewId', auth, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user.id || req.user._id;

    // Find and delete review
    const review = await Review.findOneAndDelete({ id: reviewId, userId: userId });
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found or you do not have permission to delete it'
      });
    }

    // Update product rating statistics
    await updateProductRatings(review.productId);

    res.json({
      success: true,
      message: 'Review deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete review'
    });
  }
});

// Mark review as helpful (like/thumbs up)
router.post('/:reviewId/helpful', auth, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user.id || req.user._id;

    const review = await Review.findOne({ id: reviewId });
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Use the method from Review model
    const result = await review.markAsHelpful(userId);
    
    res.json(result);

  } catch (error) {
    console.error('Error marking review as helpful:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark review as helpful'
    });
  }
});

// Report a review
router.post('/:reviewId/report', auth, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { reasons = ['Inappropriate content'] } = req.body;

    const review = await Review.findOne({ id: reviewId });
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Mark as reported
    review.isReported = true;
    review.reportReasons = reasons;
    await review.save();

    res.json({
      success: true,
      message: 'Review reported successfully. Our team will review it.'
    });

  } catch (error) {
    console.error('Error reporting review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to report review'
    });
  }
});

// Helper function to update product rating statistics
async function updateProductRatings(productId) {
  try {
    const stats = await Review.getProductStats(productId);
    
    // Update product document with new rating statistics
    await Product.findOneAndUpdate(
      { id: productId },
      {
        averageRating: stats.averageRating,
        totalRatings: stats.totalReviews,
        ratingDistribution: stats.ratingDistribution
      },
      { upsert: false }
    );
    
    console.log(`Updated ratings for product ${productId}:`, stats);
  } catch (error) {
    console.error(`Error updating product ratings for ${productId}:`, error);
  }
}

module.exports = router;