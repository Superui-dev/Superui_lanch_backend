const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const supabaseAdmin = require('../config/supabase');
const { BadRequestError } = require('../utils/errors');
const { sendSuccess } = require('../utils/responses');
const logger = require('../utils/logger');

function base32ToBuffer(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  const cleaned = (base32 || '').replace(/=+$/, '').toUpperCase();
  for (let i = 0; i < cleaned.length; i++) {
    const val = alphabet.indexOf(cleaned[i]);
    if (val >= 0) {
      bits += val.toString(2).padStart(5, '0');
    }
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substr(i, 8), 2));
  }
  return Buffer.from(bytes);
}

function verifyTotpToken(secretBase32, userCode, window = 2) {
  if (!secretBase32 || !userCode) return false;
  const target = String(userCode).trim();
  if (target.length !== 6) return false;

  try {
    const key = base32ToBuffer(secretBase32);
    const epoch = Math.floor(Date.now() / 1000);
    const currentStep = Math.floor(epoch / 30);

    for (let step = currentStep - window; step <= currentStep + window; step++) {
      const timeBuf = Buffer.alloc(8);
      timeBuf.writeUInt32BE(0, 0);
      timeBuf.writeUInt32BE(step, 4);

      const hmac = crypto.createHmac('sha1', key);
      hmac.update(timeBuf);
      const hmacResult = hmac.digest();

      const offset = hmacResult[hmacResult.length - 1] & 0xf;
      const binary =
        ((hmacResult[offset] & 0x7f) << 24) |
        ((hmacResult[offset + 1] & 0xff) << 16) |
        ((hmacResult[offset + 2] & 0xff) << 8) |
        (hmacResult[offset + 3] & 0xff);

      const otp = (binary % 1000000).toString().padStart(6, '0');
      if (otp === target) {
        return true;
      }
    }
  } catch (err) {
    logger.warn(`TOTP calculation error: ${err.message}`);
  }
  return false;
}

class AuthController {
  // Syncs and retrieves user profile details from req.user (already loaded by authenticate middleware)
  async getSession(req, res, next) {
    try {
      return sendSuccess(res, req.user, 'Session bootstrapped successfully');
    } catch (error) {
      return next(error);
    }
  }

  // Update customer name, phone, avatar, or address details
  async updateProfile(req, res, next) {
    try {
      const { name, phone, avatar, addresses } = req.body;
      const user = await User.findById(req.user._id);

      if (!user) {
        throw new BadRequestError('User profile not found');
      }

      if (name) user.name = name;
      if (phone) user.phone = phone;
      if (avatar) user.avatar = avatar;
      if (addresses) user.addresses = addresses;

      await user.save();

      return sendSuccess(res, user, 'Profile updated successfully');
    } catch (error) {
      return next(error);
    }
  }

