require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function setAdminPassword() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Find the admin user
        const adminUser = await User.findOne({ isAdmin: true });
        
        if (!adminUser) {
            console.log('No admin user found');
            process.exit(1);
        }

        console.log('Found admin user:', adminUser.email);

        // Set password
        const password = 'admin123'; // Default password
        const passwordHash = await bcrypt.hash(password, 10);
        
        await User.findByIdAndUpdate(adminUser._id, { passwordHash });
        
        console.log('Password set successfully!');
        console.log('Email:', adminUser.email);
        console.log('Password:', password);
        console.log('\nYou can now login to the admin panel with these credentials.');
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

setAdminPassword();