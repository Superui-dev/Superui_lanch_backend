const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/admin.controller');

router.get('/', adminController.getHealthStatus.bind(adminController));
router.get('/integrations', adminController.getIntegrationsDashboard.bind(adminController));

module.exports = router;

