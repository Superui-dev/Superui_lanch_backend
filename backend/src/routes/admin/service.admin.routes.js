const express = require('express');
const router = express.Router();
const serviceController = require('../../controllers/service.controller');

router.get('/', serviceController.getAdminServices);
router.post('/', serviceController.createService);
router.put('/', serviceController.bulkSaveServices);
router.put('/:id', serviceController.updateService);
router.delete('/:id', serviceController.deleteService);

module.exports = router;

