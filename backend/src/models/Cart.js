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

module.exports = mongoose.model('Cart', cartSchema);

