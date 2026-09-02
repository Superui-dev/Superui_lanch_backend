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

    // 3. Extract the x-mfa-token header (primary source — sent by frontend api client)
    const mfaToken = req.headers['x-mfa-token'];
    if (!mfaToken) {
      return next(new ForbiddenError('MFA verification required. Please provide x-mfa-token header.'));
    }

    // 4. Verify the MFA token using Supabase JWKS
    let decoded;
    try {
      decoded = await verifySupabaseJwt(mfaToken);
    } catch (err) {
      const secret = process.env.MFA_JWT_SECRET || 'a3f8c9b1e4d7f2a6c5b8e9d1f4a7c2e5b8d1f4a7c2e5b8d1f4a7c2e5b8d1f4a7';
      decoded = jwt.verify(mfaToken, secret);
    }

    // 5. Ensure the token belongs to the currently authenticated user
    // decoded.userId = Mongo _id string (from admin JWT), decoded.id = authUserId
    const userMongoId = req.user._id?.toString() || req.user.id?.toString() || '';
    const tokenUserId = decoded.userId?.toString() || decoded.id?.toString() || decoded.sub?.toString() || '';

    if (tokenUserId && userMongoId && tokenUserId !== userMongoId) {
      // Also accept a match on email as a safe fallback
      if (!decoded.email || decoded.email !== req.user.email) {
        return next(new ForbiddenError('Invalid MFA session. User mismatch.'));
      }
    }

    return next();
  } catch (error) {
    logger.error(`MFA token verification failed: ${error.message}`);
    return next(new ForbiddenError('MFA session expired or invalid. Please re-authenticate.'));
  }
}

module.exports = requireMfa;

