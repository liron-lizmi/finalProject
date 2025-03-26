import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../../styles/AuthPages.css';

const RegisterPage = () => {
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

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'שם פרטי הוא שדה חובה';
    } else if (formData.firstName.length < 2) {
      newErrors.firstName = 'שם פרטי חייב להכיל לפחות 2 תווים';
    } else if (formData.firstName.length > 50) {
      newErrors.firstName = 'שם פרטי לא יכול להכיל יותר מ-50 תווים';
    }
    
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'שם משפחה הוא שדה חובה';
    } else if (formData.lastName.length < 2) {
      newErrors.lastName = 'שם משפחה חייב להכיל לפחות 2 תווים';
    } else if (formData.lastName.length > 50) {
      newErrors.lastName = 'שם משפחה לא יכול להכיל יותר מ-50 תווים';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'אימייל הוא שדה חובה';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        newErrors.email = 'נא להזין כתובת אימייל תקינה';
      }
    }
    
    if (!formData.password) {
      newErrors.password = 'סיסמה היא שדה חובה';
    } else if (formData.password.length < 6) {
      newErrors.password = 'הסיסמה צריכה להכיל לפחות 6 תווים';
    } else if (formData.password.length > 30) {
      newErrors.password = 'הסיסמה לא יכולה להכיל יותר מ-30 תווים';
    } else {
      const hasUpperCase = /[A-Z]/.test(formData.password);
      const hasLowerCase = /[a-z]/.test(formData.password);
      const hasNumbers = /\d/.test(formData.password);
      
      if (!(hasUpperCase && hasLowerCase && hasNumbers)) {
        newErrors.password = 'הסיסמה חייבת להכיל אות גדולה, אות קטנה ומספר';
      }
    }
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'הסיסמאות אינן תואמות';
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
      const response = await axios.post('/api/auth/register', {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password
      });

      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Registration error:', err);
      setServerError(err.response?.data?.message || 'אירעה שגיאה בתהליך ההרשמה');
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
    <div className="auth-container">
      <div className="auth-box">
        <h2>הרשמה</h2>
        {serverError && <div className="error-message">{serverError}</div>}
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <input
              type="text"
              name="firstName"
              placeholder="שם פרטי"
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
              placeholder="שם משפחה"
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
              placeholder="אימייל"
              value={formData.email}
              onChange={handleChange}
              className={errors.email ? 'error' : ''}
            />
            {errors.email && <div className="input-error">{errors.email}</div>}
          </div>
          <div className="form-group password-field">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="סיסמה"
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
          <div className="form-group password-field">
            <input
              type={showConfirmPassword ? "text" : "password"}
              name="confirmPassword"
              placeholder="אימות סיסמה"
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
            {isSubmitting ? 'מבצע רישום...' : 'הירשם'}
          </button>
        </form>
        <p className="auth-link">
          כבר יש לך חשבון? <span onClick={() => navigate('/login')}>התחבר</span>
        </p>
        
        {formData.password && (
          <div className="password-strength">
            <h4>דרישות הסיסמה:</h4>
            <ul>
              <li className={/[A-Z]/.test(formData.password) ? 'valid' : 'invalid'}>
                אות גדולה אחת לפחות
              </li>
              <li className={/[a-z]/.test(formData.password) ? 'valid' : 'invalid'}>
                אות קטנה אחת לפחות
              </li>
              <li className={/\d/.test(formData.password) ? 'valid' : 'invalid'}>
                מספר אחד לפחות
              </li>
              <li className={formData.password.length >= 6 ? 'valid' : 'invalid'}>
                אורך מינימלי של 6 תווים
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default RegisterPage;