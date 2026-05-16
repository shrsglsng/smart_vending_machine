const mongoose = require('mongoose');

const rackSchema = new mongoose.Schema({
  rack_number: {
    type: Number,
    required: true
  },
  item_id: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
    max: 7
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INOPERATIONAL'],
    default: 'ACTIVE'
  }
});

const machineSchema = new mongoose.Schema({
  machine_id: {
    type: String,
    required: true,
    unique: true
  },
  racks: [rackSchema]
}, { timestamps: true });

module.exports = mongoose.model('Machine', machineSchema);