const mongoose = require('mongoose');

const downloadTokenSchema = new mongoose.Schema({
  orderId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Order', 
    required: true,
    index: true 
  },
  orderItemId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'OrderItem', 
    required: true 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true 
  },
  customerId: { // Table 10 alias
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    index: true 
  },
  productId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product', 
    required: true 
  },
  downloadToken: { type: String }, // Table 10 field
  tokenHash: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  filePath: { type: String }, // Table 10 field
  expiresAt: { type: Date, required: true },
  maxDownloads: { type: Number, required: true, default: 5 },
  downloadCount: { type: Number, required: true, default: 0 },
  downloadNumber: {
    type: String,
    unique: true,
    index: true
  },
  lastDownloadedAt: { type: Date, default: null },
  lastDownloadAt: { type: Date, default: null }, // Table 10 alias
  revokedAt: { type: Date, default: null } // admin kill-switch
}, {
  timestamps: true
});

downloadTokenSchema.pre('save', function(next) {
  if (this.userId && !this.customerId) {
    this.customerId = this.userId;
  }
  if (this.lastDownloadedAt && !this.lastDownloadAt) {
    this.lastDownloadAt = this.lastDownloadedAt;
  }
  next();
});

// Auto-generate downloadNumber on validate
downloadTokenSchema.pre('validate', async function(next) {
  if (this.isNew && !this.downloadNumber) {
    try {
      const { generateCustomId } = require('../utils/idGenerator');
      this.downloadNumber = await generateCustomId('download');
    } catch (err) {
      return next(err);
    }
  }
  next();
});

const { getOperationsConnection } = require('../config/db');
module.exports = getOperationsConnection().model('DownloadToken', downloadTokenSchema);
