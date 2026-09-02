const mongoose = require('mongoose');
const logger = require('../utils/logger');
const dns = require('dns');
try {
  dns.setDefaultResultOrder('ipv4first');
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const CATALOG_OVERFLOW_THRESHOLD = parseInt(process.env.CATALOG_DB_OVERFLOW_THRESHOLD || '50000', 10);

const catalogDb1Uri = process.env.MONGO_DB_1_URI || process.env.MONGODB_URI_CORE || process.env.MONGODB_URI || 'mongodb://localhost:27017/catalog_db_1';
const catalogDb2Uri = process.env.MONGO_DB_2_URI || process.env.MONGODB_URI_USERS || catalogDb1Uri;
const commerceDbUri = process.env.MONGO_DB_3_URI || process.env.MONGODB_URI_PROMOTIONS || process.env.MONGODB_URI_MESSAGING || catalogDb1Uri;
const opsDbUri = process.env.MONGO_DB_4_URI || process.env.MONGODB_URI_SECURITY || catalogDb1Uri;

const connOptions = {
  autoIndex: false,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 30000,
  family: 4,
  bufferTimeoutMS: 5000
};

const catalogDb1Connection = mongoose.createConnection(catalogDb1Uri, connOptions);
catalogDb1Connection.on('connecting', () => logger.info('MongoDB DB1 connecting...'));
catalogDb1Connection.on('connected', () => logger.info('MongoDB DB1 (catalog_db_1 — Primary Catalog) Connected'));
catalogDb1Connection.on('disconnected', () => logger.warn('MongoDB DB1 Disconnected'));
catalogDb1Connection.on('error', (err) => logger.error('MongoDB DB1 Connection Error: ' + err.message));

const catalogDb2Connection = mongoose.createConnection(catalogDb2Uri, connOptions);
catalogDb2Connection.on('connecting', () => logger.info('MongoDB DB2 connecting...'));
catalogDb2Connection.on('connected', () => logger.info('MongoDB DB2 (catalog_db_2 — Catalog Overflow) Connected'));
catalogDb2Connection.on('disconnected', () => logger.warn('MongoDB DB2 Disconnected'));
catalogDb2Connection.on('error', (err) => logger.error('MongoDB DB2 Connection Error: ' + err.message));

const commerceConnection = mongoose.createConnection(commerceDbUri, connOptions);
commerceConnection.on('connecting', () => logger.info('MongoDB DB3 connecting...'));
commerceConnection.on('connected', () => logger.info('MongoDB DB3 (commerce_db — Users + Commerce) Connected'));
commerceConnection.on('disconnected', () => logger.warn('MongoDB DB3 Disconnected'));
commerceConnection.on('error', (err) => logger.error('MongoDB DB3 Connection Error: ' + err.message));

const operationsConnection = mongoose.createConnection(opsDbUri, connOptions);
operationsConnection.on('connecting', () => logger.info('MongoDB DB4 connecting...'));
operationsConnection.on('connected', () => logger.info('MongoDB DB4 (operations_security_db — Ops + Security) Connected'));
operationsConnection.on('disconnected', () => logger.warn('MongoDB DB4 Disconnected'));
operationsConnection.on('error', (err) => logger.error('MongoDB DB4 Connection Error: ' + err.message));

let overflowActive = false;
let overflowCheckedAt = 0;

function waitForConnection(conn, name, timeoutMs = 5000) {
  return new Promise((resolve) => {
    if (conn.readyState === 1) {
      return resolve();
    }
    const onConnected = () => {
      cleanup();
      resolve();
    };
    const onError = (err) => {
      cleanup();
      logger.warn(`${name} connection error: ${err.message}`);
      resolve();
    };
    const onTimeout = () => {
      cleanup();
      logger.warn(`${name} connection timed out after ${timeoutMs}ms — continuing without it`);
      resolve();
    };
    const cleanup = () => {
      conn.off('connected', onConnected);
      conn.off('error', onError);
      clearTimeout(timer);
    };
    conn.on('connected', onConnected);
    conn.on('error', onError);
    const timer = setTimeout(onTimeout, timeoutMs);
  });
}

async function connectDB() {
  if (!catalogDb1Uri) {
    logger.error('MONGO_DB_1_URI is missing! Cannot start.');
    process.exit(1);
  }

  try {
    logger.info('Connecting to MongoDB databases...');
    await Promise.all([
      waitForConnection(catalogDb1Connection, 'DB1'),
      waitForConnection(catalogDb2Connection, 'DB2'),
      waitForConnection(commerceConnection, 'DB3'),
      waitForConnection(operationsConnection, 'DB4')
    ]);
    logger.info('MongoDB connection phase complete');
  } catch (error) {
    logger.error(`MongoDB connection failure: ${error.message}`);
  }
}

async function checkOverflowStatus() {
  const now = Date.now();
  if (now - overflowCheckedAt < 60_000) return overflowActive;
  overflowCheckedAt = now;
  try {
    const admin = catalogDb1Connection.db.admin();
    const stats = await catalogDb1Connection.db.command({ dbStats: 1 });
    const productCount = await catalogDb1Connection.db.collection('products').estimatedDocumentCount();
    const sizeGB = (stats.storageSize || 0) / (1024 ** 3);
    if (productCount >= CATALOG_OVERFLOW_THRESHOLD || sizeGB >= 4) {
      if (!overflowActive) {
        logger.warn(`[Catalog Overflow] DB1 reached threshold (products=${productCount}, size=${sizeGB.toFixed(2)}GB). Activating DB2 (catalog_db_2) for new product writes.`);
        overflowActive = true;
      }
    } else {
      if (overflowActive) {
        logger.info(`[Catalog Overflow] DB1 below threshold (products=${productCount}, size=${sizeGB.toFixed(2)}GB). Reverting primary writes to DB1.`);
        overflowActive = false;
      }
    }
    return overflowActive;
  } catch (err) {
    logger.warn(`Overflow check failed: ${err.message}`);
    return false;
  }
}

const getCatalogDb1Connection = () => catalogDb1Connection;
const getCatalogDb2Connection = () => catalogDb2Connection;

const getCatalogPrimaryConnection = async () => {
  const overflow = await checkOverflowStatus();
  return overflow ? catalogDb2Connection : catalogDb1Connection;
};

const getCatalogPrimaryConnectionSync = () => overflowActive ? catalogDb2Connection : catalogDb1Connection;

const getCatalogReadConnections = () => [catalogDb1Connection, catalogDb2Connection];

const getCommerceConnection = () => commerceConnection;

const getOperationsConnection = () => operationsConnection;

module.exports = {
  connectDB,
  getCatalogDb1Connection,
  getCatalogDb2Connection,
  getCatalogPrimaryConnection,
  getCatalogPrimaryConnectionSync,
  getCatalogReadConnections,
  getCommerceConnection,
  getOperationsConnection,
  getCoreConnection: getCatalogDb1Connection,
  getUsersConnection: getCommerceConnection,
  getPromotionsConnection: getOperationsConnection,
  getSecurityConnection: getOperationsConnection,
  getMessagingConnection: getCommerceConnection,
  getAnalyticsConnection: getOperationsConnection,
  isCatalogOverflowActive: () => overflowActive,
  CATALOG_OVERFLOW_THRESHOLD
};
