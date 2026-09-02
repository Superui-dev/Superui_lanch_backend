const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  customerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    default: null,
    index: true 
  },
  formType: { 
    type: String, 
    enum: ['contact', 'enquiry', 'demo', 'lead', 'other'], 
    default: 'contact',
    index: true 
  },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  subject: { type: String, trim: true },
  message: { type: String, required: true },
  source: { type: String, default: 'website', trim: true },
  ipAddress: { type: String },
  status: { 
    type: String, 
    enum: ['new', 'contacted', 'replied', 'spam', 'closed'], 
    default: 'new',
    index: true
  },
  repliedAt: { type: Date }
}, {
  timestamps: { createdAt: true, updatedAt: true }
});

const { getOperationsConnection } = require('../config/db');
module.exports = getOperationsConnection().model('Contact', contactSchema);
