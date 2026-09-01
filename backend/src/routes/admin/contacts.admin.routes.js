const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/admin.controller');

router.get('/', adminController.getContacts.bind(adminController));
router.put('/:id/status', adminController.updateContactStatus.bind(adminController));

module.exports = router;

