const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  description: {
    type: String,
    default: ''
  },
  image: {
    type: String,
    default: ''
  },
  parentCategory: {
    type: String,
    ref: 'Category',
    default: null
  },
  subcategories: [{
    type: String,
    ref: 'Category'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  attributes: [{
    name: String,
    type: {
      type: String,
      enum: ['text', 'number', 'boolean', 'select'],
      default: 'text'
    },
    required: Boolean,
    options: [String] // for select type
  }],
  seoTitle: String,
  seoDescription: String,
  seoKeywords: [String],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
categorySchema.index({ slug: 1 });
categorySchema.index({ isActive: 1 });
categorySchema.index({ parentCategory: 1 });

// Virtual to get full category path
categorySchema.virtual('fullPath').get(function() {
  // This would need to be populated in queries
  return this.parentCategory ? `${this.parentCategory}/${this.slug}` : this.slug;
});

// Virtual to check if category has products
categorySchema.virtual('hasProducts').get(function() {
  return this.productCount > 0;
});

// Static method to get category hierarchy
categorySchema.statics.getHierarchy = async function() {
  const categories = await this.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
  
  const buildTree = (parentId = null) => {
    return categories
      .filter(cat => cat.parentCategory === parentId)
      .map(cat => ({
        ...cat.toObject(),
        children: buildTree(cat.id)
      }));
  };
  
  return buildTree();
};

// Method to get all descendants
categorySchema.methods.getDescendants = async function() {
  const allCategories = await this.constructor.find({ isActive: true });
  const descendants = [];
  
  const findDescendants = (parentId) => {
    const children = allCategories.filter(cat => cat.parentCategory === parentId);
    children.forEach(child => {
      descendants.push(child);
      findDescendants(child.id);
    });
  };
  
  findDescendants(this.id);
  return descendants;
};

// Pre-save middleware to generate slug
categorySchema.pre('save', function(next) {
  if (this.isModified('name') || this.isNew) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');
  }
  next();
});

module.exports = mongoose.model('Category', categorySchema);
