import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import emailjs from 'emailjs-com';
import '../../styles/AuthPages.css';

const RegisterPage = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he'; 
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: ''
      });
    }
  };

  const sendRegistrationEmail = async (userData) => {
    try {
      const serviceId = "service_0b55fva";
      const templateId = "template_0d6cm7g";
      const userId = "GzTrzVDcGGlrFwgAi";

      const templateParams = {
        to_name: `${userData.firstName} ${userData.lastName}`,
        to_email: userData.email,
        user_name: `${userData.firstName} ${userData.lastName}`,
        message: t('emails.welcomeMessage'),
        site_name: t('general.appName'),
        login_url: `${window.location.origin}/login`
      };

      const result = await emailjs.send(serviceId, templateId, templateParams, userId);
      console.log('Email sent successfully:', result.text);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.firstName.trim()) {
      newErrors.firstName = t('errors.required');
    } else if (formData.firstName.length < 2) {
      newErrors.firstName = t('errors.shortFirstName');
    } else if (formData.firstName.length > 50) {
      newErrors.firstName = t('errors.longFirstName');
    }
    
    if (!formData.lastName.trim()) {
      newErrors.lastName = t('errors.required');
    } else if (formData.lastName.length < 2) {
      newErrors.lastName = t('errors.shortLastName');
    } else if (formData.lastName.length > 50) {
      newErrors.lastName = t('errors.longLastName');
    }
    
    if (!formData.email.trim()) {
      newErrors.email = t('errors.required');
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        newErrors.email = t('errors.invalidEmail');
      }
    }
    
    if (!formData.password) {
      newErrors.password = t('errors.required');
    } else if (formData.password.length < 6) {
      newErrors.password = t('errors.shortPassword');
    } else if (formData.password.length > 30) {
      newErrors.password = t('errors.longPassword');
    } else {
      const hasUpperCase = /[A-Z]/.test(formData.password);
      const hasLowerCase = /[a-z]/.test(formData.password);
      const hasNumbers = /\d/.test(formData.password);
      
      if (!(hasUpperCase && hasLowerCase && hasNumbers)) {
        newErrors.password = t('errors.passwordRequirements');
      }
    }
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = t('errors.passwordMismatch');
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    setServerError('');
    setSuccessMessage('');
    
    try {
      const response = await axios.post('/api/auth/register', {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password
      });

      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        
        const userObject = {
          ...response.data.user,
          name: `${formData.firstName} ${formData.lastName}`,
          isLoggedIn: true
        };
        
        localStorage.setItem('user', JSON.stringify(userObject));
        
        const emailSent = await sendRegistrationEmail({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email
        });
        
        const message = emailSent 
          ? t('auth.registerSuccess') 
          : t('auth.registerSuccessNoEmail',);
        
        setSuccessMessage(message);
        
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Registration error:', err);
      setServerError(err.response?.data?.message || t('errors.generalError'));
    } finally {
      setIsSubmitting(false);
    }
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
        <h2>{t('auth.registerTitle')}</h2>
        {serverError && <div className="error-message">{serverError}</div>}
        {successMessage && <div className="success-message">{successMessage}</div>}
        
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <input
              type="text"
              name="firstName"
              placeholder={t('auth.firstName')}
              value={formData.firstName}
              onChange={handleChange}
              className={errors.firstName ? 'error' : ''}
            />
            {errors.firstName && <div className="input-error">{errors.firstName}</div>}
          </div>
          <div className="form-group">
            <input
              type="text"
              name="lastName"
              placeholder={t('auth.lastName')}
              value={formData.lastName}
              onChange={handleChange}
              className={errors.lastName ? 'error' : ''}
            />
            {errors.lastName && <div className="input-error">{errors.lastName}</div>}
          </div>
          <div className="form-group">
            <input
              type="email"
              name="email"
              placeholder={t('auth.email')}
              value={formData.email}
              onChange={handleChange}
              className={errors.email ? 'error' : ''}
            />
            {errors.email && <div className="input-error">{errors.email}</div>}
          </div>
          <div className={`form-group password-field ${isRTL ? 'rtl' : 'ltr'}`}>
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder={t('auth.password')}
              value={formData.password}
              onChange={handleChange}
              className={errors.password ? 'error' : ''}
            />
            <span 
              className="password-toggle" 
              onClick={() => setShowPassword(!showPassword)}
            >
              {renderEyeIcon(showPassword)}
            </span>
            {errors.password && <div className="input-error">{errors.password}</div>}
          </div>
          <div className={`form-group password-field ${isRTL ? 'rtl' : 'ltr'}`}>
            <input
              type={showConfirmPassword ? "text" : "password"}
              name="confirmPassword"
              placeholder={t('auth.confirmPassword')}
              value={formData.confirmPassword}
              onChange={handleChange}
              className={errors.confirmPassword ? 'error' : ''}
            />
            <span 
              className="password-toggle" 
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {renderEyeIcon(showConfirmPassword)}
            </span>
            {errors.confirmPassword && <div className="input-error">{errors.confirmPassword}</div>}
          </div>
          <button 
            type="submit" 
            className="auth-button" 
            disabled={isSubmitting}
          >
            {isSubmitting ? t('auth.processing') : t('auth.signupButton')}
          </button>
        </form>
        <p className="auth-link">
          {t('auth.alreadyHaveAccount')} <span onClick={() => navigate('/login')}>{t('auth.loginButton')}</span>
        </p>
        
        {formData.password && (
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
        )}
      </div>
    </div>
  );
};

export default RegisterPage;