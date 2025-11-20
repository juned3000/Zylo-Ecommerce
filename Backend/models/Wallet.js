const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['add', 'spend', 'cashback', 'refund', 'send'], 
    required: true 
  },
  amount: { type: Number, required: true },
  description: { type: String },
  orderId: { type: String }, // Reference to order if applicable
  status: { 
    type: String, 
    enum: ['pending', 'completed', 'failed'], 
    default: 'completed' 
  },
  metadata: { type: Object, default: {} }, // Additional data like payment gateway info
}, { timestamps: true });

const RewardsSchema = new mongoose.Schema({
  points: { type: Number, default: 0 },
  level: { 
    type: String, 
    enum: ['Bronze', 'Silver', 'Gold', 'Platinum'], 
    default: 'Silver' 
  },
  tierProgress: { type: Number, default: 0 }, // Points needed for next tier
}, { _id: false });

const WalletSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    unique: true 
  },
  balance: { type: Number, default: 0, min: 0 },
  cashbackBalance: { type: Number, default: 0, min: 0 },
  frozenAmount: { type: Number, default: 0, min: 0 }, // Amount on hold
  transactions: [TransactionSchema],
  rewards: { type: RewardsSchema, default: () => ({}) },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Virtual for total available balance
WalletSchema.virtual('availableBalance').get(function() {
  return this.balance - this.frozenAmount;
});

// Method to add money to wallet
WalletSchema.methods.addMoney = function(amount, description = 'Money added to wallet', metadata = {}) {
  const transaction = {
    id: 'TXN' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase(),
    type: 'add',
    amount: amount,
    description: description,
    metadata: metadata
  };
  
  this.balance += amount;
  this.transactions.unshift(transaction);
  
  // Add reward points (1 point per 100 rupees)
  const rewardPoints = Math.floor(amount / 100);
  this.rewards.points += rewardPoints;
  
  // Update tier based on total points
  this.updateRewardTier();
  
  return transaction;
};

// Method to spend money from wallet
WalletSchema.methods.spendMoney = function(amount, description = 'Payment from wallet', orderId = null, metadata = {}) {
  if (this.availableBalance < amount) {
    throw new Error('Insufficient wallet balance');
  }
  
  const transaction = {
    id: 'TXN' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase(),
    type: 'spend',
    amount: amount,
    description: description,
    orderId: orderId,
    metadata: metadata
  };
  
  this.balance -= amount;
  this.transactions.unshift(transaction);
  
  return transaction;
};

// Method to add cashback
WalletSchema.methods.addCashback = function(amount, description = 'Cashback received', orderId = null, metadata = {}) {
  const transaction = {
    id: 'TXN' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase(),
    type: 'cashback',
    amount: amount,
    description: description,
    orderId: orderId,
    metadata: metadata
  };
  
  this.cashbackBalance += amount;
  this.transactions.unshift(transaction);
  
  return transaction;
};

// Method to update reward tier
WalletSchema.methods.updateRewardTier = function() {
  const points = this.rewards.points;
  
  if (points >= 10000) {
    this.rewards.level = 'Platinum';
    this.rewards.tierProgress = Math.min((points - 10000) / 5000, 1);
  } else if (points >= 5000) {
    this.rewards.level = 'Gold';
    this.rewards.tierProgress = (points - 5000) / 5000;
  } else if (points >= 1000) {
    this.rewards.level = 'Silver';
    this.rewards.tierProgress = (points - 1000) / 4000;
  } else {
    this.rewards.level = 'Bronze';
    this.rewards.tierProgress = points / 1000;
  }
};

// Method to get recent transactions
WalletSchema.methods.getRecentTransactions = function(limit = 10, type = null) {
  let transactions = this.transactions;
  
  if (type) {
    transactions = transactions.filter(t => t.type === type);
  }
  
  return transactions.slice(0, limit);
};

// Static method to get or create wallet for user
WalletSchema.statics.getOrCreate = async function(userId) {
  let wallet = await this.findOne({ userId });
  
  if (!wallet) {
    wallet = await this.create({ userId });
  }
  
  return wallet;
};

module.exports = mongoose.model('Wallet', WalletSchema);