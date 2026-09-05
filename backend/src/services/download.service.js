const crypto = require('crypto');
const DownloadToken = require('../models/DownloadToken');
const DownloadLog = require('../models/DownloadLog');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { hashToken } = require('../utils/hash');
const { BadRequestError, NotFoundError } = require('../utils/errors');
const logger = require('../utils/logger');
const r2Service = require('./r2Service');

class DownloadService {
  async generateToken(orderId, orderItemId, userId, productId, maxDownloads = 5) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);

    const ttlMinutes = parseInt(process.env.DOWNLOAD_TOKEN_TTL_MINUTES, 10) || 15;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    await DownloadToken.create({
      orderId,
      orderItemId,
      userId,
      productId,
      tokenHash,
      type: 'download',
      expiresAt,
      maxDownloads,
      downloadCount: 0,
      revokedAt: null
    });

    return rawToken;
  }

  async generateProductAccessToken(orderId, orderItemId, userId, productId) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);

    const ttlMinutes = parseInt(process.env.PRODUCT_ACCESS_TOKEN_TTL_MINUTES, 10) || 60;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    await DownloadToken.create({
      orderId,
      orderItemId,
      userId,
      productId,
      tokenHash,
      type: 'product_access',
      expiresAt,
      maxDownloads: 0,
      downloadCount: 0,
      revokedAt: null
    });

    return rawToken;
  }

  async verifyTokenAndGetFiles(rawToken, ipAddress, userAgent) {
    if (!rawToken) {
      throw new BadRequestError('Token is required');
    }

    const tokenHash = hashToken(rawToken);
    const token = await DownloadToken.findOne({ tokenHash });

    if (!token) {
      throw new NotFoundError('Download token is invalid or does not exist');
    }

    const { orderId, userId, productId } = token;

    const logAttempt = async (status) => {
      await DownloadLog.create({
        downloadTokenId: token._id,
        orderId,
        userId,
        productId,
        ipAddress,
        userAgent,
        status
      });
    };

    const order = await Order.findById(orderId);
    if (!order || order.paymentStatus !== 'SUCCESS') {
      await logAttempt('FAILED');
      throw new BadRequestError('Payment has not been completed for this order');
    }

    if (token.revokedAt) {
      await logAttempt('REVOKED');
      throw new BadRequestError('This download link has been revoked by an administrator');
    }

    const now = new Date();
    if (now > token.expiresAt) {
      await logAttempt('EXPIRED');
      throw new BadRequestError('This download link has expired');
    }

    if (token.downloadCount >= token.maxDownloads) {
      await logAttempt('FAILED');
      throw new BadRequestError('Maximum download attempts exceeded for this link');
    }

    const product = await Product.findById(productId);
    if (!product || product.status !== 'published') {
      await logAttempt('FAILED');
      throw new NotFoundError('Product is no longer available for download');
    }

    if (!product.files || product.files.length === 0) {
      await logAttempt('FAILED');
      throw new NotFoundError('No files attached to this product');
    }

    const filesWithUrls = await Promise.all(product.files.map(async (file) => {
      let downloadUrl = null;

      if (file.key && (file.storageProvider === 'r2' || !file.storageProvider)) {
        try {
          downloadUrl = await r2Service.generatePresignedDownloadUrl(file.key);
        } catch (r2Err) {
          logger.error(`Failed to generate R2 presigned URL for key "${file.key}": ${r2Err.message}`);
          downloadUrl = null;
        }
      }

      if (!downloadUrl && file.driveUrl) {
        downloadUrl = file.driveUrl;
      }

      return {
        name: file.name,
        fileName: file.fileName || file.name,
        mimeType: file.mimeType,
        size: file.size,
        downloadUrl,
        storageProvider: file.storageProvider || 'r2',
        key: file.key
      };
    }));

    const hasValidUrls = filesWithUrls.some(f => f.downloadUrl);
    if (!hasValidUrls) {
      await logAttempt('FAILED');
      throw new Error('No download links available for this product');
    }

    token.downloadCount += 1;
    token.lastDownloadedAt = now;
    await token.save();

    await logAttempt('SUCCESS');

    return filesWithUrls;
  }
}

module.exports = new DownloadService();
