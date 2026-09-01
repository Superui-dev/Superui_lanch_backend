const Contact = require('../models/Contact');
const telegramService = require('../services/telegram.service');
const { broadcastToAdmins } = require('../sockets/admin.namespace');
const events = require('../sockets/events');
const { sendSuccess } = require('../utils/responses');
const logger = require('../utils/logger');

class ContactController {
  // Submit contact message form
  async submitContactForm(req, res, next) {
    try {
      const { name, email, phone, subject, message } = req.body;
      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || req.ip || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Web Browser';

      // 1. Save in MongoDB
      const contact = await Contact.create({
        name,
        email,
        phone,
        message,
        status: 'new'
      });

      // 2. Dispatch Telegram notification via dedicated Contact Form Bot Token (8925715093:AAHK4wNZCVQofJmrebRsPozMuv5ZGQCXJ4A)
      telegramService.sendContactFormNotification({
        name,
        email,
        phone,
        subject,
        message,
        ip,
        userAgent
      }).catch(err => logger.warn(`Contact Telegram notification warning: ${err.message}`));

      // 3. Emit real-time dashboard socket event
      broadcastToAdmins(events.ADMIN_NEW_CONTACT, {
        contactId: contact._id,
        name,
        email,
        createdAt: contact.createdAt
      });

      return sendSuccess(res, contact, 'Contact message submitted successfully', 201);
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new ContactController();

