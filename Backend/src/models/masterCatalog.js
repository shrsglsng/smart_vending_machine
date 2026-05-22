const mongoose = require('mongoose');

const MasterCatalogSchema = new mongoose.Schema({
  item_id: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true,
  },
  item_name: {
    type: String,
    required: true,
    trim: true,
  },
  image_path: {
    type: String,
    required: true,
    trim: true,
  },
  default_price_paise: {
    type: Number,
    required: true,
    min: 0,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('MasterCatalog', MasterCatalogSchema);
