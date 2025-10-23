// client/src/pages/Auth/LoginPage.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import '../../styles/AuthPages.css';
import { createOAuth2Session, account } from '../../appwrite'; 
import { useTranslation } from 'react-i18next';

const LoginPage = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he'; 
  const navigate = useNavigate();
  const location = useLocation();
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const authFailed = params.get('auth') === 'failed';
    const error = params.get('error');
    
    if (authFailed) {
      setServerError(t('auth.googleLoginError'));
    }
    
    if (error === 'session_expired') {
      setServerError(t('auth.sessionExpired'));
    }
  }, [location.search, t]);

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

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.email.trim()) {
      newErrors.email = t('auth.emailRequired');
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        newErrors.email = t('auth.invalidEmailFormat');
      }
    }
    
    if (!formData.password) {
      newErrors.password = t('auth.passwordRequired');
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
    
    try {
      const response = await axios.post('/api/auth/login', formData);
      
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Login error:', err);
      setServerError(err.response?.data?.message || t('auth.invalidCredentials'));
    } finally {
      setIsSubmitting(false);
    }
  };

 const handleGoogleLogin = async () => {
  try {
    console.log('Starting Google login process...');
    
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    try {
      const sessions = await account.listSessions();
      for (const session of sessions.sessions) {
        try {
          await account.deleteSession(session.$id);
        } catch (deleteError) {
          console.log('Failed to delete session:', deleteError);
        }
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (sessionError) {
      console.log('No sessions to delete');
    }
    
    console.log('Creating OAuth session...');
    
    await createOAuth2Session(
      'google', 
      `${window.location.origin}/dashboard?auth=google&direct=true&t=${Date.now()}`, 
      `${window.location.origin}/login?auth=failed&t=${Date.now()}`
    );
  } catch (error) {
    console.error('Google login error:', error);
    setServerError(t('auth.googleLoginError'));
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
  
  const GoogleIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
        <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
        <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
        <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
        <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
      </g>
    </svg>
  );
  
  return (
    <div className={`auth-container ${isRTL ? 'rtl' : 'ltr'}`}>
      <div className="auth-logo-container">
        <img src="/images/logo.png" alt={t('general.appLogo')} className="logo" onClick={() => navigate('/')} />
      </div>
      <div className="auth-box">
        <h2>{t('auth.loginTitle')}</h2>
        {serverError && <div className="error-message">{serverError}</div>}
        
        <button 
          type="button"
          onClick={handleGoogleLogin}
          className="google-auth-button"
        >
          <GoogleIcon />
          <span>{t('auth.connectWithGoogle')}</span>
        </button>
        
        <div className="social-auth-divider">{t('auth.or')}</div>
        
        <form onSubmit={handleSubmit} noValidate>
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
          <button 
            type="submit" 
            className="auth-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? t('auth.connecting') : t('auth.loginButton')}
          </button>
        </form>
        
        <p className="auth-link">
          {t('auth.noAccount')} <span onClick={() => navigate('/register')}>{t('auth.signupButton')}</span>
        </p>
        <p className="auth-link">
          <span onClick={() => navigate('/forgot-password')}>{t('auth.forgotPassword')}</span>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;