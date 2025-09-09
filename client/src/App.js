import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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
import EventRidesPage from './pages/Events/Features/EventRidesPage';
import EventBudgetPage from './pages/Events/Features/EventBudgetPage';
import EventSharePage from './pages/Events/Features/EventSharePage';
import TaskManager from './pages/Events/Features/components/TaskManager';
import GoogleAuthCallback from './pages/Events/Features/components/GoogleAuthCallback';
import GoogleContactsCallback from './pages/components/GoogleContactsCallback';
import RSVPPage from './pages/Events/Features/RSVPPage';
import PublicRidesPage from './pages/Events/Features/PublicRidesPage';


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
    </Router>
  );
};

export default App;