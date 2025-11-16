const express = require('express');
const router = express.Router({ mergeParams: true });
const {
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
} = require('../controllers/budgetController');
const auth = require('../middleware/auth');
const { checkEditPermission, checkViewPermission } = require('../middleware/checkPermissions');

router.use(auth);

// Budget CRUD
router.get('/', checkViewPermission, getBudget);
router.post('/', checkEditPermission, createBudget);
router.put('/', checkEditPermission, updateBudget);

// Expenses
router.get('/expenses', checkViewPermission, getExpensesByCategory);
router.post('/expenses', checkEditPermission, addExpense);
router.put('/expenses/:expenseId', checkEditPermission, updateExpense);
router.delete('/expenses/:expenseId', checkEditPermission, deleteExpense);

// Incomes
router.post('/incomes', checkEditPermission, addIncome);
router.put('/incomes/:incomeId', checkEditPermission, updateIncome);
router.delete('/incomes/:incomeId', checkEditPermission, deleteIncome);
router.post('/sync-gift/:guestId', checkEditPermission, syncGiftToIncome);

// Summary and settings
router.get('/summary', checkViewPermission, getBudgetSummary);
router.put('/alert-threshold', checkEditPermission, updateAlertThreshold);

module.exports = router;