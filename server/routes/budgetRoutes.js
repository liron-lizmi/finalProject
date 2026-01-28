/**
 * budgetRoutes.js - Budget Management Routes
 *
 * Handles all budget-related endpoints for event financial management.
 * Mounted as nested router under /events/:eventId/budget
 *
 * All routes require authentication (auth middleware applied globally).
 *
 * Budget CRUD:
 * - GET /: Get event budget (view permission)
 * - POST /: Create new budget (edit permission)
 * - PUT /: Update budget settings (edit permission)
 *
 * Expense Management:
 * - GET /expenses: Get expenses grouped by category (view permission)
 * - POST /expenses: Add new expense (edit permission)
 * - PUT /expenses/:expenseId: Update expense (edit permission)
 * - DELETE /expenses/:expenseId: Delete expense (edit permission)
 *
 * Income Management:
 * - POST /incomes: Add new income (edit permission)
 * - PUT /incomes/:incomeId: Update income (edit permission)
 * - DELETE /incomes/:incomeId: Delete income (edit permission)
 * - POST /sync-gift/:guestId: Sync guest gift to income (edit permission)
 *
 * Summary & Settings:
 * - GET /summary: Get budget summary with totals (view permission)
 * - PUT /alert-threshold: Update alert threshold (edit permission)
 */

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