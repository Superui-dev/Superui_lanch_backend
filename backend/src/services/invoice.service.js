const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const Invoice = require('../models/Invoice');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const User = require('../models/User');
const { hashToken } = require('../utils/hash');
const logger = require('../utils/logger');
const { NotFoundError, BadRequestError } = require('../utils/errors');

class InvoiceService {
  /**
   * Generates a PDF buffer for the invoice.
   * @param {Object} invoice 
   * @returns {Promise<Buffer>}
   */
  async generatePDFBuffer(invoice) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const chunks = [];
        
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', err => reject(err));

        // Company Details & Invoice Header
        doc.fillColor('#4F46E5').fontSize(26).text('SuperUI', 50, 50);
        doc.fillColor('#4B5563').fontSize(9).text('123 Premium Web Templates Ave', 50, 80);
        doc.text('New Delhi, India, 110001 | hello@superui.in', 50, 93);
        doc.text('https://superui.in', 50, 106);

        // Right Aligned Invoice Info
        doc.fillColor('#1F2937').fontSize(14).text(`INVOICE: ${invoice.invoiceNumber}`, 350, 50, { align: 'right' });
        doc.fillColor('#4B5563').fontSize(9);
        doc.text(`Date: ${new Date(invoice.createdAt || Date.now()).toLocaleDateString()}`, 350, 70, { align: 'right' });
        doc.text(`Order Number: ${invoice.orderId?.orderNumber || invoice.orderId}`, 350, 83, { align: 'right' });
        doc.text(`Payment Status: ${invoice.paymentStatus}`, 350, 96, { align: 'right' });

        doc.moveTo(50, 125).lineTo(550, 125).stroke('#E5E7EB');

        // Customer & Shipping Addresses (Snapshots)
        doc.fillColor('#1F2937').fontSize(10).text('Bill To:', 50, 140);
        doc.fillColor('#4B5563').fontSize(9);
        doc.text(`Name: ${invoice.customerSnapshot.name}`, 50, 155);
        doc.text(`Email: ${invoice.customerSnapshot.email}`, 50, 168);
        if (invoice.customerSnapshot.phone) {
          doc.text(`Phone: ${invoice.customerSnapshot.phone}`, 50, 181);
        }

        // Addresses
        const billing = invoice.billingSnapshot;
        doc.fillColor('#1F2937').fontSize(10).text('Address:', 300, 140);
        doc.fillColor('#4B5563').fontSize(9);
        if (billing && billing.line1) {
          doc.text(`${billing.line1}${billing.line2 ? ', ' + billing.line2 : ''}`, 300, 155);
          doc.text(`${billing.city}, ${billing.state} - ${billing.pincode}`, 300, 168);
          doc.text(`${billing.country}`, 300, 181);
        } else {
          doc.text('Not Specified (Digital Delivery)', 300, 155);
        }

        doc.moveTo(50, 205).lineTo(550, 205).stroke('#E5E7EB');

        // Items Table
        let y = 225;
        doc.fillColor('#1F2937').fontSize(9);
        doc.text('Product Name', 50, y);
        doc.text('Qty', 350, y, { width: 30, align: 'right' });
        doc.text('Price', 400, y, { width: 60, align: 'right' });
        doc.text('Amount', 480, y, { width: 70, align: 'right' });

        doc.moveTo(50, y + 15).lineTo(550, y + 15).stroke('#F3F4F6');
        y += 25;

        doc.fillColor('#4B5563');
        for (const item of invoice.itemsSnapshot) {
          doc.text(item.productName, 50, y, { width: 280 });
          doc.text(item.quantity.toString(), 350, y, { width: 30, align: 'right' });
          doc.text(`${invoice.currency} ${item.sellingPrice.toFixed(2)}`, 400, y, { width: 60, align: 'right' });
          doc.text(`${invoice.currency} ${item.subtotal.toFixed(2)}`, 480, y, { width: 70, align: 'right' });
          y += 20;
        }

        doc.moveTo(50, y).lineTo(550, y).stroke('#E5E7EB');
        y += 15;

