const express = require('express');
const router = express.Router();
const downloadController = require('../controllers/download.controller');
const { strictLimiter } = require('../middleware/rateLimiter');

router.get('/:token', strictLimiter, downloadController.downloadProductFiles);

module.exports = router;

