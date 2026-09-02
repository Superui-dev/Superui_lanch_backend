const mongoose = require('mongoose');
const { getCatalogDb1Connection, getCatalogDb2Connection, getCatalogReadConnections, getCatalogPrimaryConnectionSync, getCatalogPrimaryConnection } = require('../config/db');

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
    trim: true,
    immutable: true
  },
  description: { type: String, default: '' },
  icon: { type: String, default: '' },
  color: { type: String, default: '#6B7280' },
  order: { type: Number, default: 0 },
  visible: { type: Boolean, default: true },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null,
    index: true
  },
  productType: {
    type: String,
    enum: ['ui-component', 'website-template', 'portfolio', 'ebook', 'source-code', 'free-resource', 'blog'],
    default: 'website-template'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

categorySchema.index({ parentId: 1, order: 1 });
categorySchema.index({ productType: 1, order: 1 });

categorySchema.virtual('children', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parentId'
});

categorySchema.virtual('productCount', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'categoryId',
  count: true
});

categorySchema.pre('validate', async function (next) {
  try {
    if (this.isNew && !this.slug) {
      const base = (this.name || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '')
        .slice(0, 80);
      let candidate = base || `category-${Date.now()}`;
      let counter = 1;
      let exists = null;
      for (const conn of getCatalogReadConnections()) {
        try { exists = await conn.model('Category').exists({ slug: candidate, _id: { $ne: this._id } }); } catch (e) {}
        if (exists) break;
      }
      while (exists) {
        counter += 1;
        candidate = `${base}-${counter}`;
        exists = null;
        for (const conn of getCatalogReadConnections()) {
          try { exists = await conn.model('Category').exists({ slug: candidate, _id: { $ne: this._id } }); } catch (e) {}
          if (exists) break;
        }
      }
      this.slug = candidate;
    }
    next();
  } catch (err) {
    next(err);
  }
});

function bind(conns) {
  for (const conn of conns) {
    try { conn.model('Category'); } catch (e) { conn.model('Category', categorySchema); }
  }
}
bind(getCatalogReadConnections());

class CategoryFacade {
  static get primary() {
    const conn = getCatalogPrimaryConnectionSync();
    try { return conn.model('Category'); } catch (e) { return conn.model('Category', categorySchema); }
  }
  static get read() {
    const conns = getCatalogReadConnections();
    return {
      find: async (q, opts) => {
        const out = [];
        const seen = new Set();
        const sort = (opts && opts.sort) || { order: 1 };
        for (const c of conns) {
          try {
            const docs = await c.model('Category').find(q || {}).sort(sort).lean();
            for (const d of docs) if (!seen.has(String(d._id))) { seen.add(String(d._id)); out.push(d); }
          } catch (e) {}
        }
        return out;
      },
      findOne: async (q) => {
        for (const c of conns) { try { const r = await c.model('Category').findOne(q).lean(); if (r) return r; } catch (e) {} }
        return null;
      },
      findById: async (id) => {
        for (const c of conns) { try { const r = await c.model('Category').findById(id).lean(); if (r) return r; } catch (e) {} }
        return null;
      }
    };
  }
  static create(doc) { return CategoryFacade.primary.create(doc); }
  static findByIdAndUpdate(id, update, opts) { return CategoryFacade.primary.findByIdAndUpdate(id, update, opts); }
  static findOneAndUpdate(q, update, opts) { return CategoryFacade.primary.findOneAndUpdate(q, update, opts); }
  static findByIdAndDelete(id) { return CategoryFacade.primary.findByIdAndDelete(id); }
  static findOne(q) { return CategoryFacade.primary.findOne(q); }
  static find(q, opts) { return CategoryFacade.primary.find(q, opts); }
  static countDocuments(q) { return CategoryFacade.primary.countDocuments(q); }
  static async deleteMany(q) {
    let total = 0;
    for (const c of getCatalogReadConnections()) {
      try {
        const r = await c.model('Category').deleteMany(q);
        total += r.deletedCount || 0;
      } catch (e) {}
    }
    return { deletedCount: total };
  }
}

module.exports = CategoryFacade;
module.exports.schema = categorySchema;