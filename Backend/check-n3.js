const mongoose = require('mongoose');
const Product = require('./models/Product');

const main = async () => {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/zylo-ecommerce');
    
    const n3Products = await Product.find({id: 'n3'});
    console.log(`Products with id 'n3': ${n3Products.length}`);
    
    n3Products.forEach((p, i) => {
        console.log(`${i+1}:`);
        console.log(`  _id: ${p._id}`);
        console.log(`  id: ${p.id}`);
        console.log(`  name: ${p.name}`);
        console.log(`  averageRating: ${p.averageRating}`);
        console.log(`  totalRatings: ${p.totalRatings}`);
        console.log(`  ratingDistribution:`, p.ratingDistribution);
        console.log(`  createdAt: ${p.createdAt}`);
        console.log('');
    });
    
    mongoose.connection.close();
};

main().catch(console.error);