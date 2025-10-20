import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../../../styles/RSVPPage.css';

const RSVPPage = () => {
  const { t } = useTranslation();
  const { eventId } = useParams();
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [guest, setGuest] = useState(null);
  const [eventInfo, setEventInfo] = useState(null);
  const [rsvpStatus, setRsvpStatus] = useState('');
  const [attendingCount, setAttendingCount] = useState(1);
  const [maleCount, setMaleCount] = useState(0);
  const [femaleCount, setFemaleCount] = useState(0);
  const [guestNotes, setGuestNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchEventInfo();
  }, [eventId]);

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

  const handlePhoneChange = (e) => {
    const formattedPhone = formatPhoneNumber(e.target.value);
    setPhone(formattedPhone);
  };

  const fetchEventInfo = async () => {
    try {
      const response = await fetch(`/api/rsvp/${eventId}/info`);
      if (response.ok) {
        const data = await response.json();
        setEventInfo(data);
      } else {
        setError(t('guests.rsvp.eventNotFound'));
      }
    } catch (err) {
      setError(t('errors.networkError'));
    }
  };

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    
    if (!phone.trim()) {
      setError(t('validation.phoneRequired'));
      return;
    }

    if (!/^05\d-\d{7}$/.test(phone)) {
      setError(t('validation.invalidPhoneFormat'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/rsvp/${eventId}/check-phone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ phone })
      });

      if (response.ok) {
        const data = await response.json();
        setGuest(data.guest);
        setRsvpStatus(data.guest.rsvpStatus);
        
        if (eventInfo && eventInfo.isSeparatedSeating) {
          setMaleCount(data.guest.maleCount || 0);
          setFemaleCount(data.guest.femaleCount || 0);
          setAttendingCount((data.guest.maleCount || 0) + (data.guest.femaleCount || 0));
        } else {
          setAttendingCount(data.guest.attendingCount || 1);
        }
        
        setGuestNotes(data.guest.guestNotes || '');
        setStep(2);
      } else {
        const errorData = await response.json();
        setError(errorData.message || t('guests.rsvp.phoneNotFound'));
      }
    } catch (err) {
      setError(t('errors.networkError'));
    } finally {
      setLoading(false);
    }
  };

  const handleRSVPSubmit = async (e) => {
    e.preventDefault();
    
    if (!rsvpStatus) {
      setError(t('guests.rsvp.statusRequired'));
      return;
    }

    if (eventInfo && eventInfo.isSeparatedSeating && rsvpStatus === 'confirmed') {
      if (maleCount === 0 && femaleCount === 0) {
        setError(t('guests.rsvp.atLeastOneRequired'));
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      const requestBody = {
        phone,
        rsvpStatus,
        guestNotes
      };

      if (eventInfo && eventInfo.isSeparatedSeating) {
        requestBody.maleCount = rsvpStatus === 'confirmed' ? maleCount : 0;
        requestBody.femaleCount = rsvpStatus === 'confirmed' ? femaleCount : 0;
        requestBody.attendingCount = rsvpStatus === 'confirmed' ? (maleCount + femaleCount) : 0;
      } else {
        requestBody.attendingCount = rsvpStatus === 'confirmed' ? attendingCount : 0;
      }

      const response = await fetch(`/api/rsvp/${eventId}/submit`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        setStep(3);
      } else {
        const errorData = await response.json();
        setError(errorData.message || t('guests.rsvp.updateFailed'));
      }
    } catch (err) {
      setError(t('errors.networkError'));
    } finally {
      setLoading(false);
    }
  };

  const formatEventDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (!eventInfo) {
    return (
      <div className="rsvp-page">
        <div className="rsvp-container">
          <div className="rsvp-loading">
            {t('common.loading')}
          </div>
        </div>
      </div>
    );
  }

  const isSeparatedSeating = eventInfo && eventInfo.isSeparatedSeating;

  return (
    <div className="rsvp-page">
      <div className="rsvp-container">
        <div className="rsvp-header">
          <h1 className="rsvp-title">{eventInfo.eventName}</h1>
          {eventInfo.eventDate && (
            <p className="rsvp-date">
              📅 {formatEventDate(eventInfo.eventDate)}
            </p>
          )}
          {eventInfo.eventLocation && (
            <p className="rsvp-location">
              📍 {eventInfo.eventLocation}
            </p>
          )}
          {isSeparatedSeating && (
            <p className="rsvp-separated-notice">
              {t('guests.rsvp.separatedSeatingNotice')}
            </p>
          )}
        </div>

        {error && (
          <div className="rsvp-error">
            {error}
          </div>
        )}

        {step === 1 && (
          <div className="rsvp-step">
            <h2>{t('guests.rsvp.enterPhone')}</h2>
            <p className="rsvp-description">
              {t('guests.rsvp.enterPhoneDescription')}
            </p>
            
            <form onSubmit={handlePhoneSubmit} className="rsvp-form">
              <div className="rsvp-form-group">
                <label htmlFor="phone">
                  {t('guests.form.phone')}
                </label>
                <input
                  type="tel"
                  id="phone"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="05X-XXXXXXX"
                  className="rsvp-form-input"
                  required
                />
              </div>

              <button
                type="submit"
                className="rsvp-submit-button"
                disabled={loading}
              >
                {loading ? t('common.loading') : t('guests.rsvp.continue')}
              </button>
            </form>
          </div>
        )}

        {step === 2 && guest && (
          <div className="rsvp-step">
            <h2>{t('guests.rsvp.welcomeBack', { name: guest.firstName })}</h2>
            <p className="rsvp-guest-info">
              {guest.firstName} {guest.lastName} - {phone}
            </p>
            
            <form onSubmit={handleRSVPSubmit} className="rsvp-form">
              <div className="rsvp-form-group">
                <label>{t('guests.rsvp.willYouAttend')}</label>
                <div className="rsvp-status-options">
                  <label className="rsvp-radio-option">
                    <input
                      type="radio"
                      name="rsvpStatus"
                      value="confirmed"
                      checked={rsvpStatus === 'confirmed'}
                      onChange={(e) => setRsvpStatus(e.target.value)}
                    />
                    <span className="rsvp-radio-label confirmed">
                      ✅ {t('guests.rsvp.yesAttending')}
                    </span>
                  </label>
                  
                  <label className="rsvp-radio-option">
                    <input
                      type="radio"
                      name="rsvpStatus"
                      value="declined"
                      checked={rsvpStatus === 'declined'}
                      onChange={(e) => setRsvpStatus(e.target.value)}
                    />
                    <span className="rsvp-radio-label declined">
                      ❌ {t('guests.rsvp.notAttending')}
                    </span>
                  </label>
                </div>
              </div>

              {rsvpStatus === 'confirmed' && (
                <>
                  {isSeparatedSeating ? (
                    <>
                      <div className="rsvp-form-group">
                        <label htmlFor="male-count">
                          {t('guests.rsvp.howManyMales')}
                        </label>
                        <div className="count-input-container">
                          <button
                            type="button"
                            className="count-button decrease"
                            onClick={() => {
                              const newCount = Math.max(0, maleCount - 1);
                              setMaleCount(newCount);
                              setAttendingCount(newCount + femaleCount);
                            }}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            id="male-count"
                            value={maleCount}
                            onChange={(e) => {
                              const value = parseInt(e.target.value);
                              if (value >= 0) {
                                setMaleCount(value);
                                setAttendingCount(value + femaleCount);
                              }
                            }}
                            min="0"
                            className="count-input"
                          />
                          <button
                            type="button"
                            className="count-button increase"
                            onClick={() => {
                              const newCount = maleCount + 1;
                              setMaleCount(newCount);
                              setAttendingCount(newCount + femaleCount);
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="rsvp-form-group">
                        <label htmlFor="female-count">
                          {t('guests.rsvp.howManyFemales')}
                        </label>
                        <div className="count-input-container">
                          <button
                            type="button"
                            className="count-button decrease"
                            onClick={() => {
                              const newCount = Math.max(0, femaleCount - 1);
                              setFemaleCount(newCount);
                              setAttendingCount(maleCount + newCount);
                            }}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            id="female-count"
                            value={femaleCount}
                            onChange={(e) => {
                              const value = parseInt(e.target.value);
                              if (value >= 0) {
                                setFemaleCount(value);
                                setAttendingCount(maleCount + value);
                              }
                            }}
                            min="0"
                            className="count-input"
                          />
                          <button
                            type="button"
                            className="count-button increase"
                            onClick={() => {
                              const newCount = femaleCount + 1;
                              setFemaleCount(newCount);
                              setAttendingCount(maleCount + newCount);
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="rsvp-form-group">
                        <div className="total-count-display">
                          {t('guests.rsvp.totalAttending')}: {attendingCount}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="rsvp-form-group">
                      <label htmlFor="attending-count">
                        {t('guests.rsvp.howManyAttending')}
                      </label>
                      <div className="count-input-container">
                        <button
                          type="button"
                          className="count-button decrease"
                          onClick={() => setAttendingCount(prev => prev > 1 ? prev - 1 : 1)}
                        >
                          −
                        </button>
                        <input
                          type="number"
                          id="attending-count"
                          value={attendingCount}
                          onChange={(e) => {
                            const value = parseInt(e.target.value);
                            if (value >= 1) {
                              setAttendingCount(value);
                            }
                          }}
                          min="1"
                          className="count-input"
                        />
                        <button
                          type="button"
                          className="count-button increase"
                          onClick={() => setAttendingCount(prev => prev + 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="rsvp-form-group">
                <label htmlFor="notes">
                  {t('guests.rsvp.additionalNotes')} ({t('guests.rsvp.optional')})
                </label>
                <textarea
                  id="notes"
                  value={guestNotes}
                  onChange={(e) => setGuestNotes(e.target.value)}
                  placeholder={t('guests.rsvp.notesPlaceholder')}
                  className="rsvp-form-textarea"
                  rows="3"
                  maxLength="500"
                />
                <small className="character-count">
                  {guestNotes.length}/500
                </small>
              </div>

              <div className="rsvp-form-actions">
                <button
                  type="submit"
                  className="rsvp-submit-button"
                  disabled={loading}
                >
                  {loading ? t('common.loading') : t('guests.rsvp.submitResponse')}
                </button>
                <button
                  type="button"
                  className="rsvp-back-button"
                  onClick={() => setStep(1)}
                >
                  {t('guests.rsvp.back')}
                </button>
              </div>
            </form>
          </div>
        )}

        {step === 3 && (
          <div className="rsvp-step rsvp-success">
            <div className="rsvp-success-icon">🎉</div>
            <h2>{t('guests.rsvp.thankYou')}</h2>
            <p className="rsvp-success-message">
              {rsvpStatus === 'confirmed' 
                ? (isSeparatedSeating 
                    ? t('guests.rsvp.confirmationSuccessSeparated', { 
                        name: guest?.firstName,
                        males: maleCount,
                        females: femaleCount
                      })
                    : t('guests.rsvp.confirmationSuccess', { 
                        name: guest?.firstName,
                        count: attendingCount 
                      })
                  )
                : t('guests.rsvp.declineSuccess', { name: guest?.firstName })
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RSVPPage;