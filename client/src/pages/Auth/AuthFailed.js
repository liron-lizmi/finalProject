import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import emailjs from 'emailjs-com';
import { useTranslation } from 'react-i18next';
import '../../styles/AuthPages.css';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
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
      setError(t('validation.emailRequired'));
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError(t('validation.emailInvalid'));
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
        site_name: "PlanIt",
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
      
      setMessage(t('success.resetLinkSent'));
      
      setEmail('');
      
    } catch (err) {
      console.error('Error details:', err);
      
      if (err.response?.status === 404) {
        setError(t('errors.emailNotExists'));
      } else if (err.message?.includes('emailjs')) {
        setError(t('errors.emailSendError'));
      } else {
        setError(err.response?.data?.message || t('errors.generalError'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>{t('forgotPassword.title')}</h2>
        {error && <div className="error-message">{error}</div>}
        {message && <div className="success-message">{message}</div>}
        
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <input
              type="email"
              placeholder={t('forgotPassword.emailPlaceholder')}
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
            {isSubmitting ? t('forgotPassword.submitting') : t('forgotPassword.submitButton')}
          </button>
        </form>
        
        <p className="auth-link">
          <span onClick={() => navigate('/login')}>{t('forgotPassword.backToLogin')}</span>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;