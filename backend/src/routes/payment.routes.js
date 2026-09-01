const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { strictLimiter, moderateLimiter } = require('../middleware/rateLimiter');
const zod = require('zod');

const { optionalAuthenticate } = require('../middleware/authenticate');

const checkoutSchema = zod.object({
  items: zod.array(zod.object({
    productId: zod.string(),
    quantity: zod.number().int().min(1).default(1)
  })),
  customerEmail: zod.string().email().optional(),
  customerName: zod.string().optional(),
  customerPhone: zod.string().optional()
});

const verifySchema = zod.object({
  orderId: zod.string(),
  paymentId: zod.string(),
  signature: zod.string()
});

router.post('/webhook', moderateLimiter, paymentController.handleWebhook.bind(paymentController));
router.post('/create-order', strictLimiter, optionalAuthenticate, validate({ body: checkoutSchema }), paymentController.createPaymentOrder.bind(paymentController));
router.post('/verify', moderateLimiter, optionalAuthenticate, validate({ body: verifySchema }), paymentController.verifyPayment.bind(paymentController));

module.exports = router;

