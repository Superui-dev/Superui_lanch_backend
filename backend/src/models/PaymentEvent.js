const mongoose = require('mongoose');

const paymentEventSchema = new mongoose.Schema({
  eventId: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  eventType: { 
    type: String, 
    required: true 
  },
  payload: { 
    type: mongoose.Schema.Types.Mixed, 
    required: true 
  },
  processed: { 
    type: Boolean, 
    default: false,
    index: true
  },
  receivedAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: false
});

const { getOperationsConnection } = require('../config/db');
module.exports = getOperationsConnection().model('PaymentEvent', paymentEventSchema);

