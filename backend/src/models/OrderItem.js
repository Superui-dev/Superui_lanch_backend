const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  orderId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Order', 
    required: true,
    index: true 
  },
  productId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product', 
    required: true 
  },
  productName: { 
    type: String, 
    required: true 
  },
  quantity: { 
    type: Number, 
    required: true, 
    min: 1 
  },
  unitPrice: { // Table 8 field
    type: Number,
    min: 0
  },
  actualPrice: { 
    type: Number, 
    required: true,
    min: 0
  },
  sellingPrice: { 
    type: Number, 
    required: true,
    min: 0
  },
  discount: { type: Number, default: 0, min: 0 }, // Table 8 field alias
  discountAmount: { 
    type: Number, 
    default: 0,
    min: 0
  },
  tax: { type: Number, default: 0, min: 0 }, // Table 8 field GST tax
  totalPrice: { type: Number, min: 0 }, // Table 8 field alias
  subtotal: { 
    type: Number, 
    required: true,
    min: 0
  }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

// Auto populate unitPrice & totalPrice if not set
orderItemSchema.pre('save', function(next) {
  if (this.sellingPrice && !this.unitPrice) {
    this.unitPrice = this.sellingPrice;
  }
  if (this.subtotal && !this.totalPrice) {
    this.totalPrice = this.subtotal;
  }
  next();
});

const { getUsersConnection } = require('../config/db');
module.exports = getUsersConnection().model('OrderItem', orderItemSchema);
