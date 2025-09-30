import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const BudgetOverview = ({ budget, eventId, onBudgetUpdated, alertThreshold, onAlertThresholdChange, canEdit }) => {
  const { t } = useTranslation();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingThreshold, setUpdatingThreshold] = useState(false);

  useEffect(() => {
    fetchBudgetSummary();
  }, [budget, eventId]);

  const fetchBudgetSummary = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/events/${eventId}/budget/summary`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const summaryData = await response.json();
        setSummary(summaryData);
      }
    } catch (err) {
      console.error('Error fetching budget summary:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (percentage) => {
    if (percentage <= 50) return 'safe';
    if (percentage <= alertThreshold) return 'warning';
    return 'danger';
  };

  if (loading) {
    return <div className="budget-loading">{t('common.loading')}</div>;
  }

  if (!summary) {
    return <div className="budget-error">{t('events.features.budget.summaryError')}</div>;
  }

  return (
    <div className="budget-overview">
      {/* Alert Threshold Setting */}
      <div className="alert-threshold-section">
        <h4>{t('events.features.budget.settings.alertSettings')}</h4>
        <div className="threshold-setting">
          <label>
            {t('events.features.budget.settings.alertThreshold')}: <span className="threshold-value">{alertThreshold}%</span>
            <input
              type="range"
              min="50"
              max="100"
              value={alertThreshold}
              onChange={async (e) => {
                if (!canEdit) return;
                
                const newThreshold = parseInt(e.target.value);
                try {
                  const token = localStorage.getItem('token');
                  const response = await fetch(`/api/events/${eventId}/budget/alert-threshold`, {
                    method: 'PUT',
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ alertThreshold: newThreshold })
                  });

                  if (response.ok) {
                    onAlertThresholdChange(newThreshold);
                  }
                } catch (err) {
                  console.error('Error updating alert threshold:', err);
                }
              }}
              className="threshold-slider"
              disabled={!canEdit}
            />
          </label>
          <p className="setting-description">
            {t('events.features.budget.settings.alertThresholdDescription')}
          </p>
        </div>
      </div>

      <div className="budget-summary-cards">
        <div className="summary-card total">
          <div className="card-icon">💰</div>
          <div className="card-content">
            <h3>{t('events.features.budget.totalBudget')}</h3>
            <div className="amount">₪{summary.totalBudget.toLocaleString()}</div>
          </div>
        </div>

        <div className="summary-card spent">
          <div className="card-icon">💸</div>
          <div className="card-content">
            <h3>{t('events.features.budget.totalSpent')}</h3>
            <div className="amount">₪{summary.totalSpent.toLocaleString()}</div>
            <div className="percentage">{summary.spentPercentage}%</div>
          </div>
        </div>

        <div className="summary-card remaining">
          <div className="card-icon">💵</div>
          <div className="card-content">
            <h3>{t('events.features.budget.remaining')}</h3>
            <div className={`amount ${summary.totalRemaining < 0 ? 'negative' : ''}`}>
              ₪{summary.totalRemaining.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="summary-card expenses">
          <div className="card-icon">📋</div>
          <div className="card-content">
            <h3>{t('events.features.budget.expenses')}</h3>
            <div className="amount">{summary.totalExpenses}</div>
            <div className="sub-info">
              {summary.paidExpenses} {t('events.features.budget.paid')}
            </div>
          </div>
        </div>
      </div>

      <div className="budget-progress">
        <h4>{t('events.features.budget.overallProgress')}</h4>
        <div className="progress-bar">
          <div 
            className={`progress-fill ${getStatusColor(summary.spentPercentage)}`}
            style={{ width: `${Math.min(summary.spentPercentage, 100)}%` }}
          ></div>
        </div>
        <div className="progress-labels">
          <span>0%</span>
          <span>{summary.spentPercentage.toFixed(1)}%</span>
          <span>100%</span>
        </div>
      </div>

      <div className="categories-breakdown">
        <h4>{t('events.features.budget.categoriesBreakdown')}</h4>
        <div className="categories-list">
          {summary.categoryBreakdown.map(cat => (
            <div key={cat.category} className="category-breakdown-item">
              <div className="category-info">
                <div className="category-details">
                  <div className="category-name">
                    {t(`events.features.budget.categories.${cat.category}`)}
                  </div>
                  <div className="category-amounts">
                    <span className="spent">
                      ₪{cat.spent.toLocaleString()} {t('events.features.budget.of')} ₪{cat.allocated.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="category-progress">
                <div className="mini-progress-bar">
                  <div 
                    className={`mini-progress-fill ${getStatusColor(cat.percentage)}`}
                    style={{ width: `${Math.min(cat.percentage, 100)}%` }}
                  ></div>
                </div>
                <span className="category-percentage">{cat.percentage.toFixed(0)}%</span>
              </div>

              <div className={`category-remaining ${cat.remaining < 0 ? 'negative' : ''}`}>
                {cat.remaining >= 0 ? '+' : ''}₪{cat.remaining.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {summary.categoryBreakdown.some(cat => cat.percentage > 100) && (
        <div className="budget-alerts">
          <h4>{t('events.features.budget.alerts')}</h4>
          <div className="alert-list">
            {summary.categoryBreakdown
              .filter(cat => cat.percentage > 100)
              .map(cat => (
                <div key={cat.category} className="alert-item danger">
                  <span className="alert-icon">⚠️</span>
                  <span>
                    {t('events.features.budget.categoryOverBudget', {
                      category: t(`events.features.budget.categories.${cat.category}`),
                      amount: Math.abs(cat.remaining).toLocaleString()
                    })}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {summary.categoryBreakdown.some(cat => cat.percentage > alertThreshold && cat.percentage <= 100) && (
        <div className="budget-warnings">
          <h4>{t('events.features.budget.warnings')}</h4>
          <div className="warning-list">
            {summary.categoryBreakdown
              .filter(cat => cat.percentage > alertThreshold && cat.percentage <= 100)
              .map(cat => (
                <div key={cat.category} className="warning-item">
                  <span className="warning-icon">⚡</span>
                  <span>
                    {t('events.features.budget.categoryNearLimit', {
                      category: t(`events.features.budget.categories.${cat.category}`),
                      percentage: cat.percentage.toFixed(0)
                    })}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetOverview;