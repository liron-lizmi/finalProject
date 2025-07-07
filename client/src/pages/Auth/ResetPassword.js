import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import '../../styles/AuthPages.css';

const ResetPassword = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { token } = useParams();
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRTL = i18n.language === 'he';

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const validatePassword = () => {
    if (!formData.password) {
      setError(t('errors.newPasswordRequired'));
      return false;
    }
    if (formData.password.length < 6) {
      setError(t('errors.shortPassword'));
      return false;
    }

    const hasUpperCase = /[A-Z]/.test(formData.password);
    const hasLowerCase = /[a-z]/.test(formData.password);
    const hasNumbers = /\d/.test(formData.password);

    if (!(hasUpperCase && hasLowerCase && hasNumbers)) {
      setError(t('errors.passwordRequirements'));
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError(t('errors.passwordMismatch'));
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validatePassword()) {
      return;
    }

    setIsSubmitting(true);
    setError('');
    setMessage('');

    try {
      const response = await axios.post(`/api/auth/reset-password/${token}`, {
        password: formData.password
      });

      setMessage(response.data.message || t('auth.updatedPasswordSuccess'));
      
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      const errorMessage = err.response?.data?.message || t('errors.generalError');
      
      if (err.response?.data?.code === 'SAME_PASSWORD') {
        setError(t('errors.samePassword'));
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderPasswordStrength = () => {
    if (!formData.password) return null;

    return (
      <div className="password-strength">
        <h4>{t('auth.passwordRequirements')}</h4>
        <ul>
          <li className={/[A-Z]/.test(formData.password) ? 'valid' : 'invalid'}>
            {t('auth.requireUppercase')}
          </li>
          <li className={/[a-z]/.test(formData.password) ? 'valid' : 'invalid'}>
            {t('auth.requireLowercase')}
          </li>
          <li className={/\d/.test(formData.password) ? 'valid' : 'invalid'}>
            {t('auth.requireNumber')}
          </li>
          <li className={formData.password.length >= 6 ? 'valid' : 'invalid'}>
            {t('auth.requireLength')}
          </li>
        </ul>
      </div>
    );
  };

  const renderEyeIcon = (isVisible) => {
    return isVisible ? (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
    ) : (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>
      </svg>
    );
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
          <div className={`form-group password-field ${isRTL ? 'rtl' : 'ltr'}`}>
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder={t('auth.newPassword')}
              value={formData.password}
              onChange={handleChange}
              required
            />
            <span
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
            >
              {renderEyeIcon(showPassword)}
            </span>
          </div>
          <div className={`form-group password-field ${isRTL ? 'rtl' : 'ltr'}`}>
            <input
              type={showConfirmPassword ? "text" : "password"}
              name="confirmPassword"
              placeholder={t('auth.confirmPassword')}
              value={formData.confirmPassword}
              onChange={handleChange}
              required
            />
            <span
              className="password-toggle"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {renderEyeIcon(showConfirmPassword)}
            </span>
          </div>
          
          {renderPasswordStrength()}
          
          <button
            type="submit"
            className="auth-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? t('auth.updatingPassword') : t('auth.updatePassword')}
          </button>
        </form>
        
        <p className="auth-link">
          <span onClick={() => navigate('/login')}>{t('auth.backToLogin')}</span>
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;