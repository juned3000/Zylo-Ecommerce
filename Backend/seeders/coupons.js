const mongoose = require('mongoose');
const Coupon = require('../models/Coupon');

const couponSeeds = [
  {
    code: 'OOF15',
    description: 'Get 15% off on your first order with code OOF15',
    discountType: 'percentage',
    discountValue: 15,
    minimumOrderValue: 500,
    maximumDiscount: 500,
    usageLimit: null, // Unlimited usage for now
    validFrom: new Date('2024-01-01'),
    validTo: new Date('2026-12-31'),
    isActive: true,
    applicableCategories: [],
    applicableProducts: [],
    createdBy: new mongoose.Types.ObjectId() // Temporary admin ID
  },
  {
    code: 'WELCOME15',
    description: 'Welcome Discount - Get 15% off your first order',
    discountType: 'percentage',
    discountValue: 15,
    minimumOrderValue: 500,
    maximumDiscount: 500,
    usageLimit: null,
    validFrom: new Date('2024-01-01'),
    validTo: new Date('2026-12-31'),
    isActive: true,
    applicableCategories: [],
    applicableProducts: [],
    createdBy: new mongoose.Types.ObjectId()
  },
  {
    code: 'SAVE100',
    description: 'Flat ₹100 off on orders above ₹1000',
    discountType: 'fixed',
    discountValue: 100,
    minimumOrderValue: 1000,
    maximumDiscount: null,
    usageLimit: null,
    validFrom: new Date('2024-01-01'),
    validTo: new Date('2026-12-31'),
    isActive: true,
    applicableCategories: [],
    applicableProducts: [],
    createdBy: new mongoose.Types.ObjectId()
  },
  {
    code: 'FASHION20',
    description: 'Get 20% off on fashion items',
    discountType: 'percentage',
    discountValue: 20,
    minimumOrderValue: 800,
    maximumDiscount: 300,
    usageLimit: null,
    validFrom: new Date('2024-01-01'),
    validTo: new Date('2026-12-31'),
    isActive: true,
    applicableCategories: [],
    applicableProducts: [],
    createdBy: new mongoose.Types.ObjectId()
  },
  {
    code: 'NEWUSER25',
    description: 'New Customer Special - Get 25% off your first purchase',
    discountType: 'percentage',
    discountValue: 25,
    minimumOrderValue: 600,
    maximumDiscount: 750,
    usageLimit: null,
    validFrom: new Date('2024-01-01'),
    validTo: new Date('2026-12-31'),
    isActive: true,
    applicableCategories: [],
    applicableProducts: [],
    createdBy: new mongoose.Types.ObjectId()
  }
];

async function seedCoupons() {
  try {
    console.log('🎫 Seeding coupons...');
    
    // Remove existing coupons with same codes to avoid duplicates
    const couponCodes = couponSeeds.map(c => c.code);
    await Coupon.deleteMany({ code: { $in: couponCodes } });
    
    // Insert new coupons
    const insertedCoupons = await Coupon.insertMany(couponSeeds);
    
    console.log(`✅ Successfully seeded ${insertedCoupons.length} coupons:`);
    insertedCoupons.forEach(coupon => {
      console.log(`   - ${coupon.code}: ${coupon.description}`);
    });
    
    return insertedCoupons;
  } catch (error) {
    console.error('❌ Error seeding coupons:', error);
    throw error;
  }
}

module.exports = {
  seedCoupons,
  couponSeeds
};

// Allow running this script directly
if (require.main === module) {
  // Connect to MongoDB if not already connected
  if (mongoose.connection.readyState === 0) {
    const DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/zylo-ecommerce';
    mongoose.connect(DB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }).then(() => {
      console.log('📦 Connected to MongoDB for seeding');
      return seedCoupons();
    }).then(() => {
      console.log('🎯 Coupon seeding completed');
      process.exit(0);
    }).catch(error => {
      console.error('💥 Seeding failed:', error);
      process.exit(1);
    });
  } else {
    seedCoupons().then(() => {
      console.log('🎯 Coupon seeding completed');
    }).catch(error => {
      console.error('💥 Seeding failed:', error);
    });
  }
}