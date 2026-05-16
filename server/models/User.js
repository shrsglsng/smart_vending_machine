const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['ADMIN', 'OPERATOR'],
    required: true
  },
  transactionPin: {
    type: String, // Hashed PIN for authorizing refunds
    required: false
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
