import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../../../../styles/RSVPManualModal.css';

const RSVPManualModal = ({ isOpen, onClose, guest, onUpdateRSVP, getGroupDisplayName, isSeparatedSeating }) => {
  const { t } = useTranslation();
  const [rsvpStatus, setRsvpStatus] = useState('pending');
  const [attendingCount, setAttendingCount] = useState(1);
  const [maleCount, setMaleCount] = useState(0);
  const [femaleCount, setFemaleCount] = useState(0);
  const [guestNotes, setGuestNotes] = useState('');

  useEffect(() => {
    if (guest) {
      setRsvpStatus(guest.rsvpStatus || 'pending');
      
      if (isSeparatedSeating) {
        setMaleCount(guest.maleCount || 0);
        setFemaleCount(guest.femaleCount || 0);
        setAttendingCount((guest.maleCount || 0) + (guest.femaleCount || 0));
      } else {
        setAttendingCount(guest.attendingCount && guest.attendingCount > 0 ? guest.attendingCount : 1);
      }
      
      setGuestNotes(guest.guestNotes || '');
    }
  }, [guest, isSeparatedSeating]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!guest) return;

    const updatedData = {
      guestId: guest._id,
      rsvpStatus,
      guestNotes
    };

    if (isSeparatedSeating) {
      updatedData.maleCount = rsvpStatus === 'confirmed' ? Math.max(0, maleCount) : 0;
      updatedData.femaleCount = rsvpStatus === 'confirmed' ? Math.max(0, femaleCount) : 0;
      updatedData.attendingCount = rsvpStatus === 'confirmed' ? (maleCount + femaleCount) : 0;
    } else {
      updatedData.attendingCount = rsvpStatus === 'confirmed' ? Math.max(1, attendingCount) : 0;
    }

    onUpdateRSVP(updatedData);
  };

  const handleAttendingCountChange = (newCount) => {
    const validCount = Math.max(1, Math.min(10, newCount));
    setAttendingCount(validCount);
  };

  const handleMaleCountChange = (newCount) => {
    const validCount = Math.max(0, Math.min(10, newCount));
    setMaleCount(validCount);
    setAttendingCount(validCount + femaleCount);
  };

  const handleFemaleCountChange = (newCount) => {
    const validCount = Math.max(0, Math.min(10, newCount));
    setFemaleCount(validCount);
    setAttendingCount(maleCount + validCount);
  };

  if (!isOpen || !guest) return null;

  return (
    <div className="rsvp-modal-overlay" onClick={onClose}>
      <div className="rsvp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rsvp-modal-header">
          <h3>{t('guests.rsvp.editRSVP')}</h3>
          <button className="rsvp-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="rsvp-modal-content">
          <div className="guest-info">
            <h4>{guest.firstName} {guest.lastName}</h4>
            <p>{guest.phone}</p>
            <p>{t('guests.group')}: {getGroupDisplayName(guest)}</p>
          </div>

          <form onSubmit={handleSubmit} className="rsvp-form">
            <div className="rsvp-form-group">
              <label>{t('guests.rsvp.status')}</label>
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
                    ✅ {t('guests.rsvp.confirmed')}
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
                    ❌ {t('guests.rsvp.declined')}
                  </span>
                </label>

                <label className="rsvp-radio-option">
                  <input
                    type="radio"
                    name="rsvpStatus"
                    value="pending"
                    checked={rsvpStatus === 'pending'}
                    onChange={(e) => setRsvpStatus(e.target.value)}
                  />
                  <span className="rsvp-radio-label pending">
                    ⏳ {t('guests.rsvp.pending')}
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
                        {t('guests.rsvp.maleCount')}
                      </label>
                      <div className="count-input-container">
                        <button
                          type="button"
                          className="count-button decrease"
                          onClick={() => handleMaleCountChange(maleCount - 1)}
                          disabled={maleCount <= 0}
                        >
                          −
                        </button>
                        <input
                          type="number"
                          id="male-count"
                          value={maleCount}
                          onChange={(e) => {
                            const value = parseInt(e.target.value);
                            if (!isNaN(value) && value >= 0) {
                              handleMaleCountChange(value);
                            }
                          }}
                          min="0"
                          max="10"
                          className="count-input"
                        />
                        <button
                          type="button"
                          className="count-button increase"
                          onClick={() => handleMaleCountChange(maleCount + 1)}
                          disabled={maleCount >= 10}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="rsvp-form-group">
                      <label htmlFor="female-count">
                        {t('guests.rsvp.femaleCount')}
                      </label>
                      <div className="count-input-container">
                        <button
                          type="button"
                          className="count-button decrease"
                          onClick={() => handleFemaleCountChange(femaleCount - 1)}
                          disabled={femaleCount <= 0}
                        >
                          −
                        </button>
                        <input
                          type="number"
                          id="female-count"
                          value={femaleCount}
                          onChange={(e) => {
                            const value = parseInt(e.target.value);
                            if (!isNaN(value) && value >= 0) {
                              handleFemaleCountChange(value);
                            }
                          }}
                          min="0"
                          max="10"
                          className="count-input"
                        />
                        <button
                          type="button"
                          className="count-button increase"
                          onClick={() => handleFemaleCountChange(femaleCount + 1)}
                          disabled={femaleCount >= 10}
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
                      {t('guests.rsvp.attendingCount')}
                    </label>
                    <div className="count-input-container">
                      <button
                        type="button"
                        className="count-button decrease"
                        onClick={() => handleAttendingCountChange(attendingCount - 1)}
                        disabled={attendingCount <= 1}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        id="attending-count"
                        value={attendingCount}
                        onChange={(e) => {
                          const value = parseInt(e.target.value);
                          if (!isNaN(value) && value >= 1) {
                            handleAttendingCountChange(value);
                          }
                        }}
                        min="1"
                        max="10"
                        className="count-input"
                      />
                      <button
                        type="button"
                        className="count-button increase"
                        onClick={() => handleAttendingCountChange(attendingCount + 1)}
                        disabled={attendingCount >= 10}
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="rsvp-form-group">
              <label htmlFor="guest-notes">
                {t('guests.rsvp.notes')} ({t('guests.rsvp.optional')})
              </label>
              <textarea
                id="guest-notes"
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
                type="button"
                className="rsvp-cancel-button"
                onClick={onClose}
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                className="rsvp-submit-button"
              >
                {t('guests.rsvp.updateRSVP')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RSVPManualModal;