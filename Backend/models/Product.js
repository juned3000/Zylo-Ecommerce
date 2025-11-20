const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // Keep legacy id for frontend compatibility
  name: { type: String, required: true },
  brand: { type: String, required: true },
  price: { type: Number, required: true },
  image: { type: String },
  sizes: [{ type: String }],
  category: { type: String, index: true },
  description: { type: String },
  stock: { type: Number, default: 100 },
  // Rating fields
  averageRating: { type: Number, default: 0, min: 0, max: 5 },
  totalRatings: { type: Number, default: 0 },
  ratingDistribution: {
    1: { type: Number, default: 0 },
    2: { type: Number, default: 0 },
    3: { type: Number, default: 0 },
    4: { type: Number, default: 0 },
    5: { type: Number, default: 0 }
  },
  createdAt: { type: Date, default: Date.now }
});

ProductSchema.index({ name: 'text', brand: 'text', category: 'text' });

module.exports = mongoose.model('Product', ProductSchema);
