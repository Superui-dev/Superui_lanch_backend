const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    trim: true 
  },
  slug: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true,
    lowercase: true,
    trim: true
  },
  order: { type: Number, default: 0 },
  visible: { type: Boolean, default: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('Category', categorySchema);

