// models/Venue.js
const mongoose = require('mongoose');

const VenueSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  placeId: {
    type: String,
    unique: true,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },
  phone: {
    type: String
  },
  website: {
    type: String
  },
  capacity: {
    min: { type: Number },
    max: { type: Number }
  },
  priceRange: {
    min: { type: Number },
    max: { type: Number }
  },
  venueType: {
    type: [String],
    enum: ['אולם', 'גן אירועים', 'מסעדה', 'מלון', 'מקום פתוח', 'אחר'],
    default: ['אחר']
  },
  eventTypes: {
    type: [String],
    enum: ['חתונה', 'בר/בת מצווה', 'ברית/ה', 'אירוע חברה', 'יום הולדת', 'אחר'],
    default: ['אחר']
  },
  amenities: {
    type: [String],
    default: []
  },
  photos: {
    type: [String],
    default: []
  },
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  reviews: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    text: String,
    rating: Number,
    date: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// אינדקס גיאוגרפי לחיפושים במרחק
VenueSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Venue', VenueSchema);