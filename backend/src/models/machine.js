const mongoose = require('mongoose');

const SlotSchema = new mongoose.Schema({
  row: {
    type: Number,
    required: true,
  },
  column: {
    type: Number,
    required: true,
  },
  slot_id: {
    type: String,
    required: true, // e.g. "R1-C2"
  },
  item_id: {
    type: String,
    default: null, // Can be unassigned initially
  },
  quantity: {
    type: Number,
    default: 0,
    min: 0,
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INOPERATIONAL'],
    default: 'ACTIVE',
  },
}, { _id: false });

const MachineSchema = new mongoose.Schema({
  tenant_id: {
    type: String,
    required: true,
    default: 'TEN_PLATFORM_ROOT', // Assigned to platform root by default if unassigned
    index: true,
  },
  machine_id: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true,
  },
  device_api_key: {
    type: String,
    required: true, // Stored as a hashed value for tablet verification
  },
  grid_config: {
    rows: {
      type: Number,
      required: true,
      min: 1,
    },
    columns: {
      type: Number,
      required: true,
      min: 1,
    },
    max_depth: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  slots: {
    type: [SlotSchema],
    default: [],
  },
  idle_video_urls: {
    type: [String],
    default: [],
  },
  min_supported_app_version: {
    type: Number,
    default: 1,
  },
  assignment_status: {
    type: String,
    enum: ['ACTIVE', 'UNASSIGNED', 'MAINTENANCE'],
    default: 'UNASSIGNED',
  },
  location: {
    type: String,
    trim: true,
    default: '',
  },
}, {
  timestamps: true,
});

// Custom schema validator to ensure no slot's inventory exceeds the max depth specified in grid_config
MachineSchema.path('slots').validate(function (slots) {
  if (!slots || slots.length === 0) {
    return true;
  }
  
  const maxDepth = this.grid_config ? this.grid_config.max_depth : null;
  if (maxDepth === null) {
    return true; // No depth configuration available to validate against yet
  }

  // Every slot quantity must be less than or equal to the machine's grid max depth
  return slots.every(slot => slot.quantity <= maxDepth);
}, 'Invalid slot configuration: Slot quantity cannot exceed grid_config.max_depth.');

module.exports = mongoose.model('Machine', MachineSchema);
