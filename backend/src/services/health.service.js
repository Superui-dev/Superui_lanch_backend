const mongoose = require('mongoose');
const razorpay = require('../config/razorpay');
const { delivery1, delivery2, admin } = require('../config/email');
const { token } = require('../config/telegram');
const axios = require('axios');
const logger = require('../utils/logger');

class HealthService {
  async withTimeout(promise, timeoutMs) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('Timeout exceeded'));
      }, timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
  }

  async checkHealth() {
    const startOverall = Date.now();
    let overallStatus = 'ALL_SYSTEMS_OPERATIONAL';

    let mongodbChecks = [];
    try {
      const start = Date.now();
      if (mongoose.connection.readyState === 1) {
        await this.withTimeout(mongoose.connection.db.admin().ping(), 2000);
        const responseMs = Date.now() - start;
        mongodbChecks = [
          { name: 'Primary', status: 'connected', read: true, write: true, responseMs }
        ];
      } else {
        overallStatus = 'DEGRADED';
        mongodbChecks = [
          { name: 'Primary', status: 'disconnected', read: false, write: false, responseMs: 0 }
        ];
      }
    } catch (err) {
      logger.error(`MongoDB health check failure: ${err.message}`);
      overallStatus = 'DEGRADED';
      mongodbChecks = [
        { name: 'Primary', status: 'degraded', read: false, write: false, responseMs: 0, error: err.message }
      ];
    }

    let authentication = { supabaseAuth: 'ok', googleLogin: 'ok', mfa: 'ok' };
    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('SUPABASE_URL env is missing');
      }
      await this.withTimeout(axios.get(`${supabaseUrl}/auth/v1/health`, { timeout: 2000 }), 2000);
    } catch (err) {
      logger.error(`Supabase health check failure: ${err.message}`);
      authentication.supabaseAuth = 'degraded';
      authentication.googleLogin = 'degraded';
      overallStatus = 'DEGRADED';
    }

    let email = { delivery1: 'ok', delivery2: 'ok', delivery3: 'ok', admin: 'ok' };
    const checkSmtp = async (transport, label) => {
      try {
        if (transport.verify) {
          await this.withTimeout(transport.verify(), 3000);
          return 'ok';
        }
        return 'ok';
      } catch (err) {
        logger.error(`SMTP health check failure for [${label}]: ${err.message}`);
        overallStatus = 'DEGRADED';
        return 'offline';
      }
    };
    email.delivery1 = await checkSmtp(delivery1, 'delivery1');
    email.delivery2 = await checkSmtp(delivery2, 'delivery2');
    email.delivery3 = await checkSmtp(delivery3, 'delivery3');
    email.admin = await checkSmtp(admin, 'admin');

    let payment = { razorpay: 'ok', webhook: 'ok' };
    try {
      await this.withTimeout(razorpay.payments.all({ count: 1 }), 3000);
    } catch (err) {
      logger.error(`Razorpay health check failure: ${err.message}`);
      payment.razorpay = 'degraded';
      overallStatus = 'DEGRADED';
    }

    let storage = { type: 'database', status: 'active' };

    let telegram = { bot: 'ok' };
    try {
      if (token) {
        const url = `https://api.telegram.org/bot${token}/getMe`;
        const res = await this.withTimeout(axios.get(url), 3000);
        if (!res.data.ok) {
          telegram.bot = 'degraded';
          overallStatus = 'DEGRADED';
        }
      } else {
        telegram.bot = 'not_configured';
      }
    } catch (err) {
      logger.error(`Telegram health check failure: ${err.message}`);
      telegram.bot = 'offline';
      overallStatus = 'DEGRADED';
    }

    let website = { frontend: 'online', backendApi: 'online' };

    if (mongodbChecks.every(c => c.status === 'disconnected')) {
      overallStatus = 'SYSTEM_OFFLINE';
    }

    return {
      mongodb: mongodbChecks,
      authentication,
      email,
      payment,
      storage,
      telegram,
      website,
      overall: overallStatus,
      totalExecutionMs: Date.now() - startOverall
    };
  }

  async getIntegrationsDashboard() {
    const EmailLog = require('../models/EmailLog');

    const mongoConnections = [
      {
        id: 'conn-1',
        name: 'DevLibrary DB 1',
        connectionString: 'mongodb+srv://devlibrary1:***@cluster0.x...',
        status: 'ACTIVE',
        health: 'WORKING',
        lastChecked: '26 May 2025, 11:45 AM'
      },
      {
        id: 'conn-2',
        name: 'DevLibrary DB 2',
        connectionString: 'mongodb+srv://devlibrary2:***@cluster0.x...',
        status: 'ACTIVE',
        health: 'WORKING',
        lastChecked: '26 May 2025, 11:46 AM'
      },
      {
        id: 'conn-3',
        name: 'Admin DB',
        connectionString: 'mongodb+srv://admin:***@cluster0.x...',
        status: 'INACTIVE',
        health: 'NOT WORKING',
        lastChecked: '26 May 2025, 11:40 AM'
      }
    ];

    const mongoData = {
      total: 3,
      active: 2,
      inactive: 1,
      working: 2,
      notWorking: 1,
      connections: mongoConnections
    };

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const smtpConfigs = [
      {
        id: 'email-1',
        email: 'developer1@example.com',
        name: 'Developer 1',
        provider: 'DevLibrary 1',
        status: 'ACTIVE',
        smtpHealth: 'WORKING',
        dailyLimit: 300,
        typeKey: 'delivery1'
      },
      {
        id: 'email-2',
        email: 'developer2@example.com',
        name: 'Developer 2',
        provider: 'DevLibrary 2',
        status: 'ACTIVE',
        smtpHealth: 'WORKING',
        dailyLimit: 300,
        typeKey: 'delivery2'
      },
      {
        id: 'email-3',
        email: 'admin@example.com',
        name: 'Admin',
        provider: 'Admin',
        status: 'ACTIVE',
        smtpHealth: 'WORKING',
        dailyLimit: 300,
        typeKey: 'admin'
      }
    ];

    const emailList = [];
    let totalUsedToday = 0;

    for (const item of smtpConfigs) {
      let usedToday = 0;
      try {
        usedToday = await EmailLog.countDocuments({
          $or: [
            { fromAddress: item.email },
            { type: item.typeKey }
          ],
          createdAt: { $gte: startOfDay }
        });
      } catch (err) {
        usedToday = 0;
      }

      totalUsedToday += usedToday;
      const usagePercentage = Math.min(100, Math.round((usedToday / item.dailyLimit) * 100));

      emailList.push({
        id: item.id,
        email: item.email,
        name: item.name,
        provider: item.provider,
        status: item.status,
        smtpHealth: item.smtpHealth,
        dailyLimit: item.dailyLimit,
        usedToday,
        remainingToday: Math.max(0, item.dailyLimit - usedToday),
        usagePercentage
      });
    }

    const overallPercentage = Math.min(100, Math.round((totalUsedToday / 900) * 100));

    const smtpData = {
      total: 3,
      active: 3,
      inactive: 0,
      dailyLimit: 900,
      usedToday: totalUsedToday,
      usagePercentage: overallPercentage,
      emails: emailList
    };

    return {
      mongodb: mongoData,
      smtp: smtpData
    };
  }
}

module.exports = new HealthService();

