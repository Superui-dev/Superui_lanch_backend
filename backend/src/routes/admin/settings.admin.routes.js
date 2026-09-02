const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/admin.controller');

router.put('/', adminController.updateSiteSettings.bind(adminController));

// Testimonials CRUD Routes
router.get('/testimonials', adminController.getTestimonials.bind(adminController));
router.post('/testimonials', adminController.createTestimonial.bind(adminController));
router.put('/testimonials/:id', adminController.updateTestimonial.bind(adminController));
router.delete('/testimonials/:id', adminController.deleteTestimonial.bind(adminController));

// Page Configuration Panel (JSON Format) Routes
router.get('/page-config', adminController.getPageConfig.bind(adminController));
router.put('/page-config', adminController.updatePageConfig.bind(adminController));

module.exports = router;

