//server/controllers/budgetController.js
const Budget = require('../models/Budget');
const Event = require('../models/Event');

const defaultCategoryAllocations = {
  venue: 0.30,        // 30%
  catering: 0.25,     // 25%
  photography: 0.10,  // 10%
  music: 0.08,        // 8%
  decoration: 0.07,   // 7%
  makeup: 0.05,       // 5%
  clothing: 0.05,     // 5%
  transportation: 0.04, // 4%
  gifts: 0.03,        // 3%
  other: 0.03         // 3%
};

const getBudget = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    let budget = await Budget.findOne({ event: eventId, user: req.userId });
    
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

    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const existingBudget = await Budget.findOne({ event: eventId, user: req.userId });
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
      event: eventId,
      user: req.userId,
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

    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const budget = await Budget.findOne({ event: eventId, user: req.userId });
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

    const budget = await Budget.findOne({ event: eventId, user: req.userId });
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

    const budget = await Budget.findOne({ event: eventId, user: req.userId });
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

    const budget = await Budget.findOne({ event: eventId, user: req.userId });
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

    const budget = await Budget.findOne({ event: eventId, user: req.userId });
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

    const budget = await Budget.findOne({ event: eventId, user: req.userId });
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

module.exports = {
  getBudget,
  createBudget,
  updateBudget,
  addExpense,
  updateExpense,
  deleteExpense,
  getBudgetSummary,
  getExpensesByCategory
};