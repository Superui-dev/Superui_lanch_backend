const Razorpay = require('razorpay');
const logger = require('../utils/logger');

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || !keySecret) {
  logger.error('Razorpay Key ID or Key Secret is missing from environment variables!');
}

const razorpay = new Razorpay({
  key_id: keyId || 'placeholder',
  key_secret: keySecret || 'placeholder'
});

module.exports = razorpay;

