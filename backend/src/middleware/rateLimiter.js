const rateLimit = require('express-rate-limit');
const { sendError } = require('../utils/responses');

// Standard error handler for rate limiters
const limitHandler = (req, res, next, options) => {
  return sendError(res, 'Too many requests. Please try again later.', 429);
};

// Strict Limiter: for auth, MFA, contacts, checkout
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 10 : 1000, // Scale up in development
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  handler: limitHandler
});

// Moderate Limiter: for coupon application, payment verification
const moderateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: process.env.NODE_ENV === 'production' ? 30 : 2000,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  handler: limitHandler
});

// Public Read Limiter: for listing products/reviews/categories
const publicLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'production' ? 60 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  handler: limitHandler
});

// Global API Limiter: fallback
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 300 : 10000,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  handler: limitHandler
});

module.exports = {
  strictLimiter,
  moderateLimiter,
  publicLimiter,
  globalLimiter
};

