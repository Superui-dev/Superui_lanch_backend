const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  orderId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Order', 
    required: true,
    index: true 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: false
  },
  gateway: { 
    type: String, 
    required: true, 
    default: 'razorpay' 
  },
  gatewayOrderId: { type: String },
  gatewayPaymentId: { 
    type: String, 
    index: { unique: true, sparse: true } 
  },
  gatewaySignature: { 
    type: String, 
    select: false
  },
  amount: { 
    type: Number, 
    required: true,
    min: 0
  },
  currency: { 
    type: String, 
    default: 'INR', 
    uppercase: true 
  },
  paymentMethod: { type: String },
  paymentStatus: { 
    type: String, 
    enum: [
      'PENDING', 'AUTHORIZED', 'CAPTURED', 'SUCCESS', 
      'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED'
    ], 
    default: 'PENDING',
    index: true
  },
  paymentNumber: {
    type: String,
    unique: true,
    index: true
  },
  failureCode: { type: String },
  failureReason: { type: String },
  errorDescription: { type: String },
  rawResponse: { type: mongoose.Schema.Types.Mixed },
  paidAt: { type: Date },
  failedAt: { type: Date }
}, {
  timestamps: true
});

// Auto-generate paymentNumber on validate
paymentSchema.pre('validate', async function(next) {
  if (this.isNew && !this.paymentNumber) {
    try {
      const { generateCustomId } = require('../utils/idGenerator');
      this.paymentNumber = await generateCustomId('payment');
    } catch (err) {
      return next(err);
    }
  }
  next();
});

const { getUsersConnection } = require('../config/db');
module.exports = getUsersConnection().model('Payment', paymentSchema);

