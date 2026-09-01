const crypto = require('crypto');
const razorpay = require('../config/razorpay');
const logger = require('../utils/logger');
const { BadRequestError } = require('../utils/errors');

class RazorpayService {
  async createOrder(amount, currency = 'INR', receipt = '') {
    try {
      const amountInPaise = Math.round(amount * 100);

      const options = {
        amount: amountInPaise,
        currency,
        receipt,
        payment_capture: 1
      };

      const razorpayOrder = await razorpay.orders.create(options);
      logger.info(`Razorpay order created successfully: ${razorpayOrder.id} for amount: ${amount}`);
      return razorpayOrder;
    } catch (error) {
      logger.error(`Razorpay order creation failed: ${error.message}`);
      throw new BadRequestError(`Payment gateway order creation failed: ${error.message}`);
    }
  }

  verifySignature(orderId, paymentId, signature) {
    if (!orderId || !paymentId || !signature) {
      return false;
    }

    try {
      const secret = process.env.RAZORPAY_KEY_SECRET;
      if (!secret) {
        throw new Error('RAZORPAY_KEY_SECRET is missing from configurations');
      }

      const body = orderId + '|' + paymentId;
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(body.toString())
        .digest('hex');

      const isValid = expectedSignature.length === signature.length &&
        crypto.timingSafeEqual(Buffer.from(expectedSignature, 'hex'), Buffer.from(signature, 'hex'));
      if (isValid) {
        logger.info(`Razorpay signature verified successfully for payment ${paymentId}`);
      } else {
        logger.warn(`Razorpay signature verification failed for payment ${paymentId}`);
      }

      return isValid;
    } catch (error) {
      logger.error(`Error verifying Razorpay signature: ${error.message}`);
      return false;
    }
  }

  async fetchPayment(paymentId) {
    if (!paymentId) {
      throw new Error('Payment ID is required to fetch payment details');
    }
    try {
      const paymentDetails = await razorpay.payments.fetch(paymentId);
      logger.info(`Fetched Razorpay payment details for ${paymentId}`);
      return paymentDetails;
    } catch (error) {
      logger.error(`Error fetching payment details from Razorpay: ${error.message}`);
      throw error;
    }
  }

  verifyWebhookSignature(rawBody, signatureHeader) {
    if (!rawBody || !signatureHeader) {
      return false;
    }

    try {
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
      if (!webhookSecret) {
        throw new Error('RAZORPAY_WEBHOOK_SECRET is missing');
      }

      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

      return expectedSignature.length === signatureHeader.length &&
        crypto.timingSafeEqual(Buffer.from(expectedSignature, 'hex'), Buffer.from(signatureHeader, 'hex'));
    } catch (error) {
      logger.error(`Error verifying Razorpay webhook signature: ${error.message}`);
      return false;
    }
  }
}

module.exports = new RazorpayService();

