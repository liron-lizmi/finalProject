import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/Auth/LoginPage';
import RegisterPage from './pages/Auth/RegisterPage';
import ForgotPassword from './pages/Auth/ForgotPassword';
import ResetPassword from './pages/Auth/ResetPassword';
import AuthFailed from './pages/Auth/AuthFailed'; 
import Dashboard from './pages/Auth/dashboard';
import VenuePage from './pages/Venues/VenuePage'; // Import the new VenuePage
import CreateEventPage from './pages/Venues/CreateEventPage'; // This will be created later

const App = () => {
  return (
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/auth-failed" element={<AuthFailed />} />
          <Route path="/venues" element={<VenuePage />} /> {/* Add this new route */}
          <Route path="/create-event" element={<CreateEventPage />} /> {/* Add this new route for after venue selection */}
        </Routes>
      </Router>
  );
};

export default App;