const express = require('express');
const auth = require('../middleware/auth');
const Product = require('../models/Product');
const User = require('../models/User');
const { body, validate } = require('../middleware/validate');

const router = express.Router();

// Get wishlist (alias maintained in users route too)
router.get('/', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ success: true, wishlist: user.wishlist || [] });
  } catch (err) { next(err); }
});

// Add to wishlist
router.post('/', auth, validate([
  body('productId').notEmpty()
]), async (req, res, next) => {
  try {
    const { productId } = req.body;
    const product = await Product.findOne({ id: productId });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const user = await User.findById(req.user.id);
    user.wishlist = Array.from(new Set([...(user.wishlist || []), productId]));
    await user.save();
    res.status(201).json({ success: true, wishlist: user.wishlist });
  } catch (err) { next(err); }
});

// Remove from wishlist
router.delete('/:productId', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    user.wishlist = (user.wishlist || []).filter(id => id !== req.params.productId);
    await user.save();
    res.json({ success: true, wishlist: user.wishlist });
  } catch (err) { next(err); }
});

module.exports = router;
