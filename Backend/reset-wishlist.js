// Script to reset wishlist for testing
const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');

async function resetWishlist() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/zylo_ecommerce');
    console.log('✅ Connected to MongoDB');

    // Find the user and clear wishlist
    const user = await User.findOne({});
    if (user) {
      console.log(`👤 Clearing wishlist for user: ${user.firstName} ${user.lastName}`);
      console.log(`   Current wishlist: ${JSON.stringify(user.wishlist)}`);
      
      user.wishlist = [];
      await user.save();
      
      console.log(`✅ Wishlist cleared: ${JSON.stringify(user.wishlist)}`);
    } else {
      console.log('❌ No user found');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📴 Disconnected from MongoDB');
    process.exit(0);
  }
}

resetWishlist();
