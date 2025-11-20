require('dotenv').config(); // Load environment variables
const mongoose = require('mongoose');
const Product = require('./models/Product');

const main = async () => {
    // Use the exact same connection as the server
    console.log('Using MONGODB_URI from env:', process.env.MONGODB_URI ? 'Set' : 'Not set');
    console.log('Connecting to:', process.env.MONGODB_URI || 'mongodb://localhost:27017/zylo-ecommerce');
    console.log('');
    
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/zylo-ecommerce');
    
    console.log('Connected to database:');
    console.log('  Name:', mongoose.connection.name);
    console.log('  Host:', mongoose.connection.host);
    console.log('');
    
    // Get total count
    const total = await Product.countDocuments();
    console.log(`Total products: ${total}`);
    
    // Get first 5 products (same as API)
    const products = await Product.find().sort({ createdAt: -1 }).limit(5);
    
    console.log('\\nFirst 5 products (newest first):');
    products.forEach((p, i) => {
        console.log(`${i+1}. ${p.id}: ${p.name}`);
        console.log(`   Rating: ${p.averageRating}/5 (${p.totalRatings} reviews)`);
        console.log(`   Created: ${p.createdAt}`);
        console.log('');
    });
    
    // Check specific product f1
    const f1 = await Product.findOne({ id: 'f1' });
    if (f1) {
        console.log('Product f1:');
        console.log(`  Name: ${f1.name}`);
        console.log(`  Rating: ${f1.averageRating}/5 (${f1.totalRatings} reviews)`);
        console.log(`  Distribution:`, f1.ratingDistribution);
    } else {
        console.log('Product f1 not found!');
    }
    
    mongoose.connection.close();
};

main().catch(console.error);