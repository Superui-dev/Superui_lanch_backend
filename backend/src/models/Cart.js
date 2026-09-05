const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  status: { 
    type: String, 
    enum: ['active', 'converted', 'abandoned'], 
    default: 'active',
    index: true
  }
}, {
  timestamps: true
});

const { getCommerceConnection } = require('../config/db');

module.exports = getCommerceConnection().model('Cart', cartSchema);

