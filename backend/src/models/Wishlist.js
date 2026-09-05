const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    unique: true, 
    index: true 
  },
  productIds: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product' 
  }]
}, {
  timestamps: true
});

const { getCommerceConnection } = require('../config/db');

module.exports = getCommerceConnection().model('Wishlist', wishlistSchema);
