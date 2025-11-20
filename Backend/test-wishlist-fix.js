// Test script to debug and fix wishlist issues
const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const Product = require('./models/Product');

async function testWishlistFix() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/zylo_ecommerce');
    console.log('✅ Connected to MongoDB');

    console.log('\n🔍 TESTING WISHLIST FIX');
    console.log('='.repeat(60));

    // 1. Find the user
    const user = await User.findOne({});
    if (!user) {
      console.log('❌ No user found in database');
      return;
    }
    console.log(`\n👤 Found user: ${user.firstName} ${user.lastName} (${user.email})`);
    console.log(`   User ID: ${user._id}`);
    console.log(`   Current wishlist: ${JSON.stringify(user.wishlist)}`);

    // 2. Find some products to test with
    const products = await Product.find({}).limit(3);
    console.log(`\n📦 Found ${products.length} products to test with:`);
    products.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.name} (ID: ${p.id})`);
    });

    if (products.length === 0) {
      console.log('❌ No products found to test with');
      return;
    }

    // 3. Test adding products to wishlist directly in database
    console.log('\n🧪 TESTING DIRECT DATABASE OPERATIONS:');
    console.log('-'.repeat(40));

    const testProductId = products[0].id;
    console.log(`\n   Testing with product: ${products[0].name} (${testProductId})`);

    // Add to wishlist
    user.wishlist = Array.from(new Set([...(user.wishlist || []), testProductId]));
    await user.save();
    console.log(`   ✅ Added to wishlist: ${JSON.stringify(user.wishlist)}`);

    // Verify it's saved
    const updatedUser = await User.findById(user._id);
    console.log(`   ✅ Verified in database: ${JSON.stringify(updatedUser.wishlist)}`);

    // 4. Test the product lookup that wishlist.js route uses
    console.log('\n🔍 TESTING PRODUCT LOOKUP (used by /api/wishlist route):');
    console.log('-'.repeat(50));

    for (const product of products) {
      const foundProduct = await Product.findOne({ id: product.id });
      if (foundProduct) {
        console.log(`   ✅ Product ${product.id} found via lookup`);
      } else {
        console.log(`   ❌ Product ${product.id} NOT found via lookup`);
      }
    }

    // 5. Test adding another product
    const testProductId2 = products[1].id;
    console.log(`\n   Adding second product: ${products[1].name} (${testProductId2})`);
    
    user.wishlist = Array.from(new Set([...(user.wishlist || []), testProductId2]));
    await user.save();
    console.log(`   ✅ Updated wishlist: ${JSON.stringify(user.wishlist)}`);

    // 6. Final verification
    console.log('\n📊 FINAL VERIFICATION:');
    console.log('-'.repeat(30));
    const finalUser = await User.findById(user._id);
    console.log(`   Final wishlist: ${JSON.stringify(finalUser.wishlist)}`);
    console.log(`   Wishlist length: ${finalUser.wishlist.length}`);

    // 7. Test product validation (this might be the issue)
    console.log('\n🔬 TESTING PRODUCT VALIDATION ISSUE:');
    console.log('-'.repeat(40));

    // Check if the products have the correct 'id' field (not '_id')
    const sampleProduct = await Product.findOne({});
    console.log('   Sample product fields:');
    console.log(`     _id: ${sampleProduct._id}`);
    console.log(`     id: ${sampleProduct.id}`);
    console.log(`     name: ${sampleProduct.name}`);
    
    // Check if findOne with id works
    const productLookupTest = await Product.findOne({ id: sampleProduct.id });
    if (productLookupTest) {
      console.log(`   ✅ Product lookup by 'id' field works`);
    } else {
      console.log(`   ❌ Product lookup by 'id' field FAILS`);
      console.log('   🔧 This explains why /api/wishlist route fails!');
    }

    console.log('\n💡 DIAGNOSIS:');
    console.log('='.repeat(30));
    
    if (user.wishlist.length > 0) {
      console.log('✅ Database wishlist operations work correctly');
      console.log('✅ User model and wishlist field are functional');
      
      if (productLookupTest) {
        console.log('✅ Product lookup works - issue might be in frontend API calls');
      } else {
        console.log('⚠️ Product lookup fails - /api/wishlist route will fail');
        console.log('💡 SOLUTION: Use /api/users/me/wishlist route instead');
      }
    } else {
      console.log('❌ Database operations failed');
    }

  } catch (error) {
    console.error('❌ Error testing wishlist:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📴 Disconnected from MongoDB');
    process.exit(0);
  }
}

testWishlistFix();
