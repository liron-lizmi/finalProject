// client/src/pages/Events/Features/PublicRidesPage.js
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useModal } from '../../../hooks/useModal';
import '../../../styles/PublicRidesPage.css';

const PublicRidesPage = () => {
  const { t, i18n} = useTranslation();
  const { eventId } = useParams();
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [guest, setGuest] = useState(null);
  const [eventInfo, setEventInfo] = useState(null);
  const [rideInfo, setRideInfo] = useState({
    status: 'not_set',
    address: '',
    availableSeats: 1,
    requiredSeats: 1,
    departureTime: ''
  });
  const [otherGuests, setOtherGuests] = useState([]);
  const [suggestedRides, setSuggestedRides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('my_info');
  const [pendingRideInfo, setPendingRideInfo] = useState(null);
  const [contactHistory, setContactHistory] = useState([]);
  const [hasConfirmedRSVP, setHasConfirmedRSVP] = useState(true);
  const [currentStatus, setCurrentStatus] = useState('not_set');

  const { showSuccessModal, Modal } = useModal();

  useEffect(() => {
    fetchEventInfo();
  }, [eventId]);

  // Refresh other guests data when switching tabs
  useEffect(() => {
    if (step === 2 && (activeTab === 'offering' || activeTab === 'seeking')) {
        fetchOtherGuests();
    }
  }, [activeTab, step]);

  // Fetch suggested rides when user info is updated
  useEffect(() => {
    if (step === 2 && guest && rideInfo.status === 'seeking' && rideInfo.address) {
      fetchSuggestedRides();
    }
  }, [step, guest, rideInfo.status, rideInfo.address]);

  // Formats phone number input
  const formatPhoneNumber = (value) => {
    const cleanedValue = value.replace(/\D/g, '');
    
    if (cleanedValue.startsWith('05') && cleanedValue.length <= 10) {
      if (cleanedValue.length <= 3) {
        return cleanedValue;
      } else {
        return `${cleanedValue.slice(0, 3)}-${cleanedValue.slice(3)}`;
      }
    }
    
    if (cleanedValue.length <= 10) {
      if (cleanedValue.length <= 3) {
        return cleanedValue;
      } else {
        return `${cleanedValue.slice(0, 3)}-${cleanedValue.slice(3)}`;
      }
    }
    
    return value.slice(0, -1);
  };

  // Handles phone number input change with formatting
  const handlePhoneChange = (e) => {
    const formattedPhone = formatPhoneNumber(e.target.value);
    setPhone(formattedPhone);
  };

  // Fetches event information from the API
  const fetchEventInfo = async () => {
    try {
      const response = await fetch(`/api/rides/${eventId}/info`);
      if (response.ok) {
        const data = await response.json();
        setEventInfo(data);
      } else {
        setError(t('events.features.rides.eventNotFound'));
      }
    } catch (err) {
      setError(t('events.features.rides.errors.networkError'));
    }
  };


  // Handles phone number submission and verification
  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    
    if (!phone.trim()) {
      setError(t('events.features.rides.validation.phoneRequired'));
      return;
    }

    if (!/^05\d-\d{7}$/.test(phone)) {
      setError(t('events.features.rides.validation.invalidPhoneFormat'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/rides/${eventId}/check-phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });

      if (response.ok) {
        const data = await response.json();
        setGuest(data.guest);
        
        // Check if guest has confirmed RSVP
        const isConfirmed = data.guest.rsvpStatus === 'confirmed';
        setHasConfirmedRSVP(isConfirmed);
        
        // Set ride info with default values and preserve existing data
        const existingRideInfo = data.guest.rideInfo || {};
        const status = existingRideInfo.status || 'not_set';
        setRideInfo({
        status: status,
        address: existingRideInfo.address || '',
        availableSeats: existingRideInfo.availableSeats || 1,
        requiredSeats: existingRideInfo.requiredSeats || 1,
        departureTime: existingRideInfo.departureTime || ''
        });

        // Set current status for tab display
        setCurrentStatus(status);
        
        // Store contact history
        if (existingRideInfo.contactHistory) {
            setContactHistory(existingRideInfo.contactHistory);
        }
        
        setStep(2);
        if (isConfirmed) {
            await fetchOtherGuests();
        }
    }  else {
      const errorData = await response.json();
      setError(t('events.features.rides.phoneNotFound'));
      }
    } catch (err) {
      setError(t('events.features.rides.errors.networkError'));
    } finally {
      setLoading(false);
    }
  };

// Fetches other guests ride information
const fetchOtherGuests = async () => {
  try {
    // Add cache buster to ensure fresh data
    const timestamp = new Date().getTime();
    const response = await fetch(`/api/rides/${eventId}/guests?t=${timestamp}`, {
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      
      // Filter out current user's phone number from the list
      const filteredGuests = data.filter(guest => 
        guest && 
        guest.phone && 
        guest.phone !== phone &&
        guest.rideInfo &&
        guest.rideInfo.status &&
        (guest.rideInfo.status === 'offering' || guest.rideInfo.status === 'seeking') &&
        guest.rideInfo.address &&
        guest.rideInfo.address.trim() !== ''
      );
      
      setOtherGuests(filteredGuests);
    } else {
      setOtherGuests([]);
    }
  } catch (err) {
    setOtherGuests([]);
  }
};


 // Fetches suggested rides based on location proximity
 const fetchSuggestedRides = async () => {
  try {
    const response = await fetch(`/api/rides/${eventId}/suggestions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        phone,
        userAddress: rideInfo.address 
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      setSuggestedRides(data.suggestions || []);
    } else {
      setSuggestedRides([]);
    }
  } catch (err) {
    setSuggestedRides([]);
  }
};


  // Validates ride information form based on status
  const isFormValid = () => {
    if (!rideInfo.status || rideInfo.status === 'not_set' || rideInfo.status === '') {
      return false;
    }

    if (rideInfo.status === 'offering' || rideInfo.status === 'seeking') {
      if (!rideInfo.address || rideInfo.address.trim() === '') {
        return false;
      }

      if (rideInfo.status === 'offering') {
        if (!rideInfo.availableSeats || rideInfo.availableSeats < 1) {
          return false;
        }
      }

      if (rideInfo.status === 'seeking') {
        if (!rideInfo.requiredSeats || rideInfo.requiredSeats < 1) {
          return false;
        }
      }
    }

    return true;
  };

// Submits ride information update to the API
const handleRideInfoSubmit = async (e) => {
  e.preventDefault();
  
  if (!isFormValid()) {
    setError(t('events.features.rides.validation.fillRequired'));
    return;
  }
  
  setLoading(true);
  setError('');

  try {
    const response = await fetch(`/api/rides/${eventId}/update`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, rideInfo })
    });

    if (response.ok) {
      const result = await response.json();
      
      if (result.guest) {
          setGuest(result.guest);
      }
      
      await fetchOtherGuests();
      
      if (rideInfo.status === 'seeking' && rideInfo.address) {
        await fetchSuggestedRides();
      }
      
      setCurrentStatus(rideInfo.status);
      if (rideInfo.status === 'seeking') {
        setActiveTab('offering');
      } else if (rideInfo.status === 'offering') {
        setActiveTab('seeking');
      }
      
      showSuccessModal(t('events.features.rides.updateSuccess'));
      } else {
      const errorData = await response.json();
      setError(errorData.message || t('events.features.rides.errors.updateFailed'));
    }
  } catch (err) {
    setError(t('events.features.rides.errors.networkError'));
  } finally {
    setLoading(false);
  }
};

 // Records contact action and updates status
  const handleContactAction = async (contactedGuestId, action) => {
    try {
      const response = await fetch(`/api/rides/${eventId}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          contactedGuestId,
          action
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.contactHistory) {
            setContactHistory(data.contactHistory);
        }
        await fetchOtherGuests();
        
        if (rideInfo.status === 'seeking' && rideInfo.address) {
          await fetchSuggestedRides();
        }
      }
    } catch (err) {
      console.error('Error recording contact:', err);
    }
  };


  // Cancels an arranged ride
  const handleCancelRide = async (contactedGuestId) => {
    try {
      const response = await fetch(`/api/rides/${eventId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          contactedGuestId
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.contactHistory) {
            setContactHistory(data.contactHistory);
        }
        await fetchOtherGuests();
        
        if (rideInfo.status === 'seeking' && rideInfo.address) {
          await fetchSuggestedRides();
        }
        
      }
    } catch (err) {
      console.error('Error cancelling ride:', err);
    }
  };


  // Gets contact status for a specific guest
    const getContactStatus = (guestId) => {
      const contact = contactHistory.find(c => c.contactedGuestId === guestId);
      return contact ? contact.action : null;
    };

  // Gets display status based on contact action
  const getContactStatusText = (status) => {
    switch (status) {
      case 'arranged_ride':
        return t('events.features.rides.status.taken');
      case 'not_relevant':
        return t('events.features.rides.status.not_relevant');
      case 'no_response':
        return t('events.features.rides.status.in_process');
      default:
        return null;
    }
  };

  // Formats event date to Hebrew locale
  const formatEventDate = (dateString) => {
  if (!dateString) return '';
    const date = new Date(dateString);
    const locale = i18n.language === 'he' ? 'he-IL' : 'en-US';
    return date.toLocaleDateString(locale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Filters guests offering rides
  const getOfferingGuests = () => {
    if (!Array.isArray(otherGuests)) return [];
    return otherGuests.filter(g => {
      return g && 
             g.rideInfo && 
             g.rideInfo.status === 'offering' &&
             g.firstName && 
             g.lastName;
    });
  };

  // Filters guests seeking rides
  const getSeekingGuests = () => {
    if (!Array.isArray(otherGuests)) return [];
    return otherGuests.filter(g => {
      return g && 
             g.rideInfo && 
             g.rideInfo.status === 'seeking' &&
             g.firstName && 
             g.lastName;
    });
  };

  if (!eventInfo) {
    return (
      <div className="public-rides-page">
        <div className="rides-container">
        </div>
      </div>
    );
  }

  return (
    <div className="public-rides-page" dir={i18n.language === 'he' ? 'rtl' : 'ltr'}>
      <div className="rides-container">
        <div className="rides-header">
          <h1 className="event-title">{eventInfo.eventName}</h1>
          {eventInfo.eventDate && (
            <p className="event-date">
              {formatEventDate(eventInfo.eventDate)}
            </p>
          )}
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {step === 1 && (
          <div className="phone-step">
            <p className="step-description">
              {t('events.features.rides.enterPhoneDescription')}
            </p>
            
            <form onSubmit={handlePhoneSubmit} className="phone-form">
              <div className="form-group">
                <input
                  type="tel"
                  id="phone"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="05X-XXXXXXX"
                  className="form-input"
                  required
                />
              </div>

              <button
                type="submit"
                className="submit-button"
                disabled={loading}
              >
                {loading ? t('events.features.rides.loading') : t('events.features.rides.continue')}
              </button>
            </form>
          </div>
        )}

        {step === 2 && guest && (
          <div className="rides-step">
            <div className="guest-welcome">
              <h3>{t('events.features.rides.welcome', { name: guest.firstName })}</h3>
              <p className="guest-info">
                {guest.firstName} {guest.lastName} - {phone}
              </p>
            </div>

            <nav className="rides-tabs">
                <button
                    className={`tab-button ${activeTab === 'my_info' ? 'active' : ''}`}
                    onClick={() => setActiveTab('my_info')}
                >
                    {t('events.features.rides.tabs.myInfo')}
                </button>
                {hasConfirmedRSVP && currentStatus === 'seeking' && (
                    <button
                    className={`tab-button ${activeTab === 'offering' ? 'active' : ''}`}
                    onClick={() => setActiveTab('offering')}
                    >
                    {t('events.features.rides.tabs.offering')}
                    </button>
                )}
                {hasConfirmedRSVP && currentStatus === 'offering' && (
                    <button
                    className={`tab-button ${activeTab === 'seeking' ? 'active' : ''}`}
                    onClick={() => setActiveTab('seeking')}
                    >
                    {t('events.features.rides.tabs.seeking')}
                    </button>
                )}
            </nav>

            <div className="tab-content">
              {activeTab === 'my_info' && (
                <div className="my-info-tab">
                  {!hasConfirmedRSVP && (
                    <div className="rsvp-warning">
                        <div className="warning-content">
                        <span className="warning-text">
                            {t('events.features.rides.rsvpWarning')}
                        </span>
                        </div>
                    </div>
                    )}
                  <form onSubmit={handleRideInfoSubmit} className="ride-form">
                    <div className="form-group">
                      <label>{t('events.features.rides.form.status')} *</label>
                      <div className="radio-options">
                        <label className="radio-option">
                          <input
                            type="radio"
                            name="status"
                            value="offering"
                            checked={rideInfo.status === 'offering'}
                            onChange={(e) => setRideInfo({...rideInfo, status: e.target.value})}
                            disabled={!hasConfirmedRSVP}
                            required
                          />
                          <span className="radio-label offering">
                            {t('events.features.rides.status.offering')}
                          </span>
                        </label>
                        
                        <label className="radio-option">
                          <input
                            type="radio"
                            name="status"
                            value="seeking"
                            checked={rideInfo.status === 'seeking'}
                            onChange={(e) => setRideInfo({...rideInfo, status: e.target.value})}
                            disabled={!hasConfirmedRSVP}
                            required
                          />
                          <span className="radio-label seeking">
                            {t('events.features.rides.status.seeking')}
                          </span>
                        </label>
                      </div>
                    </div>

                    {(rideInfo.status === 'offering' || rideInfo.status === 'seeking') && (
                      <>
                        <div className="form-group">
                          <label htmlFor="address">
                            {t('events.features.rides.form.address')} *
                          </label>
                          <input
                            type="text"
                            id="address"
                            value={rideInfo.address || ''}
                            onChange={(e) => setRideInfo({...rideInfo, address: e.target.value})}
                            placeholder={t('events.features.rides.form.addressPlaceholder')}
                            className="form-input"
                            required
                          />
                        </div>

                        {rideInfo.status === 'offering' && (
                          <div className="form-group">
                            <label htmlFor="availableSeats">
                              {t('events.features.rides.form.availableSeats')} *
                            </label>
                            <select
                              id="availableSeats"
                              value={rideInfo.availableSeats || 1}
                              onChange={(e) => setRideInfo({...rideInfo, availableSeats: parseInt(e.target.value)})}
                              className="form-select"
                              required
                            >
                              {[1,2,3,4,5,6,7,8].map(num => (
                                <option key={num} value={num}>{num}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {rideInfo.status === 'seeking' && (
                          <div className="form-group">
                            <label htmlFor="requiredSeats">
                              {t('events.features.rides.form.requiredSeats')} *
                            </label>
                            <select
                              id="requiredSeats"
                              value={rideInfo.requiredSeats || 1}
                              onChange={(e) => setRideInfo({...rideInfo, requiredSeats: parseInt(e.target.value)})}
                              className="form-select"
                              required
                            >
                              {[1,2,3,4,5,6,7,8].map(num => (
                                <option key={num} value={num}>{num}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div className="form-group">
                          <label htmlFor="departureTime">
                            {t('events.features.rides.form.departureTime')}
                          </label>
                          <input
                            type="text"
                            id="departureTime"
                            value={rideInfo.departureTime || ''}
                            onChange={(e) => setRideInfo({...rideInfo, departureTime: e.target.value})}
                            placeholder={t('events.features.rides.form.departureTimePlaceholder')}
                            className="form-input"
                          />
                        </div>
                      </>
                    )}

                    <button
                      type="submit"
                      className="submit-button"
                      disabled={loading || !isFormValid()}
                    >
                      {loading ? t('events.features.rides.loading') : t('events.features.rides.updateInfo')}
                    </button>
                  </form>
                </div>
              )}

              {activeTab === 'offering' && (
                <div className="offering-tab">
                  <h4>{t('events.features.rides.availableRides')}</h4>
                  
                  {/* Suggested rides section for seekers */}
                  {rideInfo.status === 'seeking' && suggestedRides.length > 0 && (
                    <div className="suggested-rides-section">
                      <h5 className="suggested-rides-title">{t('events.features.rides.suggestedRides')}</h5>
                      <div className="guests-list">
                        {suggestedRides.map(otherGuest => {
                          const contactStatus = getContactStatus(otherGuest._id);
                          const statusText = getContactStatusText(contactStatus);
                          const isArranged = contactStatus === 'arranged_ride';
                          
                          return (
                            <div key={otherGuest._id} className="guest-item offering suggested">
                              <div className="guest-info">
                                <h5 className="guest-name">{otherGuest.firstName} {otherGuest.lastName}</h5>
                                <div className="guest-details">
                                  {otherGuest.rideInfo && otherGuest.rideInfo.address && (
                                    <p><strong>{t('events.features.rides.form.address')}:</strong> {otherGuest.rideInfo.address}</p>
                                  )}
                                  {otherGuest.rideInfo && otherGuest.rideInfo.availableSeats && (
                                    <p><strong>{t('events.features.rides.form.availableSeats')}:</strong> {otherGuest.rideInfo.availableSeats}</p>
                                  )}
                                  {otherGuest.rideInfo && otherGuest.rideInfo.departureTime && (
                                    <p><strong>{t('events.features.rides.form.departureTime')}:</strong> {otherGuest.rideInfo.departureTime}</p>
                                  )}
                                  {otherGuest.distance && (
                                    <p className="distance-info"><strong>{t('events.features.rides.distance')}:</strong> {otherGuest.distance} {t('events.features.rides.km')}</p>
                                  )}
                                </div>
                                <div className="contact-info">
                                  <strong>{t('events.features.rides.contactInfo')}</strong> {otherGuest.phone || t('events.features.rides.notAvailable')}
                                </div>
                                {statusText && (
                                  <div className="status-display">
                                    <strong>{t('events.features.rides.status.label')}:</strong> {statusText}
                                  </div>
                                )}
                              </div>
                              <div className="contact-actions">
                                <button
                                  className="contact-action arranged"
                                  onClick={() => handleContactAction(otherGuest._id, 'arranged_ride')}
                                  disabled={isArranged}
                                >
                                  {t('events.features.rides.actions.arrangedRide')}
                                </button>
                                <button
                                  className="contact-action not-relevant"
                                  onClick={() => handleContactAction(otherGuest._id, 'not_relevant')}
                                  disabled={isArranged}
                                >
                                  {t('events.features.rides.actions.notRelevant')}
                                </button>
                                <button
                                  className="contact-action no-response"
                                  onClick={() => handleContactAction(otherGuest._id, 'no_response')}
                                  disabled={isArranged}
                                >
                                  {t('events.features.rides.actions.noResponse')}
                                </button>
                                {isArranged && (
                                  <button
                                    className="contact-action cancel-ride"
                                    onClick={() => handleCancelRide(otherGuest._id)}
                                  >
                                    {t('events.features.rides.actions.cancelRide')}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* All offering rides */}
                  <div className="all-rides-section">
                    {rideInfo.status === 'seeking' && suggestedRides.length > 0 && (
                      <h5 className="all-rides-title">{t('events.features.rides.allAvailableRides')}</h5>
                    )}
                    <div className="guests-list">
                      {getOfferingGuests().length === 0 ? (
                        <p className="no-guests">{t('events.features.rides.noOffering')}</p>
                      ) : (
                        getOfferingGuests().map(otherGuest => {
                          const contactStatus = getContactStatus(otherGuest._id);
                          const statusText = getContactStatusText(contactStatus);
                          const isArranged = contactStatus === 'arranged_ride';
                          const isSuggested = suggestedRides.some(sg => sg._id === otherGuest._id);
                          
                          return (
                            <div key={otherGuest._id} className={`guest-item offering ${isSuggested ? 'already-suggested' : ''}`}>
                              <div className="guest-info">
                                <h5 className="guest-name">{otherGuest.firstName} {otherGuest.lastName}</h5>
                                <div className="guest-details">
                                  {otherGuest.rideInfo && otherGuest.rideInfo.address && (
                                    <p><strong>{t('events.features.rides.form.address')}:</strong> {otherGuest.rideInfo.address}</p>
                                  )}
                                  {otherGuest.rideInfo && otherGuest.rideInfo.availableSeats && (
                                    <p><strong>{t('events.features.rides.form.availableSeats')}:</strong> {otherGuest.rideInfo.availableSeats}</p>
                                  )}
                                  {otherGuest.rideInfo && otherGuest.rideInfo.departureTime && (
                                    <p><strong>{t('events.features.rides.form.departureTime')}:</strong> {otherGuest.rideInfo.departureTime}</p>
                                  )}
                                </div>
                                <div className="contact-info">
                                  <strong>{t('events.features.rides.contactInfo')}</strong> {otherGuest.phone || t('events.features.rides.notAvailable')}
                                </div>
                                {statusText && (
                                  <div className="status-display">
                                    <strong>{t('events.features.rides.status.label')}:</strong> {statusText}
                                  </div>
                                )}
                              </div>
                              <div className="contact-actions">
                                <button
                                  className="contact-action arranged"
                                  onClick={() => handleContactAction(otherGuest._id, 'arranged_ride')}
                                  disabled={isArranged}
                                >
                                  {t('events.features.rides.actions.arrangedRide')}
                                </button>
                                <button
                                  className="contact-action not-relevant"
                                  onClick={() => handleContactAction(otherGuest._id, 'not_relevant')}
                                  disabled={isArranged}
                                >
                                  {t('events.features.rides.actions.notRelevant')}
                                </button>
                                <button
                                  className="contact-action no-response"
                                  onClick={() => handleContactAction(otherGuest._id, 'no_response')}
                                  disabled={isArranged}
                                >
                                  {t('events.features.rides.actions.noResponse')}
                                </button>
                                {isArranged && (
                                  <button
                                    className="contact-action cancel-ride"
                                    onClick={() => handleCancelRide(otherGuest._id)}
                                  >
                                    {t('events.features.rides.actions.cancelRide')}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'seeking' && (
                <div className="seeking-tab">
                  <h4>{t('events.features.rides.seekingRides')}</h4>
                  <div className="guests-list">
                    {getSeekingGuests().length === 0 ? (
                      <p className="no-guests">{t('events.features.rides.noSeeking')}</p>
                    ) : (
                      getSeekingGuests().map(otherGuest => {
                        return (
                          <div key={otherGuest._id} className="guest-item seeking">
                            <div className="guest-info">
                              <h5 className="guest-name">{otherGuest.firstName} {otherGuest.lastName}</h5>
                              <div className="guest-details">
                                {otherGuest.rideInfo && otherGuest.rideInfo.address && (
                                  <p><strong>{t('events.features.rides.form.address')}:</strong> {otherGuest.rideInfo.address}</p>
                                )}
                                {otherGuest.rideInfo && otherGuest.rideInfo.requiredSeats && (
                                  <p><strong>{t('events.features.rides.form.requiredSeats')}:</strong> {otherGuest.rideInfo.requiredSeats}</p>
                                )}
                                {otherGuest.rideInfo && otherGuest.rideInfo.departureTime && (
                                  <p><strong>{t('events.features.rides.form.departureTime')}:</strong> {otherGuest.rideInfo.departureTime}</p>
                                )}
                              </div>
                              <div className="contact-info">
                                <strong>{t('events.features.rides.contactInfo')}</strong> {otherGuest.phone || t('events.features.rides.notAvailable')}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {Modal}
      </div>
  );
};

export default PublicRidesPage;
