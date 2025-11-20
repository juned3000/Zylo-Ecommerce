const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const { body, validate } = require('../middleware/validate');

const router = express.Router();

// Get current user's profile
router.get('/me', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');
    // Include virtual fullName property
    const userData = user.toObject({ virtuals: true });
    res.json({ success: true, user: userData });
  } catch (err) { next(err); }
});

// Update profile
router.put('/me', auth, validate([
  body('firstName').optional().isString().isLength({ min: 1 }).withMessage('First name too short'),
  body('lastName').optional().isString(),
  body('phone').optional().isString(),
  body('dateOfBirth').optional().isISO8601().toDate(),
  body('gender').optional().isIn(['male', 'female', 'other', 'prefer_not_to_say'])
]), async (req, res, next) => {
  try {
    const updates = {};
    // Handle name fields
    if (req.body.firstName !== undefined) updates.firstName = req.body.firstName;
    if (req.body.lastName !== undefined) updates.lastName = req.body.lastName;
    // Handle other fields
    if (req.body.phone !== undefined) updates.phone = req.body.phone;
    if (req.body.dateOfBirth !== undefined) updates.dateOfBirth = req.body.dateOfBirth;
    if (req.body.gender !== undefined) updates.gender = req.body.gender;
    
    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true, runValidators: true }).select('-passwordHash');
    const userData = user.toObject({ virtuals: true });
    res.json({ success: true, user: userData });
  } catch (err) { next(err); }
});

// Addresses
router.get('/me/addresses', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ success: true, addresses: user.addresses || [] });
  } catch (err) { next(err); }
});

router.post('/me/addresses', auth, validate([
  body('firstName').notEmpty(),
  body('line').notEmpty(),
  body('city').notEmpty(),
  body('state').notEmpty(),
  body('zip').notEmpty(),
  body('phone').notEmpty()
]), async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const addr = req.body;
    if (addr.isDefault) {
      (user.addresses || []).forEach(a => a.isDefault = false);
    }
    user.addresses.push(addr);
    await user.save();
    res.status(201).json({ success: true, addresses: user.addresses });
  } catch (err) { next(err); }
});

router.put('/me/addresses/:index', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const idx = Number(req.params.index);
    if (!user.addresses || idx < 0 || idx >= user.addresses.length) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }
    if (req.body.isDefault) {
      user.addresses.forEach(a => a.isDefault = false);
    }
    user.addresses[idx] = { ...user.addresses[idx].toObject(), ...req.body };
    await user.save();
    res.json({ success: true, addresses: user.addresses });
  } catch (err) { next(err); }
});

router.delete('/me/addresses/:index', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const idx = Number(req.params.index);
    if (!user.addresses || idx < 0 || idx >= user.addresses.length) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }
    user.addresses.splice(idx, 1);
    await user.save();
    res.json({ success: true, addresses: user.addresses });
  } catch (err) { next(err); }
});

// Wishlist
router.get('/me/wishlist', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ success: true, wishlist: user.wishlist || [] });
  } catch (err) { next(err); }
});

router.post('/me/wishlist', auth, validate([
  body('productId').notEmpty()
]), async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const pid = String(req.body.productId);
    user.wishlist = Array.from(new Set([...(user.wishlist || []), pid]));
    await user.save();
    res.status(201).json({ success: true, wishlist: user.wishlist });
  } catch (err) { next(err); }
});

router.delete('/me/wishlist/:productId', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const pid = String(req.params.productId);
    user.wishlist = (user.wishlist || []).filter(id => id !== pid);
    await user.save();
    res.json({ success: true, wishlist: user.wishlist });
  } catch (err) { next(err); }
});

module.exports = router;
