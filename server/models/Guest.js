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
    // הסרנו את enum כדי לאפשר כל ערך
  },
  customGroup: {
    type: String,
    trim: true
    // שדה נוסף לשמירת שם הקבוצה המותאמת
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

// Pre-save middleware לעיבוד הקבוצות
GuestSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // אם זו קבוצה סטנדרטית, נקה את customGroup
  if (['family', 'friends', 'work', 'other'].includes(this.group)) {
    this.customGroup = undefined;
  } else {
    // אם זו קבוצה מותאמת, שמור אותה ב-customGroup גם
    if (!this.customGroup) {
      this.customGroup = this.group;
    }
  }
  
  next();
});

// Virtual לקבלת שם הקבוצה לתצוגה
GuestSchema.virtual('displayGroup').get(function() {
  if (['family', 'friends', 'work', 'other'].includes(this.group)) {
    return this.group;
  }
  return this.customGroup || this.group;
});

const Guest = mongoose.model('Guest', GuestSchema);
module.exports = Guest;