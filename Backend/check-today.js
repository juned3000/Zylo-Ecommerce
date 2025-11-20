const mongoose = require('mongoose');
const Product = require('./models/Product');

const main = async () => {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/zylo-ecommerce');
    
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const products = await Product.find({createdAt: {$gte: today}}).select('id name averageRating createdAt').sort({createdAt: -1});
    
    console.log(`Products created today (${today.toDateString()}): ${products.length}`);
    products.forEach(p => {
        console.log(`${p.id} - ${p.name} | Rating: ${p.averageRating} | ${p.createdAt}`);
    });
    
    if (products.length === 0) {
        // Check the absolute latest products
        const latest = await Product.find().select('id name averageRating createdAt').sort({createdAt: -1}).limit(5);
        console.log('\nLatest 5 products overall:');
        latest.forEach(p => {
            console.log(`${p.id} - ${p.name} | Rating: ${p.averageRating} | ${p.createdAt}`);
        });
    }
    
    mongoose.connection.close();
};

main().catch(console.error);