const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/admin.controller');

router.get('/', adminController.getBookings.bind(adminController));
router.put('/:id/status', adminController.updateBookingStatus.bind(adminController));
router.put('/:id/verify-call', adminController.verifyCall.bind(adminController));

module.exports = router;
