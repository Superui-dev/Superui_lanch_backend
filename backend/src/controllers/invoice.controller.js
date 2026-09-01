const invoiceService = require('../services/invoice.service');
const Invoice = require('../models/Invoice');
const { sendSuccess } = require('../utils/responses');
const { NotFoundError, BadRequestError } = require('../utils/errors');
const logger = require('../utils/logger');

class InvoiceController {
  /**
   * GET /api/public/invoice/:token
   * Public endpoint to fetch clean invoice details securely via token.
   */
  async getInvoiceByToken(req, res, next) {
    try {
      const { token } = req.params;
      const invoice = await invoiceService.getInvoiceByToken(token);

      // Return a safe subset of the invoice data to protect internal IDs/hashes
      const safeInvoice = {
        invoiceNumber: invoice.invoiceNumber,
        createdAt: invoice.createdAt,
        orderNumber: invoice.orderId?.orderNumber,
        customerName: invoice.customerSnapshot.name,
        customerEmail: invoice.customerSnapshot.email,
        customerPhone: invoice.customerSnapshot.phone || '',
        billingAddress: invoice.billingSnapshot,
        shippingAddress: invoice.shippingSnapshot,
        items: invoice.itemsSnapshot.map(item => ({
          productName: item.productName,
          quantity: item.quantity,
          sellingPrice: item.sellingPrice,
          subtotal: item.subtotal
        })),
        subtotal: invoice.subtotal,
        discount: invoice.discount,
        tax: invoice.tax,
        gst: invoice.gst,
        shippingCharge: invoice.shippingCharge,
        totalAmount: invoice.totalAmount,
        currency: invoice.currency,
        paymentStatus: invoice.paymentStatus,
        paymentMethod: invoice.paymentId?.paymentMethod || 'Online Payment',
        invoiceStatus: invoice.invoiceStatus
      };

      return sendSuccess(res, safeInvoice, 'Invoice details fetched successfully');
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /api/public/invoice/:token/download
   * Public endpoint to download invoice PDF securely via token.
   */
  async downloadInvoiceByToken(req, res, next) {
    try {
      const { token } = req.params;
      const invoice = await invoiceService.getInvoiceByToken(token);

      const pdfStream = await invoiceService.getInvoicePDFStream(invoice);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`);
      
      pdfStream.pipe(res);
    } catch (error) {
      logger.error(`Error downloading PDF invoice: ${error.message}`);
      return next(error);
    }
  }

  /**
   * GET /api/admin/orders/:id/invoice
   * Admin-only endpoint to get complete invoice details by order ID.
   */
  async getInvoiceByOrderId(req, res, next) {
    try {
      const { id } = req.params; // orderId
      const invoice = await Invoice.findOne({ orderId: id })
        .populate('orderId', 'orderNumber orderStatus')
        .populate('paymentId', 'gatewayPaymentId paymentMethod paidAt');

      if (!invoice) {
        throw new NotFoundError('Invoice not found for this order');
      }

      return sendSuccess(res, invoice, 'Invoice retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /api/admin/orders/:id/invoice/download
   * Admin-only endpoint to download invoice PDF by order ID.
   */
  async downloadInvoiceByOrderId(req, res, next) {
    try {
      const { id } = req.params; // orderId
      const invoice = await Invoice.findOne({ orderId: id });
      if (!invoice) {
        throw new NotFoundError('Invoice not found for this order');
      }

      const pdfStream = await invoiceService.getInvoicePDFStream(invoice);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`);
      
      pdfStream.pipe(res);
    } catch (error) {
      logger.error(`Admin invoice download error: ${error.message}`);
      return next(error);
    }
  }
}

module.exports = new InvoiceController();

