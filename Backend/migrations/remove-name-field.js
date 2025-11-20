// Migration to remove the 'name' field from User collection
// Run this script to clean up existing user documents

const mongoose = require('mongoose');
require('dotenv').config();

async function removeNameField() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/zylo_ecommerce');
    console.log('Connected to MongoDB');

    // Remove the 'name' field from all user documents
    const result = await mongoose.connection.db.collection('users').updateMany(
      { name: { $exists: true } },
      { $unset: { name: "" } }
    );

    console.log(`Migration completed: ${result.modifiedCount} documents updated`);
    
    // Show remaining users to verify
    const users = await mongoose.connection.db.collection('users').find({}, { 
      projection: { email: 1, firstName: 1, lastName: 1, name: 1 } 
    }).toArray();
    
    console.log('Current users after migration:');
    users.forEach(user => {
      console.log(`- Email: ${user.email}, First: ${user.firstName || 'N/A'}, Last: ${user.lastName || 'N/A'}, Name: ${user.name || 'REMOVED'}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

removeNameField();