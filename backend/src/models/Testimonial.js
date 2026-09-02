const mongoose = require('mongoose');
const { getCatalogDb1Connection } = require('../config/db');

const testimonialSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  role: { type: String, required: true, trim: true },
  text: { type: String, required: true, trim: true },
  avatar: { type: String, default: '' },
  initials: { type: String, default: '' },
  rating: { type: Number, default: 5, min: 1, max: 5 },
  order: { type: Number, default: 0 },
  visible: { type: Boolean, default: true }
}, {
  timestamps: true
});

const coreConnection = getCatalogDb1Connection();
const Testimonial = coreConnection.model('Testimonial', testimonialSchema);

module.exports = Testimonial;

