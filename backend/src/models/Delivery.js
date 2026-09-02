const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema({
  deliveryNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true
  },
  trackingNumber: { 
    type: String 
  },
  carrier: { 
    type: String 
  },
  status: {
    type: String,
    enum: ['PENDING', 'SHIPPED', 'DELIVERED', 'FAILED', 'RETURNED'],
    default: 'PENDING',
    index: true
  },
  deliveredAt: { 
    type: Date 
  }
}, {
  timestamps: true
});

// Auto-generate deliveryNumber on validate
deliverySchema.pre('validate', async function(next) {
  if (this.isNew && !this.deliveryNumber) {
    try {
      const { generateCustomId } = require('../utils/idGenerator');
      this.deliveryNumber = await generateCustomId('delivery');
    } catch (err) {
      return next(err);
    }
  }
  next();
});

const { getOperationsConnection } = require('../config/db');
module.exports = getOperationsConnection().model('Delivery', deliverySchema);

