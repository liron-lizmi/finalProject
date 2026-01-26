import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import emailjs from 'emailjs-com';
import '../../styles/AuthPages.css';

const ForgotPassword = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const EMAILJS_SERVICE_ID = "service_0b55fva";
  const EMAILJS_TEMPLATE_ID = "template_6ijwdwq"; 
  const EMAILJS_USER_ID = "GzTrzVDcGGlrFwgAi";

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email) {
      setError(t('errors.emailRequired'));
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError(t('errors.invalidEmail'));
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    setMessage('');
    
    try {
      const response = await axios.post('/api/auth/forgot-password', { email });
      
      const resetToken = response.data.resetToken;
      const resetURL = `${window.location.origin}/reset-password/${resetToken}`;
            
      const templateParams = {
        to_email: email,
        to_name: email.split('@')[0],
        reset_link: resetURL,
        site_name: t('general.appName'),
        current_year: new Date().getFullYear()
      };
      
      try {
        const emailResult = await emailjs.send(
          EMAILJS_SERVICE_ID,
          EMAILJS_TEMPLATE_ID,
          templateParams,
          EMAILJS_USER_ID
        );
        
      } catch (emailError) {
        // Email sending error
      }

      setMessage(t('auth.resetLinkSent'));

      setEmail('');

    } catch (err) {
      
      if (err.response?.status === 404) {
        setError(t('errors.emailNotFound'));
      } else if (err.message?.includes('emailjs')) {
        setError(t('errors.emailSendFailed'));
      } else {
        setError(err.response?.data?.message || t('errors.generalError'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`auth-container ${isRTL ? 'rtl' : 'ltr'}`}>
      <div className="auth-logo-container">
        <img src="/images/logo.png" alt={t('general.appLogo')} className="logo" onClick={() => navigate('/')} />
      </div>
      <div className="auth-box">
        <h2>{t('auth.resetPasswordTitle')}</h2>
        {error && <div className="error-message">{error}</div>}
        {message && <div className="success-message">{message}</div>}
        
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <input
              type="email"
              placeholder={t('auth.enterEmailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <button 
            type="submit" 
            className="auth-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? t('auth.sending') : t('auth.sendResetLink')}
          </button>
        </form>
        
        <p className="auth-link">
          <span onClick={() => navigate('/login')} className="back-to-login">
            {t('auth.backToLogin')}
          </span>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;