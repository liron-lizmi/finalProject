const mongoose = require('mongoose');
const i18next = require('i18next');

const TaskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: function() {
      return i18next.t('events.validation.taskTitleRequired');
    },
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  dueDate: {
    type: Date,
    required: function() {
      return i18next.t('events.validation.taskDueDateRequired');
    },
    validate: {
      validator: function(value) {
        return value && !isNaN(new Date(value).getTime());
      },
      message: function() {
        return i18next.t('validation.invalidDateFormat');
     }
    }
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  category: {
    type: String,
    enum: [
      'venue',
      'catering', 
      'decoration',
      'entertainment',
      'photography',
      'invitations',
      'transportation',
      'budget',
      'other'
    ],
    default: 'other'
  },
  reminderDate: {
    type: Date,
    validate: {
      validator: function(value) {
        if (!value) return true; 
        return !isNaN(new Date(value).getTime());
      },
      message: function() {
        return i18next.t('validation.invalidReminderDateFormat');
      }
    }
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  },
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: function() {
      return i18next.t('events.validation.taskEventRequired');
    }
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return i18next.t('events.validation.taskUserRequired');
    }
  },
  googleCalendarEventId: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  }
});

TaskSchema.index({ event: 1, user: 1 });
TaskSchema.index({ dueDate: 1 });
TaskSchema.index({ status: 1 });
TaskSchema.index({ priority: 1 });

TaskSchema.pre('save', function(next) {
  this.updatedAt = Date.now();

  if (this.status === 'completed' && !this.completedAt) {
    this.completedAt = Date.now();
  } else if (this.status !== 'completed') {
    this.completedAt = undefined;
  }

  // Validate reminder date is before due date
  if (this.reminderDate && this.dueDate) {
    const reminderDate = new Date(this.reminderDate);
    const dueDate = new Date(this.dueDate);

    if (reminderDate >= dueDate) {
      const error = new Error(i18next.t('validation.reminderBeforeDue'));
      error.name = 'ValidationError';
      return next(error);
    }
  }

  next();
});

TaskSchema.virtual('daysUntilDue').get(function() {
  if (!this.dueDate) return null;
  const today = new Date();
  const dueDate = new Date(this.dueDate);
  const diffTime = dueDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

TaskSchema.virtual('isOverdue').get(function() {
  if (!this.dueDate || this.status === 'completed') return false;
  return new Date() > new Date(this.dueDate);
});

TaskSchema.set('toJSON', { virtuals: true });
TaskSchema.set('toObject', { virtuals: true });

const Task = mongoose.model('Task', TaskSchema);
module.exports = Task;