const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
  {
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
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      default: 5
    },
    comment: {
      type: String,
      required: true,
      trim: true
    },
    recommend: {
      type: Boolean,
      default: true
    },
    orderId: {
      type: String,
      default: ''
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'approved'
    },
    featured: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

const { getPromotionsConnection } = require('../config/db');
module.exports = getPromotionsConnection().model('Feedback', feedbackSchema);
