/**
 * Task.js - Task Model
 *
 * Stores event tasks with due dates, reminders, and Google Calendar integration.
 *
 * Fields:
 * - title, description: Task info
 * - dueDate, dueTime: When task is due (dueDate required, dueTime defaults to 09:00)
 * - priority: low/medium/high/urgent
 * - status: pending/in_progress/completed/cancelled
 * - category: venue, catering, decoration, entertainment, etc.
 * - reminderDate, reminderTime, reminderRecurrence: Reminder settings
 * - googleCalendarEventId: For Google Calendar sync
 * - completedAt: Auto-set when status becomes 'completed'
 *
 * Virtuals:
 * - daysUntilDue: Days remaining (negative if overdue)
 * - isOverdue: Boolean, true if past due and not completed
 *
 * Hooks:
 * - pre('save'): Validates reminder is before due date, sets completedAt
 *
 * Indexes: event+user, dueDate, status, priority, compound indexes
 */

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
  dueTime: {
    type: String,
    validate: {
        validator: function(value) {
        if (!value) return true; 
        return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value); 
        },
        message: function() {
        return i18next.t('events.validation.invalidTimeFormat');
        }
    },
    default: '09:00'
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
  reminderTime: {
    type: String,
    validate: {
      validator: function(value) {
        if (!value) return true; 
        return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value); 
      },
      message: function() {
        return i18next.t('events.validation.invalidTimeFormat');
      }
    },
    default: '09:00'
  },
  reminderRecurrence: {
    type: String,
    enum: ['none', 'daily', 'weekly', 'biweekly'],
    default: 'none'
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
TaskSchema.index({ event: 1, dueDate: 1 });
TaskSchema.index({ event: 1, status: 1 });
TaskSchema.index({ event: 1, priority: 1 });

TaskSchema.pre('save', function(next) {
  this.updatedAt = Date.now();

  if (this.status === 'completed' && !this.completedAt) {
    this.completedAt = Date.now();
  } else if (this.status !== 'completed') {
    this.completedAt = undefined;
  }

  if (this.reminderDate && this.dueDate) {
    const reminderDateTime = new Date(this.reminderDate);
    const dueDateTime = new Date(this.dueDate);

    if (this.reminderTime) {
      const [reminderHour, reminderMinute] = this.reminderTime.split(':');
      reminderDateTime.setHours(parseInt(reminderHour), parseInt(reminderMinute), 0, 0);
    }

    if (this.dueTime) {
      const [dueHour, dueMinute] = this.dueTime.split(':');
      dueDateTime.setHours(parseInt(dueHour), parseInt(dueMinute), 0, 0);
    }

    if (reminderDateTime >= dueDateTime) {
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