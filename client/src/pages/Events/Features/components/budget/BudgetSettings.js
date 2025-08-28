import React from 'react';
import { useTranslation } from 'react-i18next';

const BudgetSettings = ({ budgetSettings, onSettingsChange, alerts, onDismissAlert }) => {
  const { t } = useTranslation();

  return (
    <div className="budget-settings">
      <h3>{t('events.features.budget.settings.title')}</h3>
      
      <div className="settings-section">
        <h4>{t('events.features.budget.settings.alertSettings')}</h4>
        <div className="setting-item">
          <label>
            {t('events.features.budget.settings.alertThreshold')}
            <input
              type="range"
              min="50"
              max="100"
              value={budgetSettings.alertThreshold}
              onChange={(e) => onSettingsChange({
                ...budgetSettings,
                alertThreshold: parseInt(e.target.value)
              })}
              className="threshold-slider"
            />
            <span className="threshold-value">{budgetSettings.alertThreshold}%</span>
          </label>
          <p className="setting-description">
            {t('events.features.budget.settings.alertThresholdDescription')}
          </p>
        </div>
      </div>

      <div className="settings-section">
        <h4>{t('events.features.budget.settings.displaySettings')}</h4>
        
        <div className="setting-item">
          <label>
            {t('events.features.budget.settings.chartColors')}
            <select
              value={budgetSettings.chartColors}
              onChange={(e) => onSettingsChange({
                ...budgetSettings,
                chartColors: e.target.value
              })}
              className="color-select"
            >
              <option value="default">{t('events.features.budget.settings.colorDefault')}</option>
              <option value="vibrant">{t('events.features.budget.settings.colorVibrant')}</option>
              <option value="pastel">{t('events.features.budget.settings.colorPastel')}</option>
              <option value="professional">{t('events.features.budget.settings.colorProfessional')}</option>
            </select>
          </label>
          <p className="setting-description">
            {t('events.features.budget.settings.chartColorsDescription')}
          </p>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="current-alerts">
          <h4>{t('events.features.budget.settings.currentAlerts')}</h4>
          <div className="alerts-list">
            {alerts.map(alert => (
              <div key={alert.id} className={`alert-item ${alert.type}`}>
                <span className="alert-message">{alert.message}</span>
                <button 
                  onClick={() => onDismissAlert(alert.id)}
                  className="dismiss-alert"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetSettings;