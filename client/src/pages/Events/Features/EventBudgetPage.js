import React, { useState, useEffect } from 'react';
import { useParams} from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import FeaturePageTemplate from './FeaturePageTemplate';
import BudgetOverview from './components/budget/BudgetOverview';
import BudgetSetup from './components/budget/BudgetSetup';
import ExpenseManager from './components/budget/ExpenseManager';
import BudgetCharts from './components/budget/BudgetCharts';
import '../../../styles/EventBudgetPage.css';

const EventBudgetPage = () => {
  const { id } = useParams();
  const { t } = useTranslation();
  const [budget, setBudget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [alertThreshold, setAlertThreshold] = useState(80);
  const [chartColors] = useState('default');
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    fetchBudget();
    loadSettings();
  }, [id]);

  useEffect(() => {
    if (budget) {
      checkForAlerts();
    }
  }, [budget, alertThreshold]);

  const fetchBudget = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/events/${id}/budget`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 404) {
        setBudget(null);
      } else if (response.ok) {
        const budgetData = await response.json();
        setBudget(budgetData);
      } else {
        throw new Error(t('events.features.budget.loadError'));
      }
    } catch (err) {
      console.error('Error fetching budget:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = () => {
    const savedThreshold = localStorage.getItem(`alert_threshold_${id}`);
    if (savedThreshold) {
      setAlertThreshold(parseInt(savedThreshold));
    }
  };

  const handleAlertThresholdChange = (newThreshold) => {
    setAlertThreshold(newThreshold);
    localStorage.setItem(`alert_threshold_${id}`, newThreshold.toString());
  };

  const checkForAlerts = async () => {
    if (!budget) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/events/${id}/budget/summary`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const summary = await response.json();
        const newAlerts = [];

        summary.categoryBreakdown.forEach(cat => {
          if (cat.percentage >= alertThreshold) {
            const categoryName = t(`events.features.budget.categories.${cat.category}`);
            newAlerts.push({
              id: `${cat.category}-${Date.now()}`,
              type: cat.percentage > 100 ? 'danger' : 'warning',
              category: cat.category,
              percentage: cat.percentage,
              message: cat.percentage > 100 
                // ? `התראה: ${categoryName} חרגה מהתקציב ב-${cat.percentage.toFixed(1)}%`
                // : `התראה: ${categoryName} הגיעה ל-${cat.percentage.toFixed(1)}% מהתקציב (סף התראה: ${alertThreshold}%)`
                ? t('events.features.budget.categoryOverBudget', {
                  category: categoryName,
                  amount: Math.abs(cat.remaining).toLocaleString()
                })
              : t('events.features.budget.categoryNearLimit', {
                  category: categoryName,
                  percentage: cat.percentage.toFixed(0)
                })
              });
          }
        });

        setAlerts(newAlerts);
      }
    } catch (err) {
      console.error('Error checking alerts:', err);
    }
  };

  const dismissAlert = (alertId) => {
    setAlerts(alerts.filter(alert => alert.id !== alertId));
  };

  const getChartColors = () => {
    const colorSchemes = {
      default: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43'],
      vibrant: ['#FF3030', '#30FF30', '#3030FF', '#FFFF30', '#FF30FF', '#30FFFF', '#FF8030', '#8030FF', '#30FF80', '#FF3080'],
      pastel: ['#FFB3BA', '#BAFFC9', '#BAE1FF', '#FFFFBA', '#FFD3BA', '#E1BAFF', '#C9FFBA', '#BABCFF', '#FFBAE1', '#BAF0FF'],
      professional: ['#2E86AB', '#A23B72', '#F18F01', '#C73E1D', '#5E8B73', '#8B5A2B', '#4B0082', '#2F4F4F', '#B22222', '#008B8B']
    };
    return colorSchemes[chartColors] || colorSchemes.default;
  };

  const handleBudgetCreated = (newBudget) => {
    setBudget(newBudget);
    setActiveTab('overview');
  };

  const handleBudgetUpdated = (updatedBudget) => {
    setBudget(updatedBudget);
    fetchBudget();
  };

  if (loading) {
    return (
      <FeaturePageTemplate
        title={t('events.features.budget.title')}
        icon="💰"
        description={t('events.features.budget.description')}
      >
        <div className="budget-loading">
          {t('common.loading')}
        </div>
      </FeaturePageTemplate>
    );
  }

  if (error) {
    return (
      <FeaturePageTemplate
        title={t('events.features.budget.title')}
        icon="💰"
        description={t('events.features.budget.description')}
      >
        <div className="budget-error">
          {error}
        </div>
      </FeaturePageTemplate>
    );
  }

  if (!budget) {
    return (
      <FeaturePageTemplate
        title={t('events.features.budget.title')}
        icon="💰"
        description={t('events.features.budget.description')}
      >
        <BudgetSetup eventId={id} onBudgetCreated={handleBudgetCreated} />
      </FeaturePageTemplate>
    );
  }

  return (
    <FeaturePageTemplate
      title={t('events.features.budget.title')}
      icon="💰"
      description={t('events.features.budget.description')}
    >
      {alerts.length > 0 && (
        <div className="budget-alerts-banner">
          {alerts.map(alert => (
            <div key={alert.id} className={`alert-banner ${alert.type}`}>
              <span>{alert.message}</span>
              <button onClick={() => dismissAlert(alert.id)} className="alert-dismiss">×</button>
            </div>
          ))}
        </div>
      )}
      
      <div className="budget-setup-wrapper">
        <BudgetSetup 
          eventId={id}
          existingBudget={budget}
          onBudgetCreated={handleBudgetUpdated}
        />
      </div>
      
      {budget && (
        <div className="budget-container">
          <div className="budget-tabs">
            <button 
              className={`budget-tab ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              {t('events.features.budget.tabs.overview')}
            </button>
            <button 
              className={`budget-tab ${activeTab === 'expenses' ? 'active' : ''}`}
              onClick={() => setActiveTab('expenses')}
            >
              {t('events.features.budget.tabs.expenses')}
            </button>
            <button 
              className={`budget-tab ${activeTab === 'charts' ? 'active' : ''}`}
              onClick={() => setActiveTab('charts')}
            >
              {t('events.features.budget.tabs.charts')}
            </button>
          </div>

          <div className="budget-content">
            {activeTab === 'overview' && (
              <BudgetOverview 
                budget={budget}
                eventId={id}
                onBudgetUpdated={handleBudgetUpdated}
                alertThreshold={alertThreshold}
                onAlertThresholdChange={handleAlertThresholdChange}
              />
            )}
            
            {activeTab === 'expenses' && (
              <ExpenseManager 
                budget={budget}
                eventId={id}
                onBudgetUpdated={handleBudgetUpdated}
              />
            )}
            
            {activeTab === 'charts' && (
              <BudgetCharts 
                budget={budget}
                eventId={id}
                chartColors={getChartColors()}
              />
            )}
          </div>
        </div>
      )}
    </FeaturePageTemplate>
  );
};

export default EventBudgetPage;