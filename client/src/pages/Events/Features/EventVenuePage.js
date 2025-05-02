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
  
  // זיהוי כיוון השפה
  const isRTL = i18n.language === 'he' || i18n.language === 'he-IL';

  useEffect(() => {
    // קביעת כיוון המסמך לפי השפה
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

      const venueData = {
        name: venue.name,
        address: venue.address || venue.formatted_address || venue.vicinity,
        phone: venue.phone || venue.formatted_phone_number || '',
        website: venue.website || ''
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

      // העתקת הנתונים המעודכנים אחרי השמירה
      const response = await axios.get(`/api/events/${id}`, {
        headers: {
          'x-auth-token': token
        }
      });

      setEvent(response.data);
      setVenueUpdateSuccess(true);
      setShowVenuePage(false);

      // הסתרת הודעת ההצלחה אחרי 3 שניות
      setTimeout(() => {
        setVenueUpdateSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Error updating venue:', err);
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
    // העברת פונקציית הקולבק ומזהה האירוע לדף בחירת המקום
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
      
      {event.venue && event.venue.name ? (
        <div className="selected-venue">
          <h3>{t('venues.selectedVenue')}</h3>
          <div className="venue-details-card">
            <h4>{event.venue.name}</h4>
            {event.venue.address && (
              <p><strong>{t('venues.details.address')}:</strong> {event.venue.address}</p>
            )}
            {event.venue.phone && (
              <p><strong>{t('venues.details.phone')}:</strong> {event.venue.phone}</p>
            )}
            {event.venue.website && (
              <p>
                <strong>{t('venues.details.website')}:</strong>{' '}
                <a href={event.venue.website} target="_blank" rel="noopener noreferrer">
                  {event.venue.website}
                </a>
              </p>
            )}
          </div>
          <button className="change-venue-button" onClick={() => setShowVenuePage(true)}>
            {t('venues.changeVenue')}
          </button>
        </div>
      ) : (
        <div className="no-venue-selected">
          <p>{t('venues.noVenueSelected')}</p>
          <button className="select-venue-button" onClick={() => setShowVenuePage(true)}>
            {t('venues.searchAndFilterButton')}
          </button>
        </div>
      )}
    </FeaturePageTemplate>
  );
};

export default EventVenuePage;