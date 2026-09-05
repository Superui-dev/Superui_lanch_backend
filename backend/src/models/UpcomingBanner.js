const mongoose = require('mongoose');
const { getCatalogDb1Connection } = require('../config/db');

const upcomingBannerSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  bannerImage: { type: String, required: true, trim: true },
  badge: { type: String, default: '', trim: true },
  headline: { type: String, default: '', trim: true },
  subtitle: { type: String, default: '', trim: true },
  link: { type: String, default: '/products', trim: true },
  order: { type: Number, default: 0 },
  visible: { type: Boolean, default: true }
}, {
  timestamps: true
});

module.exports = getCatalogDb1Connection().model('UpcomingBanner', upcomingBannerSchema);

