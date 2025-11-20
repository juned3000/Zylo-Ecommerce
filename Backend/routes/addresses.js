const express = require('express');
const auth = require('../middleware/auth');
const Address = require('../models/Address');
const { body, validate } = require('../middleware/validate');
const { param } = require('express-validator');

const router = express.Router();

// Get all addresses for current user
router.get('/', auth, async (req, res, next) => {
  try {
    const addresses = await Address.getUserAddresses(req.user.id);
    res.json({ 
      success: true, 
      addresses,
      count: addresses.length 
    });
  } catch (err) { 
    next(err); 
  }
});

// Get a specific address
router.get('/:id', auth, validate([
  param('id').isMongoId().withMessage('Invalid address ID')
]), async (req, res, next) => {
  try {
    const address = await Address.findOne({ 
      _id: req.params.id, 
      user: req.user.id 
    });
    
    if (!address) {
      return res.status(404).json({ 
        success: false, 
        message: 'Address not found' 
      });
    }
    
    res.json({ success: true, address });
  } catch (err) { 
    next(err); 
  }
});

// Create new address
router.post('/', auth, validate([
  body('firstName').notEmpty().withMessage('First name is required'),
  body('line').notEmpty().withMessage('Address line is required'),
  body('city').notEmpty().withMessage('City is required'),
  body('state').notEmpty().withMessage('State is required'),
  body('zip').notEmpty().matches(/^\d{6}$/).withMessage('ZIP code must be 6 digits'),
  body('phone').notEmpty().matches(/^\d{10}$/).withMessage('Phone must be 10 digits'),
  body('country').optional().isString(),
  body('lastName').optional().isString(),
  body('area').optional().isString(),
  body('landmark').optional().isString(),
  body('label').optional().isIn(['Home', 'Work', 'Other']),
  body('isDefault').optional().isBoolean()
]), async (req, res, next) => {
  try {
    const addressData = {
      ...req.body,
      user: req.user.id
    };
    
    // If this is the first address, make it default
    const existingCount = await Address.countDocuments({ user: req.user.id });
    if (existingCount === 0) {
      addressData.isDefault = true;
    }
    
    const address = new Address(addressData);
    await address.save();
    
    res.status(201).json({ 
      success: true, 
      address,
      message: 'Address added successfully' 
    });
  } catch (err) { 
    next(err); 
  }
});

// Update address
router.put('/:id', auth, validate([
  param('id').isMongoId().withMessage('Invalid address ID'),
  body('firstName').optional().notEmpty(),
  body('lastName').optional().isString(),
  body('country').optional().isString(),
  body('line').optional().notEmpty(),
  body('area').optional().isString(),
  body('landmark').optional().isString(),
  body('city').optional().notEmpty(),
  body('state').optional().notEmpty(),
  body('zip').optional().matches(/^\d{6}$/),
  body('phone').optional().matches(/^\d{10}$/),
  body('label').optional().isIn(['Home', 'Work', 'Other']),
  body('isDefault').optional().isBoolean()
]), async (req, res, next) => {
  try {
    const address = await Address.findOne({ 
      _id: req.params.id, 
      user: req.user.id 
    });
    
    if (!address) {
      return res.status(404).json({ 
        success: false, 
        message: 'Address not found' 
      });
    }
    
    // Update fields
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined && key !== 'user') {
        address[key] = req.body[key];
      }
    });
    
    await address.save();
    
    res.json({ 
      success: true, 
      address,
      message: 'Address updated successfully' 
    });
  } catch (err) { 
    next(err); 
  }
});

// Delete address
router.delete('/:id', auth, validate([
  param('id').isMongoId().withMessage('Invalid address ID')
]), async (req, res, next) => {
  try {
    const address = await Address.findOne({ 
      _id: req.params.id, 
      user: req.user.id 
    });
    
    if (!address) {
      return res.status(404).json({ 
        success: false, 
        message: 'Address not found' 
      });
    }
    
    const wasDefault = address.isDefault;
    await address.deleteOne();
    
    // If deleted address was default, make another one default
    if (wasDefault) {
      const firstAddress = await Address.findOne({ user: req.user.id });
      if (firstAddress) {
        firstAddress.isDefault = true;
        await firstAddress.save();
      }
    }
    
    res.json({ 
      success: true, 
      message: 'Address deleted successfully' 
    });
  } catch (err) { 
    next(err); 
  }
});

// Set address as default
router.post('/:id/default', auth, validate([
  param('id').isMongoId().withMessage('Invalid address ID')
]), async (req, res, next) => {
  try {
    const address = await Address.findOne({ 
      _id: req.params.id, 
      user: req.user.id 
    });
    
    if (!address) {
      return res.status(404).json({ 
        success: false, 
        message: 'Address not found' 
      });
    }
    
    await address.makeDefault();
    
    res.json({ 
      success: true, 
      address,
      message: 'Default address updated' 
    });
  } catch (err) { 
    next(err); 
  }
});

module.exports = router;