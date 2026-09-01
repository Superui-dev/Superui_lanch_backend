const axios = require('axios');
const logger = require('../utils/logger');

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

class TelegramService {
  constructor() {
    this.discoveredChatId = null;
    this.cachedBotUsername = null;
  }

  async getCredentials() {
    try {
      const SiteSettings = require('../models/SiteSettings');
      const settings = await SiteSettings.findOne().lean();
      if (settings && settings.telegram && typeof settings.telegram === 'object') {
        const botToken = settings.telegram.botToken || process.env.TELEGRAM_BOT_TOKEN;
        const chatId = settings.telegram.chatId || process.env.TELEGRAM_ADMIN_CHAT_ID;
        return { botToken, chatId };
      }
    } catch (err) {
      logger.warn(`Could not load Telegram credentials from SiteSettings: ${err.message}`);
    }
    return {
      botToken: process.env.TELEGRAM_BOT_TOKEN,
      chatId: process.env.TELEGRAM_ADMIN_CHAT_ID
    };
  }

  async getBotUsername(token) {
    if (this.cachedBotUsername) return this.cachedBotUsername;
    try {
      const response = await axios.get(`https://api.telegram.org/bot${token}/getMe`, { timeout: 3000 });
      if (response.data?.ok && response.data.result?.username) {
        this.cachedBotUsername = response.data.result.username;
        return response.data.result.username;
      }
    } catch (e) {
      logger.warn(`Could not fetch bot details from Telegram: ${e.message}`);
    }
    return 'SuperUI_Bot';
  }

  async getActiveChatId(token, configAdminChatId) {
    // 1. Prioritize explicitly configured Chat ID over auto-discovered Chat ID
    if (configAdminChatId) {
      return configAdminChatId;
    }

    if (this.discoveredChatId) return this.discoveredChatId;

    try {
      const url = `https://api.telegram.org/bot${token}/getUpdates`;
      const response = await axios.get(url, { timeout: 4000 });
      if (response.data?.ok && response.data.result?.length > 0) {
        const updates = response.data.result;
        for (let i = updates.length - 1; i >= 0; i--) {
          const chat = updates[i].message?.chat || updates[i].my_chat_member?.chat;
          if (chat && chat.id) {
            this.discoveredChatId = chat.id;
            logger.info(`Discovered Telegram Chat ID: ${chat.id} (${chat.first_name || chat.username || 'Admin'})`);
            return chat.id;
          }
        }
      }
    } catch (err) {
      if (err.response?.status === 409) {
        try {
          await axios.get(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`);
        } catch (e) {}
      }
      logger.warn(`Telegram auto-discovery lookup: ${err.message}`);
    }

    return null;
  }

  async sendMessage(text) {
    const creds = await this.getCredentials();
    const token = creds.botToken;
    const configAdminChatId = creds.chatId;

    if (!token) {
      logger.warn('Telegram bot token missing. Skipping notification.');
      return false;
    }

    // Ignore chat ID if it's the bot ID itself
    const botIdFromToken = token && token.includes(':') ? token.split(':')[0] : null;
    let fallbackChatId = configAdminChatId;
    if (fallbackChatId && botIdFromToken && fallbackChatId.toString() === botIdFromToken.toString()) {
      logger.warn(`Configured Chat ID (${fallbackChatId}) matches bot user ID. Ignoring fallback.`);
      fallbackChatId = null;
    }

    const targetChatId = await this.getActiveChatId(token, fallbackChatId);

    if (!targetChatId) {
      logger.warn('No active Chat ID configured or auto-discovered.');
      return false;
    }

    const botUsername = await this.getBotUsername(token);
    const textWithSignature = `${text.trim()}\n\n<i>Bot: @${botUsername}</i>`;

    try {
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      const response = await axios.post(url, {
        chat_id: targetChatId,
        text: textWithSignature,
        parse_mode: 'HTML'
      }, {
        timeout: 5000
      });

      if (response.status === 200 && response.data.ok) {
        logger.info(`Telegram login alert sent to chat ${targetChatId}`);
        return true;
      }
    } catch (error) {
      logger.error(`Telegram notification error: ${error.response?.data?.description || error.message}`);
      
      // Retry via getUpdates if targetChatId had an error
      try {
        const resUpdates = await axios.get(`https://api.telegram.org/bot${token}/getUpdates`, { timeout: 4000 });
        if (resUpdates.data?.ok && resUpdates.data.result?.length > 0) {
          const updates = resUpdates.data.result;
          const lastUpdate = updates[updates.length - 1];
          const newChatId = lastUpdate.message?.chat?.id || lastUpdate.my_chat_member?.chat?.id;
          if (newChatId && newChatId !== targetChatId) {
            this.discoveredChatId = newChatId;
            const retryRes = await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
              chat_id: newChatId,
              text: textWithSignature,
              parse_mode: 'HTML'
            }, { timeout: 5000 });
            if (retryRes.status === 200 && retryRes.data.ok) {
              logger.info(`Telegram login alert delivered to Chat ID: ${newChatId}`);
              return true;
            }
          }
        }
      } catch (retryErr) {
        // Suppress retry failure
      }
      return false;
    }
  }

  async sendAdminLoginAlert({ email, name, ip, userAgent }) {
    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const dayName = days[now.getDay()];
    const dateStr = `${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
    const timeStr = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

    const cleanIp = ip && ip.includes('::ffff:') ? ip.replace('::ffff:', '') : (ip || '127.0.0.1');

    const text = `<b>🚨 SUPERUI ADMIN LOGIN ALERT</b>\n\n` +
      `<b>👤 Admin Email:</b> ${escapeHtml(email) || 'hello.superui@gmail.com'}\n` +
      `<b>👤 Admin Name:</b> ${escapeHtml(name) || 'Administrator'}\n` +
      `<b>🌐 IP Address:</b> <code>${escapeHtml(cleanIp)}</code>\n` +
      `<b>📅 Date:</b> ${dayName}, ${dateStr}\n` +
      `<b>⏰ Time:</b> ${timeStr} IST\n` +
      `<b>💻 User-Agent / Device:</b> ${escapeHtml(userAgent) || 'Web Browser'}\n` +
      `<b>🔐 Status:</b> SUCCESSFUL ADMIN LOGIN`;

    return this.sendMessage(text);
  }

  async sendSecurityAlert({ event, details, page, ip, userAgent }) {
    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const dayName = days[now.getDay()];
    const dateStr = `${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
    const timeStr = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

    const cleanIp = ip && ip.includes('::ffff:') ? ip.replace('::ffff:', '') : (ip || '127.0.0.1');

    const text = `<b>🚨 CRITICAL SECURITY ALERT: INSPECT DETECTED</b>\n\n` +
      `<b>⚠️ Event:</b> DevTools / Inspect Element Opened\n` +
      `<b>📍 Location / Page:</b> <code>${escapeHtml(page) || '/admin'}</code>\n` +
      `<b>🌐 100% Real IP Address:</b> <code>${escapeHtml(cleanIp)}</code>\n` +
      `<b>📅 Date:</b> ${dayName}, ${dateStr}\n` +
      `<b>⏰ Time:</b> ${timeStr} IST\n` +
      `<b>💻 User-Agent / Device:</b> ${escapeHtml(userAgent) || 'Unknown Browser'}\n` +
      `<b>⚡ Details:</b> ${escapeHtml(details) || 'Potential Inspection / Reverse Engineering Attempt'}`;

    return this.sendMessage(text);
  }

  async sendLoginAttemptAlert({ email, status, errorReason, ip, userAgent }) {
    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const dayName = days[now.getDay()];
    const dateStr = `${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
    const timeStr = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

    const cleanIp = ip && ip.includes('::ffff:') ? ip.replace('::ffff:', '') : (ip || '127.0.0.1');
    const isSuccess = status === 'SUCCESS';
    const isFailed = status === 'FAILED' || errorReason;

    const icon = isSuccess ? '✅' : (isFailed ? '⚠️' : '🚨');
    const statusTitle = isSuccess ? 'ADMIN LOGIN SUCCESS' : 'ADMIN LOGIN ATTEMPT / FAILED ATTEMPT';

    const text = `<b>${icon} SUPERUI ADMIN LOGIN ACTIVITY</b>\n\n` +
      `<b>👤 Email Attempted:</b> <code>${escapeHtml(email) || 'Unknown'}</code>\n` +
      `<b>🔐 Result / Status:</b> ${statusTitle}\n` +
      (errorReason ? `<b>❌ Reason:</b> ${escapeHtml(errorReason)}\n` : '') +
      `<b>🌐 100% Real IP:</b> <code>${escapeHtml(cleanIp)}</code>\n` +
      `<b>📅 Date:</b> ${dayName}, ${dateStr}\n` +
      `<b>⏰ Time:</b> ${timeStr} IST\n` +
      `<b>💻 User-Agent / Device:</b> ${escapeHtml(userAgent) || 'Unknown Browser'}`;

    return this.sendMessage(text);
  }

  async sendContactFormNotification({ name, email, phone, subject, message, ip, userAgent }) {
    const contactToken = process.env.CONTACT_TELEGRAM_BOT_TOKEN || '8925715093:AAHK4wNZCVQofJmrebRsPozMuv5ZGQCXJ4A';
    const creds = await this.getCredentials();
    const configAdminChatId = creds.chatId;

    let targetChatId = await this.getActiveChatId(contactToken, configAdminChatId);

    if (!targetChatId && configAdminChatId) {
      targetChatId = configAdminChatId;
    }

    if (!targetChatId) {
      logger.warn('Contact Telegram notification skipped: target chat ID missing.');
      return false;
    }

    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const dayName = days[now.getDay()];
    const dateStr = `${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
    const timeStr = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

    const cleanIp = ip && ip.includes('::ffff:') ? ip.replace('::ffff:', '') : (ip || '127.0.0.1');
    const botUsername = await this.getBotUsername(contactToken);

    const text = `<b>📨 NEW CONTACT FORM INQUIRY</b>\n\n` +
      `<b>👤 Name:</b> ${escapeHtml(name) || 'N/A'}\n` +
      `<b>✉️ Email:</b> <code>${escapeHtml(email)}</code>\n` +
      `<b>📞 Phone:</b> <code>${escapeHtml(phone) || 'N/A'}</code>\n` +
      `<b>📝 Subject:</b> ${escapeHtml(subject) || 'Website Inquiry'}\n` +
      `<b>💬 Message:</b>\n<i>${escapeHtml(message)}</i>\n\n` +
      `<b>🌐 IP Address:</b> <code>${escapeHtml(cleanIp)}</code>\n` +
      `<b>📅 Date:</b> ${dayName}, ${dateStr}\n` +
      `<b>⏰ Time:</b> ${timeStr} IST\n` +
      `<b>💻 User-Agent / Device:</b> ${escapeHtml(userAgent) || 'Web Browser'}\n\n` +
      `<i>Bot: @${botUsername}</i>`;

    try {
      const url = `https://api.telegram.org/bot${contactToken}/sendMessage`;
      const response = await axios.post(url, {
        chat_id: targetChatId,
        text,
        parse_mode: 'HTML'
      }, { timeout: 5000 });

      if (response.status === 200 && response.data.ok) {
        logger.info(`Contact Form Telegram notification delivered via dedicated bot to chat ${targetChatId}`);
        return true;
      }
    } catch (error) {
      logger.error(`Dedicated Contact Telegram Bot notification error: ${error.response?.data?.description || error.message}`);
      // Fallback to default Telegram bot if separate bot fails
      return this.sendMessage(text);
    }
    return false;
  }
}

module.exports = new TelegramService();
