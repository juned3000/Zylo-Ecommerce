const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const { query, body, validate } = require('../middleware/validate');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../Frontend/img/products');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check if the file is an image
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

const router = express.Router();

// Helper function to execute database operations with retry logic
const executeWithRetry = async (operation, retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.error(`Database operation failed (attempt ${attempt}/${retries}):`, error.message);
      
      // Check if it's a connection-related error
      const isConnectionError = error.message.includes('connection') || 
                                error.message.includes('timeout') || 
                                error.message.includes('ENOTFOUND') || 
                                error.message.includes('MongoNetworkError');
      
      if (attempt === retries || !isConnectionError) {
        throw error; // Final attempt or non-connection error
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      console.log(`⏳ Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// List products with filtering
router.get('/',
  validate([
    query('q').optional().isString(),
    query('category').optional().isString(),
    query('brand').optional().isString(),
    query('priceMin').optional().isNumeric(),
    query('priceMax').optional().isNumeric(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('skip').optional().isInt({ min: 0 })
  ]),
  async (req, res, next) => {
    try {
      console.log(`📡 Products API called with query:`, req.query);
      
      const { q, category, brand, priceMin, priceMax } = req.query;
      const filter = {};
      if (q) filter.$text = { $search: q };
      if (category) filter.category = category;
      if (brand) filter.brand = brand;
      if (priceMin || priceMax) filter.price = {};
      if (priceMin) filter.price.$gte = Number(priceMin);
      if (priceMax) filter.price.$lte = Number(priceMax);

      const limit = Number(req.query.limit || 50);
      const skip = Number(req.query.skip || 0);

      console.log(`🔍 Database query filter:`, filter);
      console.log(`📊 Query options: limit=${limit}, skip=${skip}`);

      const [items, total] = await executeWithRetry(async () => {
        return Promise.all([
          Product.find(filter).limit(limit).skip(skip).sort({ createdAt: -1 }),
          Product.countDocuments(filter)
        ]);
      });

      console.log(`✅ Products query successful: ${items.length} items found, total: ${total}`);
      res.json({ success: true, items, total });
    } catch (err) {
      console.error('❌ Products API error:', err.message);
      next(err); 
    }
  }
);

// Get single product by legacy id
router.get('/:id', async (req, res, next) => {
  try {
    console.log(`🔍 Looking for product with ID: ${req.params.id}`);
    
    const item = await executeWithRetry(async () => {
      return Product.findOne({ id: req.params.id });
    });
    
    if (!item) {
      console.log(`❌ Product not found: ${req.params.id}`);
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    console.log(`✅ Product found: ${item.name}`);
    res.json({ success: true, item });
  } catch (err) {
    console.error('❌ Single product API error:', err.message);
    next(err);
  }
});

// Create new product
router.post('/',
  upload.single('image'), // Handle file upload
  async (req, res, next) => {
    try {
      const { name, brand, price, category, stock, description } = req.body;
      
      // Parse sizes if it's a JSON string
      let sizes = [];
      if (req.body.sizes) {
        try {
          sizes = JSON.parse(req.body.sizes);
        } catch (e) {
          sizes = [];
        }
      }
      
      // Validation
      if (!name || !brand || !category || !price) {
        return res.status(400).json({
          success: false,
          message: 'Name, brand, category, and price are required'
        });
      }
      
      // Generate unique ID for the product
      const lastProduct = await Product.findOne().sort({ createdAt: -1 });
      let nextId = 'p1';
      if (lastProduct && lastProduct.id) {
        const lastIdNum = parseInt(lastProduct.id.replace(/[a-zA-Z]/g, ''));
        nextId = `p${(lastIdNum || 0) + 1}`;
      }
      
      // Handle image path
      let imagePath = '../img/products/default.jpg';
      if (req.file) {
        imagePath = `../img/products/${req.file.filename}`;
      }
      
      // Handle initial rating if provided by admin
      const initialRating = req.body.initialRating ? Number(req.body.initialRating) : 0;
      let ratingData = {
        averageRating: 0,
        totalRatings: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      };
      
      // If admin sets an initial rating, create a basic rating structure
      if (initialRating > 0 && initialRating <= 5) {
        ratingData.averageRating = initialRating;
        ratingData.totalRatings = 1;
        ratingData.ratingDistribution[Math.round(initialRating)] = 1;
      }
      
      const newProduct = new Product({
        id: nextId,
        name,
        brand,
        price: Number(price),
        category,
        sizes: sizes || [],
        description: description || '',
        image: imagePath,
        stock: Number(stock) || 100,
        ...ratingData
      });
      
      await newProduct.save();
      res.status(201).json({ 
        success: true, 
        message: 'Product created successfully',
        item: newProduct 
      });
    } catch (err) { 
      console.error('Product creation error:', err);
      next(err); 
    }
  }
);

// Update existing product
router.put('/:id',
  upload.single('image'), // Handle file upload
  async (req, res, next) => {
    try {
      const updateData = { ...req.body };
      
      // Parse sizes if it's a JSON string
      if (req.body.sizes && typeof req.body.sizes === 'string') {
        try {
          updateData.sizes = JSON.parse(req.body.sizes);
        } catch (e) {
          updateData.sizes = [];
        }
      }
      
      // Convert numeric fields
      if (updateData.price) updateData.price = Number(updateData.price);
      if (updateData.stock) updateData.stock = Number(updateData.stock);
      
      // Handle image file if uploaded
      if (req.file) {
        updateData.image = `../img/products/${req.file.filename}`;
      }
      
      // Handle rating fields (ensure they're not accidentally overwritten by form data)
      // Only allow updating ratings through dedicated rating endpoints
      delete updateData.averageRating;
      delete updateData.totalRatings;
      delete updateData.ratingDistribution;
      
      const product = await Product.findOneAndUpdate(
        { id: req.params.id },
        { $set: updateData },
        { new: true, runValidators: true }
      );
      
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }
      
      res.json({ 
        success: true, 
        message: 'Product updated successfully',
        item: product 
      });
    } catch (err) { 
      console.error('Product update error:', err);
      next(err); 
    }
  }
);

// Delete product
router.delete('/:id', async (req, res, next) => {
  try {
    const product = await Product.findOneAndDelete({ id: req.params.id });
    
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    res.json({ 
      success: true, 
      message: 'Product deleted successfully',
      item: product 
    });
  } catch (err) { next(err); }
});

// Get all categories (for dropdown)
router.get('/categories/list', async (req, res, next) => {
  try {
    const categories = await Product.distinct('category');
    const brands = await Product.distinct('brand');
    res.json({ 
      success: true, 
      categories: categories.sort(),
      brands: brands.sort()
    });
  } catch (err) { next(err); }
});

// Seed demo products (dev only)
router.post('/seed', async (req, res, next) => {
  try {
    const demo = [
      { id: 'f1',  name: 'Abstract Summer Shirt', brand: 'Nike', price: 1299, image: '../img/products/f1.jpg', sizes: ['S','M','L','XL'], category: 'shirts', description: 'Comfortable cotton shirt with abstract print design, perfect for summer wear.' },
      { id: 'f2',  name: 'Tropical Leaf Shirt', brand: 'H&M', price: 1199, image: '../img/products/f2.jpg', sizes: ['S','M','L','XL'], category: 'shirts', description: 'Light and breezy shirt featuring tropical leaf patterns.' },
      { id: 'f3',  name: 'Floral Paradise Shirt', brand: 'Zara', price: 1499, image: '../img/products/f3.jpg', sizes: ['S','M','L','XL'], category: 'shirts', description: 'Elegant floral design shirt made from premium fabric.' },
      { id: 'f4',  name: 'Cherry Blossom Shirt', brand: 'Levi\'s', price: 1099, image: '../img/products/f4.jpg', sizes: ['S','M','L','XL'], category: 'shirts', description: 'Classic denim brand\'s take on floral fashion with cherry blossom prints.' },
      { id: 'f5',  name: 'Midnight Bloom Shirt', brand: 'Tommy Hilfiger', price: 1399, image: '../img/products/f5.jpg', sizes: ['S','M','L','XL'], category: 'shirts', description: 'Dark themed floral shirt perfect for evening occasions.' },
      { id: 'f6',  name: 'Dual-Tone Casual Shirt', brand: 'Uniqlo', price: 1249, image: '../img/products/f6.jpg', sizes: ['S','M','L','XL'], category: 'shirts', description: 'Modern dual-tone design for a contemporary casual look.' },
      { id: 'f7',  name: 'Black Oversized T-Shirt', brand: 'Gucci', price: 2499, image: '../img/products/f7.jpg', sizes: ['M','L','XL'], category: 'tshirt', description: 'Luxury oversized t-shirt from premium designer brand.' },
      { id: 'f8',  name: 'Lavender Print Loose Top', brand: 'Forever 21', price: 999, image: '../img/products/f8.jpg', sizes: ['S','M','L'], category: 'tops', description: 'Relaxed fit top with beautiful lavender print.' },
      { id: 'f9',  name: 'Beige Designer Shirt', brand: 'Prada', price: 2199, image: '../img/products/f9.jpg', sizes: ['S','M','L','XL'], category: 'shirts', description: 'Sophisticated beige shirt from luxury Italian fashion house.' },
      { id: 'f10', name: 'Grey Knitted Sweater', brand: 'Mango', price: 1799, image: '../img/products/f10.jpg', sizes: ['M','L','XL'], category: 'sweaters', description: 'Warm and comfortable knitted sweater for cooler weather.' },
      
      { id: 'n1',  name: 'Sky Blue Casual Shirt', brand: 'Uniqlo', price: 1199, image: '../img/products/n1.jpg', sizes: ['S','M','L','XL'], category: 'shirts', description: 'Fresh sky blue casual shirt perfect for daily wear.' },
      { id: 'n2',  name: 'Checkered Slim Shirt', brand: 'H&M', price: 1299, image: '../img/products/n2.jpg', sizes: ['S','M','L','XL'], category: 'shirts', description: 'Classic checkered pattern in a modern slim fit.' },
      { id: 'n3',  name: 'White Linen Shirt', brand: 'Zara', price: 1499, image: '../img/products/n3.jpg', sizes: ['S','M','L','XL'], category: 'shirts', description: 'Premium white linen shirt for sophisticated summer style.' },
      { id: 'n4',  name: 'Beige Patterned Shirt', brand: 'Levi\'s', price: 1599, image: '../img/products/n4.jpg', sizes: ['S','M','L','XL'], category: 'shirts', description: 'Stylish beige shirt with subtle pattern detailing.' },
      { id: 'n5',  name: 'Denim Casual Shirt', brand: 'Tommy Hilfiger', price: 1799, image: '../img/products/n5.jpg', sizes: ['S','M','L','XL'], category: 'shirts', description: 'Classic denim shirt from American heritage brand.' },
      { id: 'n6',  name: 'Striped Summer Shorts', brand: 'Gap', price: 999, image: '../img/products/n6.jpg', sizes: ['S','M','L','XL'], category: 'shorts', description: 'Comfortable striped shorts perfect for summer activities.' },
      { id: 'n7',  name: 'Brown Safari Jacket', brand: 'Mango', price: 2299, image: '../img/products/n7.jpg', sizes: ['M','L','XL'], category: 'jackets', description: 'Adventure-ready safari jacket in rich brown color.' },
      { id: 'n8',  name: 'Black Relaxed Shirt', brand: 'Calvin Klein', price: 1499, image: '../img/products/n8.jpg', sizes: ['S','M','L','XL'], category: 'shirts', description: 'Comfortable relaxed fit shirt in classic black.' },
      { id: 'n9',  name: 'Blue Denim Jacket', brand: 'Diesel', price: 2799, image: '../img/products/n9.jpg', sizes: ['M','L','XL'], category: 'jackets', description: 'Premium denim jacket from Italian designer brand.' },
      { id: 'n10', name: 'Light Blue Denim Jeans', brand: 'Levi\'s', price: 2199, image: '../img/products/n10.jpg', sizes: ['30','32','34','36'], category: 'jeans', description: 'Classic light blue jeans from the original denim brand.' },
      
      // Additional products to complete the catalog
      { id: 'n11', name: 'Classic White T-Shirt', brand: 'Nike', price: 899, image: '../img/products/n11.jpg', sizes: ['S','M','L','XL'], category: 'tshirt', description: 'Essential white t-shirt perfect for everyday wear.' },
      { id: 'n12', name: 'Cotton Casual T-Shirt', brand: 'Adidas', price: 1099, image: '../img/products/n12.jpg', sizes: ['S','M','L','XL'], category: 'tshirt', description: 'Comfortable cotton t-shirt with modern fit.' },
      { id: 'n13', name: 'Premium Polo Shirt', brand: 'Ralph Lauren', price: 1899, image: '../img/products/n13.jpg', sizes: ['S','M','L','XL'], category: 'shirts', description: 'Classic polo shirt from luxury American brand.' },
      { id: 'n14', name: 'Vintage Denim T-Shirt', brand: 'Levi\'s', price: 1299, image: '../img/products/n14.jpg', sizes: ['S','M','L','XL'], category: 'tshirt', description: 'Vintage-style t-shirt from the iconic denim brand.' },
      { id: 'n15', name: 'Sports Active Top', brand: 'Under Armour', price: 1599, image: '../img/products/n15.jpg', sizes: ['S','M','L','XL'], category: 'tops', description: 'Performance top designed for active lifestyles.' },
      { id: 'n16', name: 'Warm Winter Jacket', brand: 'The North Face', price: 3299, image: '../img/products/n16.jpg', sizes: ['M','L','XL'], category: 'jackets', description: 'Insulated jacket perfect for cold weather adventures.' }
    ];
    const ops = demo.map(d => ({ updateOne: { filter: { id: d.id }, update: { $set: d }, upsert: true } }));
    await Product.bulkWrite(ops);
    res.json({ success: true, message: 'Database seeded with demo products', count: demo.length });
  } catch (err) { next(err); }
});

module.exports = router;
