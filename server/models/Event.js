// models/Event.js
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
    default: '18:00',  
    validate: {
      validator: function(v) {
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
  venue: {
    name: String,
    address: String,
    phone: String,
    website: String 
  },
  vendors: [{
    name: {
      type: String,
      required: function() {
        return i18next.t('validation.vendorNameRequired');
      }
    },
    category: {
      type: String,
      required: function() {
        return i18next.t('validation.vendorCategoryRequired');
      },
      enum: ['catering', 'photography', 'music', 'decoration', 'lighting', 'flowers', 'other']
    },
    phone: {
      type: String,
      required: function() {
        return i18next.t('validation.vendorPhoneRequired');
      },
      default: '000-000-0000',
      validate: {
        validator: function(v) {
          if (!v || v.trim() === '') return false;
          return /^[0-9+\-\s()]*$/.test(v);
        },
        message: function() {
          return i18next.t('validation.invalidPhoneFormat');
        }
      }
    },
    notes: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Event = mongoose.model('Event', EventSchema);

module.exports = Event;