/**
 * AuthFailed.js - OAuth Authentication Failed Page
 *
 * Displays error message when OAuth (Google) login fails.
 *
 * Route: /auth-failed?reason={reason}
 *
 * Reasons:
 * - user_not_exists: User tried to login with OAuth but account doesn't exist
 *   Shows: Register button + Back to Login button
 * - default: General OAuth failure
 *   Shows: Back to Login button only
 *
 * Features:
 * - RTL support for Hebrew
 * - Contextual error messages based on failure reason
 * - Navigation to register or login pages
 */

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const AuthFailed = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const reason = searchParams.get('reason');
  const isRTL = i18n.language === 'he';

  const errorMessage = reason === 'user_not_exists' 
    ? t('auth.authFailed.userNotExists')
    : t('auth.authFailed.generalError');

  return (
    <div className={`auth-container ${isRTL ? 'rtl' : 'ltr'}`}>
      <div className="auth-box">
        <h2>{t('auth.authFailed.title')}</h2>
        <div className="error-message">
          {errorMessage}
        </div>
        <div className="auth-buttons-container">
          {reason === 'user_not_exists' ? (
            <>
              <button 
                onClick={() => navigate('/register')} 
                className="auth-button"
              >
                {t('auth.authFailed.goToRegister')}
              </button>
              <button 
                onClick={() => navigate('/login')} 
                className="auth-button secondary"
              >
                {t('auth.authFailed.backToLogin')}
              </button>
            </>
          ) : (
            <button 
              onClick={() => navigate('/login')} 
              className="auth-button"
            >
              {t('auth.authFailed.backToLogin')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthFailed;