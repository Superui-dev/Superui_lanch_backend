const jwt = require('jsonwebtoken');
const { ForbiddenError } = require('../utils/errors');
const logger = require('../utils/logger');
const { verifySupabaseJwt } = require('../utils/supabaseJwt');

/**
 * Middleware to ensure the administrator has completed the MFA (TOTP) verification.
 * Relies on a stateless signed MFA token sent in the 'x-mfa-token' header.
 */
async function requireMfa(req, res, next) {
  try {
    // 1. If user is not admin, deny access immediately
    if (!req.user || req.user.role !== 'admin') {
      return next(new ForbiddenError('Access denied. Administrator credentials required.'));
    }

    // 2. If MFA is not enabled for this admin account, allow bypass (to prevent lockout during setup)
    if (!req.user.mfaEnabled) {
      return next(new ForbiddenError('MFA enrollment required. Please set up 2FA before accessing admin panel.'));
    }

    // 3. Extract the x-mfa-token header
    const mfaToken = req.headers['x-mfa-token'];
    if (!mfaToken) {
      return next(new ForbiddenError('MFA verification required. Please provide x-mfa-token header.'));
    }

    // 4. Verify the MFA token using Supabase JWKS
    let decoded;
    try {
      decoded = await verifySupabaseJwt(mfaToken);
    } catch (err) {
      const secret = process.env.MFA_JWT_SECRET;
      if (!secret) return next(new ForbiddenError('MFA configuration error. Contact administrator.'));
      decoded = jwt.verify(mfaToken, secret);
    }

    // 5. Ensure the token belongs to the currently authenticated user
    if (decoded.userId !== req.user.id.toString()) {
      return next(new ForbiddenError('Invalid MFA session. User mismatch.'));
    }

    return next();
  } catch (error) {
    logger.error(`MFA token verification failed: ${error.message}`);
    return next(new ForbiddenError('MFA session expired or invalid. Please re-authenticate.'));
  }
}

module.exports = requireMfa;

