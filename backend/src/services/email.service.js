const { delivery1, delivery2, admin } = require('../config/email');
const EmailLog = require('../models/EmailLog');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.sendCounter = 0;
  }

  async sendProductEmail(toAddress, order, items, tokens, invoiceToken) {
    const subject = `Your SuperUI Download is Ready - Order #${order.orderNumber}`;
    
    const itemsHtml = items.map(item => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee;"><strong>${item.productName}</strong></td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">INR ${item.sellingPrice}</td>
      </tr>
    `).join('');
 
    const linksHtml = tokens.map(t => `
      <div style="margin: 20px 0; padding: 15px; background: #f9f9f9; border-radius: 5px; border-left: 4px solid #4F46E5;">
        <p style="margin: 0 0 10px 0; font-weight: bold; color: #333;">${t.productName}</p>
        <a href="${process.env.FRONTEND_ORIGIN}/products?access_token=${t.productAccessToken}" 
           style="background: #4F46E5; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; display: inline-block; font-size: 14px;">
           View Product Page
        </a>
        <a href="${process.env.FRONTEND_ORIGIN}/download/${t.tokenValue}" 
           style="background: #10B981; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; display: inline-block; font-size: 14px; margin-left: 10px;">
           Download Product Files
        </a>
        <p style="margin: 8px 0 0 0; font-size: 11px; color: #666;">Expires in 15 minutes. Limited to 5 downloads.</p>
      </div>
    `).join('');

    let invoiceHtml = '';
    if (invoiceToken) {
      invoiceHtml = `
        <div style="margin: 25px 0; padding: 20px; background: #ECFDF5; border-radius: 6px; border-left: 4px solid #10B981; text-align: center;">
          <p style="margin: 0 0 12px 0; font-weight: bold; color: #065F46;">Your purchase invoice is ready</p>
          <a href="${process.env.FRONTEND_ORIGIN}/invoice/${invoiceToken}" 
             style="background: #10B981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 15px;">
             View Invoice & Details
          </a>
        </div>
      `;
    }
 
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="color: #4F46E5; text-align: center;">Thank You for Your Order!</h2>
        <p>Hello ${order.customerName},</p>
        <p>Your payment has been successfully verified. Below are your purchase details, instant download links, and invoice access link.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Product</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
            <tr>
              <td style="padding: 12px; font-weight: bold; border-top: 2px solid #ddd;">Total Paid</td>
              <td style="padding: 12px; font-weight: bold; text-align: right; border-top: 2px solid #ddd;">INR ${order.totalAmount}</td>
            </tr>
          </tbody>
        </table>
 
        ${invoiceHtml}
 
        <h3>Download Links</h3>
        <p>Click the buttons below to download your templates. For security reasons, link validation expires shortly.</p>
        ${linksHtml}

        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="font-size: 12px; color: #888; text-align: center;">
          Need help? Reply to this email or visit our support dashboard.<br/>
          &copy; ${new Date().getFullYear()} SuperUI. All rights reserved.
        </p>
      </div>
    `;

    const todayStr = new Date().toISOString().split('T')[0];
    const startOfToday = new Date(`${todayStr}T00:00:00.000Z`);

    let sent1 = 0;
    let sent2 = 0;

    try {
      [sent1, sent2] = await Promise.all([
        EmailLog.countDocuments({
          type: 'delivery1',
          status: 'sent',
          createdAt: { $gte: startOfToday }
        }),
        EmailLog.countDocuments({
          type: 'delivery2',
          status: 'sent',
          createdAt: { $gte: startOfToday }
        })
      ]);
    } catch (dbErr) {
      logger.error(`Failed to fetch daily email counts: ${dbErr.message}. Defaulting to standard rotation.`);
    }

    let activeTransport, backup1, backup2;
    let name1, name2, name3;

    if (sent1 < 300 && sent2 < 300) {
      const useDelivery1 = (this.sendCounter % 2 === 0);
      this.sendCounter++;

      if (useDelivery1) {
        activeTransport = delivery1; name1 = 'delivery1';
        backup1 = delivery2; name2 = 'delivery2';
        backup2 = admin; name3 = 'admin';
      } else {
        activeTransport = delivery2; name1 = 'delivery2';
        backup1 = delivery1; name2 = 'delivery1';
        backup2 = admin; name3 = 'admin';
      }
    } else if (sent1 < 300 && sent2 >= 300) {
      activeTransport = delivery1; name1 = 'delivery1';
      backup1 = admin; name2 = 'admin';
      backup2 = null; name3 = null;
      logger.warn('Delivery 2 SMTP daily limit (300) reached. Routing via Delivery 1.');
    } else if (sent1 >= 300 && sent2 < 300) {
      activeTransport = delivery2; name1 = 'delivery2';
      backup1 = admin; name2 = 'admin';
      backup2 = null; name3 = null;
      logger.warn('Delivery 1 SMTP daily limit (300) reached. Routing via Delivery 2.');
    } else {
      activeTransport = admin; name1 = 'admin';
      backup1 = null; name2 = null;
      backup2 = null; name3 = null;
      logger.warn('Daily limit of 600 reached on primary senders. Using Admin SMTP for product delivery.');
    }

    const sendWithTimeout = (transportObj, transportName, timeoutMs = 10000) => {
      return Promise.race([
        transportObj.sendMail({
          from: transportObj.fromAddress,
          to: toAddress,
          subject,
          html: htmlContent
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`SMTP timeout after ${timeoutMs}ms on ${transportName}`)), timeoutMs)
        )
      ]);
    };

    try {
      logger.info(`Attempting to send product delivery email via ${name1}`);
      const info = await sendWithTimeout(activeTransport, name1, 8000);

      this.logEmail(name1, activeTransport.fromAddress, toAddress, subject, order._id, 'sent').catch(() => {});
      return info;
    } catch (err) {
      if (!backup1) {
        logger.error(`Primary transport ${name1} failed and no backup configured: ${err.message}`);
        this.logEmail(name1, activeTransport.fromAddress, toAddress, subject, order._id, 'failed', err.message).catch(() => {});
        throw err;
      }

      logger.warn(`Primary transport ${name1} failed: ${err.message}. Trying backup 1 ${name2}.`);
      
      try {
        const info = await sendWithTimeout(backup1, name2, 6000);

        this.logEmail(name2, backup1.fromAddress, toAddress, subject, order._id, 'sent').catch(() => {});
        return info;
      } catch (backupErr1) {
        if (!backup2) {
          logger.error(`Backup 1 transport ${name2} failed and no backup 2 configured: ${backupErr1.message}`);
          this.logEmail(name1, activeTransport.fromAddress, toAddress, subject, order._id, 'failed', backupErr1.message).catch(() => {});
          throw backupErr1;
        }

        logger.warn(`Backup 1 transport ${name2} failed: ${backupErr1.message}. Trying backup 2 ${name3}.`);
        
        try {
          const info = await sendWithTimeout(backup2, name3, 4000);

          this.logEmail(name3, backup2.fromAddress, toAddress, subject, order._id, 'sent').catch(() => {});
          return info;
        } catch (backupErr2) {
          logger.error(`All email transports failed. Last error (${name3}): ${backupErr2.message}`);
          this.logEmail(name1, activeTransport.fromAddress, toAddress, subject, order._id, 'failed', backupErr2.message).catch(() => {});
          throw backupErr2;
        }
      }
    }
  }

  async sendAdminMail(subject, htmlContent, recipient = null) {
    const to = recipient || admin.fromAddress;
    try {
      const info = await admin.sendMail({
        from: admin.fromAddress,
        to,
        subject,
        html: htmlContent
      });

      await this.logEmail('admin', admin.fromAddress, to, subject, null, 'sent');
      return info;
    } catch (err) {
      logger.error(`Admin notification email failed to ${to}: ${err.message}`);
      await this.logEmail('admin', admin.fromAddress, to, subject, null, 'failed', err.message);
      return { messageId: 'simulated-' + Date.now(), status: 'sandbox' };
    }
  }

  async sendManualEmail(subject, htmlContent, recipient, transportType = 'admin') {
    const { delivery1, delivery2, admin } = require('../config/email');
    
    let activeTransport = admin;
    let name = 'admin';

    if (transportType === 'delivery1') {
      activeTransport = delivery1;
      name = 'delivery1';
    } else if (transportType === 'delivery2') {
      activeTransport = delivery2;
      name = 'delivery2';
    }

    const to = recipient || activeTransport.fromAddress;

    try {
      const info = await activeTransport.sendMail({
        from: activeTransport.fromAddress,
        to,
        subject,
        html: htmlContent
      });

      await this.logEmail(name, activeTransport.fromAddress, to, subject, null, 'sent');
      return info;
    } catch (err) {
      logger.error(`Manual email failed via ${name} to ${to}: ${err.message}`);
      await this.logEmail(name, activeTransport.fromAddress, to, subject, null, 'failed', err.message);
      throw err;
    }
  }

  async logEmail(type, fromAddress, toAddress, subject, relatedOrderId, status, errorMessage = null) {
    try {
      await EmailLog.create({
        type,
        fromAddress,
        toAddress,
        subject,
        relatedOrderId,
        status,
        errorMessage
      });
    } catch (dbErr) {
      logger.error(`Failed to write email transaction log to DB: ${dbErr.message}`);
    }
  }
}

module.exports = new EmailService();
