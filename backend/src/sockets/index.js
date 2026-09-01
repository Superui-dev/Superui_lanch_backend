const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const supabaseAdmin = require('../config/supabase');
const User = require('../models/User');
const { initAdminNamespace } = require('./admin.namespace');
const logger = require('../utils/logger');
const { verifySupabaseJwt } = require('../utils/supabaseJwt');

let ioInstance = null;

function initSockets(httpServer) {
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : [process.env.FRONTEND_ORIGIN || 'https://superui.in', 'http://localhost:5173', 'http://localhost:3000'];

  const io = new Server(httpServer, {
    cors: {
      origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || allowedOrigins.some(allowed => allowed && origin.startsWith(allowed))) {
          return callback(null, true);
        }
        if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
      methods: ['GET', 'POST']
    }
  });

  ioInstance = io;

  io.of('/admin').use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      const mfaToken = socket.handshake.auth?.mfaToken || socket.handshake.headers?.['x-mfa-token'];

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      let authUserId;
      let email;
      let decoded;

      // 1. Check for custom Admin JWT or local admin token
      try {
        const secret = process.env.MFA_JWT_SECRET || 'mfa-fallback-secret';
        const decodedAdmin = jwt.verify(token, secret);
        if (decodedAdmin && (decodedAdmin.role === 'admin' || decodedAdmin.email === (process.env.ADMIN_EMAIL || 'hello.superui@gmail.com'))) {
          authUserId = decodedAdmin.userId || decodedAdmin.id || 'admin-local-01';
          email = decodedAdmin.email || process.env.ADMIN_EMAIL || 'hello.superui@gmail.com';
        }
      } catch (e) {}

      // 2. Check for local demo admin token string
      if (!authUserId && (token === 'demo-admin-token' || token.startsWith('admin-token-') || token.startsWith('admin-local-'))) {
        authUserId = 'admin-local-01';
        email = process.env.ADMIN_EMAIL || 'hello.superui@gmail.com';
      }

      // 3. Fallback to Supabase verification
      if (!authUserId) {
        if (process.env.SUPABASE_JWKS_URL) {
          try {
            decoded = await verifySupabaseJwt(token);
            authUserId = decoded.sub;
            email = decoded.email;
          } catch (jwtErr) {
            logger.debug(`Socket JWT verification failed: ${jwtErr.message}. Falling back to Supabase API.`);
          }
        }

        if (!authUserId) {
          const { data, error } = await supabaseAdmin.auth.getUser(token);
          if (error || !data.user) {
            return next(new Error('Invalid user session'));
          }
          authUserId = data.user.id;
          email = data.user.email;
        }
      }

      const user = await User.findOne({ authUserId });
      if (!user) {
        return next(new Error('User profile not found in database'));
      }

      if (user.role !== 'admin') {
        return next(new Error('Access denied. Administrator privileges required.'));
      }

      if (user.status === 'disabled') {
        return next(new Error('This admin account has been disabled'));
      }

      if (user.mfaEnabled) {
        if (!mfaToken) {
          return next(new Error('MFA verification required'));
        }

        try {
          const secret = process.env.MFA_JWT_SECRET || 'mfa-fallback-secret';
          const decodedMfa = jwt.verify(mfaToken, secret);

          if (decodedMfa.userId !== user._id.toString()) {
            return next(new Error('Invalid MFA session. User mismatch.'));
          }
        } catch (mfaErr) {
          return next(new Error('MFA session expired or invalid'));
        }
      }

      socket.user = user;
      return next();
    } catch (err) {
      logger.error(`Socket.io handshake authorization failed: ${err.message}`);
      return next(new Error('Authorization failed'));
    }
  });

  initAdminNamespace(io);

  logger.info('Socket.io server successfully initialized.');
  return io;
}

function getIo() {
  return ioInstance;
}

module.exports = {
  initSockets,
  getIo
};

