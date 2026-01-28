/**
 * Budget.js - Budget Model
 *
 * Stores event budget information including total budget, category allocations,
 * expense items, and income entries (including gifts).
 *
 * Schemas:
 * - BudgetItemSchema: Individual expense items (category, amount, isPaid, etc.)
 * - BudgetCategorySchema: Category allocations (category name, allocated amount)
 * - BudgetSchema: Main budget with totals, items, and incomes
 *
 * Categories: venue, catering, photography, music, decoration, makeup,
 *             clothing, transportation, gifts, other
 *
 * Income sources: gift (from guests), manual, other
 *
 * Fields:
 * - totalBudget: Overall budget amount
 * - alertThreshold: Percentage (50-100) to trigger budget warnings
 * - categories: Array of category allocations
 * - items: Array of expense items (called 'items' but contains expenses)
 * - incomes: Array of income entries (gifts sync from Guest model)
 */

const mongoose = require('mongoose');
const i18next = require('i18next');

const BudgetItemSchema = new mongoose.Schema({
  category: {
    type: String,
    required: function() {
      return i18next.t('validation.budgetCategoryRequired');
    },
    enum: [
      'venue',
      'catering', 
      'photography',
      'music',
      'decoration',
      'makeup',
      'clothing',
      'transportation',
      'gifts',
      'other'
    ]
  },
  description: {
    type: String,
    required: function() {
      return i18next.t('validation.budgetDescriptionRequired');
    },
    trim: true
  },
  amount: {
    type: Number,
    required: function() {
      return i18next.t('validation.budgetAmountRequired');
    },
    min: 0,
    // Store exact values as user entered them
    get: function(value) {
      return value;
    },
    set: function(value) {
      return value;
    }
  },
  date: {
    type: Date,
    default: Date.now
  },
  isPaid: {
    type: Boolean,
    default: false
  },
  notes: {
    type: String,
    trim: true
  }
});

const BudgetCategorySchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    enum: [
      'venue',
      'catering',
      'photography', 
      'music',
      'decoration',
      'makeup',
      'clothing',
      'transportation',
      'gifts',
      'other'
    ]
  },
  allocated: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
    // Preserve exact values as user entered them
    get: function(value) {
      return value;
    },
    set: function(value) {
      return value;
    }
  }
});

const BudgetSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: function() {
      return i18next.t('validation.eventRequired');
    }
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return i18next.t('validation.userRequired');
    }
  },
  totalBudget: {
    type: Number,
    required: function() {
      return i18next.t('validation.totalBudgetRequired');
    },
    min: 0,
    get: function(value) {
      return value;
    },
    set: function(value) {
      return value;
    }
  },
  alertThreshold: {
    type: Number,
    default: 80,
    min: 50,
    max: 100
  },
  categories: [BudgetCategorySchema],
  items: [BudgetItemSchema],
  incomes: [{
    source: {
      type: String,
      enum: ['gift', 'manual', 'other'],
      default: 'manual'
    },
    guestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Guest'
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    date: {
      type: Date,
      default: Date.now
    },
    notes: {
      type: String,
      trim: true
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
}, {
  // Enable getters when converting to JSON
  toJSON: { getters: true },
  toObject: { getters: true }
});

BudgetSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Budget = mongoose.model('Budget', BudgetSchema);
module.exports = Budget;