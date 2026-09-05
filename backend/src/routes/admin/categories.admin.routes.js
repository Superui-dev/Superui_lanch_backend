const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/admin.controller');
const publicController = require('../../controllers/public.controller');

router.get('/', publicController.getCategories.bind(publicController));
router.put('/reorder', adminController.reorderCategories.bind(adminController));
router.post('/', adminController.createCategory.bind(adminController));
router.put('/:id', adminController.updateCategory.bind(adminController));
router.delete('/:id', adminController.deleteCategory.bind(adminController));

module.exports = router;

