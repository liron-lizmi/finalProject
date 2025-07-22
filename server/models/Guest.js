const mongoose = require('mongoose');

const GuestSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'validation.firstNameRequired'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'validation.lastNameRequired'],
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'validation.phoneRequired'],
    validate: {
      validator: function(v) {
        if (!v || v.trim() === '') return false;
        return /^05\d-\d{7}$/.test(v);
      },
      message: 'validation.invalidPhoneFormat'
    }
  },
  group: {
    type: String,
    required: [true, 'validation.groupRequired'],
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
    trim: true
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
    required: [true, 'validation.eventRequired']
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'validation.userRequired']
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
  
  if (['family', 'friends', 'work', 'other'].includes(this.group)) {
    this.customGroup = undefined;
  } else {
    if (!this.customGroup) {
      this.customGroup = this.group;
    }
  }
  
  next();
});

GuestSchema.virtual('displayGroup').get(function() {
  if (['family', 'friends', 'work', 'other'].includes(this.group)) {
    return this.group;
  }
  return this.customGroup || this.group;
});

const Guest = mongoose.model('Guest', GuestSchema);
module.exports = Guest;