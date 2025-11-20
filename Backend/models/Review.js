const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    default: function() {
      return `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  },
  productId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  orderId: {
    type: String,
    ref: 'Order',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  comment: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  images: [{
    url: String,
    alt: String
  }],
  isVerifiedPurchase: {
    type: Boolean,
    default: true
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  isHelpful: {
    type: Number,
    default: 0
  },
  isReported: {
    type: Boolean,
    default: false
  },
  reportReasons: [String],
  adminResponse: {
    message: String,
    respondedAt: Date,
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  helpfulVotes: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    votedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Compound indexes for efficient queries
reviewSchema.index({ productId: 1, isApproved: 1 });
reviewSchema.index({ userId: 1 });
reviewSchema.index({ rating: 1 });
reviewSchema.index({ createdAt: -1 });

// Virtual for helpful votes count
reviewSchema.virtual('helpfulVotesCount').get(function() {
  return this.helpfulVotes.length;
});

// Static method to get product rating statistics
reviewSchema.statics.getProductStats = async function(productId) {
  const stats = await this.aggregate([
    { 
      $match: { 
        productId: productId, 
        isApproved: true 
      } 
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
        ratingDistribution: {
          $push: '$rating'
        }
      }
    },
    {
      $project: {
        averageRating: { $round: ['$averageRating', 1] },
        totalReviews: 1,
        ratingDistribution: 1
      }
    }
  ]);

  if (stats.length === 0) {
    return {
      averageRating: 0,
      totalReviews: 0,
      ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    };
  }

  const result = stats[0];
  
  // Calculate rating distribution
  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  result.ratingDistribution.forEach(rating => {
    distribution[rating]++;
  });

  result.ratingDistribution = distribution;
  return result;
};

// Method to check if user can review this product
reviewSchema.statics.canUserReview = async function(userId, productId, orderId) {
  // Check if user has already reviewed this product for this order
  const existingReview = await this.findOne({
    userId: userId,
    productId: productId,
    orderId: orderId
  });

  if (existingReview) {
    return { canReview: false, reason: 'You have already reviewed this product' };
  }

  // Here you would typically check if the user actually purchased the product
  // and if the order is delivered, but for now we'll assume it's valid
  return { canReview: true };
};

// Method to mark review as helpful
reviewSchema.methods.markAsHelpful = async function(userId) {
  // Check if user has already voted
  const existingVote = this.helpfulVotes.find(vote => 
    vote.userId.toString() === userId.toString()
  );

  if (existingVote) {
    return { success: false, message: 'You have already voted for this review' };
  }

  this.helpfulVotes.push({ userId });
  this.isHelpful = this.helpfulVotes.length;
  await this.save();

  return { success: true, helpfulCount: this.isHelpful };
};

// ID is now auto-generated using default function above

module.exports = mongoose.model('Review', reviewSchema);
