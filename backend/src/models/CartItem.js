const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  cartId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Cart', 
    required: true,
    index: true
  },
  productId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product', 
    required: true 
  },
  quantity: { 
    type: Number, 
    required: true, 
    default: 1,
    min: 1 
  },
  addedAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: false
});

module.exports = mongoose.model('CartItem', cartItemSchema);

