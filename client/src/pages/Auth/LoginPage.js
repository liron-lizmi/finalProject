import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../../styles/AuthPages.css';

const LoginPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      newErrors.email = 'אימייל הוא שדה חובה';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        newErrors.email = 'נא להזין כתובת אימייל תקינה';
      }
    }
    
    if (!formData.password) {
      newErrors.password = 'סיסמה היא שדה חובה';
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
      setServerError(err.response?.data?.message || 'שם משתמש או סיסמה שגויים');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>התחברות</h2>
        {serverError && <div className="error-message">{serverError}</div>}
        <form onSubmit={handleSubmit} noValidate>
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
          <div className="form-group">
            <input
              type="password"
              name="password"
              placeholder="סיסמה"
              value={formData.password}
              onChange={handleChange}
              className={errors.password ? 'error' : ''}
            />
            {errors.password && <div className="input-error">{errors.password}</div>}
          </div>
          <button 
            type="submit" 
            className="auth-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'מתחבר...' : 'התחבר'}
          </button>
        </form>
        <p className="auth-link">
          אין לך חשבון? <span onClick={() => navigate('/register')}>הירשם</span>
        </p>
        <p className="auth-link">
          <span onClick={() => navigate('/forgot-password')}>שכחת סיסמה?</span>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;