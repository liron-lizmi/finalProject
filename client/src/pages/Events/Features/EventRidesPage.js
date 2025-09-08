import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import '../../../styles/EventRidesPage.css';

const EventRidesPage = () => {
  const { t } = useTranslation();
  const { id: eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState({
    title: '',
    date: new Date()
  });
  const [guests, setGuests] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    offering: 0,
    seeking: 0,
    arrangedSeparately: 0,
    notSet: 0
  });

  useEffect(() => {
    fetchEventData();
    fetchRidesData();
  }, [eventId]);

  // Fetches event data from the API
  const fetchEventData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/events/${eventId}`, {
        headers: { 'x-auth-token': token }
      });
      setEvent(response.data);
    } catch (err) {
      setError(t('events.features.rides.errors.eventLoadFailed'));
    }
  };

  // Fetches rides data and calculates statistics
  const fetchRidesData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/events/${eventId}/guests`, {
        headers: { 'x-auth-token': token }
      });
      
      const guestsData = response.data;
      setGuests(guestsData);
      
      const offering = guestsData.filter(g => g.rideInfo?.status === 'offering').length;
      const seeking = guestsData.filter(g => g.rideInfo?.status === 'seeking').length;
      const arrangedSeparately = guestsData.filter(g => g.rideInfo?.status === 'arranged_separately').length;
      const notSet = guestsData.filter(g => !g.rideInfo?.status || g.rideInfo?.status === 'not_set').length;
      
      setStats({ offering, seeking, arrangedSeparately, notSet });
    } catch (err) {
      setError(t('events.features.rides.errors.fetchGuests'));
    }
  };

  // Updates guest ride information
  const updateGuestRideInfo = async (guestId, rideInfo) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/events/${eventId}/guests/${guestId}/ride-info`, rideInfo, {
        headers: { 'x-auth-token': token }
      });
      fetchRidesData();
    } catch (err) {
      setError(t('events.features.rides.errors.updateGuest'));
    }
  };

  // Copies ride link to clipboard
  const copyRideLink = () => {
    const rideLink = `${window.location.origin}/rides/${eventId}`;
    navigator.clipboard.writeText(rideLink).then(() => {
      alert(t('events.features.rides.linkCopied'));
    });
  };

  // Navigates back to event details page
  const handleBack = () => {
    navigate(`/event/${eventId}`);
  };

  // Gets status display text based on ride status and contact history
  const getStatusDisplay = (guest) => {
    const contactStatus = guest.rideInfo?.contactStatus;
    
    switch (contactStatus) {
      case 'taken':
        return t('events.features.rides.status.taken');
      case 'not_relevant':
        return t('events.features.rides.status.not_relevant');
      case 'in_process':
        return t('events.features.rides.status.in_process');
      default:
        return t(`events.features.rides.status.${guest.rideInfo?.status || 'not_set'}`);
    }
  };

  // הוסרת כל בלוק הטעינה - הדף מוצג מיד
  if (error) {
    return (
      <div className="rides-page-wrapper">
        <div className="rides-container">
          <div className="error-message">
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rides-page-wrapper">
      <div className="page-header">
        <div className="header-top">
          <div className="app-logo">
            <img src="/images/logo.png" alt={t('events.features.rides.appLogo')} />
          </div>
          <button className="back-button" onClick={handleBack}>
            <span className="back-icon">←</span>
            {t('events.features.rides.backToEventDetails')}
          </button>
        </div>
      </div>

      <div className="rides-container">
        <header className="rides-header">
          <h1 className="rides-title">{t('events.features.rides.title')}</h1>
          <p className="rides-description">{t('events.features.rides.description')}</p>
        </header>

        <div className="rides-stats">
          <div className="stat-item offering">
            <div className="stat-number">{stats.offering}</div>
            <div className="stat-label">{t('events.features.rides.stats.offering')}</div>
          </div>
          <div className="stat-item seeking">
            <div className="stat-number">{stats.seeking}</div>
            <div className="stat-label">{t('events.features.rides.stats.seeking')}</div>
          </div>
          <div className="stat-item share-section">
            <button className="share-link-button" onClick={copyRideLink}>
              <div className="share-icon">🔗</div>
              <div className="share-text">{t('events.features.rides.shareLink')}</div>
            </button>
          </div>
        </div>

        <div className="rides-note">
          <div className="note-content">
            <span className="note-icon">ℹ️</span>
            <span className="note-text">
              {t('events.features.rides.rsvpNote')}
            </span>
          </div>
        </div>
        <nav className="rides-tabs">
          <button
            className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            {t('events.features.rides.tabs.overview')}
          </button>
          <button
            className={`tab-button ${activeTab === 'offering' ? 'active' : ''}`}
            onClick={() => setActiveTab('offering')}
          >
            {t('events.features.rides.tabs.offering')}
          </button>
          <button
            className={`tab-button ${activeTab === 'seeking' ? 'active' : ''}`}
            onClick={() => setActiveTab('seeking')}
          >
            {t('events.features.rides.tabs.seeking')}
          </button>
        </nav>

        <div className="rides-content">
          {activeTab === 'overview' && (
            <div className="overview-tab">
              <div className="guests-list">
                {guests.map(guest => (
                  <div key={guest._id} className="guest-item">
                    <div className="guest-info">
                      <h3 className="guest-name">{guest.firstName} {guest.lastName}</h3>
                      <p className="guest-phone">{guest.phone}</p>
                    </div>
                    <div className={`ride-status status-${guest.rideInfo?.status || 'not_set'}`}>
                      {getStatusDisplay(guest)}
                    </div>
                    {guest.rideInfo?.address && (
                      <div className="ride-details">
                        <p className="ride-address">{guest.rideInfo.address}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'offering' && (
            <div className="offering-tab">
              <div className="section-header">
                <h2>{t('events.features.rides.offeringRides')}</h2>
              </div>
              <div className="guests-list">
                {guests.filter(g => g.rideInfo?.status === 'offering').map(guest => (
                  <div key={guest._id} className="guest-item offering">
                    <div className="guest-info">
                      <h3 className="guest-name">{guest.firstName} {guest.lastName}</h3>
                      <p className="guest-phone">{guest.phone}</p>
                    </div>
                    <div className="ride-details">
                      {guest.rideInfo.address && <p><strong>{t('events.features.rides.form.address')}:</strong> {guest.rideInfo.address}</p>}
                      {guest.rideInfo.availableSeats && <p><strong>{t('events.features.rides.form.availableSeats')}:</strong> {guest.rideInfo.availableSeats}</p>}
                      {guest.rideInfo.departureTime && <p><strong>{t('events.features.rides.form.departureTime')}:</strong> {guest.rideInfo.departureTime}</p>}
                    </div>
                    <div className="contact-status">
                      {getStatusDisplay(guest)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'seeking' && (
            <div className="seeking-tab">
              <div className="section-header">
                <h2>{t('events.features.rides.seekingRides')}</h2>
              </div>
              <div className="guests-list">
                {guests.filter(g => g.rideInfo?.status === 'seeking').map(guest => (
                  <div key={guest._id} className="guest-item seeking">
                    <div className="guest-info">
                      <h3 className="guest-name">{guest.firstName} {guest.lastName}</h3>
                      <p className="guest-phone">{guest.phone}</p>
                    </div>
                    <div className="ride-details">
                      {guest.rideInfo.address && <p><strong>{t('events.features.rides.form.address')}:</strong> {guest.rideInfo.address}</p>}
                      {guest.rideInfo.requiredSeats && <p><strong>{t('events.features.rides.form.requiredSeats')}:</strong> {guest.rideInfo.requiredSeats}</p>}
                      {guest.rideInfo.departureTime && <p><strong>{t('events.features.rides.form.departureTime')}:</strong> {guest.rideInfo.departureTime}</p>}
                    </div>
                    <div className="contact-status">
                      {getStatusDisplay(guest)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventRidesPage;