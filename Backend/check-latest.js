const mongoose = require('mongoose');
const Product = require('./models/Product');

const main = async () => {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/zylo-ecommerce');
    
    const products = await Product.find().select('id name averageRating createdAt').sort({createdAt: -1}).limit(10);
    
    console.log('Latest 10 products:');
    products.forEach((p, i) => {
        console.log(`${i+1}. ${p.id} - ${p.name}`);
        console.log(`   Rating: ${p.averageRating} | Created: ${p.createdAt}`);
        console.log('');
    });
    
    mongoose.connection.close();
};

main().catch(console.error);