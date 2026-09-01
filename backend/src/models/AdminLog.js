const mongoose = require('mongoose');

const adminLogSchema = new mongoose.Schema({
  adminUserId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: false,
    index: true 
  },
  action: { 
    type: String, 
    required: true,
    index: true
  },
  resource: { type: String, required: true },
  resourceId: { type: mongoose.Schema.Types.ObjectId },
  metadata: { type: mongoose.Schema.Types.Mixed },
  timestamp: { 
    type: Date, 
    default: Date.now,
    index: true
  }
}, {
  timestamps: false
});

const { getCoreConnection, getSecurityConnection } = require('../config/db');

const AdminLogModel = getCoreConnection().model('AdminLog', adminLogSchema);
try {
  getSecurityConnection().model('AdminLog', adminLogSchema);
} catch (e) {}

module.exports = AdminLogModel;

