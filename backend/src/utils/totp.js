const crypto = require('crypto');
const base32 = require('base32');

const TOTP_PERIOD = 30;
const TOTP_DIGITS = 6;
const TOTP_ALGORITHM = 'sha1';
const TOTP_WINDOW = 1;

function base32Encode(buffer) {
  return base32.encode(buffer, { padding: false }).replace(/=+$/g, '');
}

function base32Decode(str) {
  const cleaned = (str || '').toString().trim().replace(/\s+/g, '').replace(/=+$/g, '').toUpperCase();
  if (!cleaned) return Buffer.alloc(0);
  return Buffer.from(base32.decode(cleaned));
}

function generateSecret() {
  const buffer = crypto.randomBytes(20);
  return base32Encode(buffer);
}

function buildOtpauthUri({ secret, account, issuer }) {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: TOTP_ALGORITHM.toUpperCase(),
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD)
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

async function buildQrDataURL({ secret, account, issuer }) {
  const uri = buildOtpauthUri({ secret, account, issuer });
  try {
    const QRCode = require('qrcode');
    return await QRCode.toDataURL(uri, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 240,
      color: { dark: '#0f172a', light: '#ffffff' }
    });
  } catch (err) {
    const fallback = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=2&data=${encodeURIComponent(uri)}`;
    return { qrCodeUrl: fallback, uri };
  }
  return { uri };
}

function generateCounterFromTime(time = Date.now()) {
  return Math.floor(time / 1000 / TOTP_PERIOD);
}

function hotp(secretBase32, counter) {
  const key = base32Decode(secretBase32);
  if (!key || key.length === 0) {
    throw new Error('Invalid TOTP secret');
  }
  const buffer = Buffer.alloc(8);
  for (let i = 0; i < 8; i++) {
    buffer[7 - i] = counter & 0xff;
    counter = Math.floor(counter / 256);
  }
  const hmac = crypto.createHmac(TOTP_ALGORITHM, key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = (
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  ) % (10 ** TOTP_DIGITS);
  return String(code).padStart(TOTP_DIGITS, '0');
}

function verifyCode(secretBase32, code, { window = TOTP_WINDOW, time = Date.now() } = {}) {
  if (!secretBase32 || !code) return false;
  const cleanCode = String(code).replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleanCode)) return false;
  const counter = generateCounterFromTime(time);
  for (let i = -window; i <= window; i++) {
    const candidate = hotp(secretBase32, counter + i);
    if (timingSafeEqual(candidate, cleanCode)) {
      return true;
    }
  }
  return false;
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = {
  generateSecret,
  buildOtpauthUri,
  buildQrDataURL,
  verifyCode,
  hotp,
  TOTP_PERIOD,
  TOTP_DIGITS
};
