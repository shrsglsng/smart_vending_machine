// backend/src/resetAdmin.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/user');

async function resetAdmin() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB...');

        const email = 'aibotink.web@gmail.com';
        
        // Find existing user or create a new one
        let user = await User.findOne({ email });

        if (!user) {
            console.log('User not found. Creating a new Super Admin...');
            user = new User({
                tenant_id: 'TEN_PLATFORM_ROOT',
                email: email,
                role: 'SUPER_ADMIN'
            });
        }

        // We set the password in PLAINTEXT. 
        // The Mongoose pre-save hook in user.js will hash it EXACTLY ONCE.
        user.password = 'aibotink@123'; 

        await user.save();
        console.log('Super Admin password successfully reset and hashed once!');

    } catch (error) {
        console.error('Error resetting admin:', error);
    } finally {
        mongoose.connection.close();
    }
}

resetAdmin();
