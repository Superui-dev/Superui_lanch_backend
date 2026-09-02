const mongoose = require('mongoose');
const { getCatalogReadConnections, getCatalogPrimaryConnectionSync, getCatalogDb1Connection } = require('../config/db');

const productImageSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true,
    immutable: true
  },
  url: { type: String, required: true },
  key: { type: String, default: '' },
  alt: { type: String, default: '' },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true });

const productTechStackSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true,
    immutable: true
  },
  name: { type: String, required: true, trim: true },
  icon: { type: String, default: '' },
  color: { type: String, default: '#6B7280' },
  version: { type: String, default: '' },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true });

const productFeatureSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true,
    immutable: true
  },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true });

const productHighlightSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true,
    immutable: true
  },
  text: { type: String, required: true, trim: true },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true });

const productFAQSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true,
    immutable: true
  },
  question: { type: String, required: true, trim: true },
  answer: { type: String, required: true },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true });

const productVersionSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true,
    immutable: true
  },
  version: { type: String, required: true },
  changelog: { type: String, default: '' },
  releasedAt: { type: Date, default: Date.now }
}, { timestamps: true });

productImageSchema.index({ productId: 1, sortOrder: 1 });
productTechStackSchema.index({ productId: 1, sortOrder: 1 });
productFeatureSchema.index({ productId: 1, sortOrder: 1 });
productHighlightSchema.index({ productId: 1, sortOrder: 1 });
productFAQSchema.index({ productId: 1, sortOrder: 1 });
productVersionSchema.index({ productId: 1, releasedAt: -1 });

function bindAll(modelName, schema) {
  for (const conn of getCatalogReadConnections()) {
    try { conn.model(modelName); } catch (e) { conn.model(modelName, schema); }
  }
}
bindAll('ProductImage', productImageSchema);
bindAll('ProductTechStack', productTechStackSchema);
bindAll('ProductFeature', productFeatureSchema);
bindAll('ProductHighlight', productHighlightSchema);
bindAll('ProductFAQ', productFAQSchema);
bindAll('ProductVersion', productVersionSchema);

function facadeFor(modelName, schema) {
  return {
    primary: () => {
      const conn = getCatalogPrimaryConnectionSync();
      try { return conn.model(modelName); } catch (e) { return conn.model(modelName, schema); }
    },
    findAllForProduct: async (productId) => {
      const out = [];
      const conns = getCatalogReadConnections();
      for (const c of conns) {
        try { out.push(...await c.model(modelName).find({ productId }).sort({ sortOrder: 1 }).lean()); } catch (e) {}
      }
      return out;
    },
    replaceForProduct: async (productId, docs) => {
      const conn = getCatalogPrimaryConnectionSync();
      const Model = (() => { try { return conn.model(modelName); } catch (e) { return conn.model(modelName, schema); } })();
      await Model.deleteMany({ productId });
      if (docs.length) await Model.insertMany(docs.map((d, idx) => ({ ...d, productId, sortOrder: d.sortOrder ?? idx })));
    }
  };
}

module.exports = {
  ProductImage: facadeFor('ProductImage', productImageSchema),
  ProductTechStack: facadeFor('ProductTechStack', productTechStackSchema),
  ProductFeature: facadeFor('ProductFeature', productFeatureSchema),
  ProductHighlight: facadeFor('ProductHighlight', productHighlightSchema),
  ProductFAQ: facadeFor('ProductFAQ', productFAQSchema),
  ProductVersion: facadeFor('ProductVersion', productVersionSchema)
};