const express = require('express');
const auth = require('../middleware/auth');
const Wallet = require('../models/Wallet');
const { body, validate } = require('../middleware/validate');

const router = express.Router();

// Get wallet details and balance
router.get('/', auth, async (req, res, next) => {
  try {
    const wallet = await Wallet.getOrCreate(req.user.id);
    
    const response = {
      success: true,
      wallet: {
        balance: wallet.balance,
        cashbackBalance: wallet.cashbackBalance,
        availableBalance: wallet.availableBalance,
        frozenAmount: wallet.frozenAmount,
        rewards: wallet.rewards,
        isActive: wallet.isActive,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt
      }
    };
    
    res.json(response);
  } catch (err) { 
    next(err); 
  }
});

// Get transaction history
router.get('/transactions', auth, async (req, res, next) => {
  try {
    const { 
      limit = 20, 
      offset = 0, 
      type = null,
      fromDate = null,
      toDate = null 
    } = req.query;
    
    const wallet = await Wallet.getOrCreate(req.user.id);
    let transactions = wallet.transactions;
    
    // Filter by type if specified
    if (type && ['add', 'spend', 'cashback', 'refund', 'send'].includes(type)) {
      transactions = transactions.filter(t => t.type === type);
    }
    
    // Filter by date range if specified
    if (fromDate) {
      const from = new Date(fromDate);
      transactions = transactions.filter(t => t.createdAt >= from);
    }
    
    if (toDate) {
      const to = new Date(toDate);
      transactions = transactions.filter(t => t.createdAt <= to);
    }
    
    // Apply pagination
    const paginatedTransactions = transactions
      .slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    
    const response = {
      success: true,
      transactions: paginatedTransactions,
      pagination: {
        total: transactions.length,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < transactions.length
      }
    };
    
    res.json(response);
  } catch (err) { 
    next(err); 
  }
});

// Add money to wallet
router.post('/add-money', auth, validate([
  body('amount').isFloat({ min: 100, max: 50000 }).withMessage('Amount must be between Rs. 100 and Rs. 50,000'),
  body('paymentMethod').optional().isString().withMessage('Payment method must be a string'),
  body('description').optional().isString().withMessage('Description must be a string')
]), async (req, res, next) => {
  try {
    const { amount, paymentMethod = 'online', description } = req.body;
    
    const wallet = await Wallet.getOrCreate(req.user.id);
    
    // In a real application, you would:
    // 1. Initiate payment with payment gateway
    // 2. Verify payment status
    // 3. Then add money to wallet
    
    // For now, we'll simulate successful payment
    const finalDescription = description || `Money added via ${paymentMethod}`;
    const metadata = {
      paymentMethod,
      gatewayResponse: 'simulated_success',
      timestamp: new Date().toISOString()
    };
    
    const transaction = wallet.addMoney(amount, finalDescription, metadata);
    await wallet.save();
    
    res.status(201).json({
      success: true,
      message: `Successfully added Rs. ${amount} to wallet`,
      transaction,
      wallet: {
        balance: wallet.balance,
        cashbackBalance: wallet.cashbackBalance,
        rewards: wallet.rewards
      }
    });
  } catch (err) { 
    next(err); 
  }
});

// Spend money from wallet (internal API for orders)
router.post('/spend', auth, validate([
  body('amount').isFloat({ min: 1 }).withMessage('Amount must be greater than 0'),
  body('orderId').optional().isString().withMessage('Order ID must be a string'),
  body('description').optional().isString().withMessage('Description must be a string')
]), async (req, res, next) => {
  try {
    const { amount, orderId, description } = req.body;
    
    const wallet = await Wallet.getOrCreate(req.user.id);
    
    if (wallet.availableBalance < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient wallet balance',
        availableBalance: wallet.availableBalance,
        requiredAmount: amount
      });
    }
    
    const finalDescription = description || 'Payment from wallet';
    const metadata = {
      orderId,
      timestamp: new Date().toISOString()
    };
    
    const transaction = wallet.spendMoney(amount, finalDescription, orderId, metadata);
    await wallet.save();
    
    res.json({
      success: true,
      message: `Successfully deducted Rs. ${amount} from wallet`,
      transaction,
      wallet: {
        balance: wallet.balance,
        availableBalance: wallet.availableBalance
      }
    });
  } catch (err) { 
    next(err); 
  }
});

// Add cashback to wallet
router.post('/add-cashback', auth, validate([
  body('amount').isFloat({ min: 1 }).withMessage('Amount must be greater than 0'),
  body('orderId').optional().isString().withMessage('Order ID must be a string'),
  body('description').optional().isString().withMessage('Description must be a string')
]), async (req, res, next) => {
  try {
    const { amount, orderId, description } = req.body;
    
    const wallet = await Wallet.getOrCreate(req.user.id);
    
    const finalDescription = description || 'Cashback received';
    const metadata = {
      orderId,
      timestamp: new Date().toISOString()
    };
    
    const transaction = wallet.addCashback(amount, finalDescription, orderId, metadata);
    await wallet.save();
    
    res.json({
      success: true,
      message: `Cashback of Rs. ${amount} added to wallet`,
      transaction,
      wallet: {
        cashbackBalance: wallet.cashbackBalance,
        balance: wallet.balance
      }
    });
  } catch (err) { 
    next(err); 
  }
});

// Get wallet statement (downloadable format)
router.get('/statement', auth, async (req, res, next) => {
  try {
    const { 
      fromDate = null,
      toDate = null,
      format = 'json' // json, csv
    } = req.query;
    
    const wallet = await Wallet.getOrCreate(req.user.id);
    let transactions = wallet.transactions;
    
    // Filter by date range
    if (fromDate) {
      const from = new Date(fromDate);
      transactions = transactions.filter(t => t.createdAt >= from);
    }
    
    if (toDate) {
      const to = new Date(toDate);
      transactions = transactions.filter(t => t.createdAt <= to);
    }
    
    if (format === 'csv') {
      // Generate CSV format
      const csvRows = [
        ['Date', 'Transaction ID', 'Type', 'Description', 'Amount', 'Balance After']
      ];
      
      let runningBalance = wallet.balance;
      transactions.reverse().forEach(tx => {
        csvRows.push([
          tx.createdAt.toISOString().split('T')[0],
          tx.id,
          tx.type.toUpperCase(),
          tx.description || '',
          tx.type === 'spend' ? `-${tx.amount}` : `+${tx.amount}`,
          runningBalance
        ]);
        runningBalance += tx.type === 'spend' ? tx.amount : -tx.amount;
      });
      
      const csvContent = csvRows.map(row => row.join(',')).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=wallet-statement.csv');
      return res.send(csvContent);
    }
    
    // Default JSON format
    res.json({
      success: true,
      statement: {
        wallet: {
          currentBalance: wallet.balance,
          cashbackBalance: wallet.cashbackBalance,
          totalTransactions: transactions.length
        },
        period: {
          fromDate: fromDate || 'All time',
          toDate: toDate || new Date().toISOString()
        },
        transactions: transactions.map(tx => ({
          id: tx.id,
          date: tx.createdAt,
          type: tx.type,
          amount: tx.amount,
          description: tx.description,
          status: tx.status,
          orderId: tx.orderId
        }))
      }
    });
  } catch (err) { 
    next(err); 
  }
});

// Get rewards information
router.get('/rewards', auth, async (req, res, next) => {
  try {
    const wallet = await Wallet.getOrCreate(req.user.id);
    
    const nextTierRequirements = {
      'Bronze': { nextTier: 'Silver', pointsNeeded: 1000 - wallet.rewards.points },
      'Silver': { nextTier: 'Gold', pointsNeeded: 5000 - wallet.rewards.points },
      'Gold': { nextTier: 'Platinum', pointsNeeded: 10000 - wallet.rewards.points },
      'Platinum': { nextTier: null, pointsNeeded: 0 }
    };
    
    const tierInfo = nextTierRequirements[wallet.rewards.level];
    
    res.json({
      success: true,
      rewards: {
        currentPoints: wallet.rewards.points,
        currentTier: wallet.rewards.level,
        tierProgress: wallet.rewards.tierProgress,
        nextTier: tierInfo.nextTier,
        pointsToNextTier: Math.max(0, tierInfo.pointsNeeded),
        benefits: getTierBenefits(wallet.rewards.level)
      }
    });
  } catch (err) { 
    next(err); 
  }
});

// Helper function to get tier benefits
function getTierBenefits(tier) {
  const benefits = {
    'Bronze': [
      'Basic customer support',
      '1 point per Rs. 100 spent',
      'Monthly newsletters'
    ],
    'Silver': [
      'Priority customer support',
      '1 point per Rs. 100 spent',
      '2% cashback on select purchases',
      'Early access to sales'
    ],
    'Gold': [
      'Premium customer support',
      '1.5 points per Rs. 100 spent',
      '3% cashback on select purchases',
      'Free shipping on all orders',
      'Exclusive member deals'
    ],
    'Platinum': [
      'Dedicated account manager',
      '2 points per Rs. 100 spent',
      '5% cashback on all purchases',
      'Free shipping + express delivery',
      'VIP customer service',
      'Exclusive platinum offers'
    ]
  };
  
  return benefits[tier] || benefits['Bronze'];
}

module.exports = router;