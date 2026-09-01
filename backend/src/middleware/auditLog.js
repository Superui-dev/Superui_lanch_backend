const AdminLog = require('../models/AdminLog');
const logger = require('../utils/logger');

/**
 * Middleware that attaches an audit logging helper function to the request.
 * Allows controllers to log admin actions easily.
 */
function auditLog(req, res, next) {
  req.logAudit = async (action, resource, resourceId, metadata = {}) => {
    try {
      if (!req.user || req.user.role !== 'admin') {
        logger.warn(`Non-admin attempted to trigger audit log: ${req.user?.email || 'Unknown'}`);
        return;
      }

      await AdminLog.create({
        adminUserId: req.user._id,
        action,
        resource,
        resourceId: resourceId || null,
        metadata
      });

      logger.info(`Audit log recorded: Admin [${req.user.email}] performed [${action}] on [${resource}]`);
    } catch (err) {
      logger.error(`Failed to write audit log: ${err.message}`, { action, resource, resourceId });
    }
  };

  next();
}

module.exports = auditLog;

