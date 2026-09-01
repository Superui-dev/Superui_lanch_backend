const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contact.controller');
const validate = require('../middleware/validate');
const { strictLimiter } = require('../middleware/rateLimiter');
const zod = require('zod');

const contactSchema = zod.object({
  name: zod.string().min(1, 'Name is required'),
  email: zod.string().email('Valid email is required'),
  phone: zod.string().optional().nullable(),
  message: zod.string().min(5, 'Message must be at least 5 characters long')
});

router.post('/', strictLimiter, validate({ body: contactSchema }), contactController.submitContactForm);

module.exports = router;

