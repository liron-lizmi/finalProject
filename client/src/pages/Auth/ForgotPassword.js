import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import emailjs from 'emailjs-com';
import '../../styles/AuthPages.css';

const ForgotPassword = () => {
  const { t } = useTranslation();
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
      setError(t('errors.emailRequired', 'אנא הכנס כתובת אימייל'));
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError(t('errors.invalidEmail', 'כתובת האימייל אינה תקינה'));
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    setMessage('');
    
    try {
      const response = await axios.post('/api/auth/forgot-password', { email });
      
      const resetToken = response.data.resetToken;
      const resetURL = `${window.location.origin}/reset-password/${resetToken}`;
      
      console.log("Reset URL for testing:", resetURL); 
      
      const templateParams = {
        to_email: email,
        to_name: email.split('@')[0],
        reset_link: resetURL,
        site_name: t('general.appName', "PlanIt"),
        current_year: new Date().getFullYear()
      };
      
      try {
        const emailResult = await emailjs.send(
          EMAILJS_SERVICE_ID,
          EMAILJS_TEMPLATE_ID,
          templateParams,
          EMAILJS_USER_ID
        );
        
        console.log('Email sent successfully:', emailResult.text);
      } catch (emailError) {
        console.error('Email sending error:', emailError);
      }
      
      setMessage(t('auth.resetLinkSent', 'קישור לאיפוס סיסמה נשלח לאימייל שלך'));
      
      setEmail('');
      
    } catch (err) {
      console.error('Error details:', err);
      
      if (err.response?.status === 404) {
        setError(t('errors.emailNotFound', 'אימייל לא קיים במערכת'));
      } else if (err.message?.includes('emailjs')) {
        setError(t('errors.emailSendFailed', 'אירעה שגיאה בשליחת המייל. אנא נסה שוב מאוחר יותר'));
      } else {
        setError(err.response?.data?.message || t('errors.generalError', 'אירעה שגיאה. אנא נסה שוב מאוחר יותר'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>{t('auth.resetPasswordTitle', 'שחזור סיסמה')}</h2>
        {error && <div className="error-message">{error}</div>}
        {message && <div className="success-message">{message}</div>}
        
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <input
              type="email"
              placeholder={t('auth.enterEmailPlaceholder', 'הזן את כתובת האימייל שלך')}
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
            {isSubmitting ? t('auth.sending', 'שולח...') : t('auth.sendResetLink', 'שלח קישור לאיפוס סיסמה')}
          </button>
        </form>
        
        <p className="auth-link">
          <span onClick={() => navigate('/login')}>{t('auth.backToLogin', 'חזרה להתחברות')}</span>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;