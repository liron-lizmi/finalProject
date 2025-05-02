import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import HomePage from './pages/HomePage';
import LoginPage from './pages/Auth/LoginPage';
import RegisterPage from './pages/Auth/RegisterPage';
import ForgotPassword from './pages/Auth/ForgotPassword';
import ResetPassword from './pages/Auth/ResetPassword';
import AuthFailed from './pages/Auth/AuthFailed'; 
import Dashboard from './pages/Auth/dashboard';
import VenuePage from './pages/Events/VenuePage';
import CreateEventPage from './pages/Events/CreateEventPage';
import EventDetailsPage from './pages/Events/EventDetailsPage';
import EventVenuePage from './pages/Events/Features/EventVenuePage';
import EventVendorsPage from './pages/Events/Features/EventVendorsPage';
import EventGuestsPage from './pages/Events/Features/EventGuestsPage';
import EventSeatingPage from './pages/Events/Features/EventSeatingPage';
import EventTimelinePage from './pages/Events/Features/EventTimelinePage';
import EventTemplatesPage from './pages/Events/Features/EventTemplatesPage';
import EventWeatherPage from './pages/Events/Features/EventWeatherPage';
import EventBudgetPage from './pages/Events/Features/EventBudgetPage';
import EventSharePage from './pages/Events/Features/EventSharePage';
// Remove the LanguageSwitcher import

const App = () => {
  const { t, i18n, ready } = useTranslation();
  
  useEffect(() => {
    console.log('Translation ready:', ready);
    console.log('Current language:', i18n.language);
    console.log('Available languages:', i18n.languages);
    console.log('Translation for test key:', t('home.features.vendors.title'));
  }, [ready, i18n.language, t]);

  return (
    <>
      {/* Remove the LanguageSwitcher component here */}
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/auth-failed" element={<AuthFailed />} />
          <Route path="/venues" element={<VenuePage />} />
          <Route path="/create-event" element={<CreateEventPage />} />
          
          {/* Event routes */}
          <Route path="/event/:id" element={<EventDetailsPage />} />
          
          {/* Feature routes */}
          <Route path="/event/:id/venue" element={<EventVenuePage />} />
          <Route path="/event/:id/vendors" element={<EventVendorsPage />} />
          <Route path="/event/:id/guests" element={<EventGuestsPage />} />
          <Route path="/event/:id/seating" element={<EventSeatingPage />} />
          <Route path="/event/:id/timeline" element={<EventTimelinePage />} />
          <Route path="/event/:id/templates" element={<EventTemplatesPage />} />
          <Route path="/event/:id/weather" element={<EventWeatherPage />} />
          <Route path="/event/:id/budget" element={<EventBudgetPage />} />
          <Route path="/event/:id/share" element={<EventSharePage />} />
        </Routes>
      </Router>
    </>
  );
};

export default App;