// Debug script to check order addresses in the database
const mongoose = require('mongoose');
require('dotenv').config();

const Order = require('./models/Order');
const User = require('./models/User');

async function debugOrderAddresses() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/zylo_ecommerce');
    console.log('✅ Connected to MongoDB');

    // Get all orders
    const orders = await Order.find().sort({ createdAt: -1 }).limit(10);
    console.log(`📦 Found ${orders.length} recent orders`);

    if (orders.length === 0) {
      console.log('ℹ️ No orders found in database');
      process.exit(0);
    }

    // Check each order's shipping address
    for (const order of orders) {
      console.log('\n' + '='.repeat(50));
      console.log(`📋 Order ID: ${order.id}`);
      console.log(`📅 Created: ${order.createdAt}`);
      console.log(`👤 User ID: ${order.userId}`);
      console.log(`💳 Payment: ${order.paymentMethod}`);
      console.log(`📦 Status: ${order.orderStatus}`);
      console.log(`📍 Shipping Address:`, JSON.stringify(order.shippingAddress, null, 2));
      
      // Check if address fields are properly populated
      if (!order.shippingAddress) {
        console.log('❌ No shipping address found!');
      } else if (!order.shippingAddress.name && !order.shippingAddress.addressText) {
        console.log('❌ Shipping address is empty!');
      } else if (order.shippingAddress.name === 'undefined' || order.shippingAddress.addressText === 'undefined') {
        console.log('❌ Shipping address contains "undefined" values!');
      } else {
        console.log('✅ Shipping address looks good');
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('🔍 Summary:');
    
    const addressIssues = orders.filter(order => 
      !order.shippingAddress || 
      !order.shippingAddress.name || 
      !order.shippingAddress.addressText ||
      order.shippingAddress.name === 'undefined' ||
      order.shippingAddress.addressText === 'undefined'
    );

    console.log(`📊 Orders with address issues: ${addressIssues.length}/${orders.length}`);
    
    if (addressIssues.length > 0) {
      console.log('⚠️ Orders with issues:', addressIssues.map(o => o.id).join(', '));
    }

    // Also check users to see their address data
    console.log('\n🔍 Checking user addresses...');
    const users = await User.find({ addresses: { $exists: true, $ne: [] } }).limit(5);
    console.log(`👤 Found ${users.length} users with addresses`);
    
    for (const user of users) {
      console.log(`\n👤 User: ${user.firstName || ''} ${user.lastName || ''} (${user.email})`);
      console.log(`📍 Addresses: ${user.addresses.length}`);
      user.addresses.forEach((addr, index) => {
        console.log(`   ${index + 1}. ${addr.firstName} ${addr.lastName} - ${addr.line}, ${addr.city} (${addr.isDefault ? 'DEFAULT' : 'regular'})`);
      });
    }

  } catch (error) {
    console.error('❌ Error debugging orders:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📴 Disconnected from MongoDB');
    process.exit(0);
  }
}

debugOrderAddresses();