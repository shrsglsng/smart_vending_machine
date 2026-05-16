const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  order_id: {
    type: String,
    required: true,
    unique: true
  },
  machine_id: {
    type: String,
    required: true
  },
  rack_number: {
    type: Number,
    required: true
  },
  amount: {
    type: Number, // Amount in paise
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING_PAYMENT', 'PAID_UNCLAIMED', 'DISPENSING', 'COMPLETED', 'REFUNDED'],
    default: 'PENDING_PAYMENT'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600 // TTL index of 600 seconds (10 minutes)
  }
}, { timestamps: { updatedAt: true, createdAt: false } });

module.exports = mongoose.model('Order', orderSchema);
