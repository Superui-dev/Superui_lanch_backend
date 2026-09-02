const mongoose = require('mongoose');

const pageViewSchema = new mongoose.Schema({
  visitorId: { 
    type: String, 
    required: true,
    index: true 
  },
  page: { 
    type: String, 
    required: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now,
    index: true // Key index for analytics reporting
  }
}, {
  timestamps: false
});

const { getOperationsConnection } = require('../config/db');

const PageViewModel = getOperationsConnection().model('PageView', pageViewSchema);

module.exports = PageViewModel;

