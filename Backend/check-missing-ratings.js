const mongoose = require('mongoose');
const Product = require('./models/Product');

const main = async () => {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/zylo-ecommerce');
    
    // Get all products
    const allProducts = await Product.find().select('id name averageRating totalRatings createdAt').sort({createdAt: -1});
    
    console.log(`Total products in database: ${allProducts.length}\n`);
    
    // Products with ratings
    const withRatings = allProducts.filter(p => p.averageRating > 0);
    console.log(`Products with ratings (${withRatings.length}):`);
    withRatings.slice(0, 5).forEach(p => {
        console.log(`  ${p.id}: ${p.name} - ${p.averageRating}⭐ (${p.totalRatings} reviews)`);
    });
    if (withRatings.length > 5) console.log(`  ... and ${withRatings.length - 5} more`);
    
    // Products without ratings
    const withoutRatings = allProducts.filter(p => p.averageRating === 0);
    console.log(`\nProducts WITHOUT ratings (${withoutRatings.length}):`);
    withoutRatings.forEach(p => {
        console.log(`  ${p.id}: ${p.name} - Created: ${p.createdAt}`);
    });
    
    // Show first 5 products that would be returned by API (newest first)
    console.log(`\nFirst 5 products that API would return (newest first):`);
    allProducts.slice(0, 5).forEach((p, i) => {
        console.log(`  ${i+1}. ${p.id}: ${p.name} - Rating: ${p.averageRating} - Created: ${p.createdAt}`);
    });
    
    mongoose.connection.close();
};

main().catch(console.error);