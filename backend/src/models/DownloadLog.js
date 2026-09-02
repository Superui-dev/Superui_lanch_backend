const mongoose = require('mongoose');

const downloadLogSchema = new mongoose.Schema({
  downloadTokenId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'DownloadToken', 
    required: true,
    index: true
  },
  orderId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Order', 
    required: true 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  productId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product', 
    required: true 
  },
  downloadedAt: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  ipAddress: { type: String, required: true },
  userAgent: { type: String },
  status: { 
    type: String, 
    enum: ['SUCCESS', 'FAILED', 'REVOKED', 'EXPIRED'], 
    required: true 
  }
}, {
  timestamps: false
});

const { getOperationsConnection } = require('../config/db');
module.exports = getOperationsConnection().model('DownloadLog', downloadLogSchema);

