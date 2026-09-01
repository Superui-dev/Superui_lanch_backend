const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  key: { type: String },
  alt: { type: String },
  order: { type: Number, default: 0 }
}, { _id: false });

const fileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  driveUrl: { type: String, required: true },
  size: { type: Number },
  mimeType: { type: String }
}, { _id: false });

const productSchema = new mongoose.Schema({
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
  shortDescription: { type: String, trim: true },
  description: { type: String },
  price: { 
    type: Number, 
    required: true, 
    min: 0 
  },
  compareAtPrice: { type: Number, min: 0 },
  actualPrice: { type: Number, min: 0 }, // Table 6 field alias
  currency: { type: String, default: 'INR', uppercase: true },
  fileType: { 
    type: String, 
    enum: ['file', 'course', 'template', 'software', 'zip', 'other'], 
    default: 'template' 
  },
  isActive: { type: Boolean, default: true }, // Table 6 field
  categoryId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Category', 
    required: true,
    index: true 
  },
  thumbnail: {
    url: { type: String, required: true },
    key: { type: String },
    alt: { type: String }
  },
  images: [imageSchema],
  technologies: [{
    name: { type: String },
    icon: { type: String }
  }],
  features: [String],
  requirements: [String],
  preview: {
    enabled: { type: Boolean, default: false },
    url: { type: String },
    label: { type: String, default: 'Live Demo' }
  },
  documentation: {
    enabled: { type: Boolean, default: false },
    url: { type: String }
  },
  files: [fileSchema],
  version: { type: String, default: '1.0.0' },
  status: { 
    type: String, 
    enum: ['draft', 'published', 'archived'], 
    default: 'published' 
  },
  productCode: {
    type: String,
    unique: true,
    index: true
  },
  featured: { type: Boolean, default: false },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Auto-generate productCode on validate
productSchema.pre('validate', async function(next) {
  if (this.isNew && !this.productCode) {
    try {
      const { generateCustomId } = require('../utils/idGenerator');
      this.productCode = await generateCustomId('product');
    } catch (err) {
      return next(err);
    }
  }
  next();
});

module.exports = mongoose.model('Product', productSchema);
