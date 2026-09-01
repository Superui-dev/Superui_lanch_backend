const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/admin.controller');

router.get('/', adminController.getCustomers.bind(adminController));
router.put('/:id/status', adminController.toggleCustomerStatus.bind(adminController));

module.exports = router;

