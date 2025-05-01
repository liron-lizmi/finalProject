import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import reportWebVitals from './reportWebVitals';
import axios from 'axios';
import './i18n'; // ייבוא קובץ האתחול של i18n

// רכיב טעינה להצגה בזמן טעינת קבצי השפה
const Loading = () => (
  <div className="loading-container" style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh' 
  }}>
    <div className="loading-spinner"></div>
  </div>
);

// Set base URL from environment variable
axios.defaults.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Interceptor to add token to every request
axios.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Suspense fallback={<Loading />}>
      <App />
    </Suspense>
  </React.StrictMode>
);

reportWebVitals();