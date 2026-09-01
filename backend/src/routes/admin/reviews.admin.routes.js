const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/admin.controller');

router.get('/', adminController.getReviews.bind(adminController));
router.put('/:id/status', adminController.updateReviewStatus.bind(adminController));

module.exports = router;

