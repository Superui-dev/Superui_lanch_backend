const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema({
  type: { 
    type: String, 
    required: true,
    index: true 
  },
  emailType: { type: String }, // Table 11 field
  customerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    default: null,
    index: true 
  },
  orderId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Order',
    default: null,
    index: true 
  },
  relatedOrderId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Order',
    default: null,
    index: true 
  },
  fromAddress: { type: String, required: true },
  toAddress: { type: String, required: true, index: true },
  toEmail: { type: String }, // Table 11 alias
  subject: { type: String, required: true },
  status: { 
    type: String, 
    required: true,
    index: true 
  },
  providerMsgId: { type: String }, // Table 11 field
  emailNumber: {
    type: String,
    unique: true,
    index: true
  },
  errorMessage: { type: String, default: null },
  sentAt: { type: Date } // Table 11 field
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

emailLogSchema.pre('save', function(next) {
  if (this.toAddress && !this.toEmail) {
    this.toEmail = this.toAddress;
  }
  if (this.relatedOrderId && !this.orderId) {
    this.orderId = this.relatedOrderId;
  }
  if (this.status === 'sent' && !this.sentAt) {
    this.sentAt = new Date();
  }
  next();
});

// Auto-generate emailNumber on validate with fallback
emailLogSchema.pre('validate', async function(next) {
  if (this.isNew && !this.emailNumber) {
    try {
      const { generateCustomId } = require('../utils/idGenerator');
      this.emailNumber = await generateCustomId('email');
    } catch (err) {
      this.emailNumber = `EML-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }
  }
  next();
});

const { getCoreConnection, getSecurityConnection } = require('../config/db');

const EmailLogModel = getCoreConnection().model('EmailLog', emailLogSchema);
try {
  getSecurityConnection().model('EmailLog', emailLogSchema);
} catch (e) {}

module.exports = EmailLogModel;
