const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/admin.controller');

router.get('/', adminController.getHeroImages.bind(adminController));
router.post('/', adminController.createHeroImage.bind(adminController));
router.put('/:id', adminController.updateHeroImage.bind(adminController));
router.delete('/:id', adminController.deleteHeroImage.bind(adminController));

module.exports = router;
