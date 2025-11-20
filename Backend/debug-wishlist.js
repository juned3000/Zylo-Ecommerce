// Debug script to check wishlist items in the database
const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const Product = require('./models/Product');

async function debugWishlist() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/zylo_ecommerce');
    console.log('✅ Connected to MongoDB');

    console.log('\n🔍 WISHLIST DEBUG REPORT');
    console.log('='.repeat(60));

    // 1. Check all users
    const allUsers = await User.find({});
    console.log(`\n👤 Total users in database: ${allUsers.length}`);

    // 2. Check users with wishlist data
    const usersWithWishlist = await User.find({ 
      wishlist: { $exists: true, $ne: [] } 
    });
    console.log(`❤️ Users with wishlist items: ${usersWithWishlist.length}`);

    // 3. Check users with wishlist field (even if empty)
    const usersWithWishlistField = await User.find({ 
      wishlist: { $exists: true } 
    });
    console.log(`📝 Users with wishlist field: ${usersWithWishlistField.length}`);

    // 4. Show detailed user wishlist data
    console.log('\n📋 DETAILED USER WISHLIST DATA:');
    console.log('-'.repeat(40));

    for (const user of allUsers) {
      const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
      console.log(`\n👤 User: ${displayName}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   User ID: ${user._id}`);
      console.log(`   Wishlist exists: ${user.wishlist ? 'Yes' : 'No'}`);
      console.log(`   Wishlist type: ${typeof user.wishlist}`);
      console.log(`   Wishlist value:`, user.wishlist);
      console.log(`   Wishlist length: ${user.wishlist ? user.wishlist.length : 'N/A'}`);
      
      if (user.wishlist && user.wishlist.length > 0) {
        console.log(`   ❤️ Wishlist items: ${user.wishlist.join(', ')}`);
        
        // Try to find the actual products
        for (const productId of user.wishlist) {
          const product = await Product.findOne({ id: productId });
          if (product) {
            console.log(`      ✅ Product found: ${product.name} (${product.id})`);
          } else {
            console.log(`      ❌ Product NOT found: ${productId}`);
          }
        }
      }
    }

    // 5. Check if there are any products in the database
    const allProducts = await Product.find({});
    console.log(`\n📦 Total products in database: ${allProducts.length}`);
    
    if (allProducts.length > 0) {
      console.log('\n📋 Sample products:');
      allProducts.slice(0, 5).forEach((product, index) => {
        console.log(`   ${index + 1}. ${product.name} (ID: ${product.id})`);
      });
    }

    // 6. Check localStorage simulation (what might be stored locally)
    console.log('\n💾 CHECKING POTENTIAL FRONTEND ISSUES:');
    console.log('-'.repeat(40));
    
    // Look for any documents that might have wishlist data in different formats
    const aggregateWishlist = await User.aggregate([
      { $match: { wishlist: { $exists: true } } },
      { $project: { 
        email: 1, 
        wishlistExists: { $ifNull: ['$wishlist', false] },
        wishlistType: { $type: '$wishlist' },
        wishlistSize: { $size: { $ifNull: ['$wishlist', []] } }
      }}
    ]);

    console.log('📊 Wishlist aggregate data:', JSON.stringify(aggregateWishlist, null, 2));

    // 7. Summary
    console.log('\n📊 SUMMARY:');
    console.log('='.repeat(30));
    console.log(`Total Users: ${allUsers.length}`);
    console.log(`Users with wishlist field: ${usersWithWishlistField.length}`);
    console.log(`Users with wishlist items: ${usersWithWishlist.length}`);
    console.log(`Total Products: ${allProducts.length}`);

    // 8. Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('-'.repeat(30));
    
    if (usersWithWishlist.length === 0) {
      console.log('⚠️ No users have wishlist items. Possible causes:');
      console.log('   1. Users haven\'t added items to wishlist');
      console.log('   2. Frontend is not syncing with backend');
      console.log('   3. Wishlist API endpoints not working');
      console.log('   4. localStorage not syncing with database');
    }

    if (allProducts.length === 0) {
      console.log('⚠️ No products in database. You need to seed products first.');
    }

  } catch (error) {
    console.error('❌ Error debugging wishlist:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📴 Disconnected from MongoDB');
    process.exit(0);
  }
}

debugWishlist();