const express = require('express');
const auth = require('../middleware/auth');
const PaymentMethod = require('../models/PaymentMethod');
const { body, validate } = require('../middleware/validate');

const router = express.Router();

// Get all payment methods for user
router.get('/', auth, async (req, res, next) => {
  try {
    const { type = null } = req.query;
    const paymentMethods = await PaymentMethod.getByUser(req.user.id, type);
    
    const response = {
      success: true,
      paymentMethods: paymentMethods.map(pm => ({
        _id: pm._id, // Use _id for consistency
        type: pm.type,
        label: pm.label,
        displayName: pm.displayName,
        // For UPI, ensure correct structure
        upiId: pm.type === 'upi' ? pm.upiDetails?.upiId : undefined,
        verified: pm.type === 'upi' ? pm.upiDetails?.isVerified : undefined,
        // For Card
        brand: pm.type === 'card' ? pm.cardDetails?.brand : undefined,
        last4: pm.type === 'card' ? pm.cardDetails?.last4 : undefined,
        expiry: pm.type === 'card' ? `${pm.cardDetails?.expiryMonth?.toString().padStart(2, '0')}/${pm.cardDetails?.expiryYear?.toString().slice(-2)}` : undefined,
        // Common fields
        maskedDetails: pm.maskedDetails,
        isDefault: pm.isDefault,
        isActive: pm.isActive,
        lastUsedAt: pm.lastUsedAt,
        createdAt: pm.createdAt
      }))
    };
    
    res.json(response);
  } catch (err) { 
    next(err); 
  }
});

// Add a new card payment method
router.post('/card', auth, validate([
  body('brand').notEmpty().withMessage('Card brand is required'),
  body('last4').isLength({ min: 4, max: 4 }).withMessage('Last 4 digits must be exactly 4 characters'),
  body('expiryMonth').isInt({ min: 1, max: 12 }).withMessage('Expiry month must be between 1 and 12'),
  body('expiryYear').isInt({ min: new Date().getFullYear() }).withMessage('Expiry year is invalid'),
  body('holderName').notEmpty().withMessage('Card holder name is required'),
  body('label').optional().isString(),
  body('isDefault').optional().isBoolean()
]), async (req, res, next) => {
  try {
    const cardData = {
      userId: req.user.id,
      type: 'card',
      label: req.body.label,
      isDefault: req.body.isDefault || false,
      cardDetails: {
        brand: req.body.brand,
        last4: req.body.last4,
        expiryMonth: req.body.expiryMonth,
        expiryYear: req.body.expiryYear,
        holderName: req.body.holderName,
        tokenId: req.body.tokenId // In production, this would come from payment gateway
      }
    };
    
    const paymentMethod = new PaymentMethod(cardData);
    await paymentMethod.save();
    
    res.status(201).json({
      success: true,
      message: 'Card added successfully',
      paymentMethod: {
        id: paymentMethod._id,
        type: paymentMethod.type,
        displayName: paymentMethod.displayName,
        maskedDetails: paymentMethod.maskedDetails,
        isDefault: paymentMethod.isDefault
      }
    });
  } catch (err) { 
    next(err); 
  }
});

// Add a new UPI payment method
router.post('/upi', auth, validate([
  body('upiId').matches(/^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/).withMessage('Invalid UPI ID format'),
  body('providerName').optional().isString(),
  body('label').optional().isString(),
  body('isDefault').optional().isBoolean()
]), async (req, res, next) => {
  try {
    const upiData = {
      userId: req.user.id,
      type: 'upi',
      label: req.body.label,
      isDefault: req.body.isDefault || false,
      upiDetails: {
        upiId: req.body.upiId,
        providerName: req.body.providerName,
        isVerified: false
      }
    };
    
    const paymentMethod = new PaymentMethod(upiData);
    await paymentMethod.save();
    
    res.status(201).json({
      success: true,
      message: 'UPI ID added successfully',
      paymentMethod: {
        _id: paymentMethod._id,
        type: paymentMethod.type,
        upiId: paymentMethod.upiDetails.upiId,
        verified: paymentMethod.upiDetails.isVerified,
        displayName: paymentMethod.displayName,
        maskedDetails: paymentMethod.maskedDetails,
        isDefault: paymentMethod.isDefault
      }
    });
  } catch (err) { 
    next(err); 
  }
});

// Verify UPI ID
router.post('/:id/verify-upi', auth, async (req, res, next) => {
  try {
    const paymentMethod = await PaymentMethod.findOne({
      _id: req.params.id,
      userId: req.user.id,
      type: 'upi',
      isActive: true
    });
    
    if (!paymentMethod) {
      return res.status(404).json({
        success: false,
        message: 'UPI payment method not found'
      });
    }
    
    // In production, this would call actual UPI verification API
    await paymentMethod.verifyUPI();
    
    res.json({
      success: true,
      message: 'UPI ID verified successfully',
      paymentMethod: {
        id: paymentMethod._id,
        displayName: paymentMethod.displayName,
        maskedDetails: paymentMethod.maskedDetails,
        isVerified: paymentMethod.upiDetails.isVerified
      }
    });
  } catch (err) { 
    next(err); 
  }
});

// Add net banking payment method
router.post('/netbanking', auth, validate([
  body('bankName').notEmpty().withMessage('Bank name is required'),
  body('bankCode').notEmpty().withMessage('Bank code is required'),
  body('accountType').optional().isIn(['savings', 'current']),
  body('maskedAccountNumber').optional().isLength({ min: 4, max: 4 }),
  body('label').optional().isString(),
  body('isDefault').optional().isBoolean()
]), async (req, res, next) => {
  try {
    const netBankingData = {
      userId: req.user.id,
      type: 'netbanking',
      label: req.body.label,
      isDefault: req.body.isDefault || false,
      netBankingDetails: {
        bankName: req.body.bankName,
        bankCode: req.body.bankCode,
        accountType: req.body.accountType || 'savings',
        maskedAccountNumber: req.body.maskedAccountNumber
      }
    };
    
    const paymentMethod = new PaymentMethod(netBankingData);
    await paymentMethod.save();
    
    res.status(201).json({
      success: true,
      message: 'Net banking details added successfully',
      paymentMethod: {
        id: paymentMethod._id,
        type: paymentMethod.type,
        displayName: paymentMethod.displayName,
        maskedDetails: paymentMethod.maskedDetails,
        isDefault: paymentMethod.isDefault
      }
    });
  } catch (err) { 
    next(err); 
  }
});

// Update payment method (label, default status)
router.put('/:id', auth, validate([
  body('label').optional().isString(),
  body('isDefault').optional().isBoolean()
]), async (req, res, next) => {
  try {
    const paymentMethod = await PaymentMethod.findOne({
      _id: req.params.id,
      userId: req.user.id,
      isActive: true
    });
    
    if (!paymentMethod) {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found'
      });
    }
    
    if (req.body.label !== undefined) {
      paymentMethod.label = req.body.label;
    }
    
    if (req.body.isDefault !== undefined) {
      paymentMethod.isDefault = req.body.isDefault;
    }
    
    await paymentMethod.save();
    
    res.json({
      success: true,
      message: 'Payment method updated successfully',
      paymentMethod: {
        id: paymentMethod._id,
        type: paymentMethod.type,
        displayName: paymentMethod.displayName,
        maskedDetails: paymentMethod.maskedDetails,
        isDefault: paymentMethod.isDefault
      }
    });
  } catch (err) { 
    next(err); 
  }
});

// Delete payment method (soft delete - mark as inactive)
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const paymentMethod = await PaymentMethod.findOne({
      _id: req.params.id,
      userId: req.user.id,
      isActive: true
    });
    
    if (!paymentMethod) {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found'
      });
    }
    
    paymentMethod.isActive = false;
    paymentMethod.isDefault = false; // Remove default status when deleting
    await paymentMethod.save();
    
    res.json({
      success: true,
      message: 'Payment method removed successfully'
    });
  } catch (err) { 
    next(err); 
  }
});

// Get default payment method
router.get('/default', auth, async (req, res, next) => {
  try {
    const { type = null } = req.query;
    const defaultMethod = await PaymentMethod.getDefault(req.user.id, type);
    
    if (!defaultMethod) {
      return res.json({
        success: true,
        defaultMethod: null,
        message: 'No default payment method set'
      });
    }
    
    res.json({
      success: true,
      defaultMethod: {
        id: defaultMethod._id,
        type: defaultMethod.type,
        displayName: defaultMethod.displayName,
        maskedDetails: defaultMethod.maskedDetails
      }
    });
  } catch (err) { 
    next(err); 
  }
});

// Mark payment method as used (internal API for order processing)
router.post('/:id/mark-used', auth, async (req, res, next) => {
  try {
    const paymentMethod = await PaymentMethod.findOne({
      _id: req.params.id,
      userId: req.user.id,
      isActive: true
    });
    
    if (!paymentMethod) {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found'
      });
    }
    
    await paymentMethod.markAsUsed();
    
    res.json({
      success: true,
      message: 'Payment method usage recorded'
    });
  } catch (err) { 
    next(err); 
  }
});

module.exports = router;