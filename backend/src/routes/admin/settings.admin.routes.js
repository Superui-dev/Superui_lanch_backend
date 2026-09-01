const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/admin.controller');

router.put('/', adminController.updateSiteSettings.bind(adminController));

module.exports = router;

