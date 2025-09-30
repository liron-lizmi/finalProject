// server/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const i18next = require('i18next');

const UserSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: false, 
    trim: true,
    default: ''
  },
  lastName: {
    type: String,
    required: false, 
    trim: true,
    default: ''
  },
  email: {
    type: String,
    required: function() {
      return i18next.t('validation.emailRequired');
    },
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: function() {
      return i18next.t('validation.passwordRequired');
    }
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  oauth: {
    provider: String,
    providerId: {
      type: String,
      sparse: true 
    }
  },
  googleTokens: {
    access_token: String,
    refresh_token: String,
    scope: String,
    token_type: String,
    expiry_date: Number
  },
  notifications: [{
    type: {
      type: String,
      enum: ['event_shared'],
      required: true
    },
    message: {
      type: String,
      required: false
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event'
    },
    sharedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    sharerName: {  
      type: String,
      required: false
    },
    eventTitle: {  
      type: String,
      required: false
    },
    read: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

UserSchema.pre('validate', function(next) {
  if (!this.firstName && !this.lastName && !this.oauth) {
    this.invalidate('firstName', 'Either firstName or lastName is required');
    this.invalidate('lastName', 'Either firstName or lastName is required');
  }
  next();
});

UserSchema.index({ 'oauth.provider': 1, 'oauth.providerId': 1 }, { 
  unique: true, 
  sparse: true, 
  partialFilterExpression: { 
    'oauth.providerId': { $ne: null, $exists: true } 
  }
});

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', UserSchema);

module.exports = User;