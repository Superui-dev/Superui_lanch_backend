const logger = require('../utils/logger');

const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramAdminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

if (!telegramToken || !telegramAdminChatId) {
  logger.error('Telegram bot settings (TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID) are missing!');
}

module.exports = {
  token: telegramToken,
  adminChatId: telegramAdminChatId
};

