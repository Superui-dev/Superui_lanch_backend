const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/admin.controller');

// GET all products for admin (all statuses: published, draft, archived)
router.get('/', adminController.listAdminProducts.bind(adminController));
router.post('/', adminController.createProduct.bind(adminController));
router.put('/:id', adminController.updateProduct.bind(adminController));
router.delete('/:id', adminController.deleteProduct.bind(adminController));

module.exports = router;

