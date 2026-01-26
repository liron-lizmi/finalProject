import React, { Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/Auth/LoginPage';
import RegisterPage from './pages/Auth/RegisterPage';
import ForgotPassword from './pages/Auth/ForgotPassword';
import ResetPassword from './pages/Auth/ResetPassword';
import AuthFailed from './pages/Auth/AuthFailed';
import Dashboard from './pages/Auth/dashboard';
import VenuePage from './pages/Events/Venue/VenuePage';
import CreateEventPage from './pages/Events/CreateEventPage';
import EventDetailsPage from './pages/Events/EventDetailsPage';
import EventVenuePage from './pages/Events/Venue/EventVenuePage';
import EventVendorsPage from './pages/Events/Vendors/EventVendorsPage';
import EventGuestsPage from './pages/Events/Guests/EventGuestsPage';
import EventSeatingPage from './pages/Events/Seating/EventSeatingPage';
import EventRidesPage from './pages/Events/Rides/EventRidesPage';
import EventBudgetPage from './pages/Events/Budget/EventBudgetPage';
import EventSharePage from './pages/Events/Share/EventSharePage';
import TaskManager from './pages/Events/shared/components/TaskManager';
import GoogleAuthCallback from './pages/Events/shared/components/GoogleAuthCallback';
import GoogleContactsCallback from './pages/Events/Guests/components/GoogleContactsCallback';
import RSVPPage from './pages/Events/Guests/RSVPPage';
import PublicRidesPage from './pages/Events/Rides/PublicRidesPage';

// Component to handle OAuth redirect fix
const OAuthRedirectHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const oauthFlow = localStorage.getItem('oauth_flow');
    const params = new URLSearchParams(location.search);
    const isGoogleAuth = params.get('auth') === 'google';
    const isDirect = params.get('direct') === 'true';

    // If we landed on /index.html during OAuth flow, redirect to /dashboard
    if ((location.pathname === '/index.html' || location.pathname === '/') &&
        (oauthFlow === 'google' || (isGoogleAuth && isDirect))) {
      navigate('/dashboard', { replace: true });
    }
  }, [location, navigate]);

  return null;
};

const App = () => {
  return (
    <Router>
      <OAuthRedirectHandler />
      <Suspense fallback={null}>
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

        <Route path="/event/:id" element={<EventDetailsPage />} />

        <Route path="/event/:id/venue" element={<EventVenuePage />} />
        <Route path="/event/:id/vendors" element={<EventVendorsPage />} />
        <Route path="/event/:id/guests" element={<EventGuestsPage />} />
        <Route path="/event/:id/seating" element={<EventSeatingPage />} />
        <Route path="/event/:id/timeline" element={<TaskManager />} />
        <Route path="/event/:id/rides" element={<EventRidesPage />} />
        <Route path="/event/:id/budget" element={<EventBudgetPage />} />
        <Route path="/event/:id/share" element={<EventSharePage />} />

        <Route path="/auth/google/callback" element={<GoogleAuthCallback />} />
        <Route path="/auth/google/contacts/callback" element={<GoogleContactsCallback />} />

        <Route path="/rsvp/:eventId" element={<RSVPPage />} />

        <Route path="/rides/:eventId" element={<PublicRidesPage />} />
        
      </Routes>
    </Suspense>
  </Router>
  );
};

export default App;