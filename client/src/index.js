/**
 * index.js - React Application Entry Point
 *
 * Bootstraps the React application and configures global settings.
 *
 * Configuration:
 * - Sets axios base URL from REACT_APP_API_URL (default: localhost:5000)
 * - Configures axios request interceptor for:
 *   - JWT token injection from localStorage (Authorization header)
 *   - Language header injection (Accept-Language)
 * - Initializes i18n (imported for side effects)
 * - Renders App with React StrictMode and Suspense
 *
 * Global Axios Interceptor:
 * - Automatically attaches 'Bearer {token}' to all requests if token exists
 * - Attaches current language preference to all requests
 */

import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import reportWebVitals from './reportWebVitals';
import axios from 'axios';
import './i18n'; 

axios.defaults.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

axios.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const currentLang = localStorage.getItem('language') || 'he';
    config.headers['Accept-Language'] = currentLang;

    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Suspense fallback={null}>
      <App />
    </Suspense>
  </React.StrictMode>
);

reportWebVitals();