        // Pricing Summary block
        const summaryX = 350;
        doc.fillColor('#1F2937');
        doc.text('Subtotal:', summaryX, y);
        doc.text(`${invoice.currency} ${invoice.subtotal.toFixed(2)}`, 480, y, { width: 70, align: 'right' });
        y += 15;

        if (invoice.discount > 0) {
          doc.text('Discount:', summaryX, y);
          doc.text(`-${invoice.currency} ${invoice.discount.toFixed(2)}`, 480, y, { width: 70, align: 'right' });
          y += 15;
        }

        if (invoice.tax > 0) {
          doc.text('GST / Tax:', summaryX, y);
          doc.text(`${invoice.currency} ${invoice.tax.toFixed(2)}`, 480, y, { width: 70, align: 'right' });
          y += 15;
        }

        if (invoice.shippingCharge > 0) {
          doc.text('Shipping:', summaryX, y);
          doc.text(`${invoice.currency} ${invoice.shippingCharge.toFixed(2)}`, 480, y, { width: 70, align: 'right' });
          y += 15;
        }

        doc.moveTo(350, y).lineTo(550, y).stroke('#E5E7EB');
        y += 10;

        doc.fontSize(11).fillColor('#1F2937').text('Total Amount:', summaryX, y);
        doc.text(`${invoice.currency} ${invoice.totalAmount.toFixed(2)}`, 480, y, { width: 70, align: 'right' });

        // Footer Disclaimer
        y += 60;
        doc.fontSize(8).fillColor('#9CA3AF').text('This is a computer-generated invoice and does not require a physical signature.', 50, y, { align: 'center' });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Generates a new invoice from a completed Order.
   * Assumes payment has been verified successfully.
   * Idempotent: returns existing invoice if already created.
   *
   * @param {string} orderId 
   * @param {string} paymentId 
   * @param {Object} [session] Optional mongoose session for transaction safety
   * @returns {Promise<{ invoice: Object, rawToken: string }>}
   */
  async createInvoiceFromOrder(orderId, paymentId, session = null) {
    if (!orderId) {
      throw new Error('Order ID is required to generate an invoice');
    }

    // 1. Idempotency Check: return existing invoice if already exists
    const query = { orderId };
    const existingInvoice = session 
      ? await Invoice.findOne(query).session(session)
      : await Invoice.findOne(query);

    if (existingInvoice) {
      logger.info(`Invoice already exists for order ${orderId}. Rotating token and returning existing copy.`);
      const rawToken = crypto.randomBytes(32).toString('hex');
      existingInvoice.accessTokenHash = hashToken(rawToken);
      existingInvoice.tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      if (session) {
        await existingInvoice.save({ session });
      } else {
        await existingInvoice.save();
      }
      return { invoice: existingInvoice, rawToken };
    }

    // 2. Fetch Order and dependencies
    const order = session 
      ? await Order.findById(orderId).session(session)
      : await Order.findById(orderId);
      
    if (!order) {
      throw new NotFoundError('Order not found for invoice generation');
    }

    const user = session
      ? await User.findById(order.userId).session(session)
      : await User.findById(order.userId);
      
    if (!user) {
      throw new NotFoundError('User associated with order not found');
    }

    const orderItems = session
      ? await OrderItem.find({ orderId: order._id }).session(session)
      : await OrderItem.find({ orderId: order._id });

    if (!orderItems || orderItems.length === 0) {
      throw new BadRequestError('Order items not found for invoice generation');
    }

    // 3. Billing & Shipping Address extraction
    let defaultAddress = user.addresses?.find(addr => addr.isDefault);
    if (!defaultAddress && user.addresses?.length > 0) {
      defaultAddress = user.addresses[0];
    }

    const addressSnapshot = defaultAddress ? {
      label: defaultAddress.label || 'Home',
      line1: defaultAddress.line1,
      line2: defaultAddress.line2 || '',
      city: defaultAddress.city,
      state: defaultAddress.state,
      pincode: defaultAddress.pincode,
      country: defaultAddress.country || 'IN'
    } : {
      label: 'Default',
      line1: 'Not Specified',
      line2: '',
      city: 'Not Specified',
      state: 'Not Specified',
      pincode: '000000',
      country: 'IN'
    };

    // 4. Map snapshots
    const customerSnapshot = {
      userId: user._id,
      name: order.customerName || user.name || user.email.split('@')[0],
      email: order.customerEmail || user.email,
      phone: user.phone || ''
    };

    const itemsSnapshot = orderItems.map(item => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      sellingPrice: item.sellingPrice,
      subtotal: item.subtotal
    }));

    // 5. Generate secure customer access token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const accessTokenHash = hashToken(rawToken);
    
    // Expires in 30 days
    const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // 6. Create Invoice record
    const [invoice] = await Invoice.create([{
      orderId: order._id,
      customerId: user._id,
      paymentId: paymentId || null,
      customerSnapshot,
      billingSnapshot: addressSnapshot,
      shippingSnapshot: addressSnapshot,
      itemsSnapshot,
      subtotal: order.subtotal,
      discount: order.discountAmount || 0,
      tax: order.taxAmount || 0,
      gst: order.taxAmount || 0,
      shippingCharge: 0,
      totalAmount: order.totalAmount,
      currency: order.currency || 'INR',
      paymentStatus: 'SUCCESS',
      invoiceStatus: 'PAID',
      accessTokenHash,
      tokenExpiresAt
    }], session ? { session } : {});

    logger.info(`Invoice ${invoice.invoiceNumber} created in DB for order ${order.orderNumber}`);

    // 7. Generate PDF and store as base64 in database
    try {
      const pdfBuffer = await this.generatePDFBuffer(invoice);
      invoice.pdfBase64 = pdfBuffer.toString('base64');
      invoice.pdfStorageKey = `invoice-${invoice.invoiceNumber}.pdf`;
      await invoice.save();
      logger.info(`Successfully stored PDF invoice ${invoice.invoiceNumber} in database`);
    } catch (pdfErr) {
      logger.error(`Error generating PDF invoice: ${pdfErr.message}`);
    }

    return { invoice, rawToken };
  }

  /**
   * Validates access token and finds invoice details.
   * @param {string} rawToken 
   * @returns {Promise<Object>}
   */
  async getInvoiceByToken(rawToken) {
    if (!rawToken) {
      throw new BadRequestError('Secure token is required to access invoice');
    }

    const tokenHash = hashToken(rawToken);
    const invoice = await Invoice.findOne({ accessTokenHash: tokenHash })
      .populate('orderId', 'orderNumber orderStatus createdAt')
      .populate('paymentId', 'gatewayPaymentId paymentMethod paidAt');

    if (!invoice) {
      throw new NotFoundError('Invoice not found or access link is invalid');
    }

    if (invoice.tokenExpiresAt && new Date() > invoice.tokenExpiresAt) {
      throw new BadRequestError('This invoice link has expired');
    }

    return invoice;
  }

  /**
   * Fetches an invoice and returns a readable stream of the PDF from database.
   * @param {Object} invoice 
   */
  async getInvoicePDFStream(invoice) {
    if (!invoice.pdfBase64) {
      // Regenerate PDF if it doesn't exist
      try {
        const pdfBuffer = await this.generatePDFBuffer(invoice);
        invoice.pdfBase64 = pdfBuffer.toString('base64');
        invoice.pdfStorageKey = `invoice-${invoice.invoiceNumber}.pdf`;
        await invoice.save();
      } catch (genErr) {
        logger.error(`Failed to generate missing PDF: ${genErr.message}`);
        throw new Error('Invoice PDF document not ready');
      }
    }

    // Convert base64 back to buffer and return as readable stream
    const { Readable } = require('stream');
    const pdfBuffer = Buffer.from(invoice.pdfBase64, 'base64');
    const stream = new Readable();
    stream.push(pdfBuffer);
    stream.push(null);
    return stream;
  }
}

module.exports = new InvoiceService();
