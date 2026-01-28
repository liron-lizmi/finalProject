/**
 * Guest.js - Guest Model
 *
 * Stores guest information for events including RSVP status, attendance,
 * gift tracking, and ride coordination.
 *
 * Fields:
 * - firstName, lastName, phone: Basic info (phone format: 05X-XXXXXXX)
 * - group, customGroup: Guest grouping (family, friends, work, other, custom)
 * - gender: For separated seating events
 * - rsvpStatus: pending/confirmed/declined/no_response
 * - attendingCount, maleCount, femaleCount: Attendance numbers
 * - guestNotes: Notes from guest during RSVP
 * - gift: Post-event gift tracking (hasGift, description, value)
 * - rideInfo: Ride coordination (status, address, seats, contactHistory)
 * - event, user: References
 *
 * Hooks:
 * - pre('save'): Syncs attendingCount with maleCount+femaleCount,
 *   resets counts on decline, cleans up rideInfo fields
 *
 * Indexes:
 * - (event, user): For efficient guest queries
 * - (phone, event): For RSVP lookup by phone
 */

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
  gender: {
    type: String,
    enum: ['male', 'female'],
    required: function() {
      if (this.maleCount > 0 || this.femaleCount > 0) {
        return false;
      }
      return false;
    }
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
  
  maleCount: {
    type: Number,
    default: 0,
    min: 0,
    max: 20
  },
  
  femaleCount: {
    type: Number,
    default: 0,
    min: 0,
    max: 20
  },
  rsvpReceivedAt: {
    type: Date
  },
  guestNotes: {
    type: String,
    trim: true,
    maxlength: 500 
  },
  gift: {
    hasGift: {
      type: Boolean,
      default: false
    },
    description: {
      type: String,
      trim: true,
      maxlength: 200,
      default: ''
    },
    value: {
      type: Number,
      min: 0,
      default: 0
    }
  },
  rideInfo: {
    status: {
      type: String,
      enum: ['offering', 'seeking', 'not_set'],
      default: 'not_set'
    },
    address: {
      type: String,
      trim: true,
      maxlength: 200
    },
    availableSeats: {
      type: Number,
      min: 1,
      max: 8,
      default: 1
    },
    requiredSeats: {
      type: Number,
      min: 1,
      max: 8,
      default: 1
    },
    departureTime: {
      type: String,
      trim: true,
      maxlength: 50
    },
    contactStatus: {
      type: String,
      enum: ['taken', 'not_relevant', 'in_process'],
      default: undefined
    },
    contactHistory: [{
      contactedGuestId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Guest'
      },
      contactedGuestName: {
        type: String,
        trim: true
      },
      action: {
        type: String,
        enum: ['arranged_ride', 'not_relevant', 'no_response']
      },
      timestamp: {
        type: Date,
        default: Date.now
      }
    }],
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
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
  
  if (this.rsvpStatus === 'declined') {
    this.attendingCount = 0;
    this.maleCount = 0;
    this.femaleCount = 0;
  } else if (this.rsvpStatus === 'confirmed') {
    if (this.maleCount > 0 || this.femaleCount > 0) {
      this.attendingCount = (this.maleCount || 0) + (this.femaleCount || 0);
      
      if (this.maleCount > 0 && this.femaleCount === 0) {
        this.gender = 'male';
      } else if (this.femaleCount > 0 && this.maleCount === 0) {
        this.gender = 'female';
      } else if (this.maleCount > 0 && this.femaleCount > 0) {
        this.gender = 'male';
      }
    } else if (!this.attendingCount || this.attendingCount < 1 || isNaN(this.attendingCount)) {
      this.attendingCount = 1;
    }
  }

  if (this.rideInfo && this.isModified('rideInfo')) {
    if (this.rideInfo.status !== 'offering') {
      this.rideInfo.availableSeats = undefined;
    }
    
    if (this.rideInfo.status !== 'seeking') {
      this.rideInfo.requiredSeats = undefined;
    }

    this.rideInfo.lastUpdated = Date.now();
  }
  
  next();
});

GuestSchema.index({ event: 1, user: 1 });
GuestSchema.index({ phone: 1, event: 1 });

module.exports = mongoose.model('Guest', GuestSchema);