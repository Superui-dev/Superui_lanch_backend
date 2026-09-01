const Visitor = require('../models/Visitor');
const PageView = require('../models/PageView');
const crypto = require('crypto');
const { sendSuccess } = require('../utils/responses');

class AnalyticsController {
  // Ingest visitor pageview details
  async recordPageView(req, res, next) {
    try {
      const { visitorId, sessionId, page, referrer } = req.body;

      // Extract client details
      const userAgent = req.headers['user-agent'] || '';
      const ip = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
      
      // Hash IP to ensure GDPR compliance / protect customer privacy
      const ipHash = crypto.createHash('sha256').update(ip).digest('hex');

      // Simple mock user-agent parsing (would normally use a library like useragent or ua-parser-js)
      let device = 'Desktop';
      let browser = 'Other';
      let os = 'Other';

      if (/mobile/i.test(userAgent)) device = 'Mobile';
      if (/tablet/i.test(userAgent)) device = 'Tablet';
      if (/chrome/i.test(userAgent)) browser = 'Chrome';
      else if (/safari/i.test(userAgent)) browser = 'Safari';
      else if (/firefox/i.test(userAgent)) browser = 'Firefox';

      if (/windows/i.test(userAgent)) os = 'Windows';
      else if (/macintosh/i.test(userAgent)) os = 'macOS';
      else if (/android/i.test(userAgent)) os = 'Android';
      else if (/iphone/i.test(userAgent)) os = 'iOS';

      const country = req.headers['cf-ipcountry'] || 'IN'; // Cloudflare geo-location fallback

      const now = new Date();

      // Upsert Visitor profile
      await Visitor.findOneAndUpdate(
        { visitorId },
        {
          $setOnInsert: { firstVisitAt: now, landingPage: page },
          $set: {
            sessionId,
            ipHash,
            userAgent,
            device,
            browser,
            os,
            country,
            referrer,
            lastPage: page,
            lastVisitAt: now
          },
          $inc: { pagesViewed: 1 }
        },
        { upsert: true, new: true }
      );

      // Create Page View document
      const pageView = await PageView.create({
        visitorId,
        page,
        createdAt: now
      });

      return sendSuccess(res, pageView, 'Analytics event recorded');
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new AnalyticsController();

