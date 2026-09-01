const jwt = require('jsonwebtoken');
const supabaseAdmin = require('../config/supabase');
const User = require('../models/User');
const { UnauthorizedError } = require('../utils/errors');
const logger = require('../utils/logger');
const { verifySupabaseJwt } = require('../utils/supabaseJwt');

/**
 * Middleware to authenticate requests using Supabase JWT or Admin Session Tokens.
 * Automatically syncs the user with MongoDB if it's the user's first request.
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const mfaHeader = req.headers['x-mfa-token'];
    
    let token = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (mfaHeader) {
      token = mfaHeader;
    }

    if (!token) {
      return next(new UnauthorizedError('Missing or invalid Authorization header'));
    }

    let authUserId;
    let email;
    let role = 'customer';

    // 1. Check for custom Admin JWT (signed with MFA_JWT_SECRET)
    try {
      const secret = process.env.MFA_JWT_SECRET;
      if (secret) {
        const decodedAdmin = jwt.verify(token, secret);
        if (decodedAdmin && decodedAdmin.role === 'admin' && decodedAdmin.email) {
          authUserId = decodedAdmin.userId || decodedAdmin.id;
          email = decodedAdmin.email;
          role = 'admin';
        }
      }
    } catch (e) {}

    // 2. Verify via JWKS or Supabase API for regular Supabase users
    if (!authUserId) {
      if (process.env.SUPABASE_JWKS_URL) {
        try {
          const decoded = await verifySupabaseJwt(token);
          authUserId = decoded.sub;
          email = decoded.email;
          role = decoded.user_metadata?.role || 'customer';
        } catch (jwtErr) {
          logger.debug(`Local JWT verification failed: ${jwtErr.message}. Falling back to Supabase client.`);
        }
      }

      if (!authUserId) {
        const { data, error } = await supabaseAdmin.auth.getUser(token);
        if (!error && data?.user) {
          authUserId = data.user.id;
          email = data.user.email;
          role = data.user.user_metadata?.role || 'customer';
        }
      }
    }

    if (!authUserId) {
      return next(new UnauthorizedError('User authentication failed'));
    }

    // 4. Find user in MongoDB by authUserId or email
    let user = await User.findOne({ $or: [{ authUserId }, { email }] });

    // 5. Auto-create profile in MongoDB if it does not exist
    if (!user) {
      const name = email ? email.split('@')[0] : 'Administrator';
      try {
        user = await User.create({
          authUserId,
          email: email,
          name,
          role: role || (email === process.env.ADMIN_EMAIL ? 'admin' : 'customer'),
          status: 'active'
        });
        logger.info(`Auto-created MongoDB user profile for: ${email}`);
      } catch (dbErr) {
        user = await User.findOne({ email });
        if (!user) throw dbErr;
      }
    }

    // 6. Block disabled users
    if (user.status === 'disabled') {
      return next(new UnauthorizedError('This account has been disabled'));
    }

    req.user = user;
    return next();
  } catch (error) {
    return next(new UnauthorizedError(error.message || 'Authentication failed'));
  }
}

async function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const mfaHeader = req.headers['x-mfa-token'];
  if (!authHeader && !mfaHeader) {
    req.user = null;
    return next();
  }
  return authenticate(req, res, (err) => {
    if (err) req.user = null;
    return next();
  });
}

module.exports = authenticate;
module.exports.optionalAuthenticate = optionalAuthenticate;

