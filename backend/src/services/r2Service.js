const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const logger = require('../utils/logger');

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'superui-downloads';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

let r2Client = null;

function getR2Client() {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    return null;
  }
  if (!r2Client) {
    const endpoint = 'https://' + R2_ACCOUNT_ID + '.r2.cloudflarestorage.com';
    r2Client = new S3Client({
      region: 'auto',
      endpoint: endpoint,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return r2Client;
}

class R2Service {
  async generatePresignedDownloadUrl(key, expiresInSeconds) {
    const ttl = expiresInSeconds || 900;
    const client = getR2Client();
    if (!client) {
      logger.warn('[R2Service] R2 is not configured. Returning null for presigned URL.');
      return null;
    }
    try {
      const command = new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key });
      return await getSignedUrl(client, command, { expiresIn: ttl });
    } catch (err) {
      logger.error('[R2Service] Failed to generate presigned URL for key "' + key + '": ' + err.message);
      return null;
    }
  }

  async uploadFile(key, buffer, mimeType) {
    const client = getR2Client();
    if (!client) {
      logger.warn('[R2Service] R2 is not configured. Skipping upload.');
      return null;
    }
    try {
      const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: mimeType || 'application/octet-stream',
      });
      await client.send(command);
      logger.info('[R2Service] Uploaded file to R2: ' + key);
      return key;
    } catch (err) {
      logger.error('[R2Service] Failed to upload file "' + key + '": ' + err.message);
      return null;
    }
  }

  getPublicUrl(key) {
    if (!R2_PUBLIC_URL || !key) return null;
    return R2_PUBLIC_URL.replace(/\/$/, '') + '/' + key;
  }
}

module.exports = new R2Service();