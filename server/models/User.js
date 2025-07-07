const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const i18next = require('i18next');

const UserSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: function() {
      return i18next.t('validation.firstNameRequired');
    }
  },
  lastName: {
    type: String,
    required: function() {
      return i18next.t('validation.lastNameRequired');
    }
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
    providerId: String
  },
  googleTokens: {
    access_token: String,
    refresh_token: String,
    scope: String,
    token_type: String,
    expiry_date: Number
  },
  createdAt: {
    type: Date,
    default: Date.now
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