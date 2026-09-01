const { ForbiddenError } = require('../utils/errors');

/**
 * Middleware to restrict route access to administrators.
 * Must be executed after authenticate.
 */
function authorizeAdmin(req, res, next) {
  if (!req.user) {
    return next(new ForbiddenError('Access denied. Authentication required.'));
  }

  if (req.user.role !== 'admin') {
    return next(new ForbiddenError('Access denied. Administrator privileges required.'));
  }

  return next();
}

module.exports = authorizeAdmin;

