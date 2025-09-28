import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

const GoogleCalendarSync = ({ eventId, canEdit = true  }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  const showError = (message) => {
    setErrorMessage(message);
    setSuccessMessage('');
    setTimeout(() => setErrorMessage(''), 5000);
  };

  const showSuccess = (message) => {
    setSuccessMessage(message);
    setErrorMessage('');
    setTimeout(() => setSuccessMessage(''), 5000);
  };

  const checkConnectionStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/tasks/google-calendar/status', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setIsConnected(data.connected);
      }
    } catch (error) {
      console.error('Error checking connection status:', error);
    }
  };

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  useEffect(() => {
    if (location.state?.googleAuthSuccess) {
      setTimeout(() => {
        checkConnectionStatus();
      }, 1000);
    }
    
    if (location.state?.googleAuthError) {
      showError(location.state.message || t('events.features.tasks.calendar.sync.connectionError'));
    }
  }, [location.state]);

  const connectGoogleCalendar = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        showError(t('errors.notLoggedIn'));
        return;
      }

      const currentPath = location.pathname + location.search + location.hash;
      sessionStorage.setItem('googleAuthReturnTo', currentPath);

      const response = await fetch('/api/tasks/google-calendar/auth-url', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        window.location.href = data.authUrl;
      } else {
        throw new Error('Failed to get auth URL');
      }
    } catch (error) {
      console.error('Error connecting Google Calendar:', error);
      showError(t('events.features.tasks.calendar.sync.connectionError'));
    } finally {
      setLoading(false);
    }
  };

  const disconnectGoogleCalendar = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch('/api/tasks/google-calendar/disconnect', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setIsConnected(false);
        setShowDisconnectConfirm(false);
        showSuccess(t('events.features.tasks.calendar.sync.disconnectSuccess'));
      } else {
        throw new Error('Failed to disconnect');
      }
    } catch (error) {
      console.error('Error disconnecting Google Calendar:', error);
      showError(t('events.features.tasks.calendar.sync.disconnectError'));
    } finally {
      setLoading(false);
    }
  };

  const syncWithCalendar = async () => {
    try {
      setSyncing(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`/api/tasks/event/${eventId}/sync-calendar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        const successCount = data.results?.success?.length || 0;
        const failedCount = data.results?.failed?.length || 0;
        
        let message = t('events.features.tasks.calendar.sync.syncCompleted', { count: successCount });

        if (failedCount > 0) {
          message += ` (${t('events.features.tasks.calendar.sync.syncPartialFailed', { count: failedCount })})`;
        }
        
        showSuccess(message);
      } else {
        if (data.error === 'AUTH_EXPIRED' || data.needsReauth) {
          setIsConnected(false);
          showError(t('events.features.tasks.calendar.sync.authExpired'));
        } else {
          throw new Error(data.message);
        }
      }
    } catch (error) {
      console.error('Error syncing with calendar:', error);
      showError(t('events.features.tasks.calendar.sync.syncError'));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="calendar-sync-container">
      {errorMessage && (
        <div className="error-message-notification">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="success-message-notification">
          {successMessage}
        </div>
      )}

      <div className="calendar-sync-content">
        {!isConnected ? (
          <div className="not-connected">
            <div className="connection-status">
              <span className="status-indicator offline"></span>
              <span>{t('events.features.tasks.calendar.sync.notConnected')}</span>
            </div>
            <p>{t('events.features.tasks.calendar.sync.connectDescription')}</p>
            <button 
              className="connect-btn"
              onClick={connectGoogleCalendar}
              disabled={loading || !canEdit}
            >
              {loading ? (t('auth.connecting')) : (t('events.features.tasks.calendar.sync.connectButton'))}
            </button>
          </div>
        ) : (
          <div className="connected">
            <div className="connection-status">
              <span className="status-indicator online"></span>
              <span>{t('events.features.tasks.calendar.sync.connected')}</span>
            </div>
            
            <div className="sync-info">
              <p>💡 {t('events.features.tasks.calendar.sync.autoSyncInfo')}</p>
            </div>
            
            {showDisconnectConfirm && (
              <div className="modal-overlay" onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowDisconnectConfirm(false);
                }
              }}>
                <div className="modal-content disconnect-modal">
                  <div className="modal-header">
                    <h2 className="modal-title">{t('events.features.tasks.calendar.sync.disconnectConfirm')}</h2>
                    <button className="modal-close" onClick={() => setShowDisconnectConfirm(false)}>
                      ✕
                    </button>
                  </div>
                  <div className="modal-actions">
                    <button 
                      className="btn-secondary"
                      onClick={() => setShowDisconnectConfirm(false)}
                    >
                      {t('general.cancel')}
                    </button>
                    <button 
                      className="btn-primary disconnect-confirm-btn" 
                      onClick={disconnectGoogleCalendar}
                      disabled={loading}
                    >
                      {t('events.features.tasks.calendar.sync.disconnectButton')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="calendar-actions">
              <button 
                className="sync-btn"
                onClick={syncWithCalendar}
                disabled={syncing || !canEdit}
              >
                {syncing ? (t('events.features.tasks.calendar.sync.syncing')) : (t('events.features.tasks.calendar.sync.syncButton'))}
              </button>
              
              <button 
                className="disconnect-btn"
                onClick={() => setShowDisconnectConfirm(true)}
                disabled={loading || !canEdit}
              >
                {t('events.features.tasks.calendar.sync.disconnectButton')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GoogleCalendarSync;