const mongoose = require('mongoose');
const i18next = require('i18next');

const GuestSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: function() {
      return [true, i18next.t('validation.firstNameRequired')];
    },
    trim: true
  },
  lastName: {
    type: String,
    required: function() {
      return [true, i18next.t('validation.lastNameRequired')];
    },
    trim: true
  },
  phone: {
    type: String,
    required: function() {
      return [true, i18next.t('validation.phoneRequired')];
    },
    validate: {
      validator: function(v) {
        if (!v || v.trim() === '') return false;
        return /^05\d-\d{7}$/.test(v);
      },
      message: function() {
        return i18next.t('validation.invalidPhoneFormat');
      }
    }
  },
  group: {
    type: String,
    required: function() {
      return [true, i18next.t('validation.groupRequired')];
    },
    default: 'other'
  },
  customGroup: {
    type: String,
    trim: true
  },
  rsvpStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'declined', 'no_response'],
    default: 'pending'
  },
  attendingCount: {
    type: Number,
    default: 1,
    min: 0,
    max: 20
  },
  invitationSent: {
    type: Boolean,
    default: false
  },
  invitationSentAt: {
    type: Date
  },
  rsvpReceivedAt: {
    type: Date
  },
  guestNotes: {
    type: String,
    trim: true,
    maxlength: 500 
  },
  gifts: [{
    description: {
      type: String,
      trim: true
    },
    value: {
      type: Number,
      min: 0
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: function() {
      return [true, i18next.t('validation.eventRequired')];
    }
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return [true, i18next.t('validation.userRequired')];
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

GuestSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  if (typeof this.attendingCount !== 'number' || isNaN(this.attendingCount)) {
    this.attendingCount = 1;
  }
  
  if (this.rsvpStatus === 'declined') {
    this.attendingCount = 0;
  }
  
  if (this.rsvpStatus === 'confirmed' && (!this.attendingCount || this.attendingCount < 1)) {
    this.attendingCount = 1;
  }
  
  next();
});

// Create index for better performance
GuestSchema.index({ event: 1, user: 1 });
GuestSchema.index({ phone: 1, event: 1 });

module.exports = mongoose.model('Guest', GuestSchema);