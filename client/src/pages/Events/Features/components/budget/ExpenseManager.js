import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const ExpenseManager = ({ budget, eventId, onBudgetUpdated, canEdit = true }) => {
  const { t } = useTranslation();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  
  const [formData, setFormData] = useState({
    category: 'venue',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    isPaid: false,
    notes: ''
  });

  useEffect(() => {
    fetchExpenses();
  }, [eventId, selectedCategory]);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const categoryParam = selectedCategory !== 'all' ? `?category=${selectedCategory}` : '';
      const response = await fetch(`/api/events/${eventId}/budget/expenses${categoryParam}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const expensesData = await response.json();
        setExpenses(expensesData);
      }
    } catch (err) {
      console.error('Error fetching expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDateForDisplay = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.description || !formData.amount) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const url = editingExpense 
        ? `/api/events/${eventId}/budget/expenses/${editingExpense._id}`
        : `/api/events/${eventId}/budget/expenses`;
      
      const method = editingExpense ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount)
        })
      });

      if (response.ok) {
        resetForm();
        fetchExpenses();
        onBudgetUpdated();
      }
    } catch (err) {
      console.error('Error saving expense:', err);
    }
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setFormData({
      category: expense.category,
      description: expense.description,
      amount: expense.amount.toString(),
      date: expense.date.split('T')[0],
      isPaid: expense.isPaid,
      notes: expense.notes || ''
    });
    setShowAddForm(true);
  };

  const handleDelete = async (expenseId) => {
    if (!window.confirm(t('events.features.budget.confirmDeleteExpense'))) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/events/${eventId}/budget/expenses/${expenseId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        fetchExpenses();
        onBudgetUpdated();
      }
    } catch (err) {
      console.error('Error deleting expense:', err);
    }
  };

  const resetForm = () => {
    setFormData({
      category: 'venue',
      description: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      isPaid: false,
      notes: ''
    });
    setEditingExpense(null);
    setShowAddForm(false);
  };

  const togglePaymentStatus = async (expense) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/events/${eventId}/budget/expenses/${expense._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...expense,
          isPaid: !expense.isPaid
        })
      });

      if (response.ok) {
        fetchExpenses();
        onBudgetUpdated();
      }
    } catch (err) {
      console.error('Error updating payment status:', err);
    }
  };

  const getSortedExpenses = () => {
    return [...expenses].sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'amount':
          aValue = a.amount;
          bValue = b.amount;
          break;
        case 'category':
          aValue = t(`events.features.budget.categories.${a.category}`);
          bValue = t(`events.features.budget.categories.${b.category}`);
          break;
        case 'description':
          aValue = a.description.toLowerCase();
          bValue = b.description.toLowerCase();
          break;
        default:
          aValue = new Date(a.date);
          bValue = new Date(b.date);
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  };

  const getCategoryIcon = (category) => {
    const icons = {
      venue: '🏢',
      catering: '🍽️',
      photography: '📸',
      music: '🎵',
      decoration: '🎨',
      makeup: '💄',
      clothing: '👗',
      transportation: '🚗',
      gifts: '🎁',
      other: '📦'
    };
    return icons[category] || '📦';
  };

  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const paidExpenses = expenses.filter(exp => exp.isPaid).reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <div className="expense-manager">
      <div className="expense-header">
        <div className="expense-stats">
          <div className="stat-item">
            <span className="stat-label">{t('events.features.budget.totalExpenses')}</span>
            <span className="stat-value">₪{totalExpenses.toLocaleString()}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">{t('events.features.budget.paidExpenses')}</span>
            <span className="stat-value">₪{paidExpenses.toLocaleString()}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">{t('events.features.budget.unpaidExpenses')}</span>
            <span className="stat-value">₪{(totalExpenses - paidExpenses).toLocaleString()}</span>
          </div>
        </div>

        <button 
          onClick={() => setShowAddForm(true)}
          className="add-expense-button"
          disabled={!canEdit}
        >
          {t('events.features.budget.addExpense')}
        </button>
      </div>

      <div className="expense-controls">
        <div className="expense-filters">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="category-filter"
          >
            <option value="all">{t('events.features.budget.allCategories')}</option>
            {budget.categories.map(cat => (
              <option key={cat.category} value={cat.category}>
                {t(`events.features.budget.categories.${cat.category}`)}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="sort-select"
          >
            <option value="date">{t('events.features.budget.sortByDate')}</option>
            <option value="amount">{t('events.features.budget.sortByAmount')}</option>
            <option value="category">{t('events.features.budget.sortByCategory')}</option>
            <option value="description">{t('events.features.budget.sortByDescription')}</option>
          </select>

          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="sort-order-button"
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="expense-form-overlay">
          <div className="expense-form-modal">
            <form onSubmit={handleSubmit} className="expense-form">
              <h3>{editingExpense ? t('events.features.budget.editExpense') : t('events.features.budget.addExpense')}</h3>
              
              <div className="form-group">
                <label>{t('events.features.budget.category')}</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  required
                >
                  {budget.categories.map(cat => (
                    <option key={cat.category} value={cat.category}>
                      {t(`events.features.budget.categories.${cat.category}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>{t('events.features.budget.description')}</label>
                <input
                  type="text"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder={t('events.features.budget.descriptionPlaceholder')}
                  required
                />
              </div>

              <div className="form-group">
                <label>{t('events.features.budget.amount')}</label>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleInputChange}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  required
                />
              </div>

              <div className="form-group">
                <label>{t('events.features.budget.date')}</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    name="isPaid"
                    checked={formData.isPaid}
                    onChange={handleInputChange}
                  />
                  {t('events.features.budget.isPaid')}
                </label>
              </div>

              <div className="form-group">
                <label>{t('events.features.budget.notes')}</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder={t('events.features.budget.notesPlaceholder')}
                  rows="3"
                />
              </div>

              <div className="form-actions">
                <button type="button" onClick={resetForm} className="cancel-button">
                  {t('common.cancel')}
                </button>
                <button type="submit" className="save-button">
                  {editingExpense ? t('events.features.budget.updateExpense') : t('events.features.budget.saveExpense')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="expenses-list">
        {loading ? (
          <div className="expenses-loading">{t('common.loading')}</div>
        ) : getSortedExpenses().length === 0 ? (
          <div className="no-expenses">
            <p>{selectedCategory === 'all' ? t('events.features.budget.noExpenses') : t('events.features.budget.noExpensesInCategory')}</p>
          </div>
        ) : (
          getSortedExpenses().map(expense => (
            <div key={expense._id} className={`expense-item ${expense.isPaid ? 'paid' : 'unpaid'}`}>
              <div className="expense-main">
                <div className="expense-category">
                  <span className="category-icon">{getCategoryIcon(expense.category)}</span>
                  <span className="category-name">{t(`events.features.budget.categories.${expense.category}`)}</span>
                </div>
                
                <div className="expense-details">
                  <div className="expense-description">{expense.description}</div>
                  <div className="expense-date">
                    {formatDateForDisplay(expense.date)}
                  </div>
                  {expense.notes && (
                    <div className="expense-notes">{expense.notes}</div>
                  )}
                </div>

                <div className="expense-amount">
                  ₪{expense.amount.toLocaleString()}
                </div>

                <div className="expense-actions">
                  <button
                    onClick={() => togglePaymentStatus(expense)}
                    className={`payment-toggle ${expense.isPaid ? 'paid' : 'unpaid'}`}
                    title={expense.isPaid ? t('events.features.budget.markUnpaid') : t('events.features.budget.markPaid')}
                    disabled={!canEdit}
                  >
                    {expense.isPaid ? '✅' : '⏳'}
                  </button>
                  
                  <button
                    onClick={() => handleEdit(expense)}
                    className="edit-button"
                    title={t('events.features.budget.editExpense')}
                    disabled={!canEdit}
                  >
                    ✏️
                  </button>
                  
                  <button
                    onClick={() => handleDelete(expense._id)}
                    className="delete-button"
                    title={t('events.features.budget.deleteExpense')}
                    disabled={!canEdit}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ExpenseManager;