const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const { globalLimiter } = require('./middleware/rateLimiter');

// Security Middlewares
const authenticate = require('./middleware/authenticate');
const authorizeAdmin = require('./middleware/authorizeAdmin');
const requireMfa = require('./middleware/requireMfa');
const auditLog = require('./middleware/auditLog');

const app = express();

// Trust proxy headers (Cloudflare, Nginx, Vercel, Render) for 100% real IP resolution
app.set('trust proxy', 1);

// 1. Logging Request Logs
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
  stream: { write: (message) => logger.info(message.trim()) }
}));

// 2. Global Rate Limiting
app.use(globalLimiter);

// 3. Security Headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// 4. CORS Origins Settings
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [process.env.FRONTEND_ORIGIN || 'https://superui.in', 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:3000'];

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  try {
    const { hostname } = new URL(origin);
    return allowedOrigins.some(allowed => {
      try {
        const allowedHost = new URL(allowed).hostname;
        return hostname === allowedHost || hostname.endsWith('.' + allowedHost);
      } catch { return false; }
    });
  } catch { return false; }
}

app.use(cors({
  origin: function (origin, callback) {
    return callback(null, isAllowedOrigin(origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

// 5. Razorpay Webhook Raw Parser (Must be registered before body parsers)
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
  req.rawBody = req.body;
  next();
});

// 6. Global Body Parsers (With size limit rules)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 7. Base Health Check
app.get('/healthz', (req, res) => {
  return res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// ==========================================
// CUSTOMER & PUBLIC ROUTING MOUNTING
// ==========================================
app.use('/api/public', require('./routes/public.routes'));
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/cart', require('./routes/cart.routes'));
app.use('/api/orders', require('./routes/order.routes'));
app.use('/api/payments', require('./routes/payment.routes'));
app.use('/api/download', require('./routes/download.routes'));
app.use('/api/contact', require('./routes/contact.routes'));
app.use('/api/reviews', require('./routes/review.routes'));
app.use('/api/wishlist', require('./routes/wishlist.routes'));
app.use('/api/analytics', require('./routes/analytics.routes'));
app.use('/api/public/analytics', require('./routes/analytics.routes'));

// ==========================================
// ADMIN ROUTING MOUNTING (Secured Chain)
// ==========================================
const adminRouter = express.Router();
adminRouter.use(authenticate, authorizeAdmin, requireMfa, auditLog);

adminRouter.use('/products', require('./routes/admin/products.admin.routes'));
adminRouter.use('/categories', require('./routes/admin/categories.admin.routes'));
adminRouter.use('/customers', require('./routes/admin/customers.admin.routes'));
adminRouter.use('/orders', require('./routes/admin/orders.admin.routes'));
adminRouter.use('/payments', require('./routes/admin/payments.admin.routes'));
adminRouter.use('/bookings', require('./routes/admin/bookings.admin.routes'));
adminRouter.use('/downloads', require('./routes/admin/downloads.admin.routes'));
adminRouter.use('/download', require('./routes/admin/downloads.admin.routes'));
adminRouter.use('/contacts', require('./routes/admin/contacts.admin.routes'));
adminRouter.use('/email', require('./routes/admin/email.admin.routes'));
adminRouter.use('/telegram', require('./routes/admin/telegram.admin.routes'));
adminRouter.use('/analytics', require('./routes/admin/analytics.admin.routes'));
adminRouter.use('/reviews', require('./routes/admin/reviews.admin.routes'));
adminRouter.use('/feedback', require('./routes/admin/feedback.admin.routes'));
adminRouter.use('/issues', require('./routes/admin/issues.admin.routes'));
adminRouter.use('/settings', require('./routes/admin/settings.admin.routes'));
adminRouter.use('/security', require('./routes/admin/security.admin.routes'));
adminRouter.use('/health', require('./routes/admin/health.admin.routes'));
adminRouter.use('/hero-images', require('./routes/admin/hero.admin.routes'));
adminRouter.use('/upcoming-banners', require('./routes/admin/upcomingBanners.admin.routes'));
adminRouter.use('/services', require('./routes/admin/service.admin.routes'));

app.use('/api/admin', adminRouter);

// 8. Catch-all fallback for undefined routes
app.use('*', (req, res, next) => {
  res.status(404).json({ success: false, message: 'Resource not found' });
});

// 9. Global Error Handling Middleware (Always last)
app.use(errorHandler);

module.exports = app;

