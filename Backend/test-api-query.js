const mongoose = require('mongoose');
const Product = require('./models/Product');

const main = async () => {
    // Use the same connection string that the server uses
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/zylo-ecommerce');
    
    console.log('Database:', mongoose.connection.name);
    console.log('Host:', mongoose.connection.host);
    console.log('Port:', mongoose.connection.port);
    console.log('');
    
    // Execute the same query as the API
    const filter = {};
    const limit = 50;
    const skip = 0;
    
    console.log('🔍 Database query filter:', filter);
    console.log('📊 Query options: limit=' + limit + ', skip=' + skip);
    
    const [items, total] = await Promise.all([
        Product.find(filter).limit(limit).skip(skip).sort({ createdAt: -1 }),
        Product.countDocuments(filter)
    ]);
    
    console.log(`✅ Query results: ${items.length} items found, total: ${total}`);
    console.log('');
    
    // Show first 5 products
    console.log('First 5 products from query:');
    items.slice(0, 5).forEach((p, i) => {
        console.log(`${i+1}. ${p.id}: ${p.name}`);
        console.log(`   Rating: ${p.averageRating}/5 (${p.totalRatings} reviews)`);
        console.log(`   Created: ${p.createdAt}`);
        console.log('');
    });
    
    mongoose.connection.close();
};

main().catch(console.error);