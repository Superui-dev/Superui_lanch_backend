const express = require('express');
const router = express.Router();
const publicController = require('../controllers/public.controller');
const serviceController = require('../controllers/service.controller');
const upcomingBannerController = require('../controllers/upcomingBanner.controller');
const invoiceController = require('../controllers/invoice.controller');
const { publicLimiter, strictLimiter } = require('../middleware/rateLimiter');

router.use(publicLimiter);

router.get('/categories', publicController.getCategories);
router.get('/testimonials', publicController.getTestimonials);
router.get('/services', serviceController.getPublicServices);
router.get('/services/:slug', serviceController.getPublicServiceBySlug);
router.get('/products', publicController.getProducts);
router.get('/products/:slug', publicController.getProductBySlug);
router.get('/products/:productId/reviews', publicController.getProductReviews);
router.get('/settings', publicController.getSiteSettings);
router.get('/hero-images', publicController.getHeroImages);
router.get('/upcoming-banners', upcomingBannerController.getPublicUpcomingBanners);

// Public Invoice Access
router.get('/invoice/:token', invoiceController.getInvoiceByToken);
router.get('/invoice/:token/download', invoiceController.downloadInvoiceByToken);

// Public Customer Feedback Submission (Stored in MongoDB)
router.post('/feedback', publicController.submitFeedback);

// Public Customer Issue Ticket Raising (Stored in MongoDB)
router.post('/issues', publicController.submitIssue);

// Book Project Discovery Call
router.post('/book-call', publicController.bookCall);
router.get('/booked-slots', publicController.getBookedSlots);
router.get('/instagram-avatar/:username', publicController.getInstagramAvatar);

// Anti-Inspection Security Alert & Login Attempt Alerts
router.post('/inspect-alert', strictLimiter, publicController.handleInspectAlert);
router.post('/login-attempt', strictLimiter, publicController.handleLoginAttempt);

module.exports = router;
