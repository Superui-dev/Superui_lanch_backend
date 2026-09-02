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

const { getOperationsConnection } = require('../config/db');

const AdminLogModel = getOperationsConnection().model('AdminLog', adminLogSchema);

module.exports = AdminLogModel;

