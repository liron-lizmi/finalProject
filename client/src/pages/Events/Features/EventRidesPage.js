import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useModal } from '../../../hooks/useModal';
import axios from 'axios';
import FeaturePageTemplate from './FeaturePageTemplate';
import '../../../styles/EventRidesPage.css';

const EventRidesPage = ({ permissionLoading = false }) => {
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

  const [canEdit, setCanEdit] = useState(true);
  const [userPermission, setUserPermission] = useState('edit');
  const { showSuccessModal, Modal } = useModal();

  useEffect(() => {
    fetchEventData();
    fetchRidesData();
  }, [eventId]);

  const fetchEventData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/events/${eventId}`, {
        headers: { 'x-auth-token': token }
      });
      setEvent(response.data);
      
      // בדיקת הרשאות
      if (response.data.userPermission) {
        setCanEdit(response.data.canEdit || false);
        setUserPermission(response.data.userPermission);
      }
    } catch (err) {
      setError(t('events.features.rides.errors.eventLoadFailed'));
    }
};

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

  const updateGuestRideInfo = async (guestId, rideInfo) => {
  if (!canEdit) {
    setError(t('events.accessDenied'));
    return;
  }
  
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

  const copyRideLink = () => {
    const actualEventId = event.originalEvent || eventId;
    const rideLink = `${window.location.origin}/rides/${actualEventId}`;
    navigator.clipboard.writeText(rideLink).then(() => {
      showSuccessModal(t('events.features.rides.linkCopied'));
    });
  };

  const getStatusDisplay = (guest) => {
    const contactStatus = guest.rideInfo?.contactStatus;
    
    let text, icon, className;
    
    if (contactStatus === 'taken') {
      text = t('events.features.rides.status.taken');
      icon = '🚗';
      className = 'taken';
    } else if (contactStatus === 'not_relevant') {
      text = t('events.features.rides.status.not_relevant');
      icon = '✗';
      className = 'not-relevant';
    } else if (contactStatus === 'in_process') {
      text = t('events.features.rides.status.in_process');
      icon = '🔄';
      className = 'in-process';
    } else {
      const status = guest.rideInfo?.status || 'not_set';
      text = t(`events.features.rides.status.${status}`);
      icon = status === 'offering' ? '🚗' : status === 'seeking' ? '🔍' : '❓';
      className = status;
    }
    
    return (
      <span className={`status-indicator ${className}`}>
        <span className="status-icon">{icon}</span>
        <span className="status-text">{text}</span>
      </span>
    );
  };

  if (error && !permissionLoading) {
    return (
      <FeaturePageTemplate
        title={t('events.features.rides.title')}
        icon="🚎"
        description={t('events.features.rides.description')}
      >
        <div className="error-message">
          {error}
        </div>
      </FeaturePageTemplate>
    );
  }

  return (
    <FeaturePageTemplate
      title={t('events.features.rides.title')}
      icon="🚎"
      description={t('events.features.rides.description')}
    >
      <div className="rides-container">
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
            <button 
              className={`share-link-button ${!canEdit ? 'disabled' : ''}`}
              onClick={canEdit ? copyRideLink : undefined}
              disabled={!canEdit}
              title={!canEdit ? t('general.viewOnlyMode') : undefined}
            >
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
                    {guest.rideInfo?.address && (
                      <div className="ride-details">
                        <p className="ride-address">{guest.rideInfo.address}</p>
                      </div>
                    )}
                    <div className="contact-status-display">
                      {getStatusDisplay(guest)}
                    </div>
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
                      {guest.rideInfo.notes && <p><strong>{t('events.features.rides.form.notes')}:</strong> {guest.rideInfo.notes}</p>}
                    </div>
                    <div className="contact-status-display">
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
                      {guest.rideInfo.notes && <p><strong>{t('events.features.rides.form.notes')}:</strong> {guest.rideInfo.notes}</p>}
                    </div>
                    <div className="contact-status-display">
                      {getStatusDisplay(guest)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {Modal}
    </FeaturePageTemplate>
  );
};

export default EventRidesPage;
