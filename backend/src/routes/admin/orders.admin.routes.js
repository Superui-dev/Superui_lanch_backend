const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/admin.controller');
const invoiceController = require('../../controllers/invoice.controller');

router.get('/', adminController.getOrders.bind(adminController));
router.put('/:id/cancel', adminController.cancelOrder.bind(adminController));

// Admin Invoice endpoints
router.get('/:id/invoice', invoiceController.getInvoiceByOrderId.bind(invoiceController));
router.get('/:id/invoice/download', invoiceController.downloadInvoiceByOrderId.bind(invoiceController));

module.exports = router;

