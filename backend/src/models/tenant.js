const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/crypto');

const TenantSchema = new mongoose.Schema({
  tenant_id: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true,
  },
  business_name: {
    type: String,
    required: true,
    trim: true,
  },
  contact_email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  is_custom_gateway_active: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'DISABLED'],
    default: 'ACTIVE',
  },
  password: {
    type: String,
    default: null,
  },
  payment_config: {
    type: String, // Stored encrypted on disk as iv:ciphertext:tag
    default: null,
    // Custom setter triggers encryption when payment_config object is assigned/updated
    set: function (val) {
      if (!val) return null;
      // If it is already encrypted (colon separated iv:ciphertext:tag), do not encrypt again
      if (typeof val === 'string' && val.split(':').length === 3) {
        return val;
      }
      return encrypt(val);
    },
    // Custom getter decrypts transparently back to JSON object upon retrieval
    get: function (val) {
      if (!val) return null;
      try {
        return decrypt(val);
      } catch (err) {
        // Fallback or print error if key/decryption fails
        console.error(`Mongoose decryption hook failed for tenant ${this.tenant_id}:`, err.message);
        return null;
      }
    },
  },
}, {
  timestamps: true,
  // Ensure virtuals & getters are triggered during conversion to JSON or Object
  toJSON: { getters: true, virtuals: true },
  toObject: { getters: true, virtuals: true },
});

module.exports = mongoose.model('Tenant', TenantSchema);
