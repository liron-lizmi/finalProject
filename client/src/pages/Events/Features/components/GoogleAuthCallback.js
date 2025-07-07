// src/pages/Events/Features/components/GoogleAuthCallback.js
import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

const GoogleAuthCallback = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('processing'); 
  const hasProcessed = useRef(false); 

  useEffect(() => {
    // Prevent double execution in React StrictMode
    if (hasProcessed.current) {
      return;
    }

    const handleCallback = async () => {
      hasProcessed.current = true;
      
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');

        if (error) {
          console.error('Google Auth Error:', error);
          setStatus('error');
          setTimeout(() => {
            const returnTo = sessionStorage.getItem('googleAuthReturnTo') || '/dashboard';
            sessionStorage.removeItem('googleAuthReturnTo');
            navigate(returnTo, { replace: true });
          }, 3000);
          return;
        }

        if (!code || state !== 'google_calendar_auth') {
          console.error('Invalid callback parameters');
          setStatus('error');
          setTimeout(() => {
            const returnTo = sessionStorage.getItem('googleAuthReturnTo') || '/dashboard';
            sessionStorage.removeItem('googleAuthReturnTo');
            navigate(returnTo, { replace: true });
          }, 3000);
          return;
        }

        const token = localStorage.getItem('token');
        if (!token) {
          console.error('No auth token found');
          setStatus('error');
          setTimeout(() => {
            navigate('/login', { replace: true });
          }, 3000);
          return;
        }

        const response = await fetch('/api/tasks/google-calendar/callback', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ code })
        });

        const responseData = await response.json();

        if (response.ok && responseData.success) {
          setStatus('success');
          
          // Wait to show success message, then navigate back
          setTimeout(() => {
            const returnTo = sessionStorage.getItem('googleAuthReturnTo');
            
            if (returnTo && returnTo !== '/dashboard') {
              // Navigate back to the task manager with success state
              navigate(returnTo, { 
                replace: true,
                state: { 
                  googleAuthSuccess: true,
                  timestamp: Date.now()
                }
              });
            } else {
              // Only if no return path or return path is dashboard
              sessionStorage.removeItem('googleAuthReturnTo');
              navigate('/dashboard', { replace: true });
            }
          }, 1500);
        } else {
          console.error('❌ Callback failed:', responseData);
          setStatus('error');
          
          // Set appropriate error message based on error type
          let errorMessage = t('events.features.tasks.calendar.sync.connectionError');
          
          if (responseData.error === 'AUTH_EXPIRED' || 
              responseData.error === 'CODE_ALREADY_USED' ||
              responseData.error === 'MISSING_CODE') {
            errorMessage = responseData.userMessage || t('errors.generalError');
          }
          
          setTimeout(() => {
            const returnTo = sessionStorage.getItem('googleAuthReturnTo') || '/dashboard';
            sessionStorage.removeItem('googleAuthReturnTo');
            navigate(returnTo, {
              replace: true,
              state: {
                googleAuthError: true,
                message: errorMessage
              }
            });
          }, 3000);
        }

      } catch (error) {
        console.error('❌ Error processing Google Auth callback:', error);
        setStatus('error');
        setTimeout(() => {
          const returnTo = sessionStorage.getItem('googleAuthReturnTo') || '/dashboard';
          sessionStorage.removeItem('googleAuthReturnTo');
          navigate(returnTo, {
            replace: true,
            state: {
              googleAuthError: true,
              message: t('events.features.tasks.calendar.sync.connectionError')
            }
          });
        }, 3000);
      }
    };

    handleCallback();
  }, []); 

  return (
    <div className="google-auth-callback">
      <div className="auth-callback-card">
        {status === 'processing' && (
          <>
            <div className="auth-spinner"></div>
            <h2>{t('auth.processing')}</h2>
            <p>{t('general.loading')}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="auth-icon success">✅</div>
            <p>{t('events.features.tasks.calendar.sync.connectionSuccess')}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="auth-icon error">❌</div>
            <p>{t('events.features.tasks.calendar.sync.connectionError')}</p>
          </>
        )}
      </div>
    </div>
  );
};

export default GoogleAuthCallback;