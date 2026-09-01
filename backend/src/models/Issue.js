const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema(
  {
    customerId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      default: null,
      index: true 
    },
    name: {
      type: String,
      trim: true,
      default: 'Valued Customer'
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    issueType: {
      type: String,
      enum: ['Download Issue', 'Payment Problem', 'Bug Report', 'Custom Order', 'General Support'],
      default: 'Download Issue'
    },
    subject: {
      type: String,
      required: true,
      trim: true
    },
    message: { type: String }, // Table 12 alias
    description: {
      type: String,
      required: true,
      trim: true
    },
    adminReply: { type: String }, // Table 12 field
    orderId: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved', 'closed'],
      default: 'open'
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'high'
    }
  },
  {
    timestamps: true
  }
);

issueSchema.pre('save', function(next) {
  if (this.description && !this.message) {
    this.message = this.description;
  }
  next();
});

const { getPromotionsConnection } = require('../config/db');
module.exports = getPromotionsConnection().model('Issue', issueSchema);
