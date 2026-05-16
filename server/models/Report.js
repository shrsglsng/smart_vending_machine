const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  report_id: {
    type: String,
    required: true,
    unique: true
  },
  order_id: {
    type: String,
    required: true
  },
  machine_id: {
    type: String,
    required: true
  },
  issueType: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'RESOLVED_REFUNDED'],
    default: 'PENDING'
  }
}, { timestamps: true });

module.exports = mongoose.model('Report', reportSchema);
