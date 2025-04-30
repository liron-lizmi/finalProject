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
  time: {
    type: String,
    required: true,
    default: '18:00',  // שעה ברירת מחדל (6 בערב) בפורמט 24 שעות
    validate: {
      validator: function(v) {
        // בדיקה שהערך הוא בפורמט תקין של שעה בתבנית 24 שעות
        return /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/.test(v);
      },
      message: props => `${props.value} אינו פורמט שעה תקין. יש להשתמש בפורמט 24 שעות (למשל: 18:00)`
    }
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