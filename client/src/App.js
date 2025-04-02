import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/Auth/LoginPage';
import RegisterPage from './pages/Auth/RegisterPage';
import ForgotPassword from './pages/Auth/ForgotPassword';
import ResetPassword from './pages/Auth/ResetPassword';
import AuthFailed from './pages/Auth/AuthFailed'; 
import Dashboard from './pages/Auth/dashboard';
import VenueSearch from './pages/VenueSearch/VenueSearch'; 
import { GoogleMapsProvider } from './pages/VenueSearch/GoogleMapsProvider';

const App = () => {
  return (
    <GoogleMapsProvider>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/auth-failed" element={<AuthFailed />} />
          <Route path="/venues" element={<VenueSearch />} /> {/* נתיב חדש לדף חיפוש מקומות */}
        </Routes>
      </Router>
    </GoogleMapsProvider>
  );
};

export default App;