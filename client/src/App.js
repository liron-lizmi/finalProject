/**
 * App.js - Main React Application Component
 *
 * Root component that defines all application routes using React Router.
 * Includes OAuth redirect handling for Google authentication flow.
 *
 * Route Structure:
 * Public Routes:
 * - /: HomePage (landing page)
 * - /login, /register: Authentication pages
 * - /forgot-password, /reset-password/:token: Password recovery
 * - /auth-failed: OAuth failure page
 * - /venues: Public venue search
 * - /rsvp/:eventId: Public RSVP page for guests
 * - /rides/:eventId: Public ride coordination page
 *
 * Protected Routes (require authentication):
 * - /dashboard: User's event dashboard
 * - /create-event: New event creation
 * - /event/:id: Event details page
 * - /event/:id/venue: Event venue management
 * - /event/:id/vendors: Event vendors
 * - /event/:id/guests: Guest management
 * - /event/:id/seating: Seating arrangement
 * - /event/:id/timeline: Task management
 * - /event/:id/rides: Ride coordination
 * - /event/:id/budget: Budget management
 * - /event/:id/share: Event sharing
 *
 * OAuth Callbacks:
 * - /auth/google/callback: Google Calendar OAuth
 * - /auth/google/contacts/callback: Google Contacts OAuth
 *
 * Components:
 * - OAuthRedirectHandler: Fixes redirect issues during OAuth flow
 */

import React, { Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/Auth/LoginPage';
import RegisterPage from './pages/Auth/RegisterPage';
import ForgotPassword from './pages/Auth/ForgotPassword';
import ResetPassword from './pages/Auth/ResetPassword';
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
import TaskManager from './pages/Events/Task/TaskManager';
import GoogleAuthCallback from './pages/Events/Task/components/GoogleAuthCallback';
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