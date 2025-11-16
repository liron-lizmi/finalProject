//server/controllers/budgetController.js
const Budget = require('../models/Budget');
const Event = require('../models/Event');

const defaultCategoryAllocations = {
  venue: 0.30,        
  catering: 0.25,    
  photography: 0.10, 
  music: 0.08,        
  decoration: 0.07,  
  makeup: 0.05,     
  clothing: 0.05,     
  transportation: 0.04, 
  gifts: 0.03,      
  other: 0.03      
};

const getBudget = async (req, res) => {
  try {
    const { eventId } = req.params;
    let actualEventId = eventId;
    
    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (event && event.originalEvent) {
      actualEventId = event.originalEvent;
    } else if (!event) {
      const originalEvent = await Event.findOne({
        _id: eventId,
        'sharedWith.userId': req.userId
      });
      if (!originalEvent) {
        return res.status(404).json({ message: req.t('events.notFound') });
      }
      actualEventId = eventId;
    }

    let budget = await Budget.findOne({ event: actualEventId });
    
    if (!budget) {
      return res.status(404).json({ message: req.t('events.features.budget.notFound') });
    }

    res.json(budget);
  } catch (err) {
    console.error('Error fetching budget:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const createBudget = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { totalBudget, categories } = req.body;

    let actualEventId = eventId;
    let originalOwnerId = req.userId;

    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (event && event.originalEvent) {
      actualEventId = event.originalEvent;
      const originalEvent = await Event.findById(event.originalEvent);
      originalOwnerId = originalEvent.user;
    } else if (!event) {
      const originalEvent = await Event.findOne({
        _id: eventId,
        'sharedWith.userId': req.userId
      });
      if (!originalEvent) {
        return res.status(404).json({ message: req.t('events.notFound') });
      }
      actualEventId = eventId;
      originalOwnerId = originalEvent.user;
    }

    const existingBudget = await Budget.findOne({ event: actualEventId });
    if (existingBudget) {
      return res.status(400).json({ message: req.t('events.features.budget.alreadyExists') });
    }

    let budgetCategories = [];
    if (categories && Array.isArray(categories)) {
      budgetCategories = categories;
    } else {
      budgetCategories = Object.keys(defaultCategoryAllocations).map(category => ({
        category,
        allocated: Math.round(totalBudget * defaultCategoryAllocations[category])
      }));
    }

    const newBudget = new Budget({
      event: actualEventId,
      user: originalOwnerId,
      totalBudget,
      categories: budgetCategories,
      items: []
    });

    const savedBudget = await newBudget.save();
    res.status(201).json(savedBudget);
  } catch (err) {
    console.error('Error creating budget:', err);
    
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(error => error.message);
      return res.status(400).json({ errors });
    }
    
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const updateBudget = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { totalBudget, categories } = req.body;

    let actualEventId = eventId;
    let originalOwnerId = req.userId;

    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (event && event.originalEvent) {
      actualEventId = event.originalEvent;
      const originalEvent = await Event.findById(event.originalEvent);
      originalOwnerId = originalEvent.user;
    } else if (!event) {
      const originalEvent = await Event.findOne({
        _id: eventId,
        'sharedWith.userId': req.userId
      });
      if (!originalEvent) {
        return res.status(404).json({ message: req.t('events.notFound') });
      }
      actualEventId = eventId;
      originalOwnerId = originalEvent.user;
    }

    const budget = await Budget.findOne({ event: actualEventId });
    if (!budget) {
      return res.status(404).json({ message: req.t('events.features.budget.notFound') });
    }

    if (totalBudget !== undefined) {
      budget.totalBudget = totalBudget;
    }

    if (categories && Array.isArray(categories)) {
      budget.categories = categories;
    }

    const updatedBudget = await budget.save();
    res.json(updatedBudget);
  } catch (err) {
    console.error('Error updating budget:', err);
    
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(error => error.message);
      return res.status(400).json({ errors });
    }
    
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const addExpense = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { category, description, amount, date, isPaid, notes } = req.body;

    let actualEventId = eventId;

    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (event && event.originalEvent) {
      actualEventId = event.originalEvent;
    } else if (!event) {
      const originalEvent = await Event.findOne({
        _id: eventId,
        'sharedWith.userId': req.userId
      });
      if (!originalEvent) {
        return res.status(404).json({ message: req.t('events.notFound') });
      }
      actualEventId = eventId;
    }

    const budget = await Budget.findOne({ event: actualEventId });
    if (!budget) {
      return res.status(404).json({ message: req.t('events.features.budget.notFound') });
    }

    const newExpense = {
      category,
      description,
      amount,
      date: date || new Date(),
      isPaid: isPaid || false,
      notes
    };

    budget.items.push(newExpense);
    const updatedBudget = await budget.save();
    
    const addedExpense = updatedBudget.items[updatedBudget.items.length - 1];
    res.status(201).json(addedExpense);
  } catch (err) {
    console.error('Error adding expense:', err);
    
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(error => error.message);
      return res.status(400).json({ errors });
    }
    
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const updateExpense = async (req, res) => {
  try {
    const { eventId, expenseId } = req.params;
    const { category, description, amount, date, isPaid, notes } = req.body;

    let actualEventId = eventId;

    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (event && event.originalEvent) {
      actualEventId = event.originalEvent;
    } else if (!event) {
      const originalEvent = await Event.findOne({
        _id: eventId,
        'sharedWith.userId': req.userId
      });
      if (!originalEvent) {
        return res.status(404).json({ message: req.t('events.notFound') });
      }
      actualEventId = eventId;
    }

    const budget = await Budget.findOne({ event: actualEventId });
    if (!budget) {
      return res.status(404).json({ message: req.t('events.features.budget.notFound') });
    }

    const expense = budget.items.id(expenseId);
    if (!expense) {
      return res.status(404).json({ message: req.t('events.features.budget.expenseNotFound') });
    }

    if (category !== undefined) expense.category = category;
    if (description !== undefined) expense.description = description;
    if (amount !== undefined) expense.amount = amount;
    if (date !== undefined) expense.date = date;
    if (isPaid !== undefined) expense.isPaid = isPaid;
    if (notes !== undefined) expense.notes = notes;

    const updatedBudget = await budget.save();
    res.json(expense);
  } catch (err) {
    console.error('Error updating expense:', err);
    
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(error => error.message);
      return res.status(400).json({ errors });
    }
    
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const deleteExpense = async (req, res) => {
  try {
    const { eventId, expenseId } = req.params;

    let actualEventId = eventId;

    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (event && event.originalEvent) {
      actualEventId = event.originalEvent;
    } else if (!event) {
      const originalEvent = await Event.findOne({
        _id: eventId,
        'sharedWith.userId': req.userId
      });
      if (!originalEvent) {
        return res.status(404).json({ message: req.t('events.notFound') });
      }
      actualEventId = eventId;
    }

    const budget = await Budget.findOne({ event: actualEventId });
    if (!budget) {
      return res.status(404).json({ message: req.t('events.features.budget.notFound') });
    }

    const expense = budget.items.id(expenseId);
    if (!expense) {
      return res.status(404).json({ message: req.t('events.features.budget.expenseNotFound') });
    }

    budget.items.pull(expenseId);
    await budget.save();

    res.json({ message: req.t('events.features.budget.expenseDeleteSuccess') });
  } catch (err) {
    console.error('Error deleting expense:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const getBudgetSummary = async (req, res) => {
  try {
    const { eventId } = req.params;
    let actualEventId = eventId;
    
    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (event && event.originalEvent) {
      actualEventId = event.originalEvent;
    } else if (!event) {
      const originalEvent = await Event.findOne({
        _id: eventId,
        'sharedWith.userId': req.userId
      });
      if (!originalEvent) {
        return res.status(404).json({ message: req.t('events.notFound') });
      }
      actualEventId = eventId;
    }

    const budget = await Budget.findOne({ event: actualEventId });
    if (!budget) {
      return res.status(404).json({ message: req.t('events.features.budget.notFound') });
    }

    const totalSpent = budget.items.reduce((total, item) => total + item.amount, 0);
    const remaining = budget.totalBudget - totalSpent;
    
    const categoryBreakdown = budget.categories.map(cat => {
      const spent = budget.items
        .filter(item => item.category === cat.category)
        .reduce((total, item) => total + item.amount, 0);
      const allocated = cat.allocated;
      const remaining = allocated - spent;
      const percentage = allocated > 0 ? (spent / allocated * 100) : 0;
      
      return {
        category: cat.category,
        allocated,
        spent,
        remaining,
        percentage: Math.round(percentage * 100) / 100
      };
    });

    const summary = {
      totalBudget: budget.totalBudget,
      totalSpent,
      totalRemaining: remaining,
      spentPercentage: Math.round((totalSpent / budget.totalBudget) * 10000) / 100,
      categoryBreakdown,
      totalExpenses: budget.items.length,
      paidExpenses: budget.items.filter(item => item.isPaid).length
    };

    res.json(summary);
  } catch (err) {
    console.error('Error getting budget summary:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const getExpensesByCategory = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { category } = req.query;
    let actualEventId = eventId;
    
    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (event && event.originalEvent) {
      actualEventId = event.originalEvent;
    } else if (!event) {
      const originalEvent = await Event.findOne({
        _id: eventId,
        'sharedWith.userId': req.userId
      });
      if (!originalEvent) {
        return res.status(404).json({ message: req.t('events.notFound') });
      }
      actualEventId = eventId;
    }

    const budget = await Budget.findOne({ event: actualEventId });
    if (!budget) {
      return res.status(404).json({ message: req.t('events.features.budget.notFound') });
    }

    let expenses = budget.items;
    
    if (category && category !== 'all') {
      expenses = expenses.filter(item => item.category === category);
    }

    expenses.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json(expenses);
  } catch (err) {
    console.error('Error getting expenses by category:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const updateAlertThreshold = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { alertThreshold } = req.body;

    let actualEventId = eventId;

    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (event && event.originalEvent) {
      actualEventId = event.originalEvent;
    } else if (!event) {
      const originalEvent = await Event.findOne({
        _id: eventId,
        'sharedWith.userId': req.userId
      });
      if (!originalEvent) {
        return res.status(404).json({ message: req.t('events.notFound') });
      }
      actualEventId = eventId;
    }

    const budget = await Budget.findOne({ event: actualEventId });
    if (!budget) {
      return res.status(404).json({ message: req.t('events.features.budget.notFound') });
    }

    budget.alertThreshold = alertThreshold;
    const updatedBudget = await budget.save();

    res.json({ alertThreshold: updatedBudget.alertThreshold });
  } catch (err) {
    console.error('Error updating alert threshold:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const addIncome = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { source, description, amount, date, notes, guestId } = req.body;

    let actualEventId = eventId;

    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (event && event.originalEvent) {
      actualEventId = event.originalEvent;
    } else if (!event) {
      const originalEvent = await Event.findOne({
        _id: eventId,
        'sharedWith.userId': req.userId
      });
      if (!originalEvent) {
        return res.status(404).json({ message: req.t('events.notFound') });
      }
      actualEventId = eventId;
    }

    const budget = await Budget.findOne({ event: actualEventId });
    if (!budget) {
      return res.status(404).json({ message: req.t('events.features.budget.notFound') });
    }

    const newIncome = {
      source: source || 'manual',
      description,
      amount,
      date: date || new Date(),
      notes,
      guestId: guestId || null
    };

    budget.incomes.push(newIncome);
    const updatedBudget = await budget.save();
    
    const addedIncome = updatedBudget.incomes[updatedBudget.incomes.length - 1];
    res.status(201).json(addedIncome);
  } catch (err) {
    console.error('Error adding income:', err);
    
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(error => error.message);
      return res.status(400).json({ errors });
    }
    
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const updateIncome = async (req, res) => {
  try {
    const { eventId, incomeId } = req.params;
    const { source, description, amount, date, notes } = req.body;

    let actualEventId = eventId;

    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (event && event.originalEvent) {
      actualEventId = event.originalEvent;
    } else if (!event) {
      const originalEvent = await Event.findOne({
        _id: eventId,
        'sharedWith.userId': req.userId
      });
      if (!originalEvent) {
        return res.status(404).json({ message: req.t('events.notFound') });
      }
      actualEventId = eventId;
    }

    const budget = await Budget.findOne({ event: actualEventId });
    if (!budget) {
      return res.status(404).json({ message: req.t('events.features.budget.notFound') });
    }

    const income = budget.incomes.id(incomeId);
    if (!income) {
      return res.status(404).json({ message: req.t('events.features.budget.incomeNotFound') });
    }

    if (source !== undefined) income.source = source;
    if (description !== undefined) income.description = description;
    if (amount !== undefined) income.amount = amount;
    if (date !== undefined) income.date = date;
    if (notes !== undefined) income.notes = notes;

    const updatedBudget = await budget.save();
    res.json(income);
  } catch (err) {
    console.error('Error updating income:', err);
    
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(error => error.message);
      return res.status(400).json({ errors });
    }
    
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const deleteIncome = async (req, res) => {
  try {
    const { eventId, incomeId } = req.params;

    let actualEventId = eventId;

    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (event && event.originalEvent) {
      actualEventId = event.originalEvent;
    } else if (!event) {
      const originalEvent = await Event.findOne({
        _id: eventId,
        'sharedWith.userId': req.userId
      });
      if (!originalEvent) {
        return res.status(404).json({ message: req.t('events.notFound') });
      }
      actualEventId = eventId;
    }

    const budget = await Budget.findOne({ event: actualEventId });
    if (!budget) {
      return res.status(404).json({ message: req.t('events.features.budget.notFound') });
    }

    const income = budget.incomes.id(incomeId);
    if (!income) {
      return res.status(404).json({ message: req.t('events.features.budget.incomeNotFound') });
    }

    budget.incomes.pull(incomeId);
    await budget.save();

    res.json({ message: req.t('events.features.budget.incomeDeleteSuccess') });
  } catch (err) {
    console.error('Error deleting income:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const syncGiftToIncome = async (req, res) => {
  try {
    const { eventId, guestId } = req.params;
    const { hasGift, giftValue, giftDescription } = req.body;

    let actualEventId = eventId;

    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (event && event.originalEvent) {
      actualEventId = event.originalEvent;
    } else if (!event) {
      const originalEvent = await Event.findOne({
        _id: eventId,
        'sharedWith.userId': req.userId
      });
      if (!originalEvent) {
        return res.status(404).json({ message: req.t('events.notFound') });
      }
      actualEventId = eventId;
    }

    const budget = await Budget.findOne({ event: actualEventId });
    if (!budget) {
      return res.status(404).json({ message: req.t('events.features.budget.notFound') });
    }

    const Guest = require('../models/Guest');
    const guest = await Guest.findById(guestId);
    if (!guest) {
      return res.status(404).json({ message: req.t('guests.notFound') });
    }

    budget.incomes = budget.incomes.filter(income => 
      !income.guestId || income.guestId.toString() !== guestId
    );

    if (hasGift && giftValue > 0) {
      const newIncome = {
        source: 'gift',
        guestId: guestId,
        description: giftDescription || `מתנה מ${guest.firstName} ${guest.lastName}`,
        amount: giftValue,
        date: new Date(),
        notes: giftDescription || ''
      };
      budget.incomes.push(newIncome);
    }

    await budget.save();
    res.json({ message: req.t('events.features.budget.giftSyncSuccess') });
  } catch (err) {
    console.error('Error syncing gift to income:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

module.exports = {
  getBudget,
  createBudget,
  updateBudget,
  addExpense,
  updateExpense,
  deleteExpense,
  getBudgetSummary,
  getExpensesByCategory,
  updateAlertThreshold,
  addIncome,
  updateIncome,
  deleteIncome,
  syncGiftToIncome
};