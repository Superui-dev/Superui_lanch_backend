const UpcomingBanner = require('../models/UpcomingBanner');
const logger = require('../utils/logger');
const { sendSuccess } = require('../utils/responses');
const { NotFoundError, BadRequestError } = require('../utils/errors');

const DEFAULT_BANNERS = [
  {
    title: 'Your Documents, Always accessible',
    bannerImage: 'https://cdn.digilocker.gov.in/digilocker-landing-page/assets/img/banner/web-banner-1.jpg',
    badge: 'DigiLocker Ecosystem • Digital India',
    headline: 'Your Documents, Always Accessible',
    subtitle: 'Access, share and instantly verify government-issued documents, certificates, and digital records anytime, anywhere.',
    link: '/products',
    order: 1,
    visible: true
  },
  {
    title: 'Now drive hassle-free with Digilocker',
    bannerImage: 'https://cdn.digilocker.gov.in/digilocker-landing-page/assets/img/banner/web-banner-2.jpg',
    badge: 'Ministry of Road Transport & Highways',
    headline: 'Now Drive Hassle-Free with DigiLocker',
    subtitle: 'Carry your digital Driving Licence and Vehicle RC legally valid across India on your mobile device.',
    link: '/products',
    order: 2,
    visible: true
  },
  {
    title: 'Indian Railways accept Digilocker as valid ID',
    bannerImage: 'https://cdn.digilocker.gov.in/digilocker-landing-page/assets/img/banner/web-banner-3.jpg',
    badge: 'Indian Railways & Digital ID',
    headline: 'Indian Railways Accept DigiLocker as Valid ID',
    subtitle: 'Seamless identity verification during train journeys with digitally signed government credentials.',
    link: '/products',
    order: 3,
    visible: true
  },
  {
    title: 'Airport entry get more easier now',
    bannerImage: 'https://cdn.digilocker.gov.in/digilocker-landing-page/assets/img/banner/web-banner-4.jpg',
    badge: 'DigiYatra • Ministry of Civil Aviation',
    headline: 'Airport Entry Made Faster & Seamless with DigiYatra',
    subtitle: 'Facial recognition and digital credentials for paperless airport terminal entries across major Indian airports.',
    link: '/products',
    order: 4,
    visible: true
  }
];

const seedDefaultsIfEmpty = async () => {
  try {
    const count = await UpcomingBanner.countDocuments();
    if (count === 0) {
      await UpcomingBanner.insertMany(DEFAULT_BANNERS);
      logger.info('Auto-seeded default upcoming product banners successfully.');
    }
  } catch (err) {
    logger.warn(`Upcoming banner seeding check error: ${err.message}`);
  }
};

// Public: Get visible banners
exports.getPublicUpcomingBanners = async (req, res, next) => {
  try {
    await seedDefaultsIfEmpty();
    const banners = await UpcomingBanner.find({ visible: true }).sort({ order: 1, createdAt: 1 }).lean();
    return sendSuccess(res, banners, 'Upcoming banners fetched successfully');
  } catch (error) {
    return next(error);
  }
};

// Admin: Get all banners
exports.getAdminUpcomingBanners = async (req, res, next) => {
  try {
    await seedDefaultsIfEmpty();
    const banners = await UpcomingBanner.find().sort({ order: 1, createdAt: 1 }).lean();
    return sendSuccess(res, banners, 'All upcoming banners fetched successfully');
  } catch (error) {
    return next(error);
  }
};

// Admin: Create banner
exports.createUpcomingBanner = async (req, res, next) => {
  try {
    const { title, bannerImage, badge, headline, subtitle, link, order, visible } = req.body;
    if (!title || !bannerImage) {
      throw new BadRequestError('Title and banner image are required.');
    }

    const banner = await UpcomingBanner.create({
      title,
      bannerImage,
      badge: badge || '',
      headline: headline || '',
      subtitle: subtitle || '',
      link: link || '/products',
      order: order !== undefined ? Number(order) : 0,
      visible: visible !== undefined ? Boolean(visible) : true
    });

    if (req.logAudit) {
      req.logAudit('CREATE_UPCOMING_BANNER', 'UpcomingBanner', banner._id, { title: banner.title }).catch(err => logger.warn(`Audit log failed: ${err.message}`));
    }

    return sendSuccess(res, banner, 'Upcoming banner created successfully', 201);
  } catch (error) {
    return next(error);
  }
};

// Admin: Update banner
exports.updateUpcomingBanner = async (req, res, next) => {
  try {
    const { id } = req.params;
    const banner = await UpcomingBanner.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    if (!banner) {
      throw new NotFoundError('Upcoming banner not found');
    }

    if (req.logAudit) {
      req.logAudit('UPDATE_UPCOMING_BANNER', 'UpcomingBanner', banner._id, { title: banner.title }).catch(err => logger.warn(`Audit log failed: ${err.message}`));
    }

    return sendSuccess(res, banner, 'Upcoming banner updated successfully');
  } catch (error) {
    return next(error);
  }
};

// Admin: Delete banner
exports.deleteUpcomingBanner = async (req, res, next) => {
  try {
    const { id } = req.params;
    const banner = await UpcomingBanner.findByIdAndDelete(id);
    if (!banner) {
      throw new NotFoundError('Upcoming banner not found');
    }

    if (req.logAudit) {
      req.logAudit('DELETE_UPCOMING_BANNER', 'UpcomingBanner', id, { title: banner.title }).catch(err => logger.warn(`Audit log failed: ${err.message}`));
    }

    return sendSuccess(res, null, 'Upcoming banner deleted successfully');
  } catch (error) {
    return next(error);
  }
};

// Admin: Reset to default banners
exports.resetUpcomingBanners = async (req, res, next) => {
  try {
    await UpcomingBanner.deleteMany({});
    const banners = await UpcomingBanner.insertMany(DEFAULT_BANNERS);
    if (req.logAudit) {
      req.logAudit('RESET_UPCOMING_BANNERS', 'UpcomingBanner', null, { count: banners.length }).catch(err => logger.warn(`Audit log failed: ${err.message}`));
    }
    return sendSuccess(res, banners, 'Upcoming banners reset to defaults successfully');
  } catch (error) {
    return next(error);
  }
};

