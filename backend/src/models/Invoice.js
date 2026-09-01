const mongoose = require('mongoose');

const addressSnapshotSchema = new mongoose.Schema({
  label: { type: String },
  line1: { type: String },
  line2: { type: String },
  city: { type: String },
  state: { type: String },
  pincode: { type: String },
  country: { type: String }
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    unique: true, // Unique constraint to prevent duplicate invoices per order
    index: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    index: true
  },
  
  // Historical Snapshots
  customerSnapshot: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String }
  },
  billingSnapshot: addressSnapshotSchema,
  shippingSnapshot: addressSnapshotSchema,
  
  itemsSnapshot: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true },
    sellingPrice: { type: Number, required: true },
    subtotal: { type: Number, required: true }
  }],
  
  // Financial Details
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  discount: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  tax: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  gst: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  shippingCharge: {
    type: Number,
    required: true,
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
    required: true,
    default: 'INR',
    uppercase: true
  },
  
  // Statuses
  paymentStatus: {
    type: String,
    required: true,
    default: 'PENDING'
  },
  invoiceStatus: {
    type: String,
    required: true,
    enum: ['ISSUED', 'PAID', 'CANCELLED'],
    default: 'ISSUED',
    index: true
  },
  
  // Storage and Secure Tokens
  pdfStorageKey: {
    type: String
  },
  pdfBase64: {
    type: String
  },
  accessTokenHash: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  tokenExpiresAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Auto-generate invoiceNumber on validate
invoiceSchema.pre('validate', async function(next) {
  if (this.isNew && !this.invoiceNumber) {
    try {
      const { generateCustomId } = require('../utils/idGenerator');
      this.invoiceNumber = await generateCustomId('invoice');
    } catch (err) {
      return next(err);
    }
  }
  next();
});

const { getUsersConnection } = require('../config/db');
module.exports = getUsersConnection().model('Invoice', invoiceSchema);

