const mongoose = require('mongoose');
const { getCoreConnection } = require('../config/db');

const menuItemSchema = new mongoose.Schema({
  label: { type: String, required: true },
  url: { type: String, required: true },
  visible: { type: Boolean, default: true },
  order: { type: Number, default: 0 }
}, { _id: false });

const footerLinkSchema = new mongoose.Schema({
  label: { type: String, required: true },
  url: { type: String, required: true },
  visible: { type: Boolean, default: true }
}, { _id: false });

const footerColumnSchema = new mongoose.Schema({
  title: { type: String, required: true },
  links: [footerLinkSchema]
}, { _id: false });

const siteSettingsSchema = new mongoose.Schema({
  _id: { 
    type: String, 
    default: 'site_settings'
  },
  branding: {
    logo: {
      url: { type: String, default: '' },
      alt: { type: String, default: '' },
      width: { type: Number, default: 40 }
    },
    logoText: { type: String, default: 'SuperUI' },
    logoSubText: { type: String, default: '' },
    showLogo: { type: Boolean, default: true },
    showLogoText: { type: Boolean, default: true }
  },
  navbar: {
    menuItems: [menuItemSchema],
    showLogin: { type: Boolean, default: true },
    showRegister: { type: Boolean, default: true },
    showCart: { type: Boolean, default: true }
  },
  footer: {
    description: { type: String, default: '' },
    columns: [footerColumnSchema],
    copyright: { type: String, default: '' }
  },
  contact: {
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    supportHours: { type: String, default: '' }
  },
  socialLinks: {
    instagram: { type: String, default: '' },
    facebook: { type: String, default: '' },
    youtube: { type: String, default: '' },
    linkedin: { type: String, default: '' },
    telegram: { type: String, default: '' }
  },
  seo: {
    title: { type: String, default: 'SuperUI' },
    description: { type: String, default: '' },
    keywords: [String],
    ogImage: { type: String, default: '' }
  },
  pricing: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  hero: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  services: {
    type: [{
      title: { type: String, required: true },
      description: { type: String, required: true },
      image: { type: String, required: true },
      link: { type: String, default: '/contact' },
      order: { type: Number, default: 0 },
      visible: { type: Boolean, default: true }
    }],
    default: []
  },
  telegram: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: { createdAt: false, updatedAt: true }
});

const coreConnection = getCoreConnection();
const SiteSettings = coreConnection.model('SiteSettings', siteSettingsSchema);

module.exports = SiteSettings;

