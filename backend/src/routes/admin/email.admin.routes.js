const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/admin.controller');

router.get('/logs', adminController.getEmailLogs.bind(adminController));
router.post('/send', adminController.sendManualEmail.bind(adminController));
router.get('/config-status', adminController.getEmailConfigStatus.bind(adminController));
router.get('/contact-counts', adminController.getEmailContactCounts.bind(adminController));

module.exports = router;

