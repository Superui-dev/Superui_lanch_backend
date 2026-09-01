const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  instagramId: { type: String, trim: true },
  phone: { type: String, trim: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  message: { type: String, trim: true },
  status: { 
    type: String, 
    enum: ['scheduled', 'completed', 'cancelled'], 
    default: 'scheduled',
    index: true
  },
  callVerified: { type: Boolean, default: false },
  callVerificationCode: { type: String, trim: true },
  callNotes: { type: String, trim: true }
}, {
  timestamps: { createdAt: true, updatedAt: true }
});

const { getPromotionsConnection } = require('../config/db');
module.exports = getPromotionsConnection().model('Booking', bookingSchema);
