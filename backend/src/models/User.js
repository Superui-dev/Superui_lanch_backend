const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  label: { type: String, default: 'Home' },
  fullName: { type: String },
  type: { type: String, enum: ['billing', 'shipping', 'both'], default: 'both' },
  line1: { type: String, required: true },
  line2: { type: String },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  country: { type: String, required: true, default: 'IN' },
  isDefault: { type: Boolean, default: false }
}, { _id: true });

const userSchema = new mongoose.Schema({
  authUserId: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true,
    trim: true,
    lowercase: true 
  },
  name: { type: String, trim: true },
  phone: { type: String, trim: true },
  avatar: { type: String },
  avatarUrl: { type: String }, // Table 2 profile field
  emailVerified: { type: Boolean, default: false }, // Table 1 field
  
  // Table 2 Profile Attributes
  companyName: { type: String, trim: true },
  gstNumber: { type: String, trim: true },
  panNumber: { type: String, trim: true },
  dateOfBirth: { type: Date },
  gender: { type: String, enum: ['male', 'female', 'other', 'unspecified'], default: 'unspecified' },
  preferredContact: { type: String, enum: ['email', 'phone', 'whatsapp'], default: 'email' },

  addresses: [addressSchema],
  role: { 
    type: String, 
    enum: ['customer', 'admin'], 
    default: 'customer' 
  },
  customerId: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  mfaEnabled: { type: Boolean, default: false },
  status: { 
    type: String, 
    enum: ['active', 'inactive', 'disabled', 'blocked'], 
    default: 'active' 
  },
  lastLoginAt: { type: Date }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Auto-generate customerId for new customers with safe fallback
userSchema.pre('validate', async function(next) {
  if (this.isNew && this.role === 'customer' && !this.customerId) {
    try {
      const { generateCustomId } = require('../utils/idGenerator');
      this.customerId = await generateCustomId('customer');
    } catch (err) {
      const year = new Date().getFullYear();
      const rand = Math.floor(10000 + Math.random() * 90000);
      this.customerId = `CUS-${year}-${rand}`;
    }
  }
  next();
});

const { getCoreConnection, getUsersConnection } = require('../config/db');
const UserModel = getCoreConnection().model('User', userSchema);
try {
  getUsersConnection().model('User', userSchema);
} catch (e) {}
module.exports = UserModel;
