const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
  rack_number: {
    type: Number,
    required: true,
  },
  item_id: {
    type: String,
    required: true,
  },
  item_name: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  price_paise: {
    type: Number,
    required: true,
    min: 0,
  },
}, { _id: false });

const OrderSchema = new mongoose.Schema({
  tenant_id: {
    type: String,
    required: true,
    index: true,
  },
  order_id: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  idempotency_key: {
    type: String,
    unique: true,
    sparse: true,
    index: true,
  },
  machine_id: {
    type: String,
    required: true,
    index: true,
  },
  items: {
    type: [OrderItemSchema],
    required: true,
  },
  total_amount: {
    type: Number,
    required: true,
    min: 0,
  },
  items_dispensed: {
    type: Number,
    default: 0,
  },
  total_items: {
    type: Number,
    required: true,
    min: 1,
  },
  status: {
    type: String,
    enum: [
      'PENDING_PAYMENT',
      'PAYMENT_QR_GENERATED',
      'PAID',
      'DISPENSING',
      'PARTIALLY_DISPENSED',
      'COMPLETED',
      'CANCELLED',
      'REFUNDED',
    ],
    default: 'PENDING_PAYMENT',
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: true,
});

// Configure 600s (10 min) TTL index on Order.createdAt for automatic cart expiration
OrderSchema.index({ createdAt: 1 }, { expireAfterSeconds: 600 });

module.exports = mongoose.model('Order', OrderSchema);
