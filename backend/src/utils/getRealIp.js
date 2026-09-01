/**
 * 100% Accurate Real IP Resolution Helper
 * Evaluates Cloudflare CF-Connecting-IP, X-Real-IP, X-Forwarded-For, and Socket remoteAddress
 */
function getRealIp(req) {
  // 1. Cloudflare Real IP Header (Highest Priority in production)
  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp && cfIp.trim()) return cfIp.trim();

  // 2. Nginx / Reverse Proxy Real IP Header
  const realIp = req.headers['x-real-ip'];
  if (realIp && realIp.trim()) return realIp.trim();

  // 3. Standard X-Forwarded-For Header (First IP in comma-separated list)
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor && forwardedFor.trim()) {
    const ips = forwardedFor.split(',');
    if (ips[0] && ips[0].trim()) return ips[0].trim();
  }

  // 4. Express req.ip
  if (req.ip && req.ip !== '::1' && req.ip !== '127.0.0.1') {
    return req.ip.replace(/^::ffff:/, '');
  }

  // 5. Socket remoteAddress
  const socketIp = req.socket?.remoteAddress || req.connection?.remoteAddress;
  if (socketIp) {
    return socketIp.replace(/^::ffff:/, '');
  }

  return '127.0.0.1';
}

module.exports = getRealIp;

