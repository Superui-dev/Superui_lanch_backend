const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: false,
    index: true 
  },
  customerId: { // Table 7 alias
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    index: true
  },
  subtotal: { 
    type: Number, 
    required: true,
    min: 0
  },
  discountAmount: { 
    type: Number, 
    default: 0,
    min: 0
  },
  taxAmount: { 
    type: Number, 
    default: 0,
    min: 0
  },
  totalAmount: { 
    type: Number, 
    required: true,
    min: 0
  },
  currency: { 
    type: String, 
    default: 'INR', 
    uppercase: true 
  },
  paymentId: { // Table 7 reference to Payment
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Payment',
    default: null 
  },
  orderStatus: { 
    type: String, 
    enum: ['PENDING', 'processing', 'PAID', 'CANCELLED', 'COMPLETED'], 
    default: 'PENDING',
    index: true
  },
  paymentStatus: { 
    type: String, 
    enum: [
      'PENDING', 'pending', 'AUTHORIZED', 'CAPTURED', 'SUCCESS', 'success', 
      'FAILED', 'failed', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED'
    ], 
    default: 'PENDING',
    index: true
  },
  fulfillmentStatus: { 
    type: String, 
    enum: ['PENDING', 'DELIVERED', 'REVOKED'], 
    default: 'PENDING',
    index: true
  },
  customerEmail: { type: String, required: true },
  customerName: { type: String, required: true },
  paidAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  completedAt: { type: Date, default: null }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Sync customerId alias
orderSchema.pre('save', function(next) {
  if (this.userId && !this.customerId) {
    this.customerId = this.userId;
  }
  next();
});

// Auto-generate orderNumber on validate
orderSchema.pre('validate', async function(next) {
  if (this.isNew && !this.orderNumber) {
    try {
      const { generateCustomId } = require('../utils/idGenerator');
      this.orderNumber = await generateCustomId('order');
    } catch (err) {
      return next(err);
    }
  }
  next();
});

const { getCommerceConnection } = require('../config/db');
module.exports = getCommerceConnection().model('Order', orderSchema);
