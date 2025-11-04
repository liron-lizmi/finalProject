// client/src/pages/Events/Features/EventRidesPage.js
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
  const [event, setEvent] = useState({ title: '', date: new Date() });
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
  const {Modal } = useModal();

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

  const copyRideLink = () => {
    const actualEventId = event.originalEvent || eventId;
    const rideLink = `${window.location.origin}/rides/${actualEventId}`;
    navigator.clipboard.writeText(rideLink);
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
      icon = status === 'offering' ? '🚗' : status === 'seeking' ? '🔍' : '➖';
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
        <div className="rides-custom-content">
          <div className="error-box">{error}</div>
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
      <div className="rides-custom-content">
        <div className="stats-row">
          <div className="stat-box offering">
            <div className="stat-num">{stats.offering}</div>
            <div className="stat-lbl">{t('events.features.rides.stats.offering')}</div>
          </div>
          <div className="stat-box seeking">
            <div className="stat-num">{stats.seeking}</div>
            <div className="stat-lbl">{t('events.features.rides.stats.seeking')}</div>
          </div>
          <div className="stat-box share">
            <button 
              className={`share-btn ${!canEdit ? 'disabled' : ''}`}
              onClick={canEdit ? copyRideLink : undefined}
              disabled={!canEdit}
            >
              <div className="share-emoji">🔗</div>
              <div className="share-txt">{t('events.features.rides.shareLinkDescription')}</div>
            </button>
          </div>
        </div>

        <nav className="tabs-nav">
          <button
            className={`tab-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            {t('events.features.rides.tabs.overview')}
          </button>
          <button
            className={`tab-item ${activeTab === 'offering' ? 'active' : ''}`}
            onClick={() => setActiveTab('offering')}
          >
            {t('events.features.rides.tabs.offering')}
          </button>
          <button
            className={`tab-item ${activeTab === 'seeking' ? 'active' : ''}`}
            onClick={() => setActiveTab('seeking')}
          >
            {t('events.features.rides.tabs.seeking')}
          </button>
        </nav>

        <div className="tab-content-area">
          {activeTab === 'overview' && (
            <div className="guest-list">
              {guests.map(guest => (
                <div key={guest._id} className="guest-card">
                  <div className="guest-col-1">
                    <h3 className="guest-full-name">{guest.firstName} {guest.lastName}</h3>
                    <p className="guest-tel">{guest.phone}</p>
                  </div>
                  <div className="guest-col-2">
                    {guest.rideInfo?.address && (
                      <p className="guest-addr">{guest.rideInfo.address}</p>
                    )}
                  </div>
                  <div className="guest-col-3">
                    {getStatusDisplay(guest)}
                  </div>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'offering' && (
            <div className="guest-list">
              {guests.filter(g => g.rideInfo?.status === 'offering').map(guest => (
                <div key={guest._id} className="guest-card offering">
                  <div className="guest-col-1">
                    <h3 className="guest-full-name">{guest.firstName} {guest.lastName}</h3>
                    <p className="guest-tel">{guest.phone}</p>
                  </div>
                  <div className="guest-col-2">
                    {guest.rideInfo.address && <p><strong>{t('events.features.rides.form.address')}:</strong> {guest.rideInfo.address}</p>}
                    {guest.rideInfo.availableSeats && <p><strong>{t('events.features.rides.form.availableSeats')}:</strong> {guest.rideInfo.availableSeats}</p>}
                    {guest.rideInfo.departureTime && <p><strong>{t('events.features.rides.form.departureTime')}:</strong> {guest.rideInfo.departureTime}</p>}
                    {guest.rideInfo.notes && <p><strong>{t('events.features.rides.form.notes')}:</strong> {guest.rideInfo.notes}</p>}
                  </div>
                  <div className="guest-col-3">
                    {getStatusDisplay(guest)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'seeking' && (
            <div className="guest-list">
              {guests.filter(g => g.rideInfo?.status === 'seeking').map(guest => (
                <div key={guest._id} className="guest-card seeking">
                  <div className="guest-col-1">
                    <h3 className="guest-full-name">{guest.firstName} {guest.lastName}</h3>
                    <p className="guest-tel">{guest.phone}</p>
                  </div>
                  <div className="guest-col-2">
                    {guest.rideInfo.address && <p><strong>{t('events.features.rides.form.address')}:</strong> {guest.rideInfo.address}</p>}
                    {guest.rideInfo.requiredSeats && <p><strong>{t('events.features.rides.form.requiredSeats')}:</strong> {guest.rideInfo.requiredSeats}</p>}
                    {guest.rideInfo.departureTime && <p><strong>{t('events.features.rides.form.departureTime')}:</strong> {guest.rideInfo.departureTime}</p>}
                    {guest.rideInfo.notes && <p><strong>{t('events.features.rides.form.notes')}:</strong> {guest.rideInfo.notes}</p>}
                  </div>
                  <div className="guest-col-3">
                    {getStatusDisplay(guest)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {Modal}
    </FeaturePageTemplate>
  );
};

export default EventRidesPage;