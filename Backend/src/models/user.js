const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema({
  tenant_id: {
    type: String,
    required: true,
    default: 'TEN_PLATFORM_ROOT',
    index: true,
  },
  email: {
    type: String,
    unique: true,
    sparse: true, // Allows multiple users with null/omitted emails
    lowercase: true,
    trim: true,
  },
  mobile_number: {
    type: String,
    unique: true,
    sparse: true, // Allows multiple users with null/omitted mobile numbers
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['SUPER_ADMIN', 'TENANT_ADMIN', 'OPERATOR'],
    required: true,
  },
  transactionPin: {
    type: String, // Secondary bcrypt hash for refund operations (optional for operator)
    default: null,
  },
}, {
  timestamps: true,
});

// Pre-save hook to hash password and transactionPin fields upon creation or modification
UserSchema.pre('save', async function () {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  if (this.isModified('transactionPin') && this.transactionPin) {
    this.transactionPin = await bcrypt.hash(this.transactionPin, 10);
  }
});

// Instance method to check password validity
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Instance method to check transaction pin validity
UserSchema.methods.comparePin = async function (candidatePin) {
  if (!this.transactionPin) return false;
  return bcrypt.compare(candidatePin, this.transactionPin);
};

module.exports = mongoose.model('User', UserSchema);
