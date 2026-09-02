const logger = require('../utils/logger');
const events = require('./events');

let adminIoInstance = null;
let activeConnections = 0;

function initAdminNamespace(io) {
  const adminNs = io.of('/admin');
  adminIoInstance = adminNs;

  adminNs.on(events.CONNECTION, (socket) => {
    activeConnections++;
    logger.info(`Admin user connected to WS dashboard. Total connections: ${activeConnections}`);

    adminNs.emit(events.ADMIN_VISITOR_LIVE_COUNT, { liveAdmins: activeConnections, count: activeConnections });

    socket.on(events.DISCONNECT, () => {
      activeConnections = Math.max(0, activeConnections - 1);
      logger.info(`Admin user disconnected from WS dashboard. Total connections: ${activeConnections}`);
      adminNs.emit(events.ADMIN_VISITOR_LIVE_COUNT, { liveAdmins: activeConnections, count: activeConnections });
    });
  });

  return adminNs;
}

function broadcastToAdmins(event, payload) {
  if (adminIoInstance) {
    adminIoInstance.emit(event, payload);
    logger.debug(`Broadcasted event [${event}] to admin namespace.`);
  } else {
    logger.warn(`Could not broadcast event [${event}]: admin namespace is not initialized.`);
  }
}

module.exports = {
  initAdminNamespace,
  broadcastToAdmins
};

