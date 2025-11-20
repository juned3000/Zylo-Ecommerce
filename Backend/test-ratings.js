const mongoose = require('mongoose');
const Product = require('./models/Product');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/zylo-ecommerce');
        console.log('MongoDB Connected...');
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
};

const checkRatings = async () => {
    try {
        console.log('Checking products with rating data...\n');
        
        // Check specific products
        const testProducts = await Product.find({
            id: { $in: ['f1', 'f2', 'f3'] }
        }).select('id name averageRating totalRatings ratingDistribution');
        
        console.log('Test products (f1, f2, f3):');
        testProducts.forEach(product => {
            console.log(`- ${product.id}: ${product.name}`);
            console.log(`  Rating: ${product.averageRating}/5 (${product.totalRatings} reviews)`);
            console.log(`  Distribution:`, product.ratingDistribution);
            console.log('');
        });
        
        // Check all products with ratings > 0
        const productsWithRatings = await Product.find({
            averageRating: { $gt: 0 }
        }).select('id name averageRating totalRatings').limit(10);
        
        console.log(`\nProducts with ratings (${productsWithRatings.length} found):`);
        productsWithRatings.forEach(product => {
            console.log(`- ${product.id}: ${product.name} - ${product.averageRating}⭐ (${product.totalRatings} reviews)`);
        });
        
        // Count totals
        const totalProducts = await Product.countDocuments();
        const productsWithRatingCount = await Product.countDocuments({ averageRating: { $gt: 0 } });
        
        console.log(`\nSummary:`);
        console.log(`Total products: ${totalProducts}`);
        console.log(`Products with ratings: ${productsWithRatingCount}`);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.connection.close();
    }
};

const main = async () => {
    await connectDB();
    await checkRatings();
};

main();