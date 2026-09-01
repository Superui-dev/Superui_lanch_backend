const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/admin.controller');

router.post('/', adminController.createProduct.bind(adminController));
router.put('/:id', adminController.updateProduct.bind(adminController));
router.delete('/:id', adminController.deleteProduct.bind(adminController));

module.exports = router;

