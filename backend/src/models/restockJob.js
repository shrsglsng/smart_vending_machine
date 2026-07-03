const mongoose = require('mongoose');

const ClearoutItemSchema = new mongoose.Schema({
  slot_id: { type: String, required: true },
  item_id: { type: String, required: true },
  expected_quantity: { type: Number, required: true, default: 0 },
  actual_removed_quantity: { type: Number, default: null } // Filled by operator app
}, { _id: false });

const PackingItemSchema = new mongoose.Schema({
  item_id: { type: String, required: true },
  item_name: { type: String, required: true },
  total_quantity_needed: { type: Number, required: true }
}, { _id: false });

const SlotAssignmentSchema = new mongoose.Schema({
  slot_id: { type: String, required: true },
  item_id: { type: String, required: true },
  target_quantity: { type: Number, required: true },
  actual_quantity_loaded: { type: Number, default: null } // Filled by operator app
}, { _id: false });

const RestockJobSchema = new mongoose.Schema({
  tenant_id: {
    type: String,
    required: true,
    index: true
  },
  job_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  machine_id: {
    type: String,
    required: true,
    index: true
  },
  operator_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
    default: 'PENDING',
    index: true
  },
  shift_type: {
    type: String,
    enum: ['BREAKFAST', 'LUNCH', 'SNACKS', 'ADHOC'],
    required: true
  },
  clearout_required: {
    type: Boolean,
    default: true
  },
  clearout_list: {
    type: [ClearoutItemSchema],
    default: []
  },
  packing_list: {
    type: [PackingItemSchema],
    default: []
  },
  slot_assignments: {
    type: [SlotAssignmentSchema],
    default: []
  },
  completedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('RestockJob', RestockJobSchema);
