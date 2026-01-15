import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useModal } from '../../../../hooks/useModal';
import { apiFetch } from '../../../../utils/api';

const IncomeManager = ({ budget, eventId, onBudgetUpdated, canEdit = true }) => {
  const { t } = useTranslation();
  const { showConfirmModal, Modal } = useModal();
  const [incomes, setIncomes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingIncome, setEditingIncome] = useState(null);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  
  const [formData, setFormData] = useState({
    source: 'manual',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  useEffect(() => {
    if (budget && budget.incomes) {
      setIncomes(budget.incomes);
      setLoading(false);
    } else {
      setIncomes([]);
      setLoading(false);
    }
  }, [budget]);

  const formatDateForDisplay = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.description || !formData.amount) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const url = editingIncome 
        ? `/api/events/${eventId}/budget/incomes/${editingIncome._id}`
        : `/api/events/${eventId}/budget/incomes`;
      
      const method = editingIncome ? 'PUT' : 'POST';

      const response = await apiFetch(url, {
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
        onBudgetUpdated();
      }
    } catch (err) {
      console.error('Error saving income:', err);
    }
  };

  const handleEdit = (income) => {
    setEditingIncome(income);
    setFormData({
      source: income.source,
      description: income.description,
      amount: income.amount.toString(),
      date: income.date.split('T')[0],
      notes: income.notes || ''
    });
    setShowAddForm(true);
  };

  const handleDeleteClick = (incomeId) => {
    showConfirmModal(t('events.features.budget.incomes.confirmDeleteIncome'), async () => {
      await executeDelete(incomeId);
    });
  };

  const executeDelete = async (incomeId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await apiFetch(`/api/events/${eventId}/budget/incomes/${incomeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        onBudgetUpdated();
      }
    } catch (err) {
      console.error('Error deleting income:', err);
    }
  };

  const resetForm = () => {
    setFormData({
      source: 'manual',
      description: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setEditingIncome(null);
    setShowAddForm(false);
  };

  const getSortedIncomes = () => {
    return [...incomes].sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'amount':
          aValue = a.amount;
          bValue = b.amount;
          break;
        case 'source':
          aValue = t(`events.features.budget.incomes.sources.${a.source}`);
          bValue = t(`events.features.budget.incomes.sources.${b.source}`);
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

  const totalIncomes = incomes.reduce((sum, inc) => sum + inc.amount, 0);
  const giftIncomes = incomes.filter(inc => inc.source === 'gift').reduce((sum, inc) => sum + inc.amount, 0);
  const manualIncomes = incomes.filter(inc => inc.source === 'manual').reduce((sum, inc) => sum + inc.amount, 0);

  return (
    <div className="income-manager">
      <div className="income-header">
        <div className="income-stats">
          <div className="stat-item">
            <span className="stat-label">{t('events.features.budget.incomes.totalIncomes')}</span>
            <span className="stat-value">₪{totalIncomes.toLocaleString()}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">{t('events.features.budget.incomes.giftIncomes')}</span>
            <span className="stat-value">₪{giftIncomes.toLocaleString()}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">{t('events.features.budget.incomes.manualIncomes')}</span>
            <span className="stat-value">₪{manualIncomes.toLocaleString()}</span>
          </div>
        </div>

        <button 
          onClick={() => setShowAddForm(true)}
          className="add-income-button"
          disabled={!canEdit}
        >
          {t('events.features.budget.incomes.addIncome')}
        </button>
      </div>

      <div className="income-controls">
        <div className="income-filters">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="sort-select"
          >
            <option value="date">{t('events.features.budget.sortByDate')}</option>
            <option value="amount">{t('events.features.budget.sortByAmount')}</option>
            <option value="source">{t('events.features.budget.incomes.sortBySource')}</option>
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
        <div className="income-form-overlay">
          <div className="income-form-modal">
            <form onSubmit={handleSubmit} className="income-form">
              <h3>{editingIncome ? t('events.features.budget.incomes.editIncome') : t('events.features.budget.incomes.addIncome')}</h3>
              
              <div className="form-group">
                <label>{t('events.features.budget.incomes.source')}</label>
                <select
                  name="source"
                  value={formData.source}
                  onChange={handleInputChange}
                  disabled={editingIncome && editingIncome.source === 'gift'}
                  required
                >
                  <option value="manual">{t('events.features.budget.incomes.sources.manual')}</option>
                  <option value="gift">{t('events.features.budget.incomes.sources.gift')}</option>
                  <option value="other">{t('events.features.budget.incomes.sources.other')}</option>
                </select>
              </div>

              <div className="form-group">
                <label>{t('events.features.budget.description')}</label>
                <input
                  type="text"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder={t('events.features.budget.incomes.incomeDescriptionPlaceholder')}
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
                  {editingIncome ? t('events.features.budget.incomes.updateIncome') : t('events.features.budget.incomes.saveIncome')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="incomes-list">
        {loading ? (
          <div className="incomes-loading">{t('common.loading')}</div>
        ) : getSortedIncomes().length === 0 ? (
          <div className="no-incomes">
            <p>{t('events.features.budget.incomes.noIncomes')}</p>
          </div>
        ) : (
          getSortedIncomes().map(income => (
            <div key={income._id} className={`income-item ${income.source}`}>
              <div className="income-main">
                <div className="income-source">
                  <span className="source-badge">{t(`events.features.budget.incomes.sources.${income.source}`)}</span>
                </div>
                
                <div className="income-details">
                  <div className="income-description">{income.description}</div>
                  <div className="income-date">
                    {formatDateForDisplay(income.date)}
                  </div>
                  {income.notes && (
                    <div className="income-notes">{income.notes}</div>
                  )}
                </div>

                <div className="income-amount">
                  ₪{income.amount.toLocaleString()}
                </div>

                <div className="income-actions">
                  <button
                    onClick={() => handleEdit(income)}
                    className="edit-button"
                    title={t('events.features.budget.incomes.editIncome')}
                    disabled={!canEdit || income.source === 'gift'}
                  >
                    ✏️
                  </button>
                  
                  <button
                    onClick={() => handleDeleteClick(income._id)}
                    className="delete-button"
                    title={t('events.features.budget.incomes.deleteIncome')}
                    disabled={!canEdit || income.source === 'gift'}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {Modal}
      
    </div>
  );
};

export default IncomeManager;