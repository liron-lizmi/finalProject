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
  updateAlertThreshold
} = require('../controllers/budgetController');
const auth = require('../middleware/auth');
const { checkEditPermission, checkViewPermission } = require('../middleware/checkPermissions');

router.use(auth);

router.get('/', checkViewPermission, getBudget);
router.post('/', checkEditPermission, createBudget);
router.put('/', checkEditPermission, updateBudget);
router.get('/summary', checkViewPermission, getBudgetSummary);
router.get('/expenses', checkViewPermission, getExpensesByCategory);
router.post('/expenses', checkEditPermission, addExpense);
router.put('/expenses/:expenseId', checkEditPermission, updateExpense);
router.delete('/expenses/:expenseId', checkEditPermission, deleteExpense);
router.put('/alert-threshold', checkEditPermission, updateAlertThreshold);

module.exports = router;