const mongoose = require('mongoose');

const heroImageSchema = new mongoose.Schema({
  imageUrl: { type: String, required: true },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  linkUrl: { type: String, default: '' },
  order: { type: Number, default: 0 },
  visible: { type: Boolean, default: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('HeroImage', heroImageSchema);