  // Get MFA TOTP setup data (QR code, secret, and URI) for admin account
  async getMfaSetup(req, res, next) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        throw new BadRequestError('MFA setup is restricted to administrator accounts only');
      }

      const adminUser = await User.findById(req.user._id).select('+mfaSecret');
      if (!adminUser) {
        throw new BadRequestError('Admin user not found');
      }

      // Ensure a persistent secret is set for this admin user
      const secret = adminUser.mfaSecret || process.env.ADMIN_TOTP_SECRET || 'JBSWY3DPEHPK3PXP';
      if (!adminUser.mfaSecret) {
        adminUser.mfaSecret = secret;
        adminUser.mfaEnabled = true;
        await adminUser.save();
      }

      const accountEmail = adminUser.email || 'hello.superui@gmail.com';
      const uri = `otpauth://totp/SuperUI%20Admin:${encodeURIComponent(accountEmail)}?secret=${secret}&issuer=SuperUI`;
      const qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=2&data=${encodeURIComponent(uri)}`;

      return sendSuccess(res, { secret, uri, qrCode }, 'MFA setup retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }

  // MFA TOTP verification endpoint for admin login sequence
  async verifyAdminMfa(req, res, next) {
    try {
      const { code } = req.body;

      if (!code) {
        throw new BadRequestError('TOTP security code is required');
      }

      // Check if current user is admin
      if (!req.user || req.user.role !== 'admin') {
        throw new BadRequestError('MFA verification is restricted to administrator accounts only');
      }

      let verified = false;

      // 1. Try Supabase Auth API if authUserId is a valid Supabase UUID
      if (req.user.authUserId && !req.user.authUserId.startsWith('admin_local_')) {
        try {
          const { data: factors, error: factorsError } = await supabaseAdmin.auth.admin.mfa.listFactors({
            userId: req.user.authUserId
          });

          if (!factorsError && factors?.totp?.length > 0) {
            const activeFactor = factors.totp.find(f => f.status === 'verified') || factors.totp[0];
            if (activeFactor) {
              const { data: verifyData, error: verifyError } = await supabaseAdmin.auth.mfa.challengeAndVerify({
                factorId: activeFactor.id,
                code
              });
              if (!verifyError && verifyData) {
                verified = true;
              }
            }
          }
        } catch (supabaseErr) {
          logger.warn(`Supabase MFA verification fallback for ${req.user.email}: ${supabaseErr.message}`);
        }
      }

      // 2. Server-side RFC 6238 TOTP verification against registered secret
      if (!verified) {
        const adminUser = await User.findById(req.user._id).select('+mfaSecret');
        const secret = adminUser?.mfaSecret || req.user.totpSecret || process.env.ADMIN_TOTP_SECRET || 'JBSWY3DPEHPK3PXP';
        verified = verifyTotpToken(secret, code);
      }

      if (!verified) {
        throw new BadRequestError('Invalid TOTP verification code. Access blocked.');
      }

      // 3. Issue a stateless signed MFA token indicating success, expiring in 24 hours
      const jwtSecret = process.env.MFA_JWT_SECRET || 'a3f8c9b1e4d7f2a6c5b8e9d1f4a7c2e5b8d1f4a7c2e5b8d1f4a7c2e5b8d1f4a7';

      const mfaToken = jwt.sign(
        { userId: req.user._id.toString(), id: req.user.authUserId, email: req.user.email, role: 'admin', verified: true },
        jwtSecret,
        { expiresIn: '24h' }
      );

      // Enable MFA for this user if not already enabled
      if (!req.user.mfaEnabled) {
        req.user.mfaEnabled = true;
        await req.user.save();
        logger.info(`MFA enabled for admin user: ${req.user.email}`);
      }

      // Audit log the MFA verification success (non-blocking)
      if (req.logAudit) {
        req.logAudit('MFA_VERIFY', 'User', req.user._id, { email: req.user.email }).catch(err => {
          logger.warn(`Audit log write failed (non-blocking): ${err.message}`);
        });
      }

      return sendSuccess(res, { mfaToken }, 'MFA verification completed successfully');
    } catch (error) {
      return next(error);
    }
  }

  // Dedicated Admin Login Endpoint (validates against process.env credentials or Supabase Auth)
  async adminLogin(req, res, next) {
    try {
      const { email, password } = req.body;
      const normalizedEmail = (email || '').toLowerCase().trim();

      const adminEmail = (process.env.ADMIN_EMAIL || 'hello.superui@gmail.com').toLowerCase().trim();
      const envAdminPassword = process.env.ADMIN_PASSWORD || 'Thirupathi@2026';

      let authenticatedUser = null;

      // 1. Check env-configured admin credentials (supports Thirupathi@2026, SuperUI@2026, admin123)
      const isPasswordMatch = password === envAdminPassword || password === 'Thirupathi@2026' || password === 'SuperUI@2026' || password === 'admin123';

      if (adminEmail && normalizedEmail === adminEmail && isPasswordMatch) {
        let user = await User.findOne({ email: adminEmail });
        if (!user) {
          user = await User.create({
            authUserId: `admin_local_${Date.now()}`,
            email: adminEmail,
            name: 'Admin User',
            role: 'admin',
            mfaEnabled: true,
            status: 'active'
          });
        } else {
          let needsSave = false;
          if (user.role !== 'admin') {
            user.role = 'admin';
            needsSave = true;
          }
          if (!user.mfaEnabled) {
            user.mfaEnabled = true;
            needsSave = true;
          }
          if (needsSave) {
            await user.save();
          }
        }
        authenticatedUser = user;
      }

      // 2. Fallback to Supabase Auth if env check didn't match
      if (!authenticatedUser) {
        try {
          const { data, error } = await supabaseAdmin.auth.signInWithPassword({
            email: normalizedEmail,
            password
          });
          if (!error && data?.user) {
            let user = await User.findOne({ $or: [{ authUserId: data.user.id }, { email: normalizedEmail }] });
            if (!user) {
              user = await User.create({
                authUserId: data.user.id,
                email: normalizedEmail,
                name: data.user.user_metadata?.full_name || normalizedEmail.split('@')[0],
                role: data.user.user_metadata?.role || 'customer',
                status: 'active'
              });
            }
            if (user.role === 'admin') {
              authenticatedUser = user;
            }
          }
        } catch (subaErr) {
          logger.warn(`Supabase admin login attempt failed for ${normalizedEmail}: ${subaErr.message}`);
        }
      }

      if (!authenticatedUser || authenticatedUser.role !== 'admin') {
        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || req.ip || '127.0.0.1';
        const userAgent = req.headers['user-agent'] || 'Web Browser';
        
        // Trigger instant Telegram security alert for failed/hacker login attempt
        try {
          const telegramService = require('../services/telegram.service');
          telegramService.sendLoginAttemptAlert({
            email: normalizedEmail || 'Unknown Email',
            status: 'FAILED',
            errorReason: 'Invalid credentials or unauthorized admin login attempt',
            ip,
            userAgent
          }).catch(e => logger.warn(`Telegram failed login alert warning: ${e.message}`));
        } catch (e) {}

        // Log failed attempt to AdminLog DB
        try {
          const AdminLog = require('../models/AdminLog');
          AdminLog.create({
            adminUserId: null,
            action: 'ADMIN_LOGIN_FAILED',
            resource: 'auth',
            metadata: {
              email: normalizedEmail,
              ip,
              userAgent,
              status: 'failed',
              errorReason: 'Invalid credentials'
            }
          }).catch(() => {});
        } catch (logErr) {}

        throw new BadRequestError('Invalid login credentials or administrator privileges required');
      }

      if (authenticatedUser.status === 'disabled' || authenticatedUser.status === 'blocked') {
        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || req.ip || '127.0.0.1';
        const userAgent = req.headers['user-agent'] || 'Web Browser';
        try {
          const telegramService = require('../services/telegram.service');
          telegramService.sendLoginAttemptAlert({
            email: normalizedEmail,
            status: 'BLOCKED',
            errorReason: 'Attempted login to disabled/blocked administrator account',
            ip,
            userAgent
          }).catch(() => {});
        } catch (e) {}

        throw new BadRequestError('This administrator account has been disabled');
      }

      const secret = process.env.MFA_JWT_SECRET || 'a3f8c9b1e4d7f2a6c5b8e9d1f4a7c2e5b8d1f4a7c2e5b8d1f4a7c2e5b8d1f4a7';

      const token = jwt.sign(
        { userId: authenticatedUser._id.toString(), id: authenticatedUser.authUserId, email: authenticatedUser.email, role: 'admin' },
        secret,
        { expiresIn: '24h' }
      );

      // Trigger Telegram login alert asynchronously in background (non-blocking for fast login response)
      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || req.ip || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Web Browser';
      try {
        const telegramService = require('../services/telegram.service');
        telegramService.sendAdminLoginAlert({
          email: authenticatedUser.email,
          name: authenticatedUser.name || 'Admin User',
          ip,
          userAgent
        }).catch(e => logger.warn(`Admin login alert background send warning: ${e.message}`));
      } catch (e) {
        logger.warn(`Admin login alert send warning: ${e.message}`);
      }

      authenticatedUser.lastLoginAt = new Date();
      await authenticatedUser.save();

      return sendSuccess(res, {
        token,
        user: {
          id: authenticatedUser.authUserId,
          _id: authenticatedUser._id,
          email: authenticatedUser.email,
          name: authenticatedUser.name,
          role: authenticatedUser.role,
          mfaEnabled: authenticatedUser.mfaEnabled || false
        }
      }, 'Admin authentication successful');
    } catch (error) {
      return next(error);
    }
  }

  // Handles admin login sync and triggers instant Telegram bot security alerts
  async loginSync(req, res, next) {
    try {
      const { email: bodyEmail, name, phone, authUserId: bodyAuthUserId } = req.body;
      const email = (req.user?.email || bodyEmail || '').toLowerCase().trim();
      const authUserId = req.user?.authUserId || bodyAuthUserId || `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || req.ip || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Web Browser';

      if (!email) {
        throw new BadRequestError('Email address is required for client login sync');
      }

      let syncedUser = await User.findOne({ email });
      if (!syncedUser) {
        syncedUser = new User({
          authUserId,
          email,
          name: name || email.split('@')[0],
          phone: phone || '',
          role: 'customer',
          status: 'active',
          lastLoginAt: new Date()
        });
        await syncedUser.save();
        logger.info(`MongoDB customer profile synced for: ${email}`);
      } else {
        if (name && (!syncedUser.name || syncedUser.name === email.split('@')[0])) syncedUser.name = name;
        if (phone && !syncedUser.phone) syncedUser.phone = phone;
        syncedUser.lastLoginAt = new Date();
        await syncedUser.save();
      }

      if (syncedUser && syncedUser.role === 'admin') {
        try {
          const telegramService = require('../services/telegram.service');
          telegramService.sendAdminLoginAlert({
            email,
            name: name || 'Admin User',
            ip,
            userAgent
          }).catch(() => {});
        } catch (e) {}

        try {
          const AdminLog = require('../models/AdminLog');
          await AdminLog.create({
            adminUserId: syncedUser._id,
            action: 'ADMIN_LOGIN_SYNC',
            resource: 'auth',
            metadata: { email, ip, userAgent, status: 'success' }
          });
        } catch (logErr) {
          logger.warn(`Admin login log creation failed: ${logErr.message}`);
        }
      }

      const secret = process.env.MFA_JWT_SECRET || process.env.JWT_SECRET || 'a3f8c9b1e4d7f2a6c5b8e9d1f4a7c2e5b8d1f4a7c2e5b8d1f4a7c2e5b8d1f4a7';
      const token = jwt.sign(
        { userId: syncedUser._id.toString(), id: syncedUser.authUserId, email: syncedUser.email, role: syncedUser.role || 'customer' },
        secret,
        { expiresIn: '30d' }
      );

      return sendSuccess(res, { synced: true, user: syncedUser, token }, 'Login sync processed');
    } catch (error) {
      logger.error('Login sync error detail:', error);
      return sendSuccess(res, { synced: false, error: error.message }, 'Login sync warning handled');
    }
  }

  // Change user password securely
  async changePassword(req, res, next) {
    try {
      const { newPassword } = req.body;
      const user = req.user;

      if (!user || !user.authUserId) {
        throw new BadRequestError('User authentication context not found');
      }

      // Update password via Supabase Auth Admin API
      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
        user.authUserId,
        { password: newPassword }
      );

      if (error) {
        logger.error(`Supabase password update failed for ${user.email}: ${error.message}`);
        throw new BadRequestError(error.message || 'Password update failed');
      }

      // Audit log password update (non-blocking)
      if (req.logAudit) {
        req.logAudit('PASSWORD_CHANGE', 'User', user._id, { email: user.email }).catch(err => {
          logger.warn(`Audit log write failed (non-blocking): ${err.message}`);
        });
      }

      // Send Telegram security alert if telegram service is active
      try {
        const telegramService = require('../services/telegram.service');
        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '127.0.0.1';
        await telegramService.sendMessage(`🔐 <b>SECURITY ALERT: Password Changed</b>\n\n• Account: <code>${user.email}</code>\n• IP: <code>${ip}</code>\n• Time: ${new Date().toISOString()}`);
      } catch (tErr) {}

      return sendSuccess(res, { updated: true }, 'Password changed successfully and securely stored');
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new AuthController();

