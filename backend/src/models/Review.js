const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  productId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product', 
    required: true,
    index: true 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true 
  },
  rating: { 
    type: Number, 
    required: true, 
    min: 1, 
    max: 5 
  },
  comment: { 
    type: String, 
    trim: true,
    required: true 
  },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'hidden'], 
    default: 'pending',
    index: true 
  }
}, {
  timestamps: true
});

const { getCatalogDb1Connection } = require('../config/db');

module.exports = getCatalogDb1Connection().model('Review', reviewSchema);

