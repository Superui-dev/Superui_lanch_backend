const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/admin.controller');

router.get('/logs', adminController.getSecurityLogs.bind(adminController));

module.exports = router;

