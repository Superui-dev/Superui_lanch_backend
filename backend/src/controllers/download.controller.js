const downloadService = require('../services/download.service');
const { sendSuccess } = require('../utils/responses');
const { hashToken } = require('../utils/hash');

class DownloadController {
  async downloadProductFiles(req, res, next) {
    try {
      const { token } = req.params;

      const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || '';

      const files = await downloadService.verifyTokenAndGetFiles(
        token,
        ipAddress,
        userAgent
      );

      return sendSuccess(res, {
        files,
        productName: files[0]?.name || 'Product Files',
        status: 'active',
        expiresAt: null,
        downloadLink: files.find(f => f.downloadUrl)?.downloadUrl || null
      }, 'Secure download links generated successfully');
    } catch (error) {
      return next(error);
    }
  }

  async verifyProductAccessToken(req, res, next) {
    try {
      const { token } = req.params;
      const tokenHash = hashToken(token);

      const DownloadToken = require('../models/DownloadToken');
      const tokenDoc = await DownloadToken.findOne({
        tokenHash,
        type: 'product_access'
      });

      if (!tokenDoc) {
        return res.status(404).json({ success: false, message: 'Product access token is invalid or expired' });
      }

      const Product = require('../models/Product');
      const product = await Product.findById(tokenDoc.productId).lean();
      if (!product || product.status !== 'published') {
        return res.status(404).json({ success: false, message: 'Product is no longer available' });
      }

      const now = new Date();
      if (now > tokenDoc.expiresAt) {
        return res.status(410).json({ success: false, message: 'Product access link has expired' });
      }

      return res.redirect(`${process.env.FRONTEND_ORIGIN || 'http://localhost:5173'}/products/${product.slug || product._id}?access_token=${token}`);
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new DownloadController();
