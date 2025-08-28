import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const defaultCategoryAllocations = {
  venue: 0.30,
  catering: 0.25,
  photography: 0.10,
  music: 0.08,
  decoration: 0.07,
  makeup: 0.03,
  clothing: 0.05,
  transportation: 0.04,
  gifts: 0.03,
  other: 0.05
};

const BudgetSetup = ({ eventId, existingBudget, onBudgetCreated }) => {
  const { t } = useTranslation();
  const [totalBudget, setTotalBudget] = useState('');
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isFieldsDisabled, setIsFieldsDisabled] = useState(false);

  useEffect(() => {
    if (existingBudget) {
      setTotalBudget(existingBudget.totalBudget.toString());
      setCategories([...existingBudget.categories]);
      setIsEditing(true);
      setIsFieldsDisabled(true);
    } else {
      initializeCategories();
      setIsFieldsDisabled(false);
    }
  }, [existingBudget]);

  const initializeCategories = (budget = 0) => {
    const initialCategories = Object.keys(defaultCategoryAllocations).map(category => ({
      category,
      allocated: Math.round(budget * defaultCategoryAllocations[category])
    }));
    setCategories(initialCategories);
  };

  const handleTotalBudgetChange = (e) => {
    setTotalBudget(e.target.value);
    
    if (!isEditing) {
      const newTotal = parseFloat(e.target.value) || 0;
      initializeCategories(newTotal);
    }
  };

  const handleCategoryChange = (categoryName, newAmount) => {
    const updatedCategories = categories.map(cat => 
      cat.category === categoryName 
        ? { ...cat, allocated: parseFloat(newAmount) || 0 }
        : cat
    );
    setCategories(updatedCategories);
  };

  const getTotalAllocated = () => {
    return categories.reduce((total, cat) => total + cat.allocated, 0);
  };

  const getRemainingBudget = () => {
    return (parseFloat(totalBudget) || 0) - getTotalAllocated();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!totalBudget || parseFloat(totalBudget) <= 0) {
      setError(t('events.features.budget.validation.totalBudgetRequired'));
      return;
    }

    const totalAllocated = getTotalAllocated();
    const budgetAmount = parseFloat(totalBudget);
    
    if (totalAllocated > budgetAmount) {
      setError(t('events.features.budget.validation.allocatedExceedsTotal'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const url = `/api/events/${eventId}/budget`;
      const method = isEditing ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          totalBudget: budgetAmount,
          categories
        })
      });

      if (!response.ok) {
        throw new Error(t('events.features.budget.saveError'));
      }

      const budgetData = await response.json();
      onBudgetCreated(budgetData);
      setIsFieldsDisabled(true);
      
    } catch (err) {
      console.error('Error saving budget:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const enableEditing = (e) => {
    e.preventDefault();
    setIsFieldsDisabled(false);
  };

  const resetToDefaults = () => {
    const budget = parseFloat(totalBudget) || 0;
    initializeCategories(budget);
  };

  const remaining = getRemainingBudget();
  const isValid = remaining >= 0 && parseFloat(totalBudget) > 0;

  return (
    <div className="budget-setup">
      <div className="budget-setup-header">
        <h3>{isEditing ? t('events.features.budget.editBudget') : t('events.features.budget.setupBudget')}</h3>
        <p>{t('events.features.budget.setupDescription')}</p>
      </div>

      <form onSubmit={handleSubmit} className="budget-setup-form">
        <div className="total-budget-section">
          <label className="budget-label">
            {t('events.features.budget.totalBudget')}
            <input
              type="number"
              value={totalBudget}
              onChange={handleTotalBudgetChange}
              placeholder={t('events.features.budget.totalBudgetPlaceholder')}
              className="budget-input"
              min="0"
              step="1"
              disabled={isFieldsDisabled}
            />
          </label>
        </div>

        {totalBudget && (
          <div className="categories-section">
            <div className="categories-header">
              <h4>{t('events.features.budget.categoriesAllocation')}</h4>
              <button
                type="button"
                onClick={resetToDefaults}
                className="reset-button"
                disabled={isFieldsDisabled}
              >
                {t('events.features.budget.useDefaults')}
              </button>
            </div>

            <div className="categories-grid">
              {categories.map(cat => {
                const percentage = totalBudget > 0 
                  ? Math.round((cat.allocated / parseFloat(totalBudget)) * 100)
                  : 0;

                return (
                  <div key={cat.category} className="category-item">
                    <div className="category-header">
                      <span className="category-name">
                        {t(`events.features.budget.categories.${cat.category}`)}
                      </span>
                      <span className="category-percentage">{percentage}%</span>
                    </div>
                    <input
                      type="number"
                      value={cat.allocated}
                      onChange={(e) => handleCategoryChange(cat.category, e.target.value)}
                      className="category-input"
                      min="0"
                      step="1"
                      disabled={isFieldsDisabled}
                    />
                  </div>
                );
              })}
            </div>

            <div className="budget-summary">
              <div className="summary-row">
                <span>{t('events.features.budget.totalBudget')}</span>
                <span>₪{parseFloat(totalBudget).toLocaleString()}</span>
              </div>
              <div className="summary-row">
                <span>{t('events.features.budget.totalAllocated')}</span>
                <span>₪{getTotalAllocated().toLocaleString()}</span>
              </div>
              <div className={`summary-row ${remaining < 0 ? 'negative' : ''}`}>
                <span>{t('events.features.budget.remaining')}</span>
                <span>₪{remaining.toLocaleString()}</span>
              </div>
            </div>

            {remaining < 0 && (
              <div className="budget-warning">
                {t('events.features.budget.overAllocatedWarning')}
              </div>
            )}
          </div>
        )}

        {error && <div className="budget-error">{error}</div>}

        <div className="budget-actions">
          {isFieldsDisabled ? (
            <button
              type="button"
              onClick={enableEditing}
              className="edit-budget-button"
            >
              {t('events.features.budget.editBudget')}
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading || !isValid}
              className="save-budget-button"
            >
              {loading ? t('general.loading') : (isEditing ? t('events.features.budget.updateBudget') : t('events.features.budget.createBudget'))}
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default BudgetSetup;