// Trigger restart
const dns = require('dns');
try { 
  dns.setDefaultResultOrder('ipv4first');
  dns.setServers(['8.8.8.8', '1.1.1.1']); 
} catch (e) {}
require('dotenv').config();

const http = require('http');
const app = require('./app');
const { connectDB } = require('./config/db');
const { initSockets } = require('./sockets');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;

const { execSync } = require('child_process');

function freePort(port) {
  try {
    if (process.platform === 'win32' && process.env.NODE_ENV !== 'production') {
      const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      const lines = output.trim().split('\n');
      const pids = new Set();
      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5 && parts[1].endsWith(`:${port}`)) {
          const pid = parts[parts.length - 1];
          if (pid && pid !== '0' && pid !== String(process.pid) && pid !== String(process.ppid)) {
            pids.add(pid);
          }
        }
      });
      pids.forEach(pid => {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
          logger.info(`Terminated lingering process (PID ${pid}) on port ${PORT}`);
        } catch (e) {}
      });
    }
  } catch (e) {}
}

function bootstrap() {
  const server = http.createServer(app);

  initSockets(server);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`Port ${PORT} is already in use. Retrying automatic port recovery...`);
      freePort(PORT);
      setTimeout(() => {
        try {
          server.listen(PORT, () => {
            logger.info(`===============================================`);
            logger.info(`  SuperUI Backend Service Booted Successfully  `);
            logger.info(`  Environment: ${process.env.NODE_ENV || 'development'}  `);
            logger.info(`  Port:        ${PORT}                            `);
            logger.info(`===============================================`);
          });
        } catch (retryErr) {
          logger.error('Failed to retry listening on port:', retryErr);
        }
      }, 1000);
    } else {
      logger.error('HTTP Server Error:', err);
    }
  });

  freePort(PORT);

  const expressServer = server.listen(PORT, () => {
    logger.info(`===============================================`);
    logger.info(`  SuperUI Backend Service Booted Successfully  `);
    logger.info(`  Environment: ${process.env.NODE_ENV || 'development'}  `);
    logger.info(`  Port:        ${PORT}                            `);
    logger.info(`===============================================`);
  });

  connectDB().catch(err => {
    logger.error(`Background MongoDB connection failed: ${err.message}`);
  });

  const shutdown = () => {
    logger.warn('SIGTERM/SIGINT signal received. Shutting down gracefully...');
    expressServer.close(() => {
      logger.info('HTTP server closed.');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  process.on('uncaughtException', (err) => {
    logger.error('UNCAUGHT EXCEPTION! Server is shutting down...', err);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('UNHANDLED REJECTION! Promise:', promise, 'Reason:', reason);
  });
}

bootstrap();
