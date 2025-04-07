// models/Event.js
const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  date: {
    type: Date,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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