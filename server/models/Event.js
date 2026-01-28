/**
 * Event.js - Event Model
 *
 * Stores event information including details, venues, vendors, and sharing.
 *
 * Fields:
 * - title, date, time: Basic event info (time validated as HH:MM)
 * - type: Event category (wedding, birthday, corporate, etc.)
 * - isSeparatedSeating: Whether to use gender-separated seating
 * - guestCount, notes: Additional info
 * - user: Owner reference
 * - venues: Array of venue objects (name, address, phone, website)
 * - vendors: Array of vendor objects (name, category, phone, notes)
 * - sharedWith: Array of share entries (email, userId, permission, accepted)
 *
 * Hooks:
 * - pre('save'): Updates updatedAt timestamp
 */

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
  type: {
    type: String,
    default: 'other',
    enum: ['wedding', 'birthday', 'corporate', 'conference', 'party', 'other']
  },
  isSeparatedSeating: {
    type: Boolean,
    default: false
  },
  guestCount: {
    type: Number,
    default: 0,
    min: 0
  },
  notes: {
    type: String,
    trim: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return i18next.t('validation.eventUserRequired');
    }
  },
  venues: [{
    name: {
      type: String,
      required: function() {
        return i18next.t('validation.venueNameRequired');
      }
    },
    address: {
      type: String,
      required: function() {
        return i18next.t('validation.venueAddressRequired');
      }
    },
    phone: String,
    website: String
  }],
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
      enum: [
        'catering',          
        'photography',       
        'music',            
        'decoration',      
        'lighting',         
        'flowers',          
        'dj',              
        'makeup',         
        'transportation',   
        'other'           
      ]
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
    notes: {
      type: String,
      trim: true
    }
  }],
  sharedWith: [{
    email: {
      type: String,
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    permission: {
      type: String,
      enum: ['view', 'edit'],
      required: true
    },
    sharedAt: {
      type: Date,
      default: Date.now
    },
    accepted: {
      type: Boolean,
      default: false
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

EventSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Event = mongoose.model('Event', EventSchema);
module.exports = Event;