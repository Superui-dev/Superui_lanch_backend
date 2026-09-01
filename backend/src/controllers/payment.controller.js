const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const Payment = require('../models/Payment');
const PaymentEvent = require('../models/PaymentEvent');
const Product = require('../models/Product');
const Delivery = require('../models/Delivery');
const Invoice = require('../models/Invoice');
const pricingService = require('../services/pricing.service');
const razorpayService = require('../services/razorpay.service');
const downloadService = require('../services/download.service');
const emailService = require('../services/email.service');
const invoiceService = require('../services/invoice.service');
const { broadcastToAdmins } = require('../sockets/admin.namespace');
const events = require('../sockets/events');
const { BadRequestError, NotFoundError } = require('../utils/errors');
const { sendSuccess } = require('../utils/responses');
const logger = require('../utils/logger');
const mongoose = require('mongoose');
const { getUsersConnection } = require('../config/db');

class PaymentController {
  // 1. Checkout (Creates order on DB + Razorpay Order)
  async createPaymentOrder(req, res, next) {
    const conn = Order.db || getUsersConnection();
    let session = null;

    try {
      const User = require('../models/User');
      const { items, customerEmail: bodyEmail, customerName: bodyName, customerPhone: bodyPhone } = req.body;
      const customerEmail = (bodyEmail || req.user?.email || 'customer@example.com').toLowerCase().trim();
      const customerName = bodyName || req.user?.name || (customerEmail ? customerEmail.split('@')[0] : 'Customer');

      let userId = req.user?._id || null;

      if (!userId && customerEmail) {
        let existingUser = await User.findOne({ email: customerEmail });
        if (!existingUser) {
          existingUser = await User.create({
            authUserId: `cust_checkout_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            email: customerEmail,
            name: customerName,
            phone: bodyPhone || '',
            role: 'customer',
            status: 'active'
          });
        }
        userId = existingUser._id;
      }

      session = await conn.startSession();
      session.startTransaction();

      if (!items || items.length === 0) {
        throw new BadRequestError('Cannot checkout with empty items list');
      }

      const checkoutPrice = await pricingService.calculatePrice(items, userId);

      const [order] = await Order.create([{
        userId,
        subtotal: checkoutPrice.subtotal,
        discountAmount: 0,
        taxAmount: checkoutPrice.taxAmount,
        totalAmount: checkoutPrice.totalAmount,
        currency: 'INR',
        orderStatus: 'PENDING',
        paymentStatus: 'PENDING',
        fulfillmentStatus: 'PENDING',
        customerEmail,
        customerName
      }], { session });

      const orderItemsToCreate = checkoutPrice.items.map(item => ({
        orderId: order._id,
        productId: item.productId,
        productName: item.name,
        quantity: item.quantity,
        actualPrice: item.compareAtPrice || item.price,
        sellingPrice: item.price,
        discountAmount: 0,
        subtotal: item.subtotal
      }));
      await OrderItem.create(orderItemsToCreate, { session });

      let gatewayOrder;
      try {
        gatewayOrder = await razorpayService.createOrder(
          checkoutPrice.totalAmount,
          'INR',
          order._id.toString()
        );
      } catch (rzpErr) {
        logger.error(`Razorpay order creation failed, rolling back DB transaction: ${rzpErr.message}`);
        throw rzpErr;
      }

      const [payment] = await Payment.create([{
        orderId: order._id,
        userId,
        gateway: 'razorpay',
        gatewayOrderId: gatewayOrder.id,
        amount: checkoutPrice.totalAmount,
        currency: 'INR',
        paymentStatus: 'PENDING'
      }], { session });

      await session.commitTransaction();
      session.endSession();

      return sendSuccess(res, {
        gatewayOrderId: gatewayOrder.id,
        amount: gatewayOrder.amount,
        keyId: process.env.RAZORPAY_KEY_ID,
        orderId: order._id
      }, 'Checkout transaction initialized successfully');

    } catch (error) {
      if (session && session.inTransaction()) {
        try { await session.abortTransaction(); } catch (abortErr) {}
      }
      if (session) {
        try { session.endSession(); } catch (e) {}
      }
      return next(error);
    }
  }

  // 2. Verify Payment (Client-driven success flow)
  async verifyPayment(req, res, next) {
    try {
      const { orderId, paymentId, signature } = req.body;

      const order = await Order.findById(orderId);
      if (!order) {
        throw new NotFoundError('Order not found');
      }

      if (order.paymentStatus === 'SUCCESS') {
        return sendSuccess(res, order, 'Payment was already verified and processed');
      }

      const payment = await Payment.findOne({ orderId: order._id });
      if (!payment) {
        throw new NotFoundError('Payment session not found');
      }

      // First Verification: Cryptographic signature check
      const isValidFirst = razorpayService.verifySignature(payment.gatewayOrderId, paymentId, signature);
      if (!isValidFirst) {
        throw new BadRequestError('Payment verification failed (First check failed)');
      }

      // Delay for 500 milliseconds before performing the second check
      await new Promise(resolve => setTimeout(resolve, 500));

      // Second Verification: API status check or fallback signature check
      let isValidSecond = false;
      const isPlaceholderKey = !process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET.includes('your_razorpay');

      if (isPlaceholderKey) {
        // Fallback: in development/test with fake credentials, perform a second local signature check
        isValidSecond = razorpayService.verifySignature(payment.gatewayOrderId, paymentId, signature);
      } else {
        try {
          const paymentDetails = await razorpayService.fetchPayment(paymentId);
          const expectedAmountInPaise = Math.round(order.totalAmount * 100);
          if (
            paymentDetails &&
            (paymentDetails.status === 'captured' || paymentDetails.status === 'authorized') &&
            paymentDetails.amount === expectedAmountInPaise &&
            paymentDetails.order_id === payment.gatewayOrderId
          ) {
            isValidSecond = true;
          }
        } catch (apiErr) {
          logger.error(`API payment fetch failed during second verification: ${apiErr.message}`);
          isValidSecond = false;
        }
      }

      if (!isValidSecond) {
        throw new BadRequestError('Payment verification failed (Second check failed)');
      }

      // Process payment capture flow
      await this.finalizeOrderPayment(order, payment, paymentId, signature, {
        method: 'card/upi', // Razorpay widget details will be synced on webhook
        raw: { clientHandshake: true }
      });

      return sendSuccess(res, order, 'Payment verified and files delivered');
    } catch (error) {
      return next(error);
    }
  }

  // Helper method to finalize the payment, generate tokens and email delivery
  async finalizeOrderPayment(order, payment, gatewayPaymentId, gatewaySignature, metadata = {}) {
    const conn = Order.db || getUsersConnection();
    const session = await conn.startSession();
    session.startTransaction();

    let rawInvoiceToken = null;

    try {
      // Reload order and payment to ensure we have the transaction context
      const freshOrder = await Order.findById(order._id).session(session);
      if (freshOrder.paymentStatus === 'SUCCESS') {
        await session.abortTransaction();
        session.endSession();
        return;
      }

      const freshPayment = await Payment.findById(payment._id).session(session);

      const now = new Date();

      // Update payment record
      freshPayment.paymentStatus = 'SUCCESS';
      freshPayment.gatewayPaymentId = gatewayPaymentId;
      freshPayment.gatewaySignature = gatewaySignature;
      freshPayment.paymentMethod = metadata.method || 'unknown';
      freshPayment.rawResponse = metadata.raw || {};
      freshPayment.paidAt = now;
      await freshPayment.save({ session });

      // Update order record
      freshOrder.orderStatus = 'PAID';
      freshOrder.paymentStatus = 'SUCCESS';
      freshOrder.fulfillmentStatus = 'DELIVERED';
      freshOrder.paidAt = now;
      await freshOrder.save({ session });

      // Create Delivery record (deliveryNumber is auto-generated by its pre-validate hook)
      await Delivery.create([{
        orderId: freshOrder._id,
        status: 'DELIVERED',
        deliveredAt: now
      }], { session });

      // Create Invoice record with snapshots and generate token/PDF
      const { invoice, rawToken } = await invoiceService.createInvoiceFromOrder(
        freshOrder._id,
        freshPayment._id,
        session
      );
      rawInvoiceToken = rawToken;

      // Load order items
      const items = await OrderItem.find({ orderId: freshOrder._id }).session(session);

      // Generate secure download tokens for each item
      const deliveryTokens = [];
      for (const item of items) {
        const rawToken = await downloadService.generateToken(
          freshOrder._id,
          item._id,
          freshOrder.userId,
          item.productId,
          5 // limit to 5 downloads
        );

        deliveryTokens.push({
          productName: item.productName,
          tokenValue: rawToken
        });
      }

      await session.commitTransaction();
      session.endSession();

      // Asynchronously trigger email delivery & socket updates (outside the write lock)
      try {
        await emailService.sendProductEmail(freshOrder.customerEmail, freshOrder, items, deliveryTokens, rawInvoiceToken);
        logger.info(`Product delivery email sent to: ${freshOrder.customerEmail}`);
      } catch (mailErr) {
        logger.error(`Product email delivery failed for Order ${freshOrder.orderNumber}: ${mailErr.message}`);
      }

      // Push real-time event to Admin WebSocket namespace
      broadcastToAdmins(events.ADMIN_NEW_ORDER, {
        orderId: freshOrder._id,
        orderNumber: freshOrder.orderNumber,
        customerName: freshOrder.customerName,
        totalAmount: freshOrder.totalAmount,
        paidAt: now
      });

      // Push real-time event to public/storefront root WebSocket namespace
      try {
        const { getIo } = require('../sockets');
        const io = getIo();
        if (io) {
          io.emit('storefront:new-order', {
            customerName: freshOrder.customerName,
            productName: items.map(item => item.productName).join(', '),
            totalAmount: freshOrder.totalAmount,
            paidAt: now
          });
        }
      } catch (wsErr) {
        logger.error(`Storefront WS broadcast failed: ${wsErr.message}`);
      }

    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      session.endSession();
      logger.error(`Failed to finalize order payment: ${error.message}`);
      throw error;
    }
  }

  // 3. Webhook (Source of Truth, Idempotent)
  async handleWebhook(req, res, next) {
    try {
      const signatureHeader = req.headers['x-razorpay-signature'];
      
      // Verify webhook signature (using raw body buffer parsed in app.js)
      const isValid = razorpayService.verifyWebhookSignature(req.rawBody, signatureHeader);
      if (!isValid) {
        logger.warn('Unauthorized Razorpay webhook signature verification failed.');
        return res.status(400).send('Invalid signature');
      }

      const payload = JSON.parse(req.rawBody.toString());
      const eventId = payload.id;
      const eventType = payload.event;

      logger.info(`Received Razorpay webhook event: ${eventType} (Event ID: ${eventId})`);

      // Idempotency: verify if webhook event was already processed
      const existingEvent = await PaymentEvent.findOne({ eventId });
      if (existingEvent) {
        logger.info(`Razorpay Webhook event ${eventId} already processed. Acknowledging with 200.`);
        return res.status(200).json({ success: true, message: 'Event already processed' });
      }

      // Save webhook log
      const webhookEvent = await PaymentEvent.create({
        eventId,
        eventType,
        payload,
        processed: false
      });

      const paymentPayload = payload.payload.payment.entity;
      const gatewayOrderId = paymentPayload.order_id;
      const gatewayPaymentId = paymentPayload.id;

      if (eventType === 'payment.captured') {
        const payment = await Payment.findOne({ gatewayOrderId });
        if (payment) {
          const order = await Order.findById(payment.orderId);
          if (order && order.paymentStatus !== 'SUCCESS') {
            await this.finalizeOrderPayment(order, payment, gatewayPaymentId, 'webhook_verified', {
              method: paymentPayload.method,
              raw: payload
            });
          }
        }
      } else if (eventType === 'payment.failed') {
        const payment = await Payment.findOne({ gatewayOrderId });
        if (payment) {
          payment.paymentStatus = 'FAILED';
          payment.failureCode = paymentPayload.error_code;
          payment.failureReason = paymentPayload.error_reason;
          payment.errorDescription = paymentPayload.error_description;
          payment.rawResponse = payload;
          await payment.save();

          await Order.findByIdAndUpdate(payment.orderId, {
            paymentStatus: 'FAILED',
            orderStatus: 'PENDING' // Keep order pending to allow customer retry
          });

          // Broadcast failure to Admin dashboard
          broadcastToAdmins(events.ADMIN_PAYMENT_FAILED, {
            gatewayOrderId,
            gatewayPaymentId,
            reason: paymentPayload.error_description
          });
        }
      }

      webhookEvent.processed = true;
      await webhookEvent.save();

      return res.status(200).json({ success: true });
    } catch (error) {
      logger.error(`Webhook processing failed: ${error.message}`);
      return next(error);
    }
  }
}

module.exports = new PaymentController();

