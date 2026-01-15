// client/src/pages/Events/Features/components/budget/BudgetCharts.js
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../../../../utils/api';

const BudgetCharts = ({ budget, eventId, chartColors }) => {
  const { t } = useTranslation();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeChart, setActiveChart] = useState('pie');

  useEffect(() => {
    fetchBudgetSummary();
  }, [budget, eventId]);

  const fetchBudgetSummary = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await apiFetch(`/api/events/${eventId}/budget/summary`, {
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

  const getCategoryColors = () => {
    if (chartColors && chartColors.length > 0) {
      return chartColors;
    }
    return [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
      '#FECA57', '#FF9FF3', '#54A0FF', '#5F27CD',
      '#00D2D3', '#FF9F43'
    ];
  };

  const exportToPDF = () => {
    const printContent = document.getElementById('chart-data-for-print');
    if (!printContent) return;

    const printWindow = window.open('', '', 'height=600,width=800');
    
    printWindow.document.write(`
      <html>
        <head>
          <title>${t('events.features.budget.budgetReport')}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; direction: rtl; }
            .report-header { text-align: center; margin-bottom: 30px; }
            .report-title { font-size: 24px; color: #2c3e50; margin-bottom: 20px; }
            .summary-section { margin-bottom: 30px; }
            .summary-row { display: flex; justify-content: space-between; margin-bottom: 8px; padding: 8px; border-bottom: 1px solid #eee; }
            .category-row { display: flex; justify-content: space-between; margin-bottom: 6px; padding: 6px; }
            .category-row:nth-child(even) { background-color: #f9f9f9; }
            h3 { color: #2c3e50; margin-bottom: 15px; }
            .amount { font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="report-header">
            <h1 class="report-title">${t('events.features.budget.budgetReport')}</h1>
          </div>
          <div class="summary-section">
            <h3>${t('events.features.budget.budgetSummary')}</h3>
            <div class="summary-row">
              <span>${t('events.features.budget.totalBudget')}</span>
              <span class="amount">₪${summary.totalBudget.toLocaleString()}</span>
            </div>
            <div class="summary-row">
              <span>${t('events.features.budget.totalSpent')}</span>
              <span class="amount">₪${summary.totalSpent.toLocaleString()}</span>
            </div>
            <div class="summary-row">
              <span>${t('events.features.budget.remaining')}</span>
              <span class="amount">₪${summary.totalRemaining.toLocaleString()}</span>
            </div>
          </div>
          <div class="category-section">
            <h3>${t('events.features.budget.categoryBreakdown')}</h3>
            ${summary.categoryBreakdown.map(cat => `
              <div class="category-row">
                <span>${t(`events.features.budget.categories.${cat.category}`)}</span>
                <span>₪${cat.spent.toLocaleString()} / ₪${cat.allocated.toLocaleString()} (${cat.percentage.toFixed(1)}%)</span>
              </div>
            `).join('')}
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.print();
    printWindow.close();
  };

  const exportToCSV = () => {
    try {
      const BOM = '\uFEFF';
      
      const csvData = [
        [t('events.features.budget.totalBudget'), summary.totalBudget],
        [t('events.features.budget.totalSpent'), summary.totalSpent],
        [t('events.features.budget.remaining'), summary.totalRemaining],
        ['', ''],
        [t('events.features.budget.categoryBreakdown'), '', '', ''],
        [t('events.features.budget.category'), t('events.features.budget.allocated'), t('events.features.budget.spent'), t('events.features.budget.percentage')]
      ];
      
      summary.categoryBreakdown.forEach(cat => {
        csvData.push([
          t(`events.features.budget.categories.${cat.category}`),
          cat.allocated,
          cat.spent,
          `${cat.percentage.toFixed(1)}%`
        ]);
      });
      
      const csvContent = BOM + csvData.map(row => 
        row.map(field => `"${field}"`).join(',')
      ).join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `budget-report-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error exporting CSV:', err);
    }
  };

  const createPieChart = () => {
    if (!summary) return null;

    const colors = getCategoryColors();
    const total = summary.categoryBreakdown.reduce((sum, cat) => sum + cat.spent, 0);
    
    if (total === 0) {
      return (
        <div className="chart-empty">
          <p>{t('events.features.budget.noDataForChart')}</p>
        </div>
      );
    }

    let currentAngle = 0;
    const radius = 80;
    const centerX = 100;
    const centerY = 100;

    const slices = summary.categoryBreakdown
      .filter(cat => cat.spent > 0)
      .map((cat, index) => {
        const percentage = (cat.spent / total) * 100;
        const angle = (cat.spent / total) * 360;
        const startAngle = currentAngle;
        const endAngle = currentAngle + angle;
        
        const x1 = centerX + radius * Math.cos((startAngle * Math.PI) / 180);
        const y1 = centerY + radius * Math.sin((startAngle * Math.PI) / 180);
        const x2 = centerX + radius * Math.cos((endAngle * Math.PI) / 180);
        const y2 = centerY + radius * Math.sin((endAngle * Math.PI) / 180);
        
        const largeArc = angle > 180 ? 1 : 0;
        
        const pathData = [
          `M ${centerX} ${centerY}`,
          `L ${x1} ${y1}`,
          `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
          'Z'
        ].join(' ');

        currentAngle += angle;

        return {
          pathData,
          color: colors[index % colors.length],
          category: cat.category,
          spent: cat.spent,
          percentage: percentage
        };
      });

    return (
      <div className="pie-chart-container">
        <svg viewBox="0 0 200 200" className="pie-chart">
          {slices.map((slice, index) => (
            <path
              key={slice.category}
              d={slice.pathData}
              fill={slice.color}
              className="pie-slice"
            />
          ))}
        </svg>
        
        <div className="chart-legend">
          {slices.map((slice, index) => (
            <div key={slice.category} className="legend-item">
              <div 
                className="legend-color" 
                style={{ backgroundColor: slice.color }}
              ></div>
              <span className="legend-text">
                {t(`events.features.budget.categories.${slice.category}`)} - ₪{slice.spent.toLocaleString()} ({slice.percentage.toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const createBarChart = () => {
    if (!summary) return null;

    const maxValue = Math.max(...summary.categoryBreakdown.map(cat => Math.max(cat.allocated, cat.spent)));
    const colors = getCategoryColors();

    if (maxValue === 0) {
      return (
        <div className="chart-empty">
          <p>{t('events.features.budget.noDataForChart')}</p>
        </div>
      );
    }

    return (
      <div className="improved-bar-chart-container">
        <div className="bar-chart-header">
          <div className="chart-legend-horizontal">
            <div className="legend-item">
              <div className="legend-color allocated"></div>
              <span>{t('events.features.budget.allocated')}</span>
            </div>
            <div className="legend-item">
              <div className="legend-color spent"></div>
              <span>{t('events.features.budget.spent')}</span>
            </div>
          </div>
        </div>

        <div className="improved-bar-chart">
          <div className="y-axis">
            <div className="y-axis-label">₪{maxValue.toLocaleString()}</div>
            <div className="y-axis-label">₪{(maxValue * 0.75).toLocaleString()}</div>
            <div className="y-axis-label">₪{(maxValue * 0.5).toLocaleString()}</div>
            <div className="y-axis-label">₪{(maxValue * 0.25).toLocaleString()}</div>
            <div className="y-axis-label">₪0</div>
          </div>

          <div className="chart-bars-container">
            {summary.categoryBreakdown.map((cat, index) => {
              const allocatedHeight = (cat.allocated / maxValue) * 100;
              const spentHeight = (cat.spent / maxValue) * 100;
              
              return (
                <div key={cat.category} className="improved-bar-group">
                  <div className="bar-container">
                    <div className="grid-lines">
                      <div className="grid-line"></div>
                      <div className="grid-line"></div>
                      <div className="grid-line"></div>
                      <div className="grid-line"></div>
                    </div>
                    
                    <div className="bars-wrapper">
                      <div className="bar-pair">
                        <div 
                          className="improved-bar allocated"
                          style={{ height: `${allocatedHeight}%` }}
                          title={`${t('events.features.budget.allocated')}: ₪${cat.allocated.toLocaleString()}`}
                        >
                          <div className="bar-value allocated">₪{cat.allocated.toLocaleString()}</div>
                        </div>
                        <div 
                          className="improved-bar spent"
                          style={{ 
                            height: `${spentHeight}%`,
                            backgroundColor: colors[index % colors.length]
                          }}
                          title={`${t('events.features.budget.spent')}: ₪${cat.spent.toLocaleString()}`}
                        >
                          <div className="bar-value spent">₪{cat.spent.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="improved-bar-label">
                    <div className="category-name">
                      {t(`events.features.budget.categories.${cat.category}`)}
                    </div>
                    <div className="percentage-indicator">
                      {cat.percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="chart-summary">
          <div className="summary-stats">
            <div className="stat">
              <span className="stat-label">{t('events.features.budget.totalAllocated')}</span>
              <span className="stat-value">₪{summary.categoryBreakdown.reduce((sum, cat) => sum + cat.allocated, 0).toLocaleString()}</span>
            </div>
            <div className="stat">
              <span className="stat-label">{t('events.features.budget.totalSpent')}</span>
              <span className="stat-value">₪{summary.totalSpent.toLocaleString()}</span>
            </div>
            <div className="stat">
              <span className="stat-label">{t('events.features.budget.efficiency')}</span>
              <span className="stat-value">{((summary.totalSpent / summary.totalBudget) * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="budget-loading">{t('general.loading')}</div>;
  }

  if (!summary) {
    return <div className="budget-error">{t('events.features.budget.summaryError')}</div>;
  }

  return (
    <div className="budget-charts">
      <div className="charts-header">
        <h3>{t('events.features.budget.chartsTitle')}</h3>
        <div className="charts-controls">
          <div className="chart-tabs">
            <button 
              className={`chart-tab ${activeChart === 'pie' ? 'active' : ''}`}
              onClick={() => setActiveChart('pie')}
            >
              {t('events.features.budget.pieChart')}
            </button>
            <button 
              className={`chart-tab ${activeChart === 'bar' ? 'active' : ''}`}
              onClick={() => setActiveChart('bar')}
            >
              {t('events.features.budget.barChart')}
            </button>
          </div>
          <div className="export-buttons">
            <button onClick={exportToPDF} className="export-button">
              {t('events.features.budget.exportPDF')}
            </button>
            <button onClick={exportToCSV} className="export-button">
              {t('events.features.budget.exportCSV')}
            </button>
          </div>
        </div>
      </div>

      <div id="chart-data-for-print" className="chart-content">
        {activeChart === 'pie' && createPieChart()}
        {activeChart === 'bar' && createBarChart()}
      </div>
    </div>
  );
};

export default BudgetCharts;