const mongoose = require('mongoose');
const crypto = require('crypto');

const CardDetailsSchema = new mongoose.Schema({
  brand: { type: String, required: true }, // Visa, MasterCard, etc.
  last4: { type: String, required: true },
  expiryMonth: { type: Number, required: true, min: 1, max: 12 },
  expiryYear: { type: Number, required: true },
  holderName: { type: String, required: true },
  // Note: Never store full card numbers or CVV in production
  tokenId: { type: String }, // Payment gateway token
}, { _id: false });

const UPIDetailsSchema = new mongoose.Schema({
  upiId: { type: String, required: true },
  providerName: { type: String }, // GPay, PhonePe, Paytm, etc.
  isVerified: { type: Boolean, default: false },
}, { _id: false });

const NetBankingDetailsSchema = new mongoose.Schema({
  bankName: { type: String, required: true },
  bankCode: { type: String, required: true },
  accountType: { type: String, enum: ['savings', 'current'], default: 'savings' },
  // Note: Never store actual account numbers
  maskedAccountNumber: { type: String }, // Only last 4 digits
}, { _id: false });

const PaymentMethodSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  type: { 
    type: String, 
    enum: ['card', 'upi', 'netbanking', 'wallet'], 
    required: true 
  },
  label: { type: String }, // Custom label like "Primary Card", "Work UPI"
  isDefault: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  
  // Conditional fields based on type
  cardDetails: { type: CardDetailsSchema },
  upiDetails: { type: UPIDetailsSchema },
  netBankingDetails: { type: NetBankingDetailsSchema },
  
  // Metadata for payment gateway integration
  gatewayData: { type: Object, default: {} },
  
  // Usage statistics
  lastUsedAt: { type: Date },
  usageCount: { type: Number, default: 0 },
  
}, { timestamps: true });

// Validate that appropriate details are provided based on type
PaymentMethodSchema.pre('save', function(next) {
  switch (this.type) {
    case 'card':
      if (!this.cardDetails) {
        return next(new Error('Card details are required for card payment method'));
      }
      break;
    case 'upi':
      if (!this.upiDetails) {
        return next(new Error('UPI details are required for UPI payment method'));
      }
      // Validate UPI ID format
      const upiPattern = /^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/;
      if (!upiPattern.test(this.upiDetails.upiId)) {
        return next(new Error('Invalid UPI ID format'));
      }
      break;
    case 'netbanking':
      if (!this.netBankingDetails) {
        return next(new Error('Net banking details are required for net banking payment method'));
      }
      break;
  }
  next();
});

// Ensure only one default payment method per user per type
PaymentMethodSchema.pre('save', async function(next) {
  if (this.isDefault && this.isModified('isDefault')) {
    await this.constructor.updateMany(
      { 
        userId: this.userId, 
        type: this.type, 
        _id: { $ne: this._id } 
      },
      { isDefault: false }
    );
  }
  next();
});

// Virtual for display name
PaymentMethodSchema.virtual('displayName').get(function() {
  if (this.label) return this.label;
  
  switch (this.type) {
    case 'card':
      return `${this.cardDetails.brand} •••• ${this.cardDetails.last4}`;
    case 'upi':
      return this.upiDetails.upiId;
    case 'netbanking':
      return `${this.netBankingDetails.bankName} ${this.netBankingDetails.maskedAccountNumber ? '•••• ' + this.netBankingDetails.maskedAccountNumber : ''}`.trim();
    case 'wallet':
      return 'Zylo Wallet';
    default:
      return this.type;
  }
});

// Virtual for masked details (for security)
PaymentMethodSchema.virtual('maskedDetails').get(function() {
  switch (this.type) {
    case 'card':
      return {
        brand: this.cardDetails.brand,
        last4: this.cardDetails.last4,
        expiry: `${this.cardDetails.expiryMonth.toString().padStart(2, '0')}/${this.cardDetails.expiryYear.toString().slice(-2)}`
      };
    case 'upi':
      return {
        upiId: this.upiDetails.upiId,
        provider: this.upiDetails.providerName,
        verified: this.upiDetails.isVerified
      };
    case 'netbanking':
      return {
        bankName: this.netBankingDetails.bankName,
        accountType: this.netBankingDetails.accountType,
        maskedAccount: this.netBankingDetails.maskedAccountNumber
      };
    default:
      return {};
  }
});

// Method to mark as used
PaymentMethodSchema.methods.markAsUsed = function() {
  this.lastUsedAt = new Date();
  this.usageCount += 1;
  return this.save();
};

// Method to verify UPI ID (in production, this would call actual verification API)
PaymentMethodSchema.methods.verifyUPI = async function() {
  if (this.type !== 'upi') {
    throw new Error('This method is only for UPI payment methods');
  }
  
  // Simulate verification (in production, integrate with actual UPI verification API)
  this.upiDetails.isVerified = true;
  await this.save();
  return true;
};

// Static method to get default payment method for user and type
PaymentMethodSchema.statics.getDefault = async function(userId, type = null) {
  const query = { userId, isDefault: true, isActive: true };
  if (type) query.type = type;
  
  return this.findOne(query);
};

// Static method to get all payment methods for user
PaymentMethodSchema.statics.getByUser = async function(userId, type = null) {
  const query = { userId, isActive: true };
  if (type) query.type = type;
  
  return this.find(query).sort({ isDefault: -1, lastUsedAt: -1, createdAt: -1 });
};

module.exports = mongoose.model('PaymentMethod', PaymentMethodSchema);