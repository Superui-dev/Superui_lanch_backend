const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/admin.controller');

router.get('/logs', adminController.getDownloadLogs.bind(adminController));
router.put('/tokens/:id/revoke', adminController.revokeDownloadToken.bind(adminController));

module.exports = router;

