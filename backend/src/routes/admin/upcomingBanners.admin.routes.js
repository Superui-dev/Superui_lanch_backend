const express = require('express');
const router = express.Router();
const upcomingBannerController = require('../../controllers/upcomingBanner.controller');

router.get('/', upcomingBannerController.getAdminUpcomingBanners);
router.post('/', upcomingBannerController.createUpcomingBanner);
router.post('/reset', upcomingBannerController.resetUpcomingBanners);
router.put('/:id', upcomingBannerController.updateUpcomingBanner);
router.delete('/:id', upcomingBannerController.deleteUpcomingBanner);

module.exports = router;

