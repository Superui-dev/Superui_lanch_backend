const mongoose = require('mongoose');
const logger = require('../utils/logger');
const dns = require('dns');
try { 
  dns.setDefaultResultOrder('ipv4first');
  dns.setServers(['8.8.8.8', '1.1.1.1']); 
} catch (e) {}

const coreUri = process.env.MONGODB_URI_CORE || process.env.MONGODB_URI || 'mongodb://localhost:27017/superui_core';
const usersUri = process.env.MONGODB_URI_USERS || process.env.MONGODB_URI_MESSAGING || coreUri;
const promotionsUri = process.env.MONGODB_URI_PROMOTIONS || process.env.MONGODB_URI_ANALYTICS || coreUri;
const securityUri = process.env.MONGODB_URI_SECURITY || coreUri;

const connOptions = {
  autoIndex: false,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 15000,
  socketTimeoutMS: 45000,
};

// Initialize connections immediately so models bind to the correct connection instance on require()
const usersConnection = mongoose.createConnection(usersUri, connOptions);
usersConnection.on('connected', () => logger.info('MongoDB DB2 (Users & Orders) Connected'));
usersConnection.on('error', (err) => logger.error('MongoDB DB2 Connection Error: ' + err.message));

const promotionsConnection = mongoose.createConnection(promotionsUri, connOptions);
promotionsConnection.on('connected', () => logger.info('MongoDB DB3 (Promotions & Support) Connected'));
promotionsConnection.on('error', (err) => logger.error('MongoDB DB3 Connection Error: ' + err.message));

const securityConnection = mongoose.createConnection(securityUri, connOptions);
securityConnection.on('connected', () => logger.info('MongoDB DB4 (Logs & Security) Connected'));
securityConnection.on('error', (err) => logger.error('MongoDB DB4 Connection Error: ' + err.message));

async function connectDB() {
  if (!coreUri) {
    logger.error('MONGODB_URI_CORE (or MONGODB_URI) env variable is missing!');
    process.exit(1);
  }

  try {
    // DB1: Catalog Core Database (Products & Categories)
    await mongoose.connect(coreUri, {
      autoIndex: process.env.NODE_ENV !== 'production',
      serverSelectionTimeoutMS: 15000
    });
    logger.info(`MongoDB DB1 (Catalog & Products) Connected`);
  } catch (error) {
    logger.error(`MongoDB core connection failure: ${error.message}`);
    process.exit(1);
  }
}

// Export getters returning the persistent connection instances
const getCoreConnection = () => mongoose.connection;
const getUsersConnection = () => usersConnection;
const getPromotionsConnection = () => promotionsConnection;
const getSecurityConnection = () => securityConnection;

module.exports = {
  connectDB,
  getCoreConnection,
  getUsersConnection,
  getPromotionsConnection,
  getSecurityConnection,
  getMessagingConnection: () => usersConnection,
  getAnalyticsConnection: () => promotionsConnection
};
