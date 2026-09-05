const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authenticate = require('../middleware/authenticate');
const auditLog = require('../middleware/auditLog');
const { strictLimiter } = require('../middleware/rateLimiter');
const zod = require('zod');
const validate = require('../middleware/validate');

const profileSchema = zod.object({
  name: zod.string().min(1).optional(),
  phone: zod.string().optional(),
  avatar: zod.string().url().optional().or(zod.literal('')),
  addresses: zod.array(zod.object({
    label: zod.string().default('Home'),
    line1: zod.string(),
    line2: zod.string().optional(),
    city: zod.string(),
    state: zod.string(),
    pincode: zod.string(),
    country: zod.string().default('IN'),
    isDefault: zod.boolean().default(false)
  })).optional()
});

const mfaSchema = zod.object({
  code: zod.string().length(6)
});

const changePasswordSchema = zod.object({
  currentPassword: zod.string().min(1, 'Current password is required'),
  newPassword: zod.string()
    .min(8, 'New password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/, 'New password must contain uppercase, lowercase, number, and special character'),
  confirmPassword: zod.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Confirm password must match new password',
  path: ['confirmPassword']
});

router.get('/session', authenticate, authController.getSession);
router.put('/profile', authenticate, validate({ body: profileSchema }), authController.updateProfile);
router.get('/mfa/setup', strictLimiter, authenticate, authController.getMfaSetup);
router.post('/mfa/verify', strictLimiter, authenticate, auditLog, validate({ body: mfaSchema }), authController.verifyAdminMfa);
router.post('/change-password', strictLimiter, authenticate, auditLog, validate({ body: changePasswordSchema }), authController.changePassword);
const adminLoginSchema = zod.object({
  email: zod.string().email('Valid email address is required'),
  password: zod.string().min(1, 'Password is required')
});

router.post('/admin-login', strictLimiter, validate({ body: adminLoginSchema }), authController.adminLogin);

const { optionalAuthenticate } = require('../middleware/authenticate');

const loginSyncSchema = zod.object({
  email: zod.string().email().optional(),
  name: zod.string().optional(),
  phone: zod.string().optional(),
  authUserId: zod.string().optional()
});
router.post('/login-sync', optionalAuthenticate, validate({ body: loginSyncSchema }), authController.loginSync);

module.exports = router;
