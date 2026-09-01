const mongoose = require('mongoose');

const visitorSchema = new mongoose.Schema({
  visitorId: { 
    type: String, 
    required: true, 
    index: true 
  },
  sessionId: { type: String, required: true },
  ipHash: { type: String, required: true },
  userAgent: { type: String },
  device: { type: String },
  browser: { type: String },
  os: { type: String },
  country: { type: String },
  city: { type: String },
  referrer: { type: String },
  landingPage: { type: String },
  lastPage: { type: String },
  pagesViewed: { type: Number, default: 1 },
  firstVisitAt: { type: Date, default: Date.now },
  lastVisitAt: { type: Date, default: Date.now }
}, {
  timestamps: { createdAt: true, updatedAt: true }
});

const { getCoreConnection, getAnalyticsConnection } = require('../config/db');

const VisitorModel = getCoreConnection().model('Visitor', visitorSchema);
try {
  getAnalyticsConnection().model('Visitor', visitorSchema);
} catch (e) {}

module.exports = VisitorModel;

