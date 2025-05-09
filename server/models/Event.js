const mongoose = require('mongoose');
const i18next = require('i18next');

const EventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: function() {
      return i18next.t('validation.eventTitleRequired');
    },
    trim: true
  },
  date: {
    type: Date,
    required: function() {
      return i18next.t('validation.eventDateRequired');
    }
  },
  time: {
    type: String,
    required: function() {
      return i18next.t('validation.eventTimeRequired');
    },
    default: '18:00',  // שעה ברירת מחדל (6 בערב) בפורמט 24 שעות
    validate: {
      validator: function(v) {
        // בדיקה שהערך הוא בפורמט תקין של שעה בתבנית 24 שעות
        return /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/.test(v);
      },
      message: function() {
        return i18next.t('validation.invalidTimeFormat');
      }
    }
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return i18next.t('validation.eventUserRequired');
    }
  },
  type: {
    type: String,
    enum: ['wedding', 'bar_mitzvah', 'birthday', 'corporate', 'conference', 'other'],
    default: 'other'
  },
  guestCount: {
    type: Number,
    default: 0
  },
  notes: {
    type: String,
    trim: true
  },
  venue: {
    name: String,
    address: String,
    phone: String,
    website: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Event = mongoose.model('Event', EventSchema);

module.exports = Event;