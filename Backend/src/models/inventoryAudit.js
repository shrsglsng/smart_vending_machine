const mongoose = require('mongoose');

const InventoryAuditSchema = new mongoose.Schema({
  tenant_id: {
    type: String,
    required: true,
    index: true,
  },
  operator_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  machine_id: {
    type: String,
    required: true,
    index: true,
  },
  slot_id: {
    type: String,
    required: true,
  },
  item_id: {
    type: String,
    required: true,
  },
  action_type: {
    type: String,
    enum: ['RESTOCK', 'SHIFT_CLEAROUT_DONATION', 'SPOILAGE', 'ADMIN_ADJUSTMENT'],
    required: true,
    index: true,
  },
  quantity_changed: {
    type: Number,
    required: true,
  },
  previous_quantity: {
    type: Number,
    required: true,
  },
  new_quantity: {
    type: Number,
    required: true,
  },
}, {
  timestamps: { createdAt: true, updatedAt: false } // Only track creation time for audits
});

module.exports = mongoose.model('InventoryAudit', InventoryAuditSchema);
