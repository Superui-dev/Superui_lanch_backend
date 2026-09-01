const express = require('express');
const router = express.Router();
const { sendSuccess, sendError } = require('../../utils/responses');
const telegramService = require('../../services/telegram.service');

router.get('/settings', (req, res) => {
  return sendSuccess(res, {
    botTokenConfigured: !!process.env.TELEGRAM_BOT_TOKEN,
    adminChatIdConfigured: !!process.env.TELEGRAM_ADMIN_CHAT_ID,
    adminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID ? '***' + process.env.TELEGRAM_ADMIN_CHAT_ID.slice(-4) : null
  }, 'Telegram configurations loaded');
});

router.post('/test', async (req, res) => {
  try {
    const sent = await telegramService.sendAdminLoginAlert({
      email: req.user?.email || 'admin@superui.in',
      name: 'System Admin (Test Alert)',
      ip: req.ip || '127.0.0.1',
      userAgent: req.get('User-Agent') || 'SuperUI Test Console'
    });

    if (sent) {
      return sendSuccess(res, { delivered: true }, 'Test notification delivered to Telegram chat');
    } else {
      return sendError(res, 'Telegram alert delivery failed. Please start a conversation with @SuperUi_Admin_bot on Telegram by sending /start first.', 400);
    }
  } catch (err) {
    return sendError(res, err.message || 'Telegram test error', 500);
  }
});

module.exports = router;

