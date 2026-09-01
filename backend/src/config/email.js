const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// Helper function to create standard SMTP transport.
// Strictly requires prefix-specific configuration variables.
function createSMTPTransport(prefix, label) {
  const host = process.env[`${prefix}_HOST`];
  const port = parseInt(process.env[`${prefix}_PORT`], 10) || 587;
  const user = process.env[`${prefix}_USER`];
  const pass = process.env[`${prefix}_API_KEY`] || process.env[`${prefix}_PASS`];
  const from = process.env[`${prefix}_FROM`];

  if (!host || !user || !pass || !from) {
    if (process.env.NODE_ENV === 'production') {
      logger.error(`PRODUCTION ERROR: Email transport details for [${label}] are missing!`);
    } else {
      logger.warn(`Email transport details for [${label}] are partially missing. Using dummy sandbox transport.`);
    }
    return {
      sendMail: async (options) => {
        logger.debug(`Sandbox SMTP [${label}] Mock Send: to=${options.to}, subject=${options.subject}`);
        return { messageId: 'dummy-id-' + Math.random().toString(36).substring(7) };
      },
      fromAddress: from || 'placeholder@yourdomain.com',
      host: host || 'sandbox.smtp',
      port: port
    };
  }

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for other ports
    auth: {
      user,
      pass
    }
  });

  return {
    sendMail: transport.sendMail.bind(transport),
    fromAddress: from,
    host,
    port
  };
}

const delivery1 = createSMTPTransport('EMAIL_DELIVERY1', 'Delivery 1 (Mailgun)');
const delivery2 = createSMTPTransport('EMAIL_DELIVERY2', 'Delivery 2 (SendGrid)');
const admin = createSMTPTransport('EMAIL_ADMIN', 'Admin (Alerts & Fallback)');

module.exports = {
  delivery1,
  delivery2,
  admin
};
