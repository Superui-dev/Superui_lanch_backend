const crypto = require('crypto');

function hashToken(token) {
  if (!token) return '';
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  hashToken
};

