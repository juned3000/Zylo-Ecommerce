require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/zylo-ecommerce');
        console.log('MongoDB Connected to:', mongoose.connection.host);
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
};

const generateRandomRating = () => {
    const ratings = [3.8, 3.9, 4.0, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7];
    const avgRating = ratings[Math.floor(Math.random() * ratings.length)];
    const totalRatings = Math.floor(Math.random() * 60) + 20; // 20-80 reviews
    
    // Generate realistic distribution
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    
    for (let i = 0; i < totalRatings; i++) {
        let rating;
        if (avgRating >= 4.5) {
            // Excellent products: mostly 5s and 4s
            rating = Math.random() < 0.7 ? 5 : (Math.random() < 0.8 ? 4 : 3);
        } else if (avgRating >= 4.0) {
            // Good products: mix of 4s and 5s, some 3s
            rating = Math.random() < 0.4 ? 5 : (Math.random() < 0.7 ? 4 : 3);
        } else if (avgRating >= 3.5) {
            // Average products: mostly 3s and 4s
            rating = Math.random() < 0.3 ? 4 : (Math.random() < 0.6 ? 3 : (Math.random() < 0.8 ? 2 : 1));
        } else {
            // Poor products: mix of lower ratings
            rating = Math.random() < 0.2 ? 3 : (Math.random() < 0.5 ? 2 : 1);
        }
        distribution[rating]++;
    }
    
    return {
        averageRating: avgRating,
        totalRatings: totalRatings,
        ratingDistribution: distribution
    };
};

const populateMissingRatings = async () => {
    try {
        console.log('🌟 Populating missing ratings for products without ratings...\n');
        
        // Find products with 0 ratings
        const productsWithoutRatings = await Product.find({
            $or: [
                { averageRating: 0 },
                { totalRatings: 0 },
                { averageRating: { $exists: false } },
                { totalRatings: { $exists: false } }
            ]
        });
        
        console.log(`Found ${productsWithoutRatings.length} products without ratings:`);
        productsWithoutRatings.forEach(p => {
            console.log(`- ${p.id}: ${p.name} (created: ${p.createdAt})`);
        });
        console.log('');
        
        let updated = 0;
        
        for (const product of productsWithoutRatings) {
            const ratingData = generateRandomRating();
            
            await Product.updateOne(
                { _id: product._id },
                {
                    $set: {
                        averageRating: ratingData.averageRating,
                        totalRatings: ratingData.totalRatings,
                        ratingDistribution: ratingData.ratingDistribution
                    }
                }
            );
            
            console.log(`✓ Updated ${product.id} (${product.name}) - ${ratingData.averageRating}⭐ (${ratingData.totalRatings} reviews)`);
            updated++;
        }
        
        console.log(`\n✅ Successfully updated ${updated} products with ratings!`);
        
        // Show final stats
        const totalProducts = await Product.countDocuments();
        const productsWithRatings = await Product.countDocuments({ averageRating: { $gt: 0 } });
        
        console.log(`\n📊 Final Statistics:`);
        console.log(`Total Products: ${totalProducts}`);
        console.log(`Products with Ratings: ${productsWithRatings}`);
        
    } catch (error) {
        console.error('Error populating missing ratings:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\nDatabase connection closed.');
    }
};

const main = async () => {
    await connectDB();
    await populateMissingRatings();
};

main().catch(console.error);