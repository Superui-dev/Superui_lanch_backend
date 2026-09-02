const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ['order', 'payment', 'contact', 'system'], 
    required: true,
    index: true 
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  targetRole: { 
    type: String, 
    enum: ['admin', 'user'], 
    default: 'admin',
    index: true 
  },
  targetUserId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    default: null,
    index: true 
  },
  read: { 
    type: Boolean, 
    default: false,
    index: true 
  }
}, {
  timestamps: { createdAt: true, updatedAt: true }
});

const { getOperationsConnection } = require('../config/db');
module.exports = getOperationsConnection().model('Notification', notificationSchema);

