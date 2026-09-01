const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');
const validate = require('../middleware/validate');
const zod = require('zod');

const pageviewSchema = zod.object({
  visitorId: zod.string(),
  sessionId: zod.string(),
  page: zod.string(),
  referrer: zod.string().optional().or(zod.literal(''))
});

router.post('/pageview', validate({ body: pageviewSchema }), analyticsController.recordPageView);

module.exports = router;

