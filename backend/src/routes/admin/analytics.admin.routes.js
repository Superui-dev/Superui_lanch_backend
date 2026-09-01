const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/admin.controller');

router.get('/summary', adminController.getAnalyticsSummary.bind(adminController));
router.get('/visitors', adminController.getVisitorReport.bind(adminController));

module.exports = router;

