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
  getExpensesByCategory
} = require('../controllers/budgetController');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', getBudget);
router.post('/', createBudget);
router.put('/', updateBudget);
router.get('/summary', getBudgetSummary);
router.get('/expenses', getExpensesByCategory);
router.post('/expenses', addExpense);
router.put('/expenses/:expenseId', updateExpense);
router.delete('/expenses/:expenseId', deleteExpense);

module.exports = router;