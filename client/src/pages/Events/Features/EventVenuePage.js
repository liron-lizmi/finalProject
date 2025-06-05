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
    phone: '',
    website: ''
  });
  const [showVenueSelectionModal, setShowVenueSelectionModal] = useState(false);
  const [venueActionType, setVenueActionType] = useState(null);
  const [venueErrors, setVenueErrors] = useState({});
  const isRTL = i18n.language === 'he' || i18n.language === 'he-IL';

  const validateVenueField = (name, value) => {
    const errors = {};
    
    if (name === 'name' && (!value || value.trim() === '')) {
      errors.name = t('errors.venueNameRequired');
    }
    
    if (name === 'address' && (!value || value.trim() === '')) {
      errors.address = t('errors.venueAddressRequired');
    }
    
    if (name === 'phone' && value && value.trim() !== '') {
      if (!/^[0-9+\-\s()]*$/.test(value)) {
        errors.phone = t('errors.invalidPhoneFormat');
      }
    }
    
    return errors;
  };

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

      let updatedEvent = { ...event };
      
      updatedEvent.venues = [venueData];

      await axios.put(`/api/events/${id}`, updatedEvent, {
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        }
      });

      const response = await axios.get(`/api/events/${id}`, {
        headers: {
          'x-auth-token': token
        }
      });

      setEvent(response.data);
      setVenueUpdateSuccess(true);
      setShowVenuePage(false);
      setVenueActionType(null);

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
    
    const fieldErrors = validateVenueField(name, value);
    setVenueErrors(prev => ({
      ...prev,
      [name]: fieldErrors[name] || null
    }));
  };

  const handleManualVenueSubmit = async (e) => {
    e.preventDefault();
    
    const allErrors = {};
    
    if (!manualVenue.name || manualVenue.name.trim() === '') {
      allErrors.name = t('errors.venueNameRequired');
    }
    
    if (!manualVenue.address || manualVenue.address.trim() === '') {
      allErrors.address = t('errors.venueAddressRequired');
    }
    
    if (manualVenue.phone && manualVenue.phone.trim() !== '') {
      if (!/^[0-9+\-\s()]*$/.test(manualVenue.phone)) {
        allErrors.phone = t('errors.invalidPhoneFormat');
      }
    }
    
    if (Object.keys(allErrors).length > 0) {
      setVenueErrors(allErrors);
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError(t('errors.notLoggedIn'));
        navigate('/login');
        return;
      }

      setVenueDeleteSuccess(false);
      
      const venueToSubmit = {
        name: manualVenue.name.trim(),
        address: manualVenue.address.trim(),
        phone: manualVenue.phone.trim(),
        website: manualVenue.website.trim()
      };
      
      let updatedEvent = { ...event };
      
      updatedEvent.venues = [venueToSubmit];

      await axios.put(`/api/events/${id}`, updatedEvent, {
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        }
      });

      const response = await axios.get(`/api/events/${id}`, {
        headers: {
          'x-auth-token': token
        }
      });

      setEvent(response.data);
      setVenueUpdateSuccess(true);
      setShowManualForm(false);
      setVenueActionType(null);
      setVenueErrors({});
      setManualVenue({
        name: '',
        address: '',
        phone: '',
        website: ''
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

      let updatedEvent = { ...event };
      updatedEvent.venues = [];

      await axios.put(`/api/events/${id}`, updatedEvent, {
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        }
      });

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

  const handleShowVenueOptions = (actionType) => {
    setVenueActionType(actionType);
    setShowVenueSelectionModal(true);
  };
  
  const handleSelectAPIVenues = () => {
    setShowVenueSelectionModal(false);
    setShowVenuePage(true);
  };
  
  const handleSelectManualVenue = () => {
    setShowVenueSelectionModal(false);
    setShowManualForm(true);
  };

  const handleDirectAPIVenues = () => {
    setVenueActionType('add');
    setShowVenuePage(true);
  };

  const handleDirectManualVenue = () => {
    setVenueActionType('add');
    setShowManualForm(true);
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

      {/* Venue Selection Modal - רק כאשר משנים מקום קיים */}
      {showVenueSelectionModal && (
        <div className="vendor-selection-modal">
          <div className="vendor-selection-modal-content">
            <h3>{t('venues.changeVenueOptions')}</h3>
            <div className="vendor-selection-options">
              <button
                className="select-venue-button"
                onClick={handleSelectAPIVenues}
              >
                {t('venues.searchAndFilterButton')}
              </button>
              <button
                className="add-manual-venue-button"
                onClick={handleSelectManualVenue}
              >
                {t('venues.addManuallyButton')}
              </button>
            </div>
            <button
              className="cancel-button"
              onClick={() => {
                setShowVenueSelectionModal(false);
                setVenueActionType(null);
              }}
            >
              {t('general.cancel')}
            </button>
          </div>
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
                className={venueErrors.name ? 'error' : ''}
                required
              />
              {venueErrors.name && (
                <div className="error-text">{venueErrors.name}</div>
              )}
            </div>
            <div className="form-group">
              <label htmlFor="address">{t('venues.venueDetails.address')}*</label>
              <input
                type="text"
                id="address"
                name="address"
                value={manualVenue.address}
                onChange={handleManualVenueChange}
                className={venueErrors.address ? 'error' : ''}
                required
              />
              {venueErrors.address && (
                <div className="error-text">{venueErrors.address}</div>
              )}
            </div>
            <div className="form-group">
              <label htmlFor="phone">{t('venues.venueDetails.phone')}</label>
              <input
                type="text"
                id="phone"
                name="phone"
                value={manualVenue.phone}
                onChange={handleManualVenueChange}
                className={venueErrors.phone ? 'error' : ''}
              />
              {venueErrors.phone && (
                <div className="error-text">{venueErrors.phone}</div>
              )}
            </div>
            <div className="form-group">
              <label htmlFor="website">{t('venues.venueDetails.website')}</label>
              <input
                type="text"
                id="website"
                name="website"
                value={manualVenue.website}
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
                onClick={() => {
                  setShowManualForm(false);
                  setVenueErrors({});
                  setVenueActionType(null);
                }}
              >
                {t('general.cancel')}
              </button>
            </div>
          </form>
        </div>
      ) : event.venues && event.venues.length > 0 ? (
        <div className="selected-venues">
          <h3>{t('venues.selectedVenue')}</h3>
          {/* מציג רק את המקום הראשון (כי אמור להיות רק אחד) */}
          <div className="venue-details-card">
            <h4>{event.venues[0].name}</h4>
            {event.venues[0].address && (
              <p><strong>{t('venues.venueDetails.address')}:</strong> {event.venues[0].address}</p>
            )}
            {event.venues[0].phone && (
              <p><strong>{t('venues.venueDetails.phone')}:</strong> {event.venues[0].phone}</p>
            )}
            {event.venues[0].website && (
              <p>
                <strong>{t('venues.venueDetails.website')}:</strong>{' '}
                <a 
                  href={event.venues[0].website.startsWith('http') ? event.venues[0].website : `https://${event.venues[0].website}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  {event.venues[0].website}
                </a>
              </p>
            )}
            
            <div className="venue-actions">
              <button 
                className="change-venue-button" 
                onClick={() => handleShowVenueOptions('change')}
              >
                {t('venues.changeVenue')}
              </button>
              <button 
                className="delete-venue-button" 
                onClick={handleDeleteVenue}
              >
                {t('venues.deleteVenue')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="no-venue-selected">
          <p>{t('venues.noVenueSelected')}</p>
          <div className="venue-selection-options">
            <button className="select-venue-button" onClick={handleDirectAPIVenues}>
              {t('venues.searchAndFilterButton')}
            </button>
            <button className="add-manual-venue-button" onClick={handleDirectManualVenue}>
              {t('venues.addManuallyButton')}
            </button>
          </div>
        </div>
      )}
    </FeaturePageTemplate>
  );
};

export default EventVenuePage;