// backend/scripts/seedAdmin.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('./models/user'); // Adjust path to your User model

async function seedSuperAdmin() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB...');

        const email = 'aibotink.web@gmail.com';
        const existingAdmin = await User.findOne({ email });

        if (existingAdmin) {
            console.log('Super Admin already exists. Exiting.');
            process.exit(0);
        }

        // Generate a secure starting password 
        const hashedPassword = await bcrypt.hash('aibotink@123', 10);

        const superAdmin = new User({
            tenant_id: 'TEN_PLATFORM_ROOT',
            email: email,
            password: hashedPassword,
            role: 'SUPER_ADMIN'
        });

        await superAdmin.save();
        console.log('Super Admin created successfully!');

    } catch (error) {
        console.error('Error seeding admin:', error);
    } finally {
        mongoose.connection.close();
    }
}

seedSuperAdmin();