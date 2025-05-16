// pages/Events/Features/EventVenuePage.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import FeaturePageTemplate from './FeaturePageTemplate';
import VenuePage from '../VenuePage';

const EventVenuePage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showVenuePage, setShowVenuePage] = useState(false);
  const [venueUpdateSuccess, setVenueUpdateSuccess] = useState(false);
  const [venueDeleteSuccess, setVenueDeleteSuccess] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualVenue, setManualVenue] = useState({
    name: '',
    address: '',
    phone: ''
  });
  
  const isRTL = i18n.language === 'he' || i18n.language === 'he-IL';

  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.body.dir = isRTL ? 'rtl' : 'ltr';
    
    const fetchEventDetails = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError(t('errors.notLoggedIn'));
          navigate('/login');
          return;
        }

        const response = await axios.get(`/api/events/${id}`, {
          headers: {
            'x-auth-token': token
          }
        });

        setEvent(response.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching event details:', err);
        setError(t('errors.eventLoadFailed'));
        setLoading(false);
      }
    };

    fetchEventDetails();
  }, [id, navigate, t, i18n.language, isRTL]);

  const handleVenueSelect = async (venue) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError(t('errors.notLoggedIn'));
        navigate('/login');
        return;
      }

      setVenueDeleteSuccess(false);

      const venueData = {
        name: venue.name,
        address: venue.address || venue.formatted_address || venue.vicinity,
        phone: venue.phone || venue.formatted_phone_number || '',
        website: venue.website || venue.url || venue.formatted_website || ''
      };

      await axios.put(`/api/events/${id}`, 
        { venue: venueData },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': token
          }
        }
      );

      const response = await axios.get(`/api/events/${id}`, {
        headers: {
          'x-auth-token': token
        }
      });

      setEvent(response.data);
      setVenueUpdateSuccess(true);
      setShowVenuePage(false);

      setTimeout(() => {
        setVenueUpdateSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Error updating venue:', err);
      setError(t('errors.generalError'));
    }
  };

  const handleManualVenueChange = (e) => {
    const { name, value } = e.target;
    setManualVenue(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleManualVenueSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError(t('errors.notLoggedIn'));
        navigate('/login');
        return;
      }

      setVenueDeleteSuccess(false);

      await axios.put(`/api/events/${id}`, 
        { venue: manualVenue },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': token
          }
        }
      );

      const response = await axios.get(`/api/events/${id}`, {
        headers: {
          'x-auth-token': token
        }
      });

      setEvent(response.data);
      setVenueUpdateSuccess(true);
      setShowManualForm(false);
      setManualVenue({
        name: '',
        address: '',
        phone: ''
      });

      setTimeout(() => {
        setVenueUpdateSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Error updating venue:', err);
      setError(t('errors.generalError'));
    }
  };

  const handleDeleteVenue = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError(t('errors.notLoggedIn'));
        navigate('/login');
        return;
      }

      setVenueUpdateSuccess(false);

      await axios.put(`/api/events/${id}`, 
        { venue: null },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': token
          }
        }
      );

      const response = await axios.get(`/api/events/${id}`, {
        headers: {
          'x-auth-token': token
        }
      });

      setEvent(response.data);
      setVenueDeleteSuccess(true);

      setTimeout(() => {
        setVenueDeleteSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Error deleting venue:', err);
      setError(t('errors.generalError'));
    }
  };

  if (loading) {
    return (
      <div className="feature-page-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="feature-page-container">
        <div className="error-message">{error}</div>
        <button className="back-button" onClick={() => navigate(`/event/${id}`)}>
          {t('general.back')}
        </button>
      </div>
    );
  }

  if (showVenuePage) {
    return <VenuePage onSelectVenue={handleVenueSelect} />;
  }

  return (
    <FeaturePageTemplate
      title={t('events.features.venue.title')}
      icon="🏢"
      description={t('events.features.venue.description')}
    >
      {venueUpdateSuccess && (
        <div className="success-message">
          {t('venues.venueAddedSuccess')}
        </div>
      )}
      
      {venueDeleteSuccess && (
        <div className="success-message">
          {t('venues.venueDeletedSuccess')}
        </div>
      )}
      
      {showManualForm ? (
        <div className={`manual-venue-form ${isRTL ? 'rtl' : 'ltr'}`}>
          <form onSubmit={handleManualVenueSubmit}>
            <div className="form-group">
              <label htmlFor="name">{t('venues.venueDetails.name')}*</label>
              <input
                type="text"
                id="name"
                name="name"
                value={manualVenue.name}
                onChange={handleManualVenueChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="address">{t('venues.venueDetails.address')}</label>
              <input
                type="text"
                id="address"
                name="address"
                value={manualVenue.address}
                onChange={handleManualVenueChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="phone">{t('venues.venueDetails.phone')}</label>
              <input
                type="text"
                id="phone"
                name="phone"
                value={manualVenue.phone}
                onChange={handleManualVenueChange}
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="save-venue-button">
                {t('general.save')}
              </button>
              <button 
                type="button" 
                className="cancel-button" 
                onClick={() => setShowManualForm(false)}
              >
                {t('general.cancel')}
              </button>
            </div>
          </form>
        </div>
      ) : event.venue && event.venue.name ? (
        <div className="selected-venue">
          <h3>{t('venues.selectedVenue')}</h3>
          <div className="venue-details-card">
            <h4>{event.venue.name}</h4>
            {event.venue.address && (
              <p><strong>{t('venues.venueDetails.address')}:</strong> {event.venue.address}</p>
            )}
            {event.venue.phone && (
              <p><strong>{t('venues.venueDetails.phone')}:</strong> {event.venue.phone}</p>
            )}
            {event.venue.website && (
              <p>
                <strong>{t('venues.venueDetails.website')}:</strong>{' '}
                <a 
                  href={event.venue.website.startsWith('http') ? event.venue.website : `https://${event.venue.website}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  {event.venue.website}
                </a>
              </p>
            )}
          </div>
          <div className="venue-actions">
            {isRTL ? (
              <>
                <button className="change-venue-button" onClick={() => setShowVenuePage(true)}>
                  {t('venues.changeVenue')}
                </button>
                <button className="delete-venue-button" onClick={handleDeleteVenue}>
                  {t('venues.deleteVenue')}
                </button>
              </>
            ) : (
              <>
                <button className="delete-venue-button" onClick={handleDeleteVenue}>
                  {t('venues.deleteVenue')}
                </button>
                <button className="change-venue-button" onClick={() => setShowVenuePage(true)}>
                  {t('venues.changeVenue')}
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="no-venue-selected">
          <p>{t('venues.noVenueSelected')}</p>
          <div className="venue-selection-options">
            <button className="select-venue-button" onClick={() => setShowVenuePage(true)}>
              {t('venues.searchAndFilterButton')}
            </button>
            <button className="add-manual-venue-button" onClick={() => setShowManualForm(true)}>
              {t('venues.addManuallyButton')}
            </button>
          </div>
        </div>
      )}
    </FeaturePageTemplate>
  );
};

export default EventVenuePage;