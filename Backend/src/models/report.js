const mongoose = require('mongoose');

const UndispensedItemSchema = new mongoose.Schema({
  rack_number: {
    type: Number,
    required: true,
  },
  item_name: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
  price_paise: {
    type: Number,
    required: true,
  }
}, { _id: false });

const ReportSchema = new mongoose.Schema({
  tenant_id: {
    type: String,
    required: true,
    index: true,
  },
  report_id: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  order_id: {
    type: String,
    required: true,
    index: true,
  },
  machine_id: {
    type: String,
    required: true,
    index: true,
  },
  issueType: {
    type: String,
    required: true, // e.g. "JAM"
  },
  description: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['PENDING', 'RESOLVED_REFUNDED'],
    default: 'PENDING',
    index: true,
  },
  undispensed_items: {
    type: [UndispensedItemSchema],
    default: [],
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('Report', ReportSchema);
