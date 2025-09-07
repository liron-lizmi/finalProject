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

/**
 * Pre-save middleware to update timestamps and validate ride info
 */
GuestSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Ensure attendingCount is a valid number
  if (typeof this.attendingCount !== 'number' || isNaN(this.attendingCount)) {
    this.attendingCount = 1;
  }
  
  // Set attendingCount to 0 for declined guests
  if (this.rsvpStatus === 'declined') {
    this.attendingCount = 0;
  }
  
  // Ensure confirmed guests have at least 1 attendingCount
  if (this.rsvpStatus === 'confirmed' && (!this.attendingCount || this.attendingCount < 1)) {
    this.attendingCount = 1;
  }

  // Clean up ride info fields based on status
  if (this.rideInfo) {
    if (this.rideInfo.status !== 'offering') {
      this.rideInfo.availableSeats = undefined;
    }
    
    if (this.rideInfo.status !== 'seeking') {
      this.rideInfo.requiredSeats = undefined;
    }

    // Update ride info timestamp when modified
    if (this.rideInfo.lastUpdated) {
      this.rideInfo.lastUpdated = Date.now();
    }
  }
  
  next();
});

// Create indexes for better query performance
GuestSchema.index({ event: 1, user: 1 });
GuestSchema.index({ phone: 1, event: 1 });

module.exports = mongoose.model('Guest', GuestSchema);