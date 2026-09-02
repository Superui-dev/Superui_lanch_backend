const mongoose = require('mongoose');
const { getCatalogReadConnections, getCatalogDb1Connection, getCatalogPrimaryConnection } = require('../config/db');

const imageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  key: { type: String },
  alt: { type: String, default: '' },
  order: { type: Number, default: 0 }
}, { _id: false });

const fileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  driveUrl: { type: String, required: true },
  size: { type: Number },
  mimeType: { type: String }
}, { _id: false });

const techStackItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  icon: { type: String, default: '' },
  color: { type: String, default: '#6B7280' },
  version: { type: String, default: '' }
}, { _id: false });

const featureItemSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  sortOrder: { type: Number, default: 0 }
}, { _id: false });

const productSchema = new mongoose.Schema({
  productId: {
    type: String,
    unique: true,
    index: true,
    immutable: true
  },
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
    trim: true,
    immutable: true
  },
  shortDescription: { type: String, trim: true, default: '' },
  description: { type: String, default: '' },

  sellingPrice: {
    type: Number,
    required: true,
    min: 0
  },
  originalPrice: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: function (v) { return v >= this.sellingPrice; },
      message: 'Original price must be greater than or equal to selling price'
    }
  },
  discountPercent: { type: Number, default: 0, min: 0, max: 100 },
  currency: { type: String, default: 'INR', uppercase: true },
  saleBadge: { type: String, default: '' },

  compareAtPrice: { type: Number, min: 0 },
  actualPrice: { type: Number, min: 0 },

  fileType: {
    type: String,
    enum: ['file', 'course', 'template', 'software', 'zip', 'other'],
    default: 'template'
  },
  isActive: { type: Boolean, default: true },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
    index: true
  },

  thumbnail: {
    url: { type: String, required: true },
    key: { type: String },
    alt: { type: String, default: '' }
  },
  images: { type: [imageSchema], default: [], validate: [(arr) => arr.length <= 5, 'Maximum 5 preview images allowed'] },

  technologies: { type: [techStackItemSchema], default: [] },
  features: { type: [featureItemSchema], default: [] },
  requirements: { type: [String], default: [] },
  highlights: { type: [String], default: [] },
  whatsIncluded: { type: [String], default: [] },

  liveUrl: { type: String, default: '' },
  demoUrl: { type: String, default: '' },
  preview: {
    enabled: { type: Boolean, default: false },
    url: { type: String },
    label: { type: String, default: 'Live Demo' }
  },
  documentation: {
    enabled: { type: Boolean, default: false },
    url: { type: String }
  },

  files: { type: [fileSchema], default: [], select: false },

  version: { type: String, default: '1.0.0' },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft',
    index: true
  },
  archivedAt: { type: Date, default: null },
  archivedReason: { type: String, default: '' },

  featured: { type: Boolean, default: false },
  tags: { type: [String], default: [] },
  metaTitle: { type: String, default: '' },
  metaDescription: { type: String, default: '' },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

productSchema.index({ status: 1, createdAt: -1 });
productSchema.index({ categoryId: 1, status: 1 });
productSchema.index({ tags: 1 });

productSchema.pre('validate', async function (next) {
  try {
    if (this.isNew && !this.productId) {
      const { generateCustomId } = require('../utils/idGenerator');
      this.productId = await generateCustomId('product_sup');
    }

    if (this.isModified('name') || this.isNew) {
      const baseSlug = (this.name || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '')
        .slice(0, 80) || `product-${Date.now()}`;

      if (!this.slug || this.isNew) {
        let candidate = baseSlug;
        let counter = 1;
        let exists = null;
        for (const conn of getCatalogReadConnections()) {
          try {
            const M = conn.model('Product');
            exists = await M.exists({ slug: candidate, _id: { $ne: this._id } });
          } catch (e) {}
          if (exists) break;
        }
        while (exists) {
          counter += 1;
          candidate = `${baseSlug}-${counter}`;
          exists = null;
          for (const conn of getCatalogReadConnections()) {
            try {
              const M = conn.model('Product');
              exists = await M.exists({ slug: candidate, _id: { $ne: this._id } });
            } catch (e) {}
            if (exists) break;
          }
        }
        this.slug = candidate;
      }
    }

    if (this.isModified('originalPrice') || this.isModified('sellingPrice') || this.isNew) {
      const op = Number(this.originalPrice) || 0;
      const sp = Number(this.sellingPrice) || 0;
      if (op > 0 && sp > 0 && op >= sp) {
        this.discountPercent = Math.round(((op - sp) / op) * 100);
      } else if (op > 0 && sp === op) {
        this.discountPercent = 0;
      }
    }

    if (this.isModified('status') && this.status === 'archived' && !this.archivedAt) {
      this.archivedAt = new Date();
    }
    if (this.isModified('status') && this.status !== 'archived') {
      this.archivedAt = null;
    }

    next();
  } catch (err) {
    next(err);
  }
});

productSchema.pre('findOneAndUpdate', async function (next) {
  const update = this.getUpdate();
  if (update && (update.$set || update.originalPrice !== undefined || update.sellingPrice !== undefined)) {
    const set = update.$set || update;
    const op = set.originalPrice;
    const sp = set.sellingPrice;
    if (op !== undefined && sp !== undefined && Number(op) > 0 && Number(sp) > 0 && Number(op) >= Number(sp)) {
      set.discountPercent = Math.round(((Number(op) - Number(sp)) / Number(op)) * 100);
    }
    if (set.status === 'archived' && !set.archivedAt) {
      set.archivedAt = new Date();
    }
    if (set.status && set.status !== 'archived') {
      set.archivedAt = null;
    }
    if (update.$set) {
      this.setUpdate(update);
    }
  }
  next();
});

productSchema.statics.generateNextProductId = async function () {
  const { generateCustomId } = require('../utils/idGenerator');
  return generateCustomId('product_sup');
};

function bindTo(conns) {
  for (const conn of conns) {
    try { conn.model('Product'); } catch (e) { conn.model('Product', productSchema); }
  }
}
bindTo(getCatalogReadConnections());

class ProductFacade {
  static get primary() {
    const conn = (require('../config/db').getCatalogPrimaryConnectionSync && require('../config/db').getCatalogPrimaryConnectionSync()) || getCatalogDb1Connection();
    try { return conn.model('Product'); } catch (e) { return conn.model('Product', productSchema); }
  }
  static get read() {
    const conns = getCatalogReadConnections();
    return {
      findOne: async (q) => {
        for (const c of conns) { try { const r = await c.model('Product').findOne(q).lean(); if (r) return r; } catch (e) {} }
        return null;
      },
      find: async (q, opts) => {
        const out = [];
        const seen = new Set();
        const sort = (opts && opts.sort) || { createdAt: -1 };
        for (const c of conns) {
          try {
            const docs = await c.model('Product').find(q || {}).sort(sort).lean();
            for (const d of docs) if (!seen.has(String(d._id))) { seen.add(String(d._id)); out.push(d); }
          } catch (e) {}
        }
        return out;
      },
      findById: async (id) => {
        for (const c of conns) { try { const r = await c.model('Product').findById(id).lean(); if (r) return r; } catch (e) {} }
        return null;
      },
      countDocuments: async (q) => {
        let total = 0;
        for (const c of conns) { try { total += await c.model('Product').countDocuments(q || {}); } catch (e) {} }
        return total;
      }
    };
  }
  static create(doc) { return ProductFacade.primary.create(doc); }
  static findById(id) { return ProductFacade.primary.findById(id); }
  static findByIdAndUpdate(id, update, opts) { return ProductFacade.primary.findByIdAndUpdate(id, update, opts); }
  static findByIdAndDelete(id) { return ProductFacade.primary.findByIdAndDelete(id); }
  static deleteOne(q) { return ProductFacade.primary.deleteOne(q); }
  static findOneAndUpdate(q, u, opts) { return ProductFacade.primary.findOneAndUpdate(q, u, opts); }
  static findOne(q, opts) { return ProductFacade.primary.findOne(q, opts); }
  static find(q, opts) { return ProductFacade.primary.find(q, opts); }
  static countDocuments(q) { return ProductFacade.primary.countDocuments(q); }
  static generateNextProductId() { return ProductFacade.primary.generateNextProductId(); }
  static async deleteMany(q) {
    let total = 0;
    for (const c of getCatalogReadConnections()) {
      try {
        const r = await c.model('Product').deleteMany(q);
        total += r.deletedCount || 0;
      } catch (e) {}
    }
    return { deletedCount: total };
  }
}

module.exports = ProductFacade;
module.exports.schema = productSchema;