/**
 * Script to populate existing products with sample rating data
 * Run this script after adding the rating fields to the Product model
 */

const mongoose = require('mongoose');
const Product = require('./models/Product');

// Database connection (update with your actual connection string)
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/zylo-ecommerce', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB Connected...');
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
};

// Sample rating data for demo products
const sampleRatings = {
    'f1': { averageRating: 4.5, totalRatings: 128, ratingDistribution: { 1: 2, 2: 5, 3: 15, 4: 34, 5: 72 } },
    'f2': { averageRating: 4.2, totalRatings: 89, ratingDistribution: { 1: 1, 2: 4, 3: 12, 4: 28, 5: 44 } },
    'f3': { averageRating: 4.7, totalRatings: 156, ratingDistribution: { 1: 1, 2: 3, 3: 8, 4: 22, 5: 122 } },
    'f4': { averageRating: 4.1, totalRatings: 73, ratingDistribution: { 1: 2, 2: 5, 3: 10, 4: 28, 5: 28 } },
    'f5': { averageRating: 4.4, totalRatings: 95, ratingDistribution: { 1: 1, 2: 3, 3: 12, 4: 31, 5: 48 } },
    'f6': { averageRating: 4.3, totalRatings: 67, ratingDistribution: { 1: 1, 2: 2, 3: 8, 4: 25, 5: 31 } },
    'f7': { averageRating: 4.8, totalRatings: 203, ratingDistribution: { 1: 0, 2: 2, 3: 6, 4: 25, 5: 170 } },
    'f8': { averageRating: 4.0, totalRatings: 54, ratingDistribution: { 1: 2, 2: 4, 3: 11, 4: 19, 5: 18 } },
    'f9': { averageRating: 4.6, totalRatings: 134, ratingDistribution: { 1: 1, 2: 2, 3: 7, 4: 32, 5: 92 } },
    'f10': { averageRating: 4.2, totalRatings: 88, ratingDistribution: { 1: 2, 2: 3, 3: 11, 4: 30, 5: 42 } },
    'n1': { averageRating: 4.3, totalRatings: 76, ratingDistribution: { 1: 1, 2: 3, 3: 9, 4: 28, 5: 35 } },
    'n2': { averageRating: 4.1, totalRatings: 62, ratingDistribution: { 1: 2, 2: 4, 3: 8, 4: 24, 5: 24 } },
    'n3': { averageRating: 4.5, totalRatings: 97, ratingDistribution: { 1: 1, 2: 2, 3: 7, 4: 29, 5: 58 } },
    'n4': { averageRating: 4.4, totalRatings: 83, ratingDistribution: { 1: 1, 2: 3, 3: 8, 4: 27, 5: 44 } },
    'n5': { averageRating: 4.6, totalRatings: 119, ratingDistribution: { 1: 1, 2: 2, 3: 6, 4: 28, 5: 82 } },
    'n6': { averageRating: 3.9, totalRatings: 45, ratingDistribution: { 1: 3, 2: 4, 3: 8, 4: 18, 5: 12 } },
    'n7': { averageRating: 4.7, totalRatings: 142, ratingDistribution: { 1: 1, 2: 2, 3: 5, 4: 22, 5: 112 } },
    'n8': { averageRating: 4.2, totalRatings: 71, ratingDistribution: { 1: 2, 2: 3, 3: 9, 4: 26, 5: 31 } },
    'n9': { averageRating: 4.8, totalRatings: 167, ratingDistribution: { 1: 0, 2: 1, 3: 4, 4: 28, 5: 134 } },
    'n10': { averageRating: 4.3, totalRatings: 91, ratingDistribution: { 1: 2, 2: 3, 3: 8, 4: 32, 5: 46 } }
};

const populateRatings = async () => {
    try {
        console.log('Starting rating data population...');
        
        let updatedCount = 0;
        let skippedCount = 0;

        for (const [productId, ratingData] of Object.entries(sampleRatings)) {
            try {
                // Find product by id
                const product = await Product.findOne({ id: productId });
                
                if (!product) {
                    console.log(`Product with id ${productId} not found, skipping...`);
                    skippedCount++;
                    continue;
                }

                // Update product with rating data
                await Product.updateOne(
                    { id: productId },
                    {
                        $set: {
                            averageRating: ratingData.averageRating,
                            totalRatings: ratingData.totalRatings,
                            ratingDistribution: ratingData.ratingDistribution
                        }
                    }
                );

                console.log(`✓ Updated ratings for product ${productId} (${product.name}) - ${ratingData.averageRating}/5 stars, ${ratingData.totalRatings} reviews`);
                updatedCount++;

            } catch (error) {
                console.error(`Error updating product ${productId}:`, error.message);
            }
        }

        console.log(`\nRating population completed!`);
        console.log(`✓ Updated: ${updatedCount} products`);
        console.log(`⚠ Skipped: ${skippedCount} products`);

        // Display sample of updated products
        const sampleProducts = await Product.find({ 
            averageRating: { $gt: 0 } 
        }).limit(5).select('id name averageRating totalRatings');

        console.log('\nSample of updated products:');
        sampleProducts.forEach(product => {
            console.log(`- ${product.name}: ${product.averageRating}⭐ (${product.totalRatings} reviews)`);
        });

        // Statistics
        const stats = await Product.aggregate([
            {
                $group: {
                    _id: null,
                    totalProducts: { $sum: 1 },
                    productsWithRatings: { 
                        $sum: { $cond: [{ $gt: ["$totalRatings", 0] }, 1, 0] } 
                    },
                    averageRatingOverall: { 
                        $avg: { $cond: [{ $gt: ["$totalRatings", 0] }, "$averageRating", null] } 
                    },
                    totalReviews: { 
                        $sum: { $cond: [{ $gt: ["$totalRatings", 0] }, "$totalRatings", 0] } 
                    }
                }
            }
        ]);

        if (stats.length > 0) {
            const { totalProducts, productsWithRatings, averageRatingOverall, totalReviews } = stats[0];
            console.log('\nRating Statistics:');
            console.log(`📊 Total Products: ${totalProducts}`);
            console.log(`⭐ Products with Ratings: ${productsWithRatings}`);
            console.log(`📈 Overall Average Rating: ${averageRatingOverall ? averageRatingOverall.toFixed(2) : 'N/A'}⭐`);
            console.log(`💬 Total Reviews: ${totalReviews}`);
        }

    } catch (error) {
        console.error('Error populating ratings:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\nDatabase connection closed.');
    }
};

// Run the script
const main = async () => {
    console.log('🌟 Zylo Ecommerce - Rating Data Population Script');
    console.log('='.repeat(50));
    
    await connectDB();
    await populateRatings();
};

// Execute if run directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { populateRatings, sampleRatings };