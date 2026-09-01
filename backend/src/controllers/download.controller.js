const downloadService = require('../services/download.service');
const { sendSuccess } = require('../utils/responses');

class DownloadController {
  // Verify download token and return files with Drive links
  async downloadProductFiles(req, res, next) {
    try {
      const { token } = req.params;
      
      // Capture request metadata
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || '';

      const files = await downloadService.verifyTokenAndGetFiles(
        token,
        ipAddress,
        userAgent
      );

      return sendSuccess(res, files, 'Secure download links generated successfully');
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new DownloadController();

