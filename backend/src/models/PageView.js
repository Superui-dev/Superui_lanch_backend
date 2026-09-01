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

const { getCoreConnection, getAnalyticsConnection } = require('../config/db');

const PageViewModel = getCoreConnection().model('PageView', pageViewSchema);
try {
  getAnalyticsConnection().model('PageView', pageViewSchema);
} catch (e) {}

module.exports = PageViewModel;

