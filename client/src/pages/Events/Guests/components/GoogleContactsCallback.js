/**
 * GoogleContactsCallback.js - Google Contacts OAuth Callback
 *
 * Handles OAuth callback from Google Contacts authorization.
 *
 * Route: /auth/google-contacts/callback
 *
 * Flow:
 * 1. Receive OAuth code and state from Google
 * 2. Exchange code for tokens via backend
 * 3. Fetch contacts from Google
 * 4. Redirect back to guest page with contacts
 *
 * Query Parameters:
 * - code: OAuth authorization code
 * - state: Should be 'google_contacts_auth'
 * - error: Present if user denied access
 *
 * States:
 * - processing: Exchanging tokens
 * - success: Contacts fetched
 * - error: Something went wrong
 *
 * Storage:
 * - googleContactsReturnTo: Original page to return to
 */
import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../../../utils/api';

const GoogleContactsCallback = () => {
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
          setStatus('error');
          setTimeout(() => {
            const returnTo = sessionStorage.getItem('googleContactsReturnTo') || '/dashboard';
            sessionStorage.removeItem('googleContactsReturnTo');
            navigate(returnTo, { replace: true });
          }, 3000);
          return;
        }

        if (!code || state !== 'google_contacts_auth') {
          setStatus('error');
          setTimeout(() => {
            const returnTo = sessionStorage.getItem('googleContactsReturnTo') || '/dashboard';
            sessionStorage.removeItem('googleContactsReturnTo');
            navigate(returnTo, { replace: true });
          }, 3000);
          return;
        }

        const token = localStorage.getItem('token');
        if (!token) {
          setStatus('error');
          setTimeout(() => {
            navigate('/login', { replace: true });
          }, 3000);
          return;
        }

        const returnTo = sessionStorage.getItem('googleContactsReturnTo') || '/dashboard';
        const eventIdMatch = returnTo.match(/\/event\/([^\/]+)\/guests/);
        const eventId = eventIdMatch ? eventIdMatch[1] : null;

        if (!eventId) {
            setStatus('error');
            setTimeout(() => {
                navigate('/dashboard', { replace: true });
            }, 3000);
            return;
        }

        const response = await apiFetch(`/api/events/${eventId}/guests/google-contacts/callback`, {
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
            const returnTo = sessionStorage.getItem('googleContactsReturnTo');
            
            if (returnTo && returnTo !== '/dashboard') {
              // Navigate back to the guest page with success state
              navigate(returnTo, { 
                replace: true,
                state: { 
                  googleContactsSuccess: true,
                  timestamp: Date.now()
                }
              });
            } else {
              sessionStorage.removeItem('googleContactsReturnTo');
              navigate('/dashboard', { replace: true });
            }
          }, 1500);
        } else {
          setStatus('error');
          
          setTimeout(() => {
            const returnTo = sessionStorage.getItem('googleContactsReturnTo') || '/dashboard';
            sessionStorage.removeItem('googleContactsReturnTo');
            navigate(returnTo, {
              replace: true,
              state: {
                googleContactsError: true,
                message: responseData.message || t('guests.googleConnectionError')
              }
            });
          }, 3000);
        }

      } catch (error) {
        setStatus('error');
        setTimeout(() => {
          const returnTo = sessionStorage.getItem('googleContactsReturnTo') || '/dashboard';
          sessionStorage.removeItem('googleContactsReturnTo');
          navigate(returnTo, {
            replace: true,
            state: {
              googleContactsError: true,
              message: t('guests.errors.googleConnectionError')
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
            <p>{t('import.googleConnectionSuccess')}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="auth-icon error">❌</div>
            <p>{t('guests.errors.googleConnectionError')}</p>
          </>
        )}
      </div>
    </div>
  );
};

export default GoogleContactsCallback